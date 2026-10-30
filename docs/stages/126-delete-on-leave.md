# 126: Leaving the page during Undo deletes for real

- Status: completed; review in stage127
- Started / last updated: 2026-10-31 (Asia/Kuala_Lumpur)
- Coordinator thread: this T3 thread (Claude Code)
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from the runtime's model identification); effort not shown by the runtime, unverified
- Workspace/branch and starting commit: `fix/delete-on-leave`, `26b594f`
- Scope and acceptance criteria: the owner sent a screenshot of a row showing "✓ Deleted · Undo 2s" and asked that refreshing or leaving the site during the Undo window count as an actual delete. Before this change, `pagehide` undid every pending delete (stage51), so the file came back. Reloading or closing during the grace must delete inline and bulk deletes on the server; Undo must still keep the file; a swipe not yet released must still not delete.

## Changes

- `web/src/deferred-delete.ts`: `flush()` ends the grace and runs the delete now; later `undo()` and `flush()` are no-ops.
- `web/src/dashboard.ts`: `pagehide` calls `flush()` instead of `undo()`. DELETE requests use `keepalive: true`, so the browser finishes them after the page is gone. A bulk batch sends its DELETEs in parallel rather than one after another, because only requests started before unload are sent. The 404/410 handling and the first-error report are unchanged. The server takes a lock per file, so parallel deletes of different files do not contend.
- Tests: `deferred-delete.test.ts` covers `flush`; the stage51 `dashboard.test.ts` test "leaving the page restores pending deletes" is replaced by one that checks that `pagehide` sends both an inline and a bulk DELETE at once, with `keepalive`, and leaves no Undo.

## Verification

Private logs and scripts are in `"$HOME/.cache/storagi/tmp"` and `"$HOME/.cache/storagi/repro"` (`leave-126.mjs`), outside Git.

- RED→GREEN: both new tests failed before the change (no DELETE sent on `pagehide`, no `flush`), and pass after it.
- Headless Chromium 1248 against `test:preview` (loopback 5174, synthetic data, `leave-126.log`): an inline delete, reloaded 1 s into the grace, is gone from the server and the list; a two-row bulk delete, with the tab closed 0.5 s into the grace, is gone from the server (5 → 2 files); Undo followed by a reload keeps the file.
- `npm run format:check` PASS. `npm run check` exit 0: 33 server, 91 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds (`check-126.log`).

## Findings and limitations

- `pagehide` does not fire if the browser or phone kills the tab without unloading it (for example, Android discarding a background tab). In that case the delete is never sent and the file stays, as before. Switching tabs or apps without closing them keeps the countdown running, as before.
- A page restored from the back/forward cache after leaving has already sent its DELETEs, so it shows the rows as deleted rather than offering Undo.
- While the preview ran (about 20 s), an existing tailnet-only Tailscale Serve mapping on port 5174, which predates this stage, could reach it. It served synthetic data only; the mapping was left unchanged.

## Handoff

The coordinator commits, runs the stage127 review and opens the PR. No merge, tag or deployment.
