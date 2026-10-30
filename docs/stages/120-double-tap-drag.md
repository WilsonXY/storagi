# 120: Double tap and drag to select on touch

- Status: completed; independent review in stage121
- Started / last updated: 2026-10-30 (Asia/Kuala_Lumpur)
- Coordinator thread: `89498ba8-441e-4c13-8d08-c8669ebd58db`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (T3 reports `claude-opus-5-5`, effort high)
- Workspace/branch and starting commit: `fix/gesture-select-touch`, `0e1de91`
- Scope and acceptance criteria: on the stage118 tailnet preview, the owner reported that drag-select on a row "still doesn't work at all" on Android Chrome. They asked for touchpad-style select instead: double tap a file, then drag up or down. A plain drag must still scroll, and a sideways swipe must still delete. Run `npm run check`, check formatting and run a touch reproduction in Chromium.

## Decisions

The old touch path started painting after a 400 ms hold and relied on cancelling `touchmove` to stop scrolling. It worked under emulation but not on the owner's phone, and no physical device was available to find out why. The owner's requested gesture replaces it. Tapping a row, then touching the same row again within 350 ms, starts painting at once. That touch's `touchstart` is cancelled, so Chrome never starts a scroll, long press or zoom for it. A double tap without a drag toggles that one row. The second touch does not start painting on links or buttons, and the checkbox column's existing drag is unchanged.

## Changes

- `web/src/gestures.ts`: remove the hold timer, record the last touch tap on a row, and start painting when the next touch on that row lands within 350 ms. Cancel `touchstart` as well as `touchmove` while painting.
- `web/src/shelf.html`: the gesture setting's description mentions double tap and drag.
- `web/src/style.css`: comment only.
- `web/tests/dashboard.test.ts`: a new test checks that a second touch tap after 500 ms followed by a drag selects nothing, and that one after 150 ms followed by a drag selects the range.

## Verification

Private logs and scripts are in `"$HOME/.cache/storagi/tmp"` and `"$HOME/.cache/storagi/repro"`, outside Git.

- RED→GREEN: before the change, the new test fails at the double-tap assertion (`expected '0' to be '2'`); after it, all 48 dashboard tests pass.
- Touch reproduction against `test:preview` (loopback 5174, synthetic data), headless Chromium 390 × 844 with CDP touch events: a plain drag on a row scrolls and selects nothing (`pointercancel`). Double tap then drag down selects rows 1–4 without scrolling, and double tap then drag up selects rows 3–5. A double tap without moving toggles one row. A second tap after 600 ms followed by a drag scrolls and selects nothing.
- `npm run format:check` PASS. `npm run check` exit 0: 33 server, 89 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds (`check-120.log`). `secrets:check` (Gitleaks 8.30.1) on the staged change: no leaks.

## Findings and limitations

No physical phone was used: T3 device access is turned off. Why the old hold-to-paint failed on the owner's phone is not known. Within 350 ms of tapping a row, that row's swipe-to-delete is not available, because the next touch selects instead.

## Handoff

The coordinator commits, runs the stage121 review, fixes its findings and pushes to PR #22. No merge, tag or deployment.
