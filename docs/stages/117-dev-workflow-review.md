# 117: Independent review of Gitleaks/Prettier workflow

- Status: completed; PASS, low finding and two suggestions fixed by coordinator
- Started / completed: 2026-10-25 (Asia/Kuala_Lumpur)
- Coordinator thread: `42d785a3-6c60-4ddc-8d8b-c6f10923031b` (Codex `gpt-6.1-sol` until it failed with `model_not_found`, then Claude `claude-opus-5-5`)
- Round 1: T3 review task `storagi-117-dev-workflow-astra-review-r1`, Codex `gpt-6-astra`/high as the owner requested. Failed before starting: Codex rejected the model for this account (`model_not_found`). A direct `codex exec -m gpt-6-astra` probe failed the same way. No review ran.
- Round 2: T3 review task `storagi-117-dev-workflow-opus-review-r2`, fresh worktree. Astra being unavailable, the owner routing rule for changes written by `gpt-6.1-sol` names Claude Opus 5.5/high. Reviewer session `11c153c0-3dc2-4c50-af48-f26fc0ba286d`; the coordinator checked its own session log, and all 91 entries record `claude-opus-5-5` and effort `high`.
- Reviewed range: `ac24b45..c09c47a` (formatting `c48a698`, tooling `d9e78ce`, docs `c09c47a`).

## Findings and responses

1. Low (deploy hygiene): root `npm ci` in `setup` leaves Prettier in `$staging/node_modules`. That copy shipped in every release, outside the content hash and on the server's module path. No exploit was found. **Fixed:** `scripts/deploy.sh` now removes the root `node_modules` alongside `web/node_modules`. The fake project in `scripts/deploy.test.ts` creates a root `node_modules/prettier`, and the test asserts it is absent from the release. Without the fix the deploy suite fails 1 of 103 tests; with it, 103/103 pass. `docs/system-service.md` updated.
2. Suggestion (overengineering): `--log-opts=--all` matches Gitleaks 8.30.1's default log options. **Fixed:** `secrets:history` is now `gitleaks git --redact .`; it still scans the same 271 commits.
3. Suggestion (docs): Gitleaks honours inline `gitleaks:allow` and repo-local `.gitleaks.toml`/`.gitleaksignore`. **Fixed:** README says any of these in a change needs explicit review.
4. Note: the CI history scan covers all fetched refs. A leak on any pushed branch, or a failed Gitleaks download, fails `check`, and auto-deploy then records that tag as `ci-failed`. This fails closed and is accepted as is.

The reviewer confirmed that `c48a698` is formatting-only: re-running the formatter reproduces it byte for byte, JS/TS syntax trees match, and HTML differs only in whitespace nodes, none in `white-space: pre*` elements. Built CSS and fonts are unchanged. The Prettier lock integrity and the Gitleaks SHA-256 match their official sources. The `check` job name that auto-deploy queries is kept. The reviewer ran `format:check` and the full `npm run check` (286 tests), plus history and staged scans and a synthetic staged/deleted-token probe in a throwaway repository.

## Verification after fixes

Private log: `"$HOME/.cache/storagi/stage117/check-r2fix.log"`. `npm run format:check` PASS. `secrets:history` 271 commits, no leaks. `secrets:check` PASS. `npm run check` exit 0: 33 server, 88 web, 11 HTTP and 154 deploy tests, both typechecks and builds. The deploy test count is unchanged because the fix added assertions, not tests.

## Handoff

Repository invariance: before and after each round, this checkout's HEAD (`c09c47a`), clean status and `git ls-remote --heads origin` hash matched the saved baseline. Each reviewer worktree was at `c09c47a` and clean, with no untracked files, when removed. The coordinator removed only the two worktrees and branches recorded on this stage's tasks (`t3/dev-workflow-review`, `t3/review-dev-workflow`) and the reviewer's scratch directory. The review findings are fixed in a follow-up commit, and the coordinator publishes the PR and watches CI. No merge, tag, deployment or host changes.
