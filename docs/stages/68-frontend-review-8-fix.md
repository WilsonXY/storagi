# 68: Fix round 67 findings

- Status: completed; not independently re-reviewed
- Date: 2026-10-23 +08:00
- Owner: coordinator (Claude Code in T3 Code, thread `90da6e4a-818a-4e67-bc98-98f1606e3cd0`)
- Starting commit: `91934d1`

## Changes

- **Live state, not the held-back render:** a `selectable()` helper filters `order` through the live `counting()` check. It drives select-all, the header box, Ctrl/Cmd-A, shift ranges and drags, so a row being deleted is never selected, even while a swipe holds back the re-render.
- **Stale buttons:** on a row already being deleted, every row button except Undo does nothing.
- **Unreleased swipe at `pagehide`:** gestures gain `cancel()`, which `pagehide` calls first. An unfinished pointer or touchpad swipe snaps back instead of committing later; released swipes keep their own Undo as before.

## Verification

- Three tests failed on `91934d1` and pass after: stale Delete then Cancel during the settle keeps the swipe's Undo; Ctrl+A during the settle leaves the swiped row out; `pagehide` before a touchpad swipe's release cancels it.
- `npm run check`: 32 server, 86 web, 11 acceptance tests, both typechecks and builds pass.
