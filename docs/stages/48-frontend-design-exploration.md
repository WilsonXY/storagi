# 48: Frontend design exploration (dark ASCII koi direction)

- Status: completed; owner to choose a direction
- Started: 2026-10-21 16:00 +08:00; completed 2026-10-21
- Coordinator thread: Claude Code cloud session on branch `claude/nifty-knuth-k90bhs`, starting commit `1fa9cd8`.
- Agent/task identifiers: coordinator plus four delegated variant builders (forks of the coordinator session), listed under Delegation.
- Provider/model/effort: the session is configured for Claude Opus 5.5; the serving model per turn is not independently proven here. Forks inherit the coordinator's model.
- Scope: design exploration only. Static prototypes under `design/explorations/`; no change to `web/`, `server/`, deployment or the running service. Nothing deployed or exposed; local preview servers bind to `127.0.0.1`.

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

- The koi favicon is not in the repository on any branch (only the orange "s." SVG). Variants use a drawn stand-in until the owner supplies the file.
- Leon Sans 2.0 has proportional digits and no `tnum` feature, so live figures are set in a monospace.
- The real service deletes immediately; an undo needs a client-side grace period before the DELETE request.
- Download progress needs the download to run through `fetch` streaming rather than a plain link; see `REFERENCES.md`.
- Shared-helper bugs reported by the forks and fixed by the coordinator: koi colour patches clipped outside the slimmed body; `KoiPond`/`KoiMark` throwing on zero-size canvases and never stopping (guards and `destroy()` added); finish times on the real clock instead of the sample clock (`simNow()`); times shown in the browser's zone instead of UTC+8; `daysLeft` rounding up; `font` shorthands dropping tabular figures. Fork-local workarounds remain in place and still work.
- Remaining weaknesses named by the forks: an empty throughput history for the first seconds (A seeds it), the prototype state bar can cover the last row, truncation of long names at 768px in B, the drawn koi stand-in.

## Handoff

The owner picks a direction (or a mix); a later stage ports it into `web/` with tests.
