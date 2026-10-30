# 120: Double tap and drag to select on touch

- Status: completed; stage121 review findings fixed
- Started / last updated: 2026-10-30 (Asia/Kuala_Lumpur)
- Coordinator thread: `89498ba8-441e-4c13-8d08-c8669ebd58db`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (T3 reports `claude-opus-5-5`, effort high)
- Workspace/branch and starting commit: `fix/gesture-select-touch`, `0e1de91`
- Scope and acceptance criteria: on the stage118 tailnet preview, the owner reported that drag-select on a row "still doesn't work at all" on Android Chrome. They asked for touchpad-style select instead: double tap a file, then drag up or down. A plain drag must still scroll, and a sideways swipe must still delete. Run `npm run check`, check formatting and run a touch reproduction in Chromium.

## Decisions

The old touch path started painting after a 400 ms hold and relied on cancelling `touchmove` to stop scrolling. It worked under emulation but not on the owner's phone, and no physical device was available to find out why. The owner's requested gesture replaces it. Tapping a row, then touching the same row again within 350 ms, starts painting at once. That touch's `touchstart` is cancelled, so Chrome never starts a scroll, long press or zoom for it. A double tap without a drag toggles that one row: edge auto-scroll starts only once the finger has moved 8 px, so a double tap near the top or bottom edge stays a tap. Neither touch can be on a link or button, and the checkbox column's existing drag is unchanged.

## Changes

- `web/src/gestures.ts`: remove the hold timer, record the last touch tap on a row's body, and start painting when the next touch on that row's body lands within 350 ms. Cancel `touchstart` as well as `touchmove` while painting. Start edge auto-scroll on the first 8 px of movement instead of when painting starts.
- `web/src/shelf.html`: the gesture setting's description says "tap a file, then touch it again and drag".
- `web/src/style.css`: comment only.
- `web/tests/dashboard.test.ts`: a new test stubs row geometry in the bottom edge band. It checks that a second touch after 500 ms, or after a first tap on the Delete button, neither cancels `touchstart` nor selects. A second touch after 150 ms cancels `touchstart` and its drag selects two rows. A double tap without a drag toggles one row and never scrolls. The shared `pointer` helper takes a pointer type.
- `docs/implementation-log.md`: Prettier re-padded the index table for the new row; no other row's content changed.

## Verification

Private logs and scripts are in `"$HOME/.cache/storagi/tmp"` and `"$HOME/.cache/storagi/repro"`, outside Git.

- RED→GREEN: before the change, the first version of the test failed at the double-tap assertion (`expected '0' to be '2'`). After stage121, the extended test failed on `701c68e` at the button case (`expected '2' to be '0'`). With only the button fix, it failed at the edge case (`scrollBy` called 12 times). With both fixes, all 48 dashboard tests pass.
- Touch reproduction against `test:preview` (loopback 5174, synthetic data), headless Chromium 390 × 844 with CDP touch events: a plain drag on a row scrolls and selects nothing (`pointercancel`). Double tap then drag down selects rows 1–4 without scrolling, and double tap then drag up selects rows 3–5. A double tap without moving toggles one row. A second tap after 600 ms followed by a drag scrolls and selects nothing. After stage121's fixes: a double tap without moving on a row in the bottom 72 px toggles only that row and does not scroll, and a checkbox-column drag to the bottom edge still auto-scrolls.
- `701c68e`: `npm run format:check` PASS. `npm run check` exit 0: 33 server, 89 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds (`check-120.log`). `secrets:check` (Gitleaks 8.30.1) on the staged change: no leaks.
- After stage121's fixes: the same checks and counts (`check-120b.log`).

## Findings and limitations

No physical phone was used: T3 device access is turned off. Why the old hold-to-paint failed on the owner's phone is not known. Within 350 ms of tapping a row's body, the next touch on that row selects instead of swiping to delete or scrolling, so a tap to stop a fling followed by a quick flick on the same row selects. The checkbox, links and buttons are never affected. Stage121's suggestion to rename the "Swipe gestures" setting was not taken: it already covered drag-select, and renaming it is outside this fix.

## Handoff

The coordinator committed, ran the stage121 review, fixed its findings and pushes to PR #22. No merge, tag or deployment.
