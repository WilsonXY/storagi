# 165: Preview from the whole name column

- Status: completed; stage166 review FAIL (one P2), fixed here; stage167 re-review PASS
- Started / last updated: 2026-11-04 (Asia/Kuala_Lumpur)
- Coordinator thread: Claude Code session `7c605ea2-6f35-4a84-a343-eba74077428c`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from this session's runtime metadata)
- Workspace/branch and starting commit: `t3/long-press-preview` (PR #38), `8dee98e`
- Scope and acceptance criteria: trying stage162 on a phone over the private preview, the owner reported "i have to click really precisely on the file name only the preview can trigger" and sent a screenshot boxing a file's name together with the details line under it ("mp4 1.1 MiB 29 d left"), asking for "the hitbox to be the entire div.name instead". Run `npm run check`, check formatting and try it in Chromium at phone and desktop widths.

## Decisions

- On a phone the name cell (`.name`) was already as wide as its column but only 21 px tall in a 60 px row; the details line (`.meta-phone`) and the row's padding sat outside it. The owner's box covered both, so the hit area is now the name column for the full height of the row: the name, the details line, and the row's own padding and gaps within the name column's width. The checkbox, the type, size and expiry cells and the buttons stay outside.
- Mouse and finger share it, so on desktop resting on the row just above or below the name also previews; the type, size and expiry columns still do not (the owner's stage142 "name cell only" rule).

## Changes

- `web/src/dashboard.ts`: `nameId()` accepts a target inside `.name` or `.meta-phone`, or the row itself when the pointer's x lies within the name cell's width.
- Stage166 fix (`web/src/style.css`): the `pointer: coarse` rule that stops text selection and the iOS callout now covers `#groups .meta-phone` as well as `.name`, so with swipe gestures off a long press on the details line previews instead of selecting it.
- `web/tests/dashboard.test.ts`: the touch test now also presses the details line, the row inside and outside the name column, and the checkbox.

## Verification

- RED→GREEN: the new check failed before the change (no preview from the details line) and passes after it; dashboard 56/56; web typecheck PASS.
- `npm run format:check` PASS; `npm run check` exit 0 (33 server, 110 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds).
- Chromium 1243 phone emulation (390 px, touch) on the mock preview (`name-hit.mjs`): a long press on the name text, the name cell past the text, the details line, the row padding above the name and the gap between name and details each showed the video preview; the download button and the checkbox column showed none. Run three times: the very first press of the first run (a fresh browser's first video load) showed nothing within 1.2 s, every other press as listed. Desktop mouse at 1280 px (`name-hit-mouse.mjs`): the name and the row below the name previewed; the row below the type cell did not.
- Stage166 fix: Chromium with swipe gestures off (`select-check.mjs`): at 390 px with touch, the name and details line compute `user-select: none` and the size cell keeps `auto`; at 1280 px with a mouse all stay `auto`. Chromium does not report `-webkit-touch-callout` (an iOS property), so the callout part is unverified. `npm run format:check` PASS and `npm run check` exit 0 (33 server, 110 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds).
- Private scripts and logs are outside Git in `"$HOME/.cache/storagi/repro"` and `"$HOME/.cache/storagi/tmp"`.

## Findings and limitations

- Not yet re-tried by the owner on the phone.

## Handoff

Stage166 reviewed the first version (FAIL, one P2 fixed above). Stage167 re-reviewed the fix: PASS.
