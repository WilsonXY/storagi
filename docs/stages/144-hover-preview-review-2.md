# 144: Re-review of the hover preview fixes

- Status: completed; FAIL, two P2s and two P3s fixed in stage142
- Started / completed: 2026-11-03 (Asia/Kuala_Lumpur)
- Coordinator thread: `c17dcc70-b4f0-4873-ad26-d35daf1b4f1f`; the coordinator wrote this record from the reviewer's report
- Agent/task/thread identifiers: T3 `delegate_task`, role review, isolated worktree; Codex session `01a19faa-7323-7203-a6cf-c2242a62bfc9`
- Provider/model/effort: Codex `gpt-6.1-sol`, reasoning effort high, confirmed in the reviewer's own session log
- Workspace/branch and starting commit: fresh worktree at `5ead6f9` (parent `8521479`)
- Scope and acceptance criteria: read-only check of the stage143 fixes and a fresh look at the whole feature.

## Findings and responses

- P2 `web/src/dashboard.ts`: a failed load (`error`) never cleared the pending load, so that image could not be retried until the page was reloaded. Fixed: `onerror` clears it and dismisses the preview for that row, so it is tried again once the mouse leaves the row and comes back (not on every small movement, which would re-download a broken file over and over).
- P2 `web/src/dashboard.ts`: a refresh that inserted a file above the hovered one kept its preview beside a cursor now resting on a different row. Fixed: `renderInbox()` compares the order of rows and day labels before and after; if anything moved, the preview hides. A refresh that changes nothing keeps it.
- P3: moving to an already loaded image returned before cancelling another image's unfinished load. Fixed: a load for a different file is cancelled first.
- P3: a second Escape set the dismissed row to empty, so the preview reopened on the same row. Fixed: Escape only records a row when a preview was active.

Previous findings, per the reviewer: stale previews partly fixed (insertion remained), loads partly fixed (the error and cached-switch cases remained), Escape partly fixed (second press), cache bound fixed. The reviewer accepted removing `src` as cancellation, citing the HTML image-loading algorithm, without testing current browsers. It found no TDZ, authentication-bypass or content-execution issue.

## Verification

The reviewer reported: `npm run setup` PASS; dashboard 52/52 and preferences 3/3 PASS (one file at a time, thread pool); web typecheck PASS; ten in-memory DOM probes, 6 PASS and 4 FAIL matching the findings; `git diff --check` PASS.

## Handoff

Read-only invariants checked by the coordinator afterwards: this worktree's HEAD `5ead6f9` and status unchanged, remote heads identical to before. The reviewer's worktree was still at `5ead6f9` with a clean status; it and its branch were removed. The coordinator fixed these findings; see stage142 for their verification. Stage145 reviews them together with the video and text previews.
