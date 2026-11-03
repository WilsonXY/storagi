# 143: Independent review of the hover image preview

- Status: completed; FAIL, three P2s and one P3 fixed in stage142
- Started / completed: 2026-11-03 (Asia/Kuala_Lumpur)
- Coordinator thread: `c17dcc70-b4f0-4873-ad26-d35daf1b4f1f`; the coordinator wrote this record from the reviewer's report
- Agent/task/thread identifiers: T3 `delegate_task`, role review, isolated worktree; Codex session `01a19e40-6db2-7282-a552-fb4326c4774c`
- Provider/model/effort: Codex `gpt-6.1-sol`, reasoning effort high, confirmed in the reviewer's own session log
- Workspace/branch and starting commit: fresh worktree at `8521479` (parent `e7b9d45`)
- Scope and acceptance criteria: read-only review of the stage142 diff for stale or stuck previews, interaction with gestures, selection, keyboard and teardown, security (CSP, content execution), unbounded downloads, accessibility and test coverage.

## Findings and responses

- P2 `web/src/dashboard.ts`: a preview survived list changes. A refresh that replaced the hovered file left its preview up, a load finishing late could show a file no longer listed, and a horizontal touchpad swipe (which prevents scrolling) left it visible. Fixed: one `previewable()` check (file listed and rendered, image, not deleting or expired, setting on) runs on every render and before a finished load is shown; a wheel event and switching views hide the preview.
- P2 `web/src/dashboard.ts`: unfinished loads were neither tracked nor cancelled. Returning to an image before it finished started a second `Image`, and moving across large images left their loads running. Fixed: one load at a time; returning to the same file reuses it, and wanting another file cancels it (`src` removed). Teardown cancels it too.
- P2 `web/src/dashboard.ts`: Escape did not dismiss a preview covering nearby rows. Fixed: Escape hides it, and it stays closed until the mouse moves to another row or leaves the list.
- P3: the loaded-image cache had no bound. Fixed: it keeps the 20 most recently loaded images. A size threshold for full-file previews was not added; see stage142 limitations.

The reviewer found no authentication bypass or content-execution path: URLs stay same-origin and encoded, authorization stays on the server, and content only enters an `<img>`.

## Verification

The reviewer reported: `npm run setup` PASS; the default Vitest run was interrupted by two transfer-test failures under heavy host load; with one worker 45 tests passed and the dashboard worker timed out starting; a thread-worker retry passed all 51 dashboard tests, so all 96 web tests passed across runs. Nine DOM probes, injected in memory, found seven failures matching the findings; pointer-down timer cancellation and lock/late-load safety passed. `git diff --check` PASS. It did not run a real browser.

## Handoff

Read-only invariants checked by the coordinator afterwards: this worktree's HEAD `8521479` and status unchanged, remote heads identical to before. The reviewer's worktree was still at `8521479` with a clean status; it and its branch were removed. Stage144 reviews the fixes.
