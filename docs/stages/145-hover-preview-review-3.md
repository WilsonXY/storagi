# 145: Review of the video and text previews

- Status: completed; FAIL, four P2s and a P3; three P2s and the P3 fixed in stage142, the download-bound P2 settled by the owner's 6 s cap
- Started / completed: 2026-11-03 (Asia/Kuala_Lumpur)
- Coordinator thread: `c17dcc70-b4f0-4873-ad26-d35daf1b4f1f`; the coordinator wrote this record from the reviewer's report
- Agent/task/thread identifiers: T3 `delegate_task`, role review, isolated worktree; Codex session `01a1a05d-1345-7751-af70-555c33c13c07`
- Provider/model/effort: Codex `gpt-6.1-sol`, reasoning effort high, confirmed in the reviewer's own session log
- Workspace/branch and starting commit: fresh worktree at `54544b8` (planned as stage140; renumbered to 145 when `main` was merged, see stage142)
- Scope and acceptance criteria: read-only check of the stage144 fixes (`5ead6f9..660d6bf`) and of the video and text previews (`660d6bf..54544b8`).

## Findings and responses

- P2: a video still loading (before `loadeddata`) was not stopped on hide, Escape, view change or a render that moved rows, so its download continued. Fixed: hiding cancels a pending video load; image and text loads are still kept for reuse.
- P2: a cancelled text read that had already resolved could call `done()` and clear the tracking of the next load (shown with a video). Fixed: each load has its own identity, and only the tracked load may finish or fail.
- P2: the 4 KiB text limit counted characters, so multibyte text read up to 12,288 bytes when a server ignored the range; reader clean-up was skipped on errors. Fixed: bytes are counted and copied up to 4,096, decoded once in stream mode, and the reader is cancelled in `finally`.
- P2: looping the first 3 s does not bound what a video downloads; browsers may fetch the whole file. Confirmed by measurement (stage142) and put to the owner, who chose a 6 s cap: 6 s after a video preview starts loading, its download stops and the preview freezes on its current frame (or is dropped if not yet loaded).
- P3: videos shorter than 3 s froze at the end. Fixed: `loop` is set.

Previous (stage144) findings: all four fixed, per the reviewer. It found no security issue (text via `textContent`, CSP and authorization unchanged), and judged the text extension list sensible.

## Verification

The reviewer reported: `npm run setup` PASS; dashboard 54/54 and preferences 3/3 PASS (single thread worker); web typecheck and `git diff --check` PASS; in-memory probes using the loader source reproduced the first three findings and the short-video freeze. It ran no real browser and no bandwidth measurement.

## Handoff

Read-only invariants checked by the coordinator afterwards: this worktree's HEAD `54544b8` and status unchanged. The remote branch `t3/file-type-column` had moved, but to a merge commit made in another session's worktree at 15:46; the reviewer's session log contains no `git push` and no mention of that branch. The reviewer's worktree was still at `54544b8` with a clean status; it and its branch were removed. Stage146 reviews the fixes.
