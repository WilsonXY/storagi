#!/usr/bin/env bash
# Build an owner-created vX.Y.Z tag and promote it to the Storagi system service. See docs/system-service.md.
# Usage, from a clean checkout of main: scripts/deploy.sh vX.Y.Z
# Runs as the caller, without root: it builds and stamps the release in a private staging dir,
# then hands it to sudo /usr/local/sbin/storagi-promote (scripts/storagi-promote) for the cutover.
# Exit codes are the helper's: 0 deployed, 1 refused or failed before cutover (production
# untouched), 2 cutover failed and the previous release is back, 3 MANUAL RECOVERY REQUIRED,
# 75 nothing done, try again later (origin unreachable, main moved on, transfers open, deploy running).
set -euo pipefail
# Any failing build step is 1, never a status the helper's codes give a meaning to.
trap 'exit 1' ERR

die() { echo "deploy: $*" >&2; exit 1; }
later() { echo "deploy: $*" >&2; exit 75; }

# --- Refusal gates: nothing is built until they all pass.
[[ $# -eq 1 && $1 =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "usage: scripts/deploy.sh vX.Y.Z"
tag=$1
repo=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
status=$(git -C "$repo" status --porcelain --untracked-files=no) || die "git status failed in the checkout"
[[ -z $status ]] || die "checkout has tracked changes"
git -C "$repo" fetch --quiet origin --tags || later "could not fetch from origin"
[[ $(git -C "$repo" rev-parse HEAD) == $(git -C "$repo" rev-parse origin/main) ]] || later "checkout HEAD is not origin/main"
commit=$(git -C "$repo" rev-parse --verify --quiet "refs/tags/$tag^{commit}") || die "tag $tag not found"
git -C "$repo" merge-base --is-ancestor "$commit" origin/main || die "tag $tag is not on origin/main"
# Only owner-pushed tags ship: a tag made in this checkout alone is refused.
remote=$(git -C "$repo" ls-remote origin "refs/tags/$tag" "refs/tags/$tag^{}") || later "could not reach origin"
[[ $(tail -n 1 <<<"$remote" | cut -f1) == "$commit" ]] || die "tag $tag is not pushed to origin"

built_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
name=$tag-$(git -C "$repo" rev-parse --short "$commit")-${built_at//[-:]/}
mkdir -p "$HOME/.cache/storagi/staging"
staging=$(cd "$HOME/.cache/storagi/staging" && pwd -P)/$name
mkdir -m 700 "$staging"
trap 'chmod -R u+w "$staging" && rm -rf "$staging"' EXIT
trap 'exit 129' HUP; trap 'exit 130' INT; trap 'exit 143' TERM

# --- Build and stamp the release; nothing here needs root or touches production.
echo "deploy: building $tag ($commit) in $staging"
git -C "$repo" archive "$commit" | tar -x -C "$staging"
(cd "$staging" && npm run setup && npm run check)
(cd "$staging/server" && npm prune --omit=dev)
rm -rf "$staging/web/node_modules"
# The node the unit runs must load the native SQLite binding.
node=$(sed -n 's/^ExecStart=\([^ ]*\) .*/\1/p' "$staging/deploy/storagi.service")
(cd "$staging/server" && "$node" -e "new (require('better-sqlite3'))(':memory:').prepare('select 1').get()")
hash=$("$staging/scripts/verify-release.sh" --print-hash "$staging")
cat >"$staging/BUILD_MANIFEST" <<EOF
TAG=$tag
COMMIT=$commit
BUILT_AT=$built_at
DEPLOYED_BY=scripts/deploy.sh
NODE=$("$node" --version)
CONTENT_SHA256=$hash
EOF

# --- The helper copies, checks and cuts over, and handles signals itself: report its status.
echo "deploy: promoting $name (sudo may ask for your password)"
trap : HUP INT TERM
status=0
sudo /usr/local/sbin/storagi-promote "$staging" || status=$?
exit "$status"
