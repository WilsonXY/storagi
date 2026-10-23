# 96: Fix round 95 findings at the root

- Status: completed; not independently re-reviewed (the owner's extra review budget is used)
- Date: 2026-10-23 +08:00
- Owner: coordinator (Claude Code in T3 Code, thread `90da6e4a-818a-4e67-bc98-98f1606e3cd0`)
- Starting commit: `37ff81e`

## Change

Rounds 93 and 95 found races because a swipe only decided to delete when its exit animation ended, so anything that happened during those 200 ms (a bulk delete, its Undo) could race it. Now:

- A released swipe registers its delete immediately, as an ordinary inline delete with its own 6 s Undo (`web/src/gestures.ts`). The animation plays afterwards.
- The list always re-renders when a swipe settles, whether or not it deleted.

Because the swiped row already counts as deleting, a bulk delete during the animation leaves it out, exactly as it does for a row deleted inline. Bulk Undo never touches it, and the swipe's own Undo stays visible on the row.

## Behaviour clarified

A swipe is a delete of its own. If a row is swiped and then also caught in a bulk delete, the bulk toast does not count it, and bulk Undo does not restore it. The row shows "✓ Deleted · Undo" for its own grace, as the prototype does for every swiped row. The round 93 test, which expected bulk Undo to cancel the swipe too, was replaced by two tests that pin this behaviour down.

## Verification

- Both new tests failed on `37ff81e` and pass after:
  - swipe, then bulk delete and bulk Undo during the animation; the swiped row keeps its own Undo, which keeps the file
  - the list re-renders after a refused swipe, so select-all excludes the swiped row
- The earlier double-swipe and touchpad-Undo tests still pass.
- `npm run check`: 32 server, 83 web, 11 acceptance tests, both typechecks and builds pass.
