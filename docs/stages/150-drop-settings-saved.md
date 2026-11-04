# 150: Remove the "Saved ·" notes under the settings switches

- Status: completed; stage151 review PASS, no findings; merge with `main` reviewed in stage152
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
- After PR #32 (hover preview) merged into `main`, merging `main` here conflicted. The merge also drops that PR's `#preview-saved` note ("Saved · previews on/off"), which the owner's screenshot included, and its test now checks the switch's `aria-checked` instead of the note text.

## Verification

- Web suite 95 of 95, `tsc --noEmit`, `vite build` and Prettier check: PASS.
- Chromium on the mock preview (own loopback port, stopped afterwards): after turning off both switches, the page has no `.set-saved`/`#koi-saved`/`#gesture-saved` element and no "Saved" text. Screenshot kept outside Git.

- After merging `main`: web suite 101 of 101, typecheck, build and Prettier PASS. In Chromium, with all three switches turned off, the page has no "Saved" text and none of the three note elements.
- Second merge of `main` (after PR #30, paste upload): only the stage index conflicted; both sides' rows were kept (150–152, then 153–157). Web suite 108 of 108, typecheck, build and Prettier PASS. One earlier run under host load (load average about 12) failed `font-build.test.ts` and reported only 9 of 12 files; the full rerun and that test alone passed.

## Handoff

The coordinator opens the PR; no merge, tag or deployment.
