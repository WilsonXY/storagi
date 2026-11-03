# 146: Re-review of the stage145 fixes and the 6 s video cap

- Status: completed; FAIL, one P2 and one P3, both fixed in stage142
- Started / completed: 2026-11-03 (Asia/Kuala_Lumpur)
- Coordinator thread: `c17dcc70-b4f0-4873-ad26-d35daf1b4f1f`; the coordinator wrote this record from the reviewer's report
- Agent/task/thread identifiers: T3 `delegate_task`, role review, isolated worktree; Codex session `01a1a084-43ab-7552-b892-17c5fefab828`
- Provider/model/effort: Codex `gpt-6.1-sol`, reasoning effort high, confirmed in the reviewer's own session log
- Workspace/branch and starting commit: fresh worktree at `5397d6b`
- Scope and acceptance criteria: read-only check of the stage145 fixes and the 6 s cap (`54544b8..d35bde8`), the merge of `main` with the 4 s Undo grace and the type column (`d35bde8..ad2d1b6`), and the whole feature.

## Findings and responses

- P2 `web/src/dashboard.ts`: a video that failed while loading was untracked without being stopped, so its 6 s timer stayed armed; one shared timer handle meant that when it fired, `stopVideo` of the failed video cleared the next video's cap, and that video kept downloading (reproduced in memory: still sourced after 25 s). Fixed: a failed load is cancelled before it is untracked, and each video keeps its own cap timer (a `WeakMap`), so stopping one video never clears another's. Regression test added.
- P3 `web/src/dashboard.ts`, `web/src/style.css`: the box was placed using an assumed 320 × 240 size while hidden, but a text preview is about 372 × 284, so near the right or bottom edge it could first appear partly off-screen. Fixed: the box is placed again once revealed, using its real size, and clamped to at least 8 px from the top and left.

Stage145 findings, per the reviewer: pending video stop, load identity, byte limit and short-video loop fixed; the video download bound partly fixed (the cap worked except in the P2 case above). Returning to a row after a video froze starts a new download; the reviewer judged this intended, since videos are not cached. The merge kept preview classification on the full stored filename (the type column now shows names without their extension), `.row[data-id]` targeting, row-order checks and exclusion during the 4 s Undo grace. No security or integration issue found.

## Verification

The reviewer reported: `npm run setup` PASS; one file at a time with a single thread worker, dashboard 55/55, preferences 3/3, deferred delete 4/4, formatting 2/2; selection-sorting 4/5 under the host time zone because of time-zone-sensitive day grouping (code unchanged by this branch) and 5/5 with `TZ=America/New_York`; web typecheck and `git diff --check` PASS; seven in-memory scenario groups passed and the failed-video probe reproduced the P2. No browser or bandwidth runs.

## Handoff

Read-only invariants checked by the coordinator afterwards: this worktree's HEAD `5397d6b` and status unchanged. The remote branch `t3/enable-paste-file-upload` had moved, to a merge of `main` made at 16:33 in that branch's own worktree; the reviewer's log contains `git push` only inside repository documents it read, and no push command. The reviewer's worktree was still at `5397d6b` with a clean status; it and its branch were removed. The coordinator fixed both findings (stage142) without a further review round.
