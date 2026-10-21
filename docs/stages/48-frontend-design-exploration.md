# 48: Frontend design exploration (dark ASCII koi direction)

- Status: in progress
- Started: 2026-10-21 16:00 +08:00
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

Filled in as each fork returns.

## Verification

Filled in at completion.

## Findings and limitations

- The koi favicon is not in the repository on any branch (only the orange "s." SVG). Variants use a drawn stand-in until the owner supplies the file.
- Leon Sans 2.0 has proportional digits and no `tnum` feature, so live figures are set in a monospace.
- The real service deletes immediately; an undo needs a client-side grace period before the DELETE request.
- Download progress needs the download to run through `fetch` streaming rather than a plain link; see `REFERENCES.md`.

## Handoff

The owner picks a direction (or a mix); a later stage ports it into `web/` with tests.
