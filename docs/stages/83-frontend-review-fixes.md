# 83: Fix review round 1 findings

- Status: completed
- Date: 2026-10-23 +08:00
- Owner: coordinator (Claude Code in T3 Code, thread `90da6e4a-818a-4e67-bc98-98f1606e3cd0`)
- Starting commit: `09e1a88`
- Scope: the findings in [82](82-frontend-review.md)

## Changes

- **B1:** `AutoRefresh.now()` always fetches. Polling still stops while hidden, because the 1 s tick and the visibility handler are the only automatic callers. The first load of a background tab and the offline retry now work.
- **S1:** any stream failure aborts the request before aborting the file.
- **S2:** 404/410 show "This copy has expired or was removed. Refresh your Inbox." before any server text.
- **S3:** one set of pending deletes; `pagehide` undoes them (the rows come back), which matches "leaving the page keeps the file". Downloads use a set too, so neither list grows without bound.
- **S4:** an Undo toast is never replaced; a notice raised meanwhile waits and shows after it.
- **S5:** duplicate rows name their copy in the checkbox, Download and Delete labels.
- **S6:** "1 file queued", "3 files queued".
- **S8:** removed the test-only and unused APIs and the clock/timer injection on `AutoRefresh`, `OfflineRetry` and `deferredDelete` (tests use fake timers). The one-microtask start in `now()` stays: without it, a synchronous throw reaches `finally` before `pending` is set and wedges later refreshes (an existing test caught this during the change).

Tests that only exercised removed APIs lost those assertions; the behaviour they described is covered elsewhere (queue ETA in `transfer-view`, the toggle through the dashboard's select-all test).

## Verification

- Five new dashboard regression tests (hidden-tab mount, pagehide restores pending deletes, Undo toast survives a later notice, expired-copy message plus duplicate labels, failed disk write aborts the request) fail on `09e1a88` and pass after the fix. A sixth (touchpad swipe through Undo) is new coverage and passes on both.
- `npm run check`: 32 server, 66 web, 11 acceptance tests, both typechecks and builds pass.
