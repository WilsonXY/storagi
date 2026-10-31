# 129: Independent review of delete on leave

- Status: completed; FAIL, two P2s and one suggestion, all fixed by the coordinator in stage128
- Started / completed: 2026-10-31 (Asia/Kuala_Lumpur)
- Coordinator thread: `a17f8d53-6344-4999-8ff8-d4a3521e6708` (Claude `claude-opus-5-5`)
- Reviewer (owner routing for Claude-written changes): Codex `gpt-6.1-sol`, reasoning effort high, run as a read-only T3 review task in a fresh worktree. Its own native session log records provider `openai` (`session_meta`, line 1) and model `gpt-6.1-sol` with effort `high` (`turn_context`, line 10).
- Reviewed range: `26b594f..2b42e0b`

## Findings and responses

The reviewer checked credentials, CSRF, 404/410 handling, first-error selection, shelf updates, duplicate prevention, bulk folding, gesture cancellation, destroy and sign-out, and the server's per-file delete lock, and found no other issue. It ran the 91 web tests and the web typecheck (PASS), confirmed that both new tests fail on the original source, and ran six temporary probes from a snapshot outside the checkout (five passed; one reproduced finding 2).

1. P2: every DELETE used `keepalive`, and Chromium allows 256 keepalive requests per frame, so a bulk delete of more than 256 copies would fail even when the grace simply ran out. The reviewer suggested a bulk-delete endpoint. **Fixed differently:** only the DELETEs sent from `pagehide` use `keepalive`, so ordinary deletes have no such limit. Closing the page with more than 256 copies counting down leaves the extra copies on the shelf. This is recorded as a stage128 limitation and marked with a `ponytail:` comment, since the endpoint would be a server API change for a case one owner's shelf is unlikely to reach.
2. P2: `flush()` did not emit the zero tick, so a page restored from the back/forward cache before the DELETE answered still showed "Undo 6s", and Undo did nothing. **Fixed:** `flush()` emits the zero tick, so rows switch to "Deleting"; a test holds the DELETEs unanswered and checks that no Undo is left.
3. Suggestion: the unload test still passed with sequential bulk DELETEs. **Fixed:** the test holds every DELETE unanswered and checks that a folded two-file bulk batch and an inline delete all start at once.

The reviewer did not run browser navigation, real keepalive-limit delivery, server tests or the full project check; finding 1 is source-backed. Stage126 covers the Chromium reload and close check.

## Handoff

Repository invariance: after the review, this checkout's HEAD (`2b42e0b`) and status matched the saved baseline. `git ls-remote --heads origin` differed by one new branch, `fix/reject-folder-drop`, pushed by another thread's worktree, which is not this reviewer's. The reviewer's worktree was at `2b42e0b` and clean when the coordinator removed it and its T3 branch (`t3/review-delete-on-leave`). Fixes were re-verified by the coordinator, not re-reviewed. The coordinator opens the PR and watches CI. No merge, tag, deployment or host changes.
