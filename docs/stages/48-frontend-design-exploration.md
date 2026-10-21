# 48: Frontend design exploration (dark ASCII koi direction)

- Status: completed; owner to choose a direction
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

- Koi motion: "i want them to swim anyway", with a toggle if not too costly. Implemented as one stored preference in `shared/storagi.js` (`storagi.motion`): `always` (default) swims regardless of `prefers-reduced-motion`; `system` follows it. The pond, stippled mark, loader and variant C's crossing read it and switch live without a reload. Prototypes show it as "Koi: swim / system" in the state bar; in the app it belongs in the account menu. Checked in all four variants with the browser set to reduced motion: moving by default, still on `system`, moving again after switching back. CSS micro-transitions still follow the system setting.
- Accent: keep the koi red-orange alongside the grayscale mark.

## Owner-reported rendering bugs (2026-10-21)

- Variant A's throughput chart ended unevenly at the right on the owner's Windows browser. Cause: JetBrains Mono came from Google Fonts, whose subsets omit the block and box characters, so the browser substituted fonts of different widths and rows of equal length ended apart. Fixed by self-hosting the full JetBrains Mono 2.304 (OFL, `shared/fonts/`) as "Storagi Mono"; every ASCII glyph in use is in it at one width, except Ledger's `▮▯`, replaced with `▌`. Not reproducible on Linux, where the fallback widths happened to match.
- Variant D's stippled koi was missing on the published page. It sampled `icon-512.png` through a canvas; an image the page cannot read back leaves the mark empty. The mark is now baked into `shared/brand/mark.js` as a grayscale bitmap, with no image request.

## Handoff

The owner picks a direction (or a mix); a later stage ports it into `web/` with tests.
