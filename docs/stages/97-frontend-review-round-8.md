# 97: Owner-approved re-review of 96 (Astra and gpt-6.1-sol)

- Status: completed; both verdicts FAIL
- Date: 2026-10-23 +08:00
- Owner approval: "One more Astra + Sol round" after 96
- Coordinator thread: Claude Code in T3 Code, thread `90da6e4a-818a-4e67-bc98-98f1606e3cd0`; this record is written by the coordinator from both reports
- Reviewers, each a fresh read-only Codex session in its own worktree at `91934d1`:
  - T3 task `storagi-stage97-astra-review-r8`: `gpt-6-astra`, high reasoning effort
  - T3 task `storagi-stage97-sol-review-r8`: `gpt-6.1-sol`, high reasoning effort
  - Both confirmed from their own Codex session logs

## Read-only invariants

Before and after both reviews: parent HEAD `91934d1`, clean status and all nine remote heads unchanged. Both reviewer worktrees were still at `91934d1` with clean status. Both worktrees and branches were removed afterwards.

## Round 95 findings

Both resolved:

- Astra: native Chromium wheel and mouse probes. The swipe keeps its own working Undo after a bulk delete and bulk Undo.
- Astra: a refused swipe re-renders.
- gpt-6.1-sol: pointer and wheel probes. Pressing the swipe's Undo sends no DELETE.

Post-release `pagehide`, lock, sign-out, double-swipe and refresh probes passed in both.

## New findings

| Source | Severity | Finding | Coordinator verdict |
| --- | --- | --- | --- |
| gpt-6.1-sol | Blocking | While a swipe settles (renders are held back for 200 ms), the swiped row's stale Delete button could still be activated by keyboard; Enter then Cancel replaced the swipe's Undo while its DELETE stayed scheduled. Native Chromium | Fix (98) |
| Both | Blocking | Select-all and Ctrl+A used the stale `order` while a swipe settled, so the pending row was selected. Native Chromium | Fix (98) |
| Astra | Blocking | `pagehide` within a touchpad swipe's 140 ms release window left its timer alive; after a back/forward-cache restore the timer committed the swipe and a DELETE went out. Native Chromium with a verified restore | Fix (98). This differs from round 89's A2 (judged not to hold): that swipe had been released; this one had not, and the same two-finger motion can be the browser's Back gesture |

No security problems. `npm run check` passed on the first run in both: 32 server, 83 web, 11 acceptance tests.
