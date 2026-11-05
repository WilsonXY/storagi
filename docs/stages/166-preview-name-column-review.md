# 166: Preview name column review

- Status: completed; FAIL (one P2), fixed in stage165
- Started / last updated / completed: 2026-11-04 (Asia/Kuala_Lumpur)
- Coordinator thread: Claude Code session `7c605ea2-6f35-4a84-a343-eba74077428c`
- Agent/task/thread identifiers: T3 delegated review task `06c2c79e-236b-4765-8312-f48f4d8d1e2f`; Codex session `01a1a5da-3754-79d2-95e7-e54d7f56d3a0`
- Provider/model/effort: Codex `gpt-6.1-sol`, reasoning effort high, confirmed from the reviewer's own Codex session log (`"model":"gpt-6.1-sol"`, `"reasoning_effort":"high"`)
- Workspace/branch and starting commit: a separate T3 review worktree at `fccd79d` (stage165's first commit)
- Scope and acceptance criteria: read-only review of stage165: the whole name column previews at phone width while the checkbox, other cells and buttons do not at any width; no regression in mouse hover, the long press, row gestures or click handlers; the new test fails without the change.

## Findings

1. P2, `web/src/dashboard.ts` `nameId()` with `web/src/style.css`: the details line (`.meta-phone`) now previews on a long press, but only `.name` was made unselectable on touch screens. With swipe gestures off, the row-wide rule no longer applies and `gestures.ts` does not cancel the context menu, so a long press on the details line could start a text selection or the iOS callout instead. Fixed in stage165: the `pointer: coarse` rule covers `.meta-phone` too.

No other findings across the responsive layouts, swiping rows and their underlay, deleting rows, Escape dismissal, tooltips and click handlers.

## Verification

The reviewer installed the web dependencies in its own worktree (ignored by Git) and ran: dashboard tests 56/56 PASS, web TypeScript check PASS, `git diff --check` PASS. Running the new test against the parent's `dashboard.ts` in memory failed at the details line check, as expected.

## Handoff

Coordinator checks after the review: this checkout's `HEAD`, `git status` and `git ls-remote --heads origin` matched the values recorded before it; the reviewer's worktree was still at `fccd79d` with a clean status. The worktree and its branch `t3/review-preview-hitbox` were then removed. Native phone selection and callout behaviour remains unverified.
