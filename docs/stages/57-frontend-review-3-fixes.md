# 57: Fix review round 3 findings

- Status: completed; not yet independently re-reviewed
- Date: 2026-10-23 +08:00
- Owner: coordinator (Claude Code in T3 Code, thread `90da6e4a-818a-4e67-bc98-98f1606e3cd0`)
- Starting commit: `6d1dfd8`
- Scope: B1 and S1–S4 from [56](56-frontend-review-round-3.md)

## Changes

- **B1:** a bulk delete leaves out rows already counting down inline; those keep their own Undo. If nothing is left, it only clears the selection.
- **S1:** a new bulk delete cancels earlier pending bulk batches without sending anything and starts one delete for all their copies with a fresh 6 s grace and one toast. This replaces round 2's count map.
- **S2:** the pill and banner share one "last good" value, "—" until the first successful load.
- **S3:** the N2 test now asserts that no notice appears. A new test covers a single inline delete answered with 404 (no error) and a bulk delete where one copy gets a 500 (the rest are still deleted, one "boom" notice).
- **S4:** identical notices waiting behind an Undo show once; `pagehide` also closes the toast whose deletes it just undid.

Tests that clicked `.toast button` now click `#notice button`, the live toast; a replaced toast stays in the DOM for its 300 ms exit animation, where `pointer-events: none` already keeps it out of reach.

## Verification

- New tests for B1, S1 and S2 failed on `6d1dfd8` and pass after. The S3 delete-failure test passed before and after (it was a coverage gap, not a bug).
- `npm run check`: 32 server, 74 web, 11 acceptance tests, both typechecks and builds pass.

## Review status

Rounds 52, 54 and 56 used the three fix-and-re-review rounds the review process allows. These fixes have not been independently reviewed; the owner decides whether to run a fourth focused round before the PR.
