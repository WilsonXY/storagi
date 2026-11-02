# 138: Independent review of the file type column

- Status: completed; FAIL, both P2s addressed in stage137
- Started / last updated: 2026-11-03 (Asia/Kuala_Lumpur)
- Coordinator thread: `4196e13a-ee30-4f39-b1ff-391f6ff80243`
- Agent/task/thread identifiers: T3 `delegate_task` review child, role `review`, `isolation: "worktree"`; Codex session `01a19e28-a3a5-79a0-9eb0-add7b45162d2`
- Provider/model/effort: Codex `gpt-6.1-sol`, reasoning effort `high`, confirmed in the reviewer's own session log (`model` and `reasoning_effort` fields, working directory the review worktree)
- Workspace/branch and starting commit: fresh worktree on `t3/type-column-review` at `29b2cbf`, reviewing `e7b9d45..29b2cbf`
- Scope and acceptance criteria: read-only review of stage137: `splitName` edge cases and the type sort, escaping of new row HTML, the full filename kept for tooltip, search, downloads and labels, desktop and phone layout, test coverage and the accuracy of the stage137 record.

## Findings and responses

1. P2, `web/src/sorting.ts`: sorting Type Z to A puts files without a type last, which contradicted stage137's claim that they always sort first. Response: the plain reversal is kept, because it matches how Name Z to A behaves. The record was corrected, and the test now also checks the Z to A order.
2. P2, `web/src/style.css` phone meta line: at 320px a 10-character type with size and expiry is wider than the 136px track, and the line can run under the row actions. The reviewer found this by reading the CSS; its browser timed out. Response: the coordinator reproduced it in Chromium (last item ending at x = 236 against the actions at x = 216) and fixed it with `flex-wrap: wrap`; afterwards the line fits. Evidence is in stage137.

The reviewer confirmed that every new interpolation is escaped, and that the full filename is still used for the tooltip, search, downloads, accessible labels and duplicate detection. It checked ten filename edge cases and both sort directions by transpiling the code in memory. Its web Vitest run could not start workers on the loaded host, so that part is inconclusive.

## Handoff

Read-only invariants: the coordinator checkout's HEAD (`29b2cbf`), clean status and `origin` heads matched before and after. The review worktree was still at `29b2cbf` with no changes other than ignored `node_modules`. The coordinator then removed the worktree and the `t3/type-column-review` branch. No re-review: the two fixes are small and were verified directly.
