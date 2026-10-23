# 92: Fix round 91 findings

- Status: completed
- Date: 2026-10-23 +08:00
- Owner: coordinator (Claude Code in T3 Code, thread `90da6e4a-818a-4e67-bc98-98f1606e3cd0`)
- Starting commit: `c13e6ac`
- Scope: the three findings in [91](91-frontend-review-round-5.md)

## Changes

- **Refresh join:** a call to `AutoRefresh.now()` while a fetch is in flight now gets one fresh fetch after it, never the in-flight answer. Further calls in the meantime share that one extra fetch.
- **Double swipe:** gestures ignore new pointer and wheel input while a swipe is settling. `deleteFiles` also refuses any row already counting down or sending, whatever the source, so no row can have two pending deletes.
- **Dead Undo:** when the grace ends, the row switches to the prototype's "Deleting" spinner state. This state also counts as counting down for selection, so the row stays out of select-all and ranges.

## Verification

- Three tests failed on `c13e6ac` and pass after: the double swipe (with `animate()` stubbed to finish after 200 ms, as in a real browser), the "Deleting" row, and the refresh unit test. The refresh test used to assert that overlapping calls join; it now asserts one fresh fetch after the in-flight one.
- `npm run check`: 32 server, 81 web, 11 acceptance tests, both typechecks and builds pass.
