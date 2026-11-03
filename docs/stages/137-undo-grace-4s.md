# 137: Shorten the delete Undo grace to 4 seconds

- Status: completed; stage138 review PASS, its suggestion fixed
- Started / last updated: 2026-11-03 (Asia/Kuala_Lumpur)
- Coordinator thread: this T3 thread; the coordinator made this one-value change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from this session's runtime metadata)
- Workspace/branch and starting commit: `t3/undo-grace-4s`, `e7b9d45`
- Scope and acceptance criteria: the owner asked to shorten the time a deleted copy can be restored with Undo from 6 s to 4 s (first 5 s, then 4 s). The inline row clock, the bulk toast and its clock, and the deferred DELETE must all use 4 s; Undo and leave-the-page behaviour are unchanged.

## Changes

- `web/src/deferred-delete.ts`: exports `GRACE_SECONDS = 4`, the default grace.
- `web/src/dashboard.ts`: the inline row clock and the bulk toast's duration and clock read `GRACE_SECONDS` instead of three separate `6` literals.
- `web/tests/deferred-delete.test.ts`, `web/tests/dashboard.test.ts`: the boundary checks move from 5999/6000 ms to 3999/4000 ms; the fold test now starts its second bulk delete at 2 s and checks at 5 s, after the first batch's old 4 s deadline and before the fresh one.
- `design/explorations/HANDOFF.md`, `design/explorations/REFERENCES.md`: the stated grace is now 4 s. The exploration prototype (`design/explorations/final/app.js`) and earlier stage records keep 6 s as history.

## Verification

- Tests changed first: the web suite failed 4 tests against the 6 s code, then passed after the change.
- Web suite after the change: 94 of 94 PASS. Server 33 of 33, deploy 154 of 154, both typechecks, both builds and `npm run format:check`: PASS.
- `npm run test:acceptance`: FAIL twice, the same server test each time (`acceptance-review-fixes.test.ts`, half-open PATCH then DELETE, which hit its timeout after about 21 s). The host's load average was about 15 from other work during both runs; one full `npm run check` also had vitest workers time out at startup and passed when run alone. This change touches no server or acceptance code, and stage134 recorded the same half-open DELETE timing out. Left for CI on a clean runner.
- Browser proof on the mock preview (own port, loopback, stopped afterwards): right after confirming an inline delete the row read "✓ Deleted · Undo · 4s", and the DELETE request went out 3,976 ms after the confirm click. Screenshot kept outside Git.
- After stage138: the touchpad swipe test is renamed to "four-second Undo" and checks that the row clock reads 4s; web suite 94 of 94 PASS again.

## Handoff

The coordinator opens the PR; no merge, tag or deployment.
