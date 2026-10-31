# 127: Independent review of the folder drop guard

- Status: completed; FAIL, one P2, one P3 and one suggestion, all fixed by the coordinator
- Started / completed: 2026-10-31 (Asia/Kuala_Lumpur)
- Coordinator thread: `f6782541-21f6-4374-9f87-02f683b0f118` (Claude `claude-opus-5-5`)
- Reviewer (owner routing for Claude-written changes): Codex `gpt-6.1-sol`, reasoning effort high, run as a read-only T3 review task in a fresh worktree. Its own native session log records provider `openai`, model `gpt-6.1-sol` and effort `high`.
- Reviewed range: `26b594f..d91a03d`

## Findings and responses

The reviewer confirmed that string items and items without a file are skipped, that items are read synchronously during `drop`, that the picker cannot select folders and resume/retry cannot introduce one, that the server cannot tell a folder placeholder from an empty file, and that the folder notice replaces the queued toast as intended. Folder names are rendered with `textContent`.

1. P2: `item.webkitGetAsEntry()?.isDirectory` calls the method unconditionally, so in a browser without it any drop throws before `options.drop` and nothing uploads. **Fixed:** the method is called optionally (`webkitGetAsEntry?.()`); a new test drops a file through an item with no entry API, which failed with `TypeError` on `d91a03d` and now passes.
2. P3: stage126 said a browser without the method falls back to the old behaviour, but it threw. **Fixed:** stage126 now records the actual fallback after the fix.
3. Suggestion: an upload count of one did not prove which file uploaded. **Fixed:** the mock keeps its file; the test asserts the uploaded file is the ZIP, Transfers lists only `posters.zip`, and no second upload starts after it succeeds.

The reviewer could not run Vitest, typechecks or builds (dependencies absent in its worktree) and did not reproduce native browser drops; stage126 covers both.

## Handoff

Repository invariance: after the review, this checkout's HEAD (`d91a03d`), status and `git ls-remote --heads origin` matched the saved baseline. The reviewer's worktree was at `d91a03d` and clean when the coordinator removed it and its T3 branch (`t3/review-folder-drop`). The coordinator opens the PR and watches CI. No merge, tag, deployment or host changes.
