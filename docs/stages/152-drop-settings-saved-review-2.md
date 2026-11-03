# 152: Review of the merge with main and the preview-note removal

- Status: PASS, no findings
- Date: 2026-11-04 (Asia/Kuala_Lumpur)
- Reviewer: Codex `gpt-6.1-sol`, reasoning effort high, started through T3 `delegate_task` (role review, worktree isolation). Model and effort confirmed from the reviewer's own Codex session log; the reviewer also reported them from its runtime metadata.
- Reviewed commit: merge `0937031` (net diff `origin/main..0937031`, and `git show --cc 0937031`). PR #32 (hover preview) had merged into `main`, so the branch conflicted; the merge also removes PR #32's `#preview-saved` note. This record is written by the coordinator from the reviewer's report.

## Reviewer report

- No conflict markers and no lost `main` code: the hover preview still works, and the preview switch still saves `storagi.previews`, updates `aria-checked` and re-renders the Inbox.
- No `koi-saved`, `gesture-saved`, `preview-saved` or `set-saved` references are left in `web/`. `git diff --check` is clean.
- The replacement test still covers the switch: the saved preference, its `aria-checked`, previews turned off and the filename tooltip coming back.
- The index keeps `main`'s rows 142–146 unchanged and lists 150–152 once each. The stage150 record is accurate.
- The reviewer's worktree had no installed dependencies, so it skipped npm tests, typecheck and build and installed nothing; it checked the switch code with in-memory Node assertions instead. The coordinator's runs in stage150 cover the suite.

## Read-only checks

The parent's HEAD (`0937031`), clean status and remote heads matched before and after. The reviewer's worktree was still at `0937031` and clean, and was removed with its branch afterwards.
