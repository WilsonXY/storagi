# 150: Remove the "Saved ·" notes under the settings switches

- Status: completed; independent review pending (stage151)
- Started / last updated: 2026-11-04 (Asia/Kuala_Lumpur)
- Coordinator thread: this T3 thread; the coordinator made this small removal itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from this session's runtime metadata)
- Workspace/branch and starting commit: `t3/drop-settings-saved`, `1b439ec`
- Scope and acceptance criteria: the owner said the "Saved · the koi stay still" and "Saved · swipe gestures off" lines under the settings switches are not needed. Remove them; the switches still save and show their state.

Stage numbers 142–146 are used by two open branches (hover preview, paste upload), so this change starts at 150 to avoid a clash.

## Changes

- `web/src/shelf.html`: the `#koi-saved` and `#gesture-saved` paragraphs are gone.
- `web/src/dashboard.ts`: `switches()` no longer takes a `saved` argument or writes those notes.
- `web/src/style.css`: the unused `.set-saved` rule is gone. The settings grid's 16 px gap still spaces the cards.
- The exploration prototype (`design/explorations/final/app.js`) keeps its notes as history.
- The "Saved · previews on" note comes from open PR #32 (hover preview) and is not on `main`; that branch needs the same removal.

## Verification

- Web suite 95 of 95, `tsc --noEmit`, `vite build` and Prettier check: PASS.
- Chromium on the mock preview (own loopback port, stopped afterwards): after turning off both switches, the page has no `.set-saved`/`#koi-saved`/`#gesture-saved` element and no "Saved" text. Screenshot kept outside Git.

## Handoff

The coordinator opens the PR; no merge, tag or deployment.
