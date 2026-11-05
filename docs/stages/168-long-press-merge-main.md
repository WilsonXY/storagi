# 168: Merge `main` (preview placeholder) into the long press branch

- Status: completed; stage169 review PASS
- Started / last updated: 2026-11-04 (Asia/Kuala_Lumpur)
- Coordinator thread: Claude Code session `7c605ea2-6f35-4a84-a343-eba74077428c`
- Agent/task/thread identifiers: none; the coordinator merged it itself
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from this session's runtime metadata)
- Workspace/branch and starting commit: `t3/long-press-preview` (PR #38) at `1a76b99`, merging `origin/main` at `66dfbe8` (PR #37, the hover preview placeholder)
- Scope and acceptance criteria: PR #38 conflicted with `main`. Merge `main` in, keep the intent of both sides, and check that the project still builds and passes.

PR #37's stage records took numbers 162 to 165 at the same time as this branch's 162 to 165. Both sets are kept, as the stage rules allow; their names differ.

## Decisions

- `dashboard.ts`: both sides added a variable to the same declaration (`skeletonTimer` from `main`, `press` from this branch); both are kept. `hidePreview()` clears both.
- `style.css`: both sides added a rule after the preview image rule (the `pointer: coarse` selection rule and `.preview-skeleton`); both are kept.
- `main`'s placeholder (a pulsing box shown at 0.2 s so resting the mouse visibly did something) was mouse-only, because the long press did not exist on `main`. To keep that intent for touch, a long press also shows the placeholder when it fires at 0.5 s and the preview is not already loaded, until the preview replaces it. The placeholder check moves into a shared `placeholder(id)`, which also requires the preview still to be wanted for that file. Mouse timing is unchanged: placeholder at 0.2 s, download at 0.3 s.

## Changes

- Merge commit with the two conflicts resolved as above.
- `web/src/dashboard.ts`: `placeholder(id)`, used by the mouse's 0.2 s timer and by the long press.
- `web/tests/dashboard.test.ts`: the touch test expects nothing at 499 ms, then the placeholder at 500 ms, replaced by the image once it loads.

## Verification

- After resolving, before the touch placeholder: dashboard 56/56 PASS. The touch placeholder check then failed (no placeholder) and passes with `placeholder(id)`; dashboard 56/56, web typecheck PASS.
- `npm run format:check` PASS; `npm run check` exit 0 (33 server, 110 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds).
- Chromium on the mock preview, phone emulation: `longpress.mjs` twice, `name-hit.mjs`, `landscape.mjs` gave the same results as before the merge; `name-hit-mouse.mjs` at 1280 px likewise. `touch-skeleton.mjs`, with each download delayed 2 s: holding a finger on an image name showed nothing at 0.3 s, the placeholder at 0.7 s, the image at 3.2 s, and nothing after lifting.

## Handoff

Stage169 reviewed the merge: PASS.
