# 128: Leaving the page during Undo deletes for real

- Status: completed; stage129 review FAIL (two P2s and a suggestion), all fixed here; stage132 review FAIL (one P2), accepted as a limit by owner choice after a resend attempt that stage133 failed
- Started / last updated: 2026-10-31 / 2026-11-01 (Asia/Kuala_Lumpur)
- Coordinator thread: `a17f8d53-6344-4999-8ff8-d4a3521e6708`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (T3 reports `claude-opus-5-5`, effort high, in this thread's `orchestrator_capabilities` inherited options)
- Workspace/branch and starting commit: `fix/delete-on-leave`, `26b594f`
- Scope and acceptance criteria: the owner sent a screenshot of a row showing "✓ Deleted · Undo 2s" and asked that refreshing or leaving the site during the Undo window count as an actual delete. Before this change, `pagehide` undid every pending delete (stage51), so the file came back. Reloading or closing during the grace must delete inline and bulk deletes on the server; Undo must still keep the file; a swipe not yet released must still not delete.

## Changes

Stage numbers 126 and 127 were taken by the folder-drop fix merged to `main` first; this change was renumbered to 128 and 129 when `main` was merged in. Its later review rounds were planned as 130 and 131, but the README rewrite merged to `main` used those numbers, so they became 132 and 133.

- `web/src/deferred-delete.ts`: `flush()` ends the grace, emits the zero tick (inline rows switch to "Deleting", so no Undo is left), and runs the delete now; later `undo()` and `flush()` are no-ops.
- `web/src/dashboard.ts`: `pagehide` calls `flush()` instead of `undo()`. The DELETEs sent from `pagehide` use `keepalive: true`, so the browser finishes them after the page is gone; DELETEs sent when the grace simply runs out do not, so ordinary deletes are not subject to keepalive limits. A bulk batch sends its DELETEs in parallel rather than one after another, because only requests started before unload are sent. The 404/410 handling and the first-error report are unchanged. The server takes a lock per file, so parallel deletes of different files do not contend.
- Next-visit resend, added and then removed: for the stage132 P2, the owner first chose to have `pagehide` save pending ids to `localStorage` and the next visit resend them (`16f8fa5`). Stage133 found four bugs in it (two tabs could lose each other's saved deletes, a back/forward-cache return never resent, a later Undo did not cancel an older saved delete, and a malformed saved id stopped the dashboard loading). The owner then chose to drop it and keep the documented limit; `web/` was restored to the stage132-reviewed `1109d98` (revert commit after `16f8fa5`).
- Tests: `deferred-delete.test.ts` covers `flush`; the stage51 `dashboard.test.ts` test "leaving the page restores pending deletes" is replaced by one that holds every DELETE unanswered and checks that `pagehide` starts the inline DELETE and both files of a folded bulk batch at once, all with `keepalive`, and that no row Undo or Undo toast is left (as after a back/forward-cache restore). Another test checks that a delete whose grace runs out does not use `keepalive`.

## Verification

Private logs and scripts are in `"$HOME/.cache/storagi/tmp"` and `"$HOME/.cache/storagi/repro"` (`leave-126.mjs`, `record-126.mjs`), outside Git. PR proof is in `"$HOME/.cache/storagi/proof-126"`.

- RED→GREEN: both new tests failed before the change (no DELETE sent on `pagehide`, no `flush`), and pass after it. The three tests added for the stage129 findings failed on `2b42e0b` (Undo left on the row, `keepalive` on an ordinary delete, no zero tick from `flush`) and pass after the fixes.
- Headless Chromium 1248 against `test:preview` (loopback 5174, synthetic data, `leave-126.log`): an inline delete, reloaded 1 s into the grace, is gone from the server and the list; a two-row bulk delete, with the tab closed 0.5 s into the grace, is gone from the server (5 → 2 files); Undo followed by a reload keeps the file.
- `npm run format:check` PASS. `npm run check` exit 0: 33 server, 91 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds (`check-126.log`). After the stage129 fixes: 33 server, 92 web, 11 HTTP and 154 deploy tests, typechecks and builds PASS (`check-126b.log`), and the Chromium reproduction gives the same results (`leave-126b.log`).
- Resend (since removed): its two tests failed before it and passed after it, and a recorded Chromium run through a loopback proxy that dropped the closing page's DELETEs showed the previous head keeping three copies and the resend deleting them (`check-130.log`, `leave-130.log`, `"$HOME/.cache/storagi/proof-130"`). This evidence covers only the removed code.
- Final code (resend removed, `main` with the README rewrite merged): see the stage133 handoff for the final check.

## Findings and limitations

- `pagehide` does not fire if the browser or phone kills the tab without unloading it (for example, Android discarding a background tab). In that case the delete is never sent and the file stays, as before. Switching tabs or apps without closing them keeps the countdown running, as before.
- A page restored from the back/forward cache after leaving has already sent its DELETEs, so it shows inline rows as "Deleting" and no Undo toast.
- Chromium allows 256 keepalive requests per frame. If more than 256 copies are counting down when the page closes, the extra DELETEs are dropped and those copies stay on the shelf until their 30-day expiry (they are not lost). The owner accepted this limit (stage132/133). A bulk-delete endpoint was not built: it changes the server API, and Chromium's 64 KiB keepalive body quota would still cap it at roughly 1,600 ids.
- While the preview ran on port 5174 (about 20 s, twice), an existing tailnet-only Tailscale Serve mapping on that port, which predates this stage, could reach it. It served synthetic data only; the mapping was left unchanged. Later runs used loopback ports 5185 and 5186, which have no mapping.

## Handoff

The coordinator updates PR #26 and watches CI. No merge, tag or deployment.
