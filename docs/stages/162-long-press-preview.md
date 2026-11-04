# 162: Long press previews a file on a phone

- Status: in progress; stage163 review FAIL (two P2s), both fixed here; awaiting re-review (stage164)
- Started / last updated: 2026-11-04 (Asia/Kuala_Lumpur)
- Coordinator thread: Claude Code session `7c605ea2-6f35-4a84-a343-eba74077428c`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from this session's runtime metadata)
- Workspace/branch and starting commit: `t3/9904269c`, `efdea33`
- Scope and acceptance criteria: the owner reported that "the hover preview feature doesnt work on phone" and asked that "the user [be] able to make the preview show up when they are long pressing on the item with their finger". Run `npm run check`, check formatting, and try the long press in Chromium at phone width.

## Decisions

- Same rules as the mouse (stage142): only the name cell, only files that have a preview, and the "File previews" setting still turns it off. The same loaders, cache, 6 s video cap and one-load-at-a-time rule apply.
- A finger held still on a name for 500 ms shows the preview, about the time a phone takes to recognise a long press. It stays while the finger stays down and hides when the finger lifts, or once it moves 8 px (the same distance at which `gestures.ts` starts a swipe, drag or scroll).
- Lifting needs no handler of its own: after `pointerup` or `pointercancel` a touch always sends `pointerleave`, which already hides the preview.
- The box goes above the finger when there is room, so the hand does not cover it; otherwise below, as with the mouse. Either way it is kept inside the window, so in a short landscape window with room on neither side it overlaps the finger rather than leaving the screen (stage163).
- No preview while a row gesture is running (`gestures.busy()`), checked on the press and again when the 500 ms is up: a touch straight after a tap starts a drag to select, and holding it still must not open a preview over the selection or download the file (stage163).
- On touch screens (`pointer: coarse`) the name cell cannot be text-selected and has no iOS callout, so a long press previews instead of selecting the name. With swipe gestures on, the whole row already had this; with them off, the name now does too.

## Changes

- `web/src/dashboard.ts`: a touch `pointerdown` on a previewable name starts the 500 ms timer; a touch `pointermove` hides the preview once the finger has moved 8 px and never starts a mouse-style hover. `place()` puts a finger's preview above it. Any other `pointerdown` still hides the preview, as before.
- Stage163 fixes (`dashboard.ts`): `place()` clamps the top to the window's bottom edge, for mouse and finger; the touch `pointerdown` and its timer skip the preview while `gestures.busy()`.
- `web/src/style.css`: the `pointer: coarse` rule for `#groups .name`.
- `web/tests/dashboard.test.ts`: a test for a touch press on another cell, the 500 ms wait, a small wobble, the position above the finger, hiding on lift and on movement, and a quick tap. Stage163 added a double tap and hold that must show no preview, and a 390 px-high window where the box must stay on screen; the earlier quick-tap step now leaves a pause so it is not itself a double tap.

## Verification

- RED→GREEN: the new test failed before the change (no image loaded after 500 ms) and passes after it; dashboard 56/56.
- `npm run format:check` PASS; `npm run check` exit 0 (33 server, 110 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds).
- Chromium 1243 with phone emulation (390 × 844, touch, `isMobile`) against the mock preview on loopback, using CDP touch events (`longpress.mjs`), run three times with the same results: after 300 ms nothing shows; after 900 ms the PNG and the Markdown file show their previews, above the finger and inside the screen; lifting hides them; a quick tap shows nothing; dragging the finger to scroll shows nothing (the browser sent `pointercancel`); with swipe gestures turned off a long press still previews. On the very first run against a cold server the Markdown preview had not appeared within 900 ms; the next three runs showed it each time.
- Stage163 fixes: each new check failed without its fix (a preview over the drag selection; `top` 196 px instead of 142 px) and passes with it; dashboard 56/56. `npm run format:check` PASS and `npm run check` exit 0 (33 server, 110 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds). In Chromium, `longpress.mjs` with a double tap and hold step, run twice: one row selected and no preview, every earlier step as before. `landscape.mjs` at 844 × 390 with the finger at y = 196: the reviewed code put the box at 212 to 424 px, below the window; with the fix it sits at 170 to 382 px.
- A paced recording (42 s after the stage163 fixes) and screenshots. Private scripts, logs and proof files are outside Git in `"$HOME/.cache/storagi/repro"`, `"$HOME/.cache/storagi/tmp"` and `"$HOME/.cache/storagi/proof-longpress"`.

## Findings and limitations

- Not tried on the owner's real Android phone or on iOS. CDP touch events do not reproduce a phone's own long-press handling (no `contextmenu` was sent), so whether Android or iOS still opens a menu or selection somewhere on the row is unverified. The name cell is made unselectable and without a callout for that reason.
- A long press on a name no longer selects its text on a touch screen.

## Handoff

Stage163 reviewed the first version (FAIL, two P2s fixed above). Stage164 re-reviews the fixes.
