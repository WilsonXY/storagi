# 254: Shelf-test cleanup integration and candidate CI

- Status: in progress
- Started / last updated: 2026-11-08 Asia/Kuala_Lumpur
- Coordinator thread: branch `test/strengthen-shelf-tests`; [plan 250](250-test-cleanup-plan.md).
- Agent/session: coordinator session `01a1b73e-8d4d-7e83-a1e2-9e62c9ed4c4a`.
- Provider/model/effort: actual Codex `gpt-6.1-sol`, high, verified by coordinator from its own `turn_context` in `"$HOME/.codex/sessions/2026/11/08/rollout-2026-11-08T02-21-32-01a1b73e-8d4d-7e83-a1e2-9e62c9ed4c4a.jsonl"`. The coordinator also read both delegates' own session contexts and confirmed the same actual model/effort.
- Starting commit: `b44bb6d17beb896146b8f01a987bb69a990a9289` in the existing owner-prepared worktree.
- Scope and acceptance: integrate stages 251/252, run required checks and secrets scans, preserve all unique boundary/security/lifecycle/race coverage, commit before isolated independent review, audit review invariants and cleanup, open/link a scoped PR and handle candidate CI. No merge/tag/deploy/exposure or source scheduler changes.

## Integration and coordination

Both Sol/high delegates completed bounded stages without committing or changing product sources. The earlier Opus usage-limit failures and partial edits are preserved in stage 250. Stage 251 reports 101 web and 25 server tests passing, plus three mutation red/green checks. Stage 252 reports all three browser acceptances passing, real-click Refresh red/green checks at both cadences including frozen clocks, and moving-layout/52px/overflow counterexamples. The coordinator inspected the diffs and ignored proof results, and reran formatting of all six changed scripts/tests plus `git diff --check`: passed.

The shared-refresh companion reserves stages 255 onward. It owns cadence/recovery source and browser timing, and explicitly preserves our immediate Refresh/search and geometry assertions. Stage 252 released the heavy-run window; the companion now runs its own full checks/browser acceptance. This coordinator holds its full check until the companion releases that window. Counterexamples and private machine evidence remain ignored.

A fresh fetch shows owner-merged application fixes #43 (backend revocation) and #44 (selection scoping) on `origin/main` at `ecb9190`. Integrate this current base before candidate validation; the application fixes remain base history, outside the cleanup PR diff. No change is imported from the unmerged shared-refresh branch.

## Verification

- Rebased the committed test-only candidate cleanly onto `origin/main` at `ecb9190`; no product-source or Settings confirmation-test diff remains relative to the base. Original cleanup commit became `86a292c` after rebase.
- `TMPDIR="$HOME/.cache/storagi/tmp" npm run check`: PASS, 408 tests (59 server, 184 web, 11 HTTP acceptance, 154 deploy), both typechecks and production builds. Private log: ignored `artifacts/test-cleanup-integration/check.log`.
- `npm run format:check`: PASS. Gitleaks 8.30.1 `npm run secrets:history`: PASS, 468 commits scanned, no leaks. Staged secret scan before original commit: PASS.
- Final rebased actual-service retention acceptance: PASS, 41.69 seconds. Text initially failed at a pre-existing optional-toast prerequisite (see below); the corrected complete Text rerun passed in 77.67 seconds. Actual-service transfer acceptance: PASS, 29.65 seconds. All use pinned Playwright 1.64.1 / Chromium 1248, signed synthetic identities, disposable storage and loopback. Logs: ignored `browser.log`, `browser-text-rerun.log`, `transfer.log` in `artifacts/test-cleanup-integration/`.
- The final harness-only correction does not enter `npm run check`; its changed script was formatted and exercised through the complete actual-service Text scenario after correction. No unrelated broad-suite rerun was needed.
- Browser and mutation details from delegated stages remain in [251](251-unit-test-cleanup.md) and [252](252-browser-test-cleanup.md). Independent review and candidate CI pending.

## Findings and limitations

Production, real OAuth, external exposure and physical devices remain outside this test-only change. The existing large acceptance tests remain single tests; no harness rewrite was introduced.

### Optional-toast prerequisite failure and correction

The first rebased Text run timed out at the existing `locator('#notice').elementHandle()` before clicking Copy in the long-message layout fixtures. That call waits for a prior notice to exist, although the app legitimately removes a normal toast after four seconds. Layout/screenshot work before this point may outlast that timeout. The callback below already accepts a null previous notice and still demands a new, distinct live notice.

A tight actual-service Copy-only proof (`artifacts/test-cleanup-integration/toast-seam.test.ts`) starts with no notice, then tests replacement with a notice present. With the original awaiting lookup, it fails at exactly `locator.elementHandle` (one-second diagnostic timeout). With a nonwaiting `elementHandles()` snapshot, both absent and present cases pass, including real Copy and distinct new-notice identity/content. The same minimal snapshot replaces the original lookup in acceptance; no timeout, toast behavior, identity comparison or layout assertion was relaxed. Red/green logs are ignored `toast-red.log` / `toast-green.log`. The full Text rerun then passed.

### Remote-ref coordination

The coordinator acknowledged the companion's all-remote-ref hold before its independent review and made no remote writes. After its successful review, the companion pushed once to `47650cce65f463b2d3879ba7e54b541a3a03d610` and opened PR #45. Root and companion explicitly reserve the next quiet window for this cleanup candidate. Finish the local commit first, then take a fresh exact snapshot immediately before isolated review; release promptly after audit. No companion changes are bundled.

## Handoff

In progress. No PR yet.
