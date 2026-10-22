# 48: Frontend design exploration (dark ASCII koi direction)

- Status: completed; owner chose the final design (A's app with C's locked screen)
- Started: 2026-10-21 16:00 +08:00; completed 2026-10-21
- Coordinator thread: Claude Code cloud session on branch `claude/nifty-knuth-k90bhs`, starting commit `1fa9cd8`.
- Agent/task identifiers: coordinator plus four delegated variant builders (forks of the coordinator session), listed under Delegation.
- Provider/model/effort: the session is configured for Claude Opus 5.5; the serving model per turn is not independently proven here. Forks inherit the coordinator's model.
- Scope: design exploration only. Static prototypes under `design/explorations/`; the only change outside them is the owner's favicon in `web/public/`. No change to `server/`, deployment or the running service. Nothing deployed or exposed; local preview servers bind to `127.0.0.1`.

## Owner's request (2026-10-21)

Rebuild the frontend design with T3 Code as the base theme and ASCII as the core element; true dark, dark mode only; the owner's koi favicon as the symbol. Add live upload/download speed with an estimated finish time, and auto-refresh in the browser (about every minute). Evaluate and borrow from the owner's references: stackedlol's ASCII shark scene (via sundyme), Kevser's animated upload card, Elia Kuratli's inline delete with undo and multi-select action bar, Emil Kowalski's orbit loader and cursor-repelling dithered icon, and the Leon Sans 2.0 typeface. Leave room to breathe. Use Leonxlnx/taste-skill (installed here as `design-taste-frontend`, tasteskill v2) and generate several layout variants to choose a direction from.

## Plan and ownership

| Part | Owner | Output |
| --- | --- | --- |
| Audit of every current frontend screen | Coordinator | `design/explorations/AUDIT.md` |
| Reference research (frames of each video, T3 Code theme source, Leon Sans files) | Coordinator | `design/explorations/REFERENCES.md` |
| Shared foundation: tokens, Leon Sans, koi ASCII engine, transfer/refresh/selection/undo simulator | Coordinator | `design/explorations/shared/` |
| Variant A — Pond (T3 Code shell) | Delegated fork A | `design/explorations/a-pond/` |
| Variant B — Ledger (keyboard-first terminal) | Delegated fork B | `design/explorations/b-ledger/` |
| Variant C — Handoff (send and pick-up lanes) | Delegated fork C | `design/explorations/c-handoff/` |
| Variant D — Still water (centred, quiet) | Delegated fork D | `design/explorations/d-still-water/` |
| Comparison index, screenshots, publication | Coordinator | `design/explorations/index.html` |

Acceptance for each variant: login, session-check loading, shelf, empty and offline states; live upload and download speed with ETA and finish time; a visible auto-refresh countdown that pauses while hidden; multi-select with a floating action bar; inline delete with undo; working 390px phone layout; no console errors; taste-skill `inspect.mjs --app` run with every FAIL either fixed or explained.

## Delegation

Each variant was built by its own fork of the coordinator session, writing only inside its own folder, without committing. The coordinator reviewed every returned report and screenshot, committed each folder, and fixed shared helpers centrally.

| Fork | Variant | Returned | Inspector (`inspect.mjs --app`) at return |
| --- | --- | --- | --- |
| A | Pond | All five states, 1440/768/390, no console errors | 1 FAIL kept: contrast of the unfilled ASCII tick tracks |
| B | Ledger | All five states, keyboard map, no console errors | 1 FAIL kept: same track contrast |
| C | Handoff | All five states, koi crossing, no console errors | 0 FAIL, 1 WARN: share of text under 13px (ASCII glyphs and 12px figure lines) |
| D | Still water | All five states, drop pond, no console errors | 1 FAIL kept (track contrast), 1 WARN (mono figures inside the headline sentence) |

The kept contrast FAIL is the unfilled half of tick bars and meters (`#2c2c2e`, about 1.5:1). Those glyphs are `aria-hidden` tracks; the same progress is printed as text beside them. Raising them to 4.5:1 would make empty as loud as full. The owner may overrule.

## Verification

- Baseline: the current dashboard in the synthetic preview, `inspect.mjs --app`: 6 FAIL, 2 WARN (recorded in `design/explorations/AUDIT.md`).
- After the coordinator's shared fixes, every variant was reloaded at `?state=shelf` (1440×900 and 390×844) and `?state=locked` (1440×900) in headless Chromium with the timezone pinned to UTC+8: 12 loads, 0 console or page errors. Those screenshots are in `design/explorations/shots/`.
- The comparison page `design/explorations/index.html` loads with 0 errors at 1440 and 390.
- Not exercised: real file picker and OS drag-and-drop in a real browser, real Google sign-in, the real service. All data is sample data from `shared/storagi.js`.

## Findings and limitations

- The koi favicon was not in the repository at first; the owner then supplied it (a grayscale kohaku curl in glyph cells). It now lives in `design/explorations/shared/brand/`, is every prototype's tab icon and brand mark, is the source the stippled `KoiMark` samples, and replaces `web/public/favicon.svg` (web tests 19/19 and build passed). The `.ico`, PNG and touch icons are not served by production yet: `server/src/static.ts` allows only `/favicon.svg` besides the app shell and assets.
- Owner report: opened from the published page, the variants showed no fish. Reproduced with `prefers-reduced-motion: reduce`: the pond painted its single still frame at construction, while its screen was still hidden. Fixed in `shared/koi.js` (pond and mark repaint and seed fish whenever the canvas gets a size); all four locked screens re-checked with motion on and reduced.
- Leon Sans 2.0 has proportional digits and no `tnum` feature, so live figures are set in a monospace.
- The real service deletes immediately; an undo needs a client-side grace period before the DELETE request.
- Download progress needs the download to run through `fetch` streaming rather than a plain link; see `REFERENCES.md`.
- Shared-helper bugs reported by the forks and fixed by the coordinator: koi colour patches clipped outside the slimmed body; `KoiPond`/`KoiMark` throwing on zero-size canvases and never stopping (guards and `destroy()` added); finish times on the real clock instead of the sample clock (`simNow()`); times shown in the browser's zone instead of UTC+8; `daysLeft` rounding up; `font` shorthands dropping tabular figures. Fork-local workarounds remain in place and still work.
- Remaining weaknesses named by the forks: an empty throughput history for the first seconds (A seeds it), the prototype state bar can cover the last row, truncation of long names at 768px in B, the drawn koi stand-in.

## Owner decisions (2026-10-21)

- Koi motion: "i want them to swim anyway", with a toggle if not too costly. First built as `always`/`system`; superseded the same day by the owner's Settings switch, `storagi.motion` = `swim` (default) or `static`, which never consults `prefers-reduced-motion`. Interface transitions also always play (the shared reduced-motion override was removed).
- Accent: keep the koi red-orange alongside the grayscale mark.

## Owner-reported rendering bugs (2026-10-21)

- Variant A's throughput chart ended unevenly at the right on the owner's Windows browser. Cause: JetBrains Mono came from Google Fonts, whose subsets omit the block and box characters, so the browser substituted fonts of different widths and rows of equal length ended apart. Fixed by self-hosting the full JetBrains Mono 2.304 (OFL, `shared/fonts/`) as "Storagi Mono"; every ASCII glyph in use is in it at one width, except Ledger's `▮▯`, replaced with `▌`. Not reproducible on Linux, where the fallback widths happened to match.
- Variant D's stippled koi was missing on the published page. It sampled `icon-512.png` through a canvas; an image the page cannot read back leaves the mark empty. The mark is now baked into `shared/brand/mark.js` as a grayscale bitmap, with no image request.

## Owner iteration on variant A (2026-10-21)

- Round 1: clock time of the last refresh; checkboxes always visible; "est." instead of "done"; the storage meter and transfer bars drawn as rounded blocks (the owner asked for rounder blocks, not a frame; a first attempt with a frame was removed); the Google sign-in label removed; the sidebar's Transfers item opens and closes the panel at desktop width.
- Settings: a sidebar Settings item opens a Settings view with a "Swimming koi" switch (on: swim, off: one still picture), saved per browser and applied live, with a live preview pond. The koi preference is now the owner's swim/static switch rather than following the system setting. Variants B–D keep the switch in their prototype state bar.
- Found while testing: A's tab click handler matched the app container's own `data-tab` attribute, so every click inside A was treated as a tab click (reset the view, cancelled the click's default). Fixed for `data-tab` and the new `data-view`. Checked: preview moving when on, still when off, still after reload, moving again after switching on; desktop, 1100px and phone menu paths.

## Final design (2026-10-21)

Owner: "i want both of these final version! removes others that were untouched. combine the A and this locked screen C". Variant A becomes `design/explorations/final/`, with C's locked screen: a centred card (the dotted koi over a band of static, "Your shelf is locked.", Continue with Google, "Owner only.") over a full-window koi pond. Behind them sits a faint static decoy of a shelf (the old Send / Pick up layout with made-up rows, owner's request); the real app stays hidden until sign-in. Variants B, C and D, their screenshots, and the helpers only they used (`ticks`, `blocks`, `brailleSpinner`, the state-bar koi toggle) were removed; they remain in Git history. Checked: every final state loads with no console errors, signing in from the locked card returns to the shelf, and the comparison page now presents the final design.

## Final polish (2026-10-21)

Phone and state fixes from the owner's review: menu icon centring, the app name returning to the Inbox, a taller and slightly translucent drop box, more room at the top, toasts stacking above the selection bar with short one-line text, the speed line pinned under the search with a solid flash, the offline banner pinned below the search and an offline-only static speed line, a slimmer offline pill, the last-updated time on phones, the dotted koi filled without holes and following a finger drag, and the static band kept at the owner's request.

## Owner iteration, day 2 (2026-10-22)

The owner asked for five changes to the final design; all are in `final/` and `shared/`, and the handoff brief covers them.

- **Pond waves.** A click or tap on open water (the shelf's pond, the locked screen, the Settings preview) drops three thin rings drawn in glyphs (`~` across the top and bottom, `( )` at the sides, `/ \` between, a faint `·` wake), spreading at about 60 px/s and fading within about 3 s (shortened from about 5 s at the owner's request). A koi startles when a crest passes its head: it turns away from the drop and darts off, calming over about a second. With the koi set to still, the rings still spread but the koi stay put. Clicks on the drop box and on controls do not splash.
- **Select-all bug.** The header checkbox never showed its tick: its click handler called `preventDefault()`, which makes the browser undo the box's toggle after the handler has set the right state. Removed; the box is now ticked when every shown file is selected and a dash when some are, after the owner's reference (a dedicated checkbox column with a tri-state header). A small tick animation was added to all boxes.
- **Drag to select.** Dragging down (or up) across rows selects every row passed; if the first row was already selected, the drag clears instead, and rows the drag leaves again go back. Mouse and touchpad: press anywhere on a row and drag. Touch: drag down the checkbox column, or press and hold a row for about 0.4 s first (a plain vertical drag scrolls the page). The list scrolls by itself near the window's edges.
- **Swipe to delete.** A row dragged left slides over a red strip that lights at about a third of the row's width; letting go there deletes it with the usual 6 s Undo, and a shorter swipe springs back. Works with a mouse drag, a finger, and a touchpad's two-finger sideways swipe.
- **Settings → Swipe gestures.** A second switch turns both gestures on or off, stored per browser as `storagi.gestures` (`on` by default).
- **Sorting.** Name, Size and Expires in the list header sort the list: ascending on the first click, then flipping on each click. While sorted, the list is one run without day headings and a clear button (×) appears at the right end of the header, which returns to newest first in day groups. On phones the header, hidden before, now shows select-all and the three sort buttons.

Checked in headless Chromium (1440×900 and 390×844 with touch, UTC+8), with no console or page errors: the select-all box ticks, clears, and goes from a dash to all; every sort direction and the clear button; a mouse drag selecting rows 1–4 and a drag from a checkbox clearing three; a mouse swipe deleting with Undo and a short swipe springing back; a touchpad sideways wheel deleting while a vertical wheel still scrolls; touch drag down the checkboxes, a tap on one box, a vertical touch drag on a row scrolling without selecting, hold-then-drag selecting, a touch swipe deleting; the row buttons still working by click and tap; waves on the shelf, the locked screen and a phone; and gestures off doing nothing. Not checked on a real phone or touchpad.

## Handoff

The design is final and approved. [`design/explorations/HANDOFF.md`](../../design/explorations/HANDOFF.md) is the implementation brief: what to reuse, how each piece maps onto the real endpoints, the CSP and static-file constraints, the open download decision, and the acceptance list. Stage 49 (port into `web/`) is planned for a different agent; it is not started here, and nothing was deployed.
