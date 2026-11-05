# 163: Long press preview review

- Status: completed; FAIL (two P2s), both fixed in stage162
- Started / last updated / completed: 2026-11-04 (Asia/Kuala_Lumpur)
- Coordinator thread: Claude Code session `7c605ea2-6f35-4a84-a343-eba74077428c`
- Agent/task/thread identifiers: T3 delegated review task `cfe015a1-6f16-448d-a610-2e3ec596ef4f`; Codex session `01a1a560-0f68-7f22-a770-ebe63c7a5f5e`
- Provider/model/effort: Codex `gpt-6.1-sol`, reasoning effort high, confirmed from the reviewer's own Codex session log (`"model":"gpt-6.1-sol"`, `"reasoning_effort":"high"`)
- Workspace/branch and starting commit: a separate T3 review worktree at `d65c372` (stage162's first commit)
- Scope and acceptance criteria: read-only review of stage162: the long press shows and hides correctly, mouse hover is unchanged, no conflict with row gestures, and phone browser behaviour as far as can be reasoned.

## Findings

1. P2, `web/src/dashboard.ts` `place()`: with no room above the finger, a touch preview always went below without checking the bottom edge. In an 844 × 390 window with the finger at y = 180, a 252 px box ended 58 px below the window. Fixed in stage162: the top is clamped to the window, for mouse and finger.
2. P2, `web/src/dashboard.ts` touch `pointerdown`: a touch straight after a tap starts a drag to select in `gestures.ts`, but the preview timer also started, so holding still opened a preview over the selection and downloaded the file. Fixed in stage162: no preview while `gestures.busy()`, checked on the press and when the timer fires.

The reviewer found the mouse path unchanged, hiding on lift through `pointerleave` consistent with the Pointer Events specification, and no loader or video-cap regression.

## Verification

The reviewer could not run the tests or typecheck: its worktree had no installed dependencies (`vitest: not found`). It ran `git diff --check` (PASS) and an in-memory probe of both handlers for finding 2. The coordinator reproduced both findings with failing tests before fixing them and measured finding 1 in Chromium (see stage162).

## Handoff

Coordinator checks after the review: this checkout's `HEAD`, `git status` and `git ls-remote --heads origin` matched the values recorded before it; the reviewer's worktree was still at `d65c372` with a clean status. The worktree and its branch `t3/review-long-press-preview` were then removed. Real Android Chrome and iOS Safari behaviour remains unverified.
