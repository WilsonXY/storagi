# 124: Stop the list header and day labels from highlighting

- Status: completed; stage125 review PASS, its two record findings fixed
- Started / last updated: 2026-10-30 (Asia/Kuala_Lumpur)
- Coordinator thread: `224920a4-69b6-459c-83da-d9d3bc88f27b`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (T3 reports `claude-opus-5-5`, effort high, in this thread's `orchestrator_capabilities` inherited options)
- Workspace/branch and starting commit: `fix/unselectable-list-labels`, `c171d26`
- Scope and acceptance criteria: the owner sent a screenshot with the Name/Size/Expires header and the day labels ("Today", "Saturday", "23 Oct") boxed, one of them highlighted, and asked to "make these unhighlight-able". Text selection must not include them; nothing else changes. Run `npm run check`, check formatting and reproduce in Chromium.

## Changes

- `web/src/style.css`: `.list-head` and `.group h3` get `user-select: none` (and `-webkit-user-select` for Safari, as the gesture rows already do).

Stage numbers 122 and 123 were skipped: another open thread's branch already uses 122.

## Verification

Private logs and scripts are in `"$HOME/.cache/storagi/tmp"` and `"$HOME/.cache/storagi/repro"` (`select-123.mjs`), outside Git.

- RED→GREEN in headless Chromium 1248 at 1280 × 900 against `test:preview` (loopback 5174, synthetic data). On `c171d26`: computed `user-select` is `auto` on both, a mouse drag from the header down to the third row selects `"Size\nExpires\nToday\nYesterday\nWednesday\n"`, and a triple-click on a day label selects `"Today\n"`. With the change: computed `user-select` is `none` on both, and the same drag and triple-click select nothing.
- `npm run format:check` PASS. `npm run check` exit 0: 33 server, 89 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds (`check-123.log`).

## Findings and limitations

No unit test: jsdom does not apply `user-select`, so the Chromium reproduction is the test. The sort buttons still work as buttons; only text highlighting is removed.

## Handoff

The coordinator commits, runs the stage125 review and opens the PR. No merge, tag or deployment.
