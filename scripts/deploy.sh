#!/usr/bin/env bash
# Deploy an owner-created vX.Y.Z tag to the Storagi user service. See docs/user-service.md.
# Usage, from a clean checkout of main: scripts/deploy.sh vX.Y.Z
# Exit 0 deployed, 1 refused or failed before cutover (production untouched),
# 2 cutover failed and the previous release is back, 3 MANUAL RECOVERY REQUIRED.
set -euo pipefail

root=$HOME/.local/lib/storagi
env_file=$HOME/.config/storagi/environment
unit=$HOME/.config/systemd/user/storagi-user.service
service=storagi-user.service

die() { echo "deploy: $*" >&2; exit 1; }
wait_for() { local i; for ((i = 0; i < $1; i++)); do "${@:2}" && return; sleep 1; done; return 1; }
stopped() { [[ $(systemctl --user is-active "$service") =~ ^(inactive|failed)$ && -z $(ss -Htln "sport = :$port") ]]; }
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$port$1"; }
healthy() { # $1: physical release dir the service must run from
  local pid
  [[ $(code /) == 200 && $(code /api/session) == 401 ]] &&
    pid=$(systemctl --user show -p MainPID --value "$service") && [[ $pid != 0 ]] &&
    [[ $(readlink -f "/proc/$pid/cwd") == "$1"/* ]]
}

# Roll back on any failure or HUP/INT/TERM after the stop; other failures exit 1.
phase=
on_exit() {
  local status=$?
  case $phase in
    build) chmod -R u+w "$release" && rm -rf "$release"; echo "deploy: build failed; removed releases/$name, production untouched" >&2; exit 1 ;;
    cutover) rollback ;;
    live) ;;
    *) ((status == 0)) || exit 1 ;;
  esac
}
rollback() {
  trap '' HUP INT TERM
  set +e
  echo "deploy: cutover failed; rolling back to $prev_target" >&2
  if systemctl --user stop "$service" && wait_for 60 stopped; then
    ln -sfn "$prev_target" "$root/current.next"
    mv -T "$root/current.next" "$root/current"
    install -m 600 "$backup/storagi-user.service" "$unit"
    systemctl --user daemon-reload
    systemctl --user start "$service"
    if wait_for 90 healthy "$prev"; then
      echo "deploy: rolled back to $prev_target; database backup (not restored) in $backup" >&2
      exit 2
    fi
  fi
  echo "deploy: MANUAL RECOVERY REQUIRED: $service is not healthy on $prev_target." >&2
  echo "deploy: old unit and database backup (not restored) in $backup; never run two app processes on one DATA_DIR." >&2
  exit 3
}
trap on_exit EXIT
trap 'exit 129' HUP; trap 'exit 130' INT; trap 'exit 143' TERM

# --- Refusal gates: nothing below changes the runtime until they all pass.
[[ $# -eq 1 && $1 =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "usage: scripts/deploy.sh vX.Y.Z"
tag=$1
repo=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
[[ -z $(git -C "$repo" status --porcelain --untracked-files=no) ]] || die "checkout has tracked changes"
git -C "$repo" fetch --quiet origin --tags
[[ $(git -C "$repo" rev-parse HEAD) == $(git -C "$repo" rev-parse origin/main) ]] || die "checkout HEAD is not origin/main"
commit=$(git -C "$repo" rev-parse --verify --quiet "refs/tags/$tag^{commit}") || die "tag $tag not found"
git -C "$repo" merge-base --is-ancestor "$commit" origin/main || die "tag $tag is not on origin/main"
# Only owner-pushed tags ship: a tag made in this checkout alone is refused.
[[ $(git -C "$repo" ls-remote origin "refs/tags/$tag" "refs/tags/$tag^{}" | tail -n 1 | cut -f1) == "$commit" ]] ||
  die "tag $tag is not pushed to origin"

[[ -d $root/releases ]] || die "no runtime at $root; first installation is manual (docs/user-service.md)"
exec 9>"$root/.deploy.lock"
flock -n 9 || die "another deploy is running"
prev=$(readlink -e "$root/current") && [[ ${prev%/*} == "$(readlink -e "$root/releases")" ]] ||
  die "$root/current must point into releases/; first installation is manual"
prev_target=$(readlink "$root/current")
[[ -f $unit ]] || die "no installed unit at $unit"
[[ -f $env_file && $(stat -c %a "$env_file") == 600 ]] || die "environment $env_file missing or not mode 600"
# Plain-text reads of two keys only: never source the file or print other values.
port=$(sed -n 's/^PORT=//p' "$env_file" | tail -n 1)
port=${port:-8787}
data_dir=$(sed -n 's/^DATA_DIR=//p' "$env_file" | tail -n 1)
[[ $port =~ ^[0-9]+$ ]] || die "PORT in the environment is not a number"
[[ -f $data_dir/storagi.sqlite ]] || die "no storagi.sqlite in DATA_DIR from the environment"
[[ -z $(ss -Htn state established "sport = :$port") ]] ||
  die "open connections to 127.0.0.1:$port; wait for transfers to finish (idle keep-alives close within minutes)"
built_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
name=$tag-$(git -C "$repo" rev-parse --short "$commit")-${built_at//[-:]/}
release=$root/releases/$name
backup=$root/backups/$name
[[ ! -e $release && ! -e $backup ]] || die "release $name already exists"

# --- Build in a fresh release; production stays untouched until cutover.
echo "deploy: building $tag ($commit) in releases/$name"
mkdir -m 700 "$release"
phase=build
git -C "$repo" archive "$commit" | tar -x -C "$release"
(cd "$release" && npm run setup && npm run check)
(cd "$release/server" && npm prune --omit=dev)
rm -rf "$release/web/node_modules"
# The node the unit runs must load the native SQLite binding.
node=$(sed -n 's/^ExecStart=\([^ ]*\) .*/\1/p' "$release/deploy/storagi-user.service")
(cd "$release/server" && "$node" -e "new (require('better-sqlite3'))(':memory:').prepare('select 1').get()")
cat >"$release/BUILD_MANIFEST" <<EOF
TAG=$tag
COMMIT=$commit
BUILT_AT=$built_at
DEPLOYED_BY=scripts/deploy.sh
NODE=$("$node" --version)
CONTENT_SHA256=$("$release/scripts/verify-release.sh" --print-hash "$release")
EOF
chmod -R a-w "$release"
"$release/scripts/verify-release.sh"
release=$(readlink -e "$release")
install -d -m 700 "$root/backups" "$backup"
install -m 600 "$unit" "$backup/storagi-user.service"

# --- Cutover with the service stopped.
echo "deploy: stopping $service"
phase=cutover
if ! systemctl --user stop "$service" || ! wait_for 60 stopped; then
  phase=
  systemctl --user start "$service" || true
  die "could not stop $service; started it again, nothing changed"
fi
for f in "$data_dir"/storagi.sqlite{,-wal,-shm}; do
  [[ -e $f ]] || continue
  install -m 600 "$f" "$backup/"
  cmp -s "$f" "$backup/${f##*/}" || die "database backup of ${f##*/} does not match"
done
install -m 600 "$release/deploy/storagi-user.service" "$unit"
systemctl --user daemon-reload
ln -sfn "releases/$name" "$root/current.next"
mv -T "$root/current.next" "$root/current"
systemctl --user start "$service"
wait_for 90 healthy "$release" || die "new release is not healthy"
phase=live
set +e

# --- Keep current, previous and the 3 newest releases; the 3 newest backups.
older() { find "$1" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' | sort -rn | tail -n +4 | cut -d' ' -f2-; }
older "$root/releases" | while read -r old; do
  [[ $old == "$name" || $old == "${prev##*/}" ]] && continue
  chmod -R u+w "$root/releases/$old" && rm -rf "${root:?}/releases/$old"
done
older "$root/backups" | while read -r old; do rm -rf "${root:?}/backups/$old"; done
echo "deploy: $tag live as releases/$name (previous ${prev##*/}); database backup in backups/$name"
