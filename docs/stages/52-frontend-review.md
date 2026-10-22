# 52: Independent frontend review, round 1

- Status: completed; verdict FAIL (one blocking finding)
- Date: 2026-10-23 +08:00
- Coordinator thread: Claude Code in T3 Code, thread `90da6e4a-818a-4e67-bc98-98f1606e3cd0`; this record is written by the coordinator from the reviewer's report
- Reviewer: T3 delegated review task `storagi-stage52-review-r1`, fresh read-only Claude Code session in its own worktree at `09e1a88`
- Provider/model/effort: Claude Opus 5.5 at high effort, confirmed from the reviewer's own session log (`"model":"claude-opus-5-5"`, `"effort":"high"` on its turns). The owner's routing uses Claude instead of Codex because gpt-6.1-sol implemented stages 49 and 50.
- Scope: `git diff 50a19f5..09e1a88` against the handoff, the audit's must-keep list, the prototype and the production constraints

## Read-only invariants

Before and after: parent HEAD `09e1a88`, clean status and all nine remote heads unchanged; the reviewer's worktree was still at `09e1a88` with a clean status. Its worktree and branch were then removed.

## Findings

| ID | Severity | Finding | Coordinator verdict |
| --- | --- | --- | --- |
| B1 | Blocking | `AutoRefresh.now()` skipped fetching in a hidden tab, so a dashboard opened in a background tab showed no files and a false "Updated" time for up to 60 s; the offline retry treated the skipped fetch as success | Fix (53) |
| S1 | Suggestion | A failed disk write during a streamed download left the response unread, holding the server's descriptor | Fix (53) |
| S2 | Suggestion | The server's raw "Not found" replaced the friendly expired-copy message | Fix (53) |
| S3 | Suggestion | A page frozen or restored during the 6 s grace sends its DELETE on wake with no Undo | Fix (53) |
| S4 | Suggestion | Any later toast replaced the bulk-delete Undo toast, so the copies were deleted with no way back | Fix (53) |
| S5 | Suggestion | Duplicate rows had identical button labels for screen readers | Fix (53) |
| S6 | Suggestion | "Files queued" instead of the prototype's "N files queued" | Fix (53) |
| S7 | Suggestion | Test gaps: gestures, hidden-tab mount, download error paths, swipe through Undo | Partly fixed (53): regression tests for B1, S1–S5 and a touchpad swipe through Undo. Pointer drag and touch hold stay untested in jsdom (no layout); stage 50's browser script exercised them |
| S8 | Suggestion | Over-engineering: test-only APIs (`queueEta`, `finishTime`, metrics history, `ago`, `onGestureChange`, `toggleAll`, `OfflineRetry.error`, delete getters/commit), unused clock/timer injection, cleanup lists that grow without bound | Fix (53) |

The reviewer found no security problems. It verified escaping, CSP, CSRF, fail-closed sign-in, 401/403 handling with the upload URL preserved, the delete grace, the synchronous picker call, clean re-mounts, and that the preserved tests changed selectors only.

## Checks run by the reviewer

`npm run check` failed once in `scripts/acceptance-review-fixes.test.ts` (a half-open PATCH timing test in untouched server code, on a loaded machine), then passed on the second run: 32 server, 59 web, 11 acceptance tests.
