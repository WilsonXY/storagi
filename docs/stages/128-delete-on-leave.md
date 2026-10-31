# 128: Leaving the page during Undo deletes for real

- Status: completed; stage129 review FAIL (two P2s and a suggestion), all fixed here; stage130 review FAIL (one P2), fixed here by owner choice; round 3 in stage131
- Started / last updated: 2026-10-31 / 2026-11-01 (Asia/Kuala_Lumpur)
- Coordinator thread: `a17f8d53-6344-4999-8ff8-d4a3521e6708`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (T3 reports `claude-opus-5-5`, effort high, in this thread's `orchestrator_capabilities` inherited options)
- Workspace/branch and starting commit: `fix/delete-on-leave`, `26b594f`
- Scope and acceptance criteria: the owner sent a screenshot of a row showing "✓ Deleted · Undo 2s" and asked that refreshing or leaving the site during the Undo window count as an actual delete. Before this change, `pagehide` undid every pending delete (stage51), so the file came back. Reloading or closing during the grace must delete inline and bulk deletes on the server; Undo must still keep the file; a swipe not yet released must still not delete.

## Changes

Stage numbers 126 and 127 were taken by the folder-drop fix merged to `main` first; this change was renumbered to 128 and 129 when `main` was merged in.

- `web/src/deferred-delete.ts`: `flush()` ends the grace, emits the zero tick (inline rows switch to "Deleting", so no Undo is left), and runs the delete now; later `undo()` and `flush()` are no-ops.
- `web/src/dashboard.ts`: `pagehide` calls `flush()` instead of `undo()`. The DELETEs sent from `pagehide` use `keepalive: true`, so the browser finishes them after the page is gone; DELETEs sent when the grace simply runs out do not, so ordinary deletes are not subject to keepalive limits. A bulk batch sends its DELETEs in parallel rather than one after another, because only requests started before unload are sent. The 404/410 handling and the first-error report are unchanged. The server takes a lock per file, so parallel deletes of different files do not contend.
- Next-visit resend (stage130 P2, owner chose this option): `pagehide` also saves the ids of every copy still counting down or being deleted to `localStorage` (`storagi.leftDeletes`, merged with any already there). When the dashboard opens, before it loads the list, it resends a DELETE for each saved id (no `keepalive`); ids that succeed or are already gone (404/410) are removed from the list, and ones that fail stay for the next visit. Non-string or malformed stored values are ignored. The 404/410 check is shared by both paths.
- Tests: `deferred-delete.test.ts` covers `flush`; the stage51 `dashboard.test.ts` test "leaving the page restores pending deletes" is replaced by one that holds every DELETE unanswered and checks that `pagehide` starts the inline DELETE and both files of a folded bulk batch at once, all with `keepalive`, and that no row Undo or Undo toast is left (as after a back/forward-cache restore). Another test checks that a delete whose grace runs out does not use `keepalive`. Two more check that `pagehide` saves the pending ids, and that the next visit resends saved ids before loading the list, keeping only the one that failed (503) and dropping the deleted and already-gone ones.

## Verification

Private logs and scripts are in `"$HOME/.cache/storagi/tmp"` and `"$HOME/.cache/storagi/repro"` (`leave-126.mjs`, `record-130.mjs`, `drop-proxy-130.mjs`), outside Git. PR proof is in `"$HOME/.cache/storagi/proof-126"` and `"$HOME/.cache/storagi/proof-130"`.

- RED→GREEN: both new tests failed before the change (no DELETE sent on `pagehide`, no `flush`), and pass after it. The three tests added for the stage129 findings failed on `2b42e0b` (Undo left on the row, `keepalive` on an ordinary delete, no zero tick from `flush`) and pass after the fixes.
- Headless Chromium 1248 against `test:preview` (loopback 5174, synthetic data, `leave-126.log`): an inline delete, reloaded 1 s into the grace, is gone from the server and the list; a two-row bulk delete, with the tab closed 0.5 s into the grace, is gone from the server (5 → 2 files); Undo followed by a reload keeps the file.
- `npm run format:check` PASS. `npm run check` exit 0: 33 server, 91 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds (`check-126.log`). After the stage129 fixes: 33 server, 92 web, 11 HTTP and 154 deploy tests, typechecks and builds PASS (`check-126b.log`), and the Chromium reproduction gives the same results (`leave-126b.log`).
- Next-visit resend: both new tests failed before it (nothing saved; no DELETE on load) and pass after it. `npm run format:check` PASS; `npm run check` exit 0 after merging `main`: 33 server, 96 web, 11 HTTP and 154 deploy tests, typechecks and builds (`check-130.log`).
- Headless Chromium, recorded, through a loopback proxy (`drop-proxy-130.mjs`, port 5186 in front of the mock on 5185) that drops every DELETE sent while the page closes, as Chromium does past its keepalive limit: three copies deleted in bulk, then a reload during the grace. On the previous PR head `9141580` all three copies stay on the server (5 files); with this change all three are gone (2 files) and the saved list is cleared. The reload/close/Undo reproduction still passes (`leave-130.log`).

## Findings and limitations

- `pagehide` does not fire if the browser or phone kills the tab without unloading it (for example, Android discarding a background tab). In that case the delete is never sent and the file stays, as before. Switching tabs or apps without closing them keeps the countdown running, as before.
- A page restored from the back/forward cache after leaving has already sent its DELETEs, so it shows inline rows as "Deleting" and no Undo toast.
- Chromium allows 256 keepalive requests per frame. If more than 256 copies are counting down when the page closes, the extra DELETEs are dropped. A refresh resends them at once, because the page reloads; leaving resends them on the next visit in the same browser. If the owner never returns in that browser, those copies stay until their 30-day expiry. The reviewer's bulk-delete endpoint was not built: it changes the server API, and Chromium's 64 KiB keepalive body quota would still cap it at roughly 1,600 ids.
- While the preview ran on port 5174 (about 20 s, twice), an existing tailnet-only Tailscale Serve mapping on that port, which predates this stage, could reach it. It served synthetic data only; the mapping was left unchanged. Later runs used loopback ports 5185 and 5186, which have no mapping.

## Handoff

The coordinator commits, runs the stage131 review and updates PR #26. No merge, tag or deployment.
