# 121: Independent review of double tap and drag

- Status: completed; GLM PASS, DeepSeek FAIL on one medium finding, all code findings fixed by the coordinator
- Started / completed: 2026-10-30 (Asia/Kuala_Lumpur)
- Coordinator thread: `89498ba8-441e-4c13-8d08-c8669ebd58db` (Claude `claude-opus-5-5`)
- Primary (owner routing for Claude-written changes: Codex `gpt-6.1-sol`/high): a read-only `codex exec -m gpt-6.1-sol -c model_reasoning_effort=high -s read-only` in a fresh detached worktree failed again before reviewing: "The 'gpt-6.1-sol' model is not supported when using Codex with a ChatGPT account." No review ran.
- Fallback, run at the same time in separate fresh T3 worktrees: OpenCode `opencode/deepseek-v4.1-flash-free` (session `ses_e744fa3baffeW2U1B2YeMBIHL9`) and `opencode/glm-5.3-flash-free` (session `ses_e744f8ca8ffeppAQ5KGTsY46sJ`). Each session's own `opencode session export` records that model with `variant: max` on every model message. Neither reviewer could read an effort setting from inside its runtime.
- Reviewed range: `0e1de91..701c68e`

## Findings and responses

Both reviewers reproduced RED on `0e1de91` and GREEN on `701c68e`, and found the event mechanics sound. DeepSeek checked them in headless Chromium 1248 with CDP touch: pointerdown comes before touchstart, and a cancelled touchstart gives no pointercancel, click, context menu or zoom. Both found that stale tap state cannot arm another row, survives a re-render correctly, and is cleared by cancel and destroy, and that `eat` cannot swallow a later click.

1. Medium (DeepSeek): a double tap without a drag, on a row in the top or bottom 72 px edge band, started edge auto-scroll at once and selected the rows scrolled under the finger. **Fixed:** edge scrolling starts on the first 8 px of movement. Test and Chromium check added.
2. Low (both): a first tap on a row's Download or Delete button armed the double tap. **Fixed:** both touches must be on the row's body; test added.
3. Low/Suggestion (both): the test did not exercise the `touchstart` cancel, the no-drag toggle or the button exclusion, and its count relied on jsdom's zero geometry. **Fixed:** the test stubs row geometry and covers all three; the shared `pointer` helper takes a pointer type instead of a duplicate helper.
4. Low (DeepSeek): the record listed only swipe-to-delete as blocked within 350 ms of a tap; a scroll that starts on the same row is too. **Fixed** in stage120's limitations.
5. Suggestion (DeepSeek): reword the setting description and rename "Swipe gestures". **Description reworded**; rename not taken (stage120 says why).
6. Suggestion (GLM): note that Prettier re-padded the log table. **Fixed** in stage120's Changes.
7. Medium/Low (both, process): emulation passed the old hold-to-paint too, so the owner's phone is the real test. **Accepted:** the owner is asked to try it on the tailnet preview before merging.

## Verification after fixes

Private log `"$HOME/.cache/storagi/tmp/check-120b.log"`. See stage120 for the RED→GREEN steps and the Chromium touch reproduction.

## Handoff

Repository invariance: after both reviews, this checkout's HEAD (`701c68e`), clean status and `git ls-remote --heads origin` matched the saved baseline. The primary's probe worktree and both reviewer worktrees were at `701c68e` and clean when removed. The coordinator removed only those worktrees and the two T3 branches recorded on this stage's tasks (`t3/touch-double-tap-drag-selection`, `t3/review-double-tap-drag`). The coordinator pushes to PR #22 and watches CI. No merge, tag, deployment or host changes.
