# 64: Fix round 63 finding

- Status: completed; not independently re-reviewed (the owner's extra review budget is used)
- Date: 2026-10-23 +08:00
- Owner: coordinator (Claude Code in T3 Code, thread `90da6e4a-818a-4e67-bc98-98f1606e3cd0`)
- Starting commit: `15d04fc`

## Change

`counting()` in `web/src/dashboard.ts` now also counts rows hidden by a pending bulk batch. So a swipe that finishes after a bulk delete of the same row is refused, whichever order the two happen in. One line.

## Verification

- A new test (row selected, touchpad swipe, bulk Delete during the 200 ms exit animation, bulk Undo) failed on `15d04fc` and passes after. No DELETE is sent.
- `npm run check`: 32 server, 82 web, 11 acceptance tests, both typechecks and builds pass.
