#!/usr/bin/env bash
# Start-time gate (ExecStartPre): refuse a release that scripts/deploy.sh did not stamp, or that changed since.
# Usage: verify-release.sh [release-dir]       (default: the release containing this script)
#        verify-release.sh --print-hash <dir>  (content hash, used by scripts/deploy.sh)
set -euo pipefail
die() { echo "verify-release: $*" >&2; exit 1; }

# One sha256 over sorted relative paths with file hashes, and symlinks by target.
# Every symlink must resolve inside the release: content behind an outside or dangling link is not hashed.
content_hash() {
  local paths=(server/dist server/node_modules server/package.json server/package-lock.json web/dist) p top
  for p in "${paths[@]}"; do [[ -e $p ]] || die "missing $p"; done
  top=$(pwd -P)
  while IFS= read -r -d '' p; do
    [[ $(readlink -e -- "$p") == "$top"/* ]] || die "symlink $p points outside the release or is dangling"
  done < <(find "${paths[@]}" -type l -print0)
  {
    find "${paths[@]}" -type f -print0 | LC_ALL=C sort -z | xargs -0r sha256sum --
    find "${paths[@]}" -type l -printf '%p -> %l\n' | LC_ALL=C sort
  } | sha256sum | cut -d' ' -f1
}

if [[ ${1-} == --print-hash ]]; then cd "${2:?release dir}" && content_hash; exit; fi
dir=${1:-$(dirname "$(readlink -f "$0")")/..}
cd "$dir" 2>/dev/null || die "no release at $dir"
[[ -f BUILD_MANIFEST ]] || die "BUILD_MANIFEST missing in $(pwd -P)"
field() { sed -n "s/^$1=//p" BUILD_MANIFEST; }
for key in TAG COMMIT BUILT_AT DEPLOYED_BY NODE CONTENT_SHA256; do
  [[ -n $(field "$key") ]] || die "BUILD_MANIFEST has no $key"
done
[[ $(field DEPLOYED_BY) == scripts/deploy.sh ]] || die "DEPLOYED_BY is not scripts/deploy.sh"
[[ $(field TAG) =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "TAG is not vX.Y.Z"
[[ $(field COMMIT) =~ ^[0-9a-f]{40}$ ]] || die "COMMIT is not a full sha"
[[ $(content_hash) == "$(field CONTENT_SHA256)" ]] || die "content differs from CONTENT_SHA256 in $(pwd -P)"
echo "verify-release: $(field TAG) $(field COMMIT) ok"
