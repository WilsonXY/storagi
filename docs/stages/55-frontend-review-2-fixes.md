# 55: Fix review round 2 suggestions

- Status: completed
- Date: 2026-10-23 +08:00
- Owner: coordinator (Claude Code in T3 Code, thread `90da6e4a-818a-4e67-bc98-98f1606e3cd0`)
- Starting commit: `0738748`
- Scope: N1–N4 from [54](54-frontend-review-round-2.md)

## Changes

- **N1:** one Undo covers every pending bulk batch; a second bulk delete shows the combined count, and its Undo restores both batches.
- **N2:** a bulk delete tries every copy. A 404/410 counts as already deleted; any other failure is reported once, after the rest were tried, and the list refreshes. `request()` errors now carry their HTTP status.
- **N3:** notices raised during an Undo toast queue up and show in order.
- **N4:** `AutoRefresh.last` is 0 until the first successful fetch; the offline banner and pill say "last good —" until then.

A single inline delete that gets a 404/410 now also counts as deleted (no error toast). The friendly expired-copy message is still used for downloads, and its test now goes through a download.

## Verification

- Four new dashboard tests (two bulk deletes with one Undo, bulk delete past a 404, queued notices in order, no false "last good") failed before the change and pass after.
- `npm run check`: 32 server, 70 web, 11 acceptance tests, both typechecks and builds pass.
