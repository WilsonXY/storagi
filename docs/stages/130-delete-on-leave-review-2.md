# 130: Second independent review of delete on leave

- Status: completed; FAIL, one P2 and one suggestion; the suggestion was fixed, and the P2 was fixed in stage128 by the owner's choice
- Started / completed: 2026-11-01 (Asia/Kuala_Lumpur)
- Coordinator thread: `a17f8d53-6344-4999-8ff8-d4a3521e6708` (Claude `claude-opus-5-5`)
- Reviewer (owner routing for Claude-written changes): Codex `gpt-6.1-sol`, reasoning effort high, run as a read-only T3 review task in a fresh worktree. Its own native session log records provider `openai` (`session_meta`, line 1) and model `gpt-6.1-sol` with effort `high` (`turn_context`, line 10).
- Reviewed: the whole change `9d2b1df...1109d98`, the stage129 fixes `2b42e0b..81e8b9c`, and the merge of `main` (`9141580`)

The owner asked why the stage129 fixes had not been reviewed again; the coordinator had judged them small and covered by tests. This round reviews them.

## Findings and responses

The reviewer confirmed that every DELETE sent from `pagehide` starts synchronously while the keepalive flag is set (`flush()` → `commit()` → `remove()` → `request()` → `fetch()`), that ordinary grace expiry uses `keepalive: false`, and that no other request picks up the flag. Stage129 finding 2 (dead Undo after a back/forward-cache restore) and the test suggestion are resolved. The merge kept both sides of the stage index. No security issue or unnecessary abstraction. It ran the 94 web tests and the web typecheck from a snapshot outside the checkout (PASS), and four temporary probes, including one modelling the 256-request limit.

1. P2: closing the page with more than 256 copies counting down still leaves the extra copies undeleted, so stage129 finding 1 is not fully resolved. The reviewer suggested an authenticated bulk-delete endpoint. **Owner decision:** the coordinator gave three options: resend on the next visit, the bulk-delete endpoint (a server API change, still capped at roughly 1,600 ids by Chromium's 64 KiB keepalive body quota), or keep the limit. The owner chose "resend on the next visit". **Fixed** in stage128.
2. Suggestion: stage129 still said "Stage126 covers the Chromium reload and close check" after the renumbering. **Fixed:** it says stage128.

The reviewer did not run real browser navigation, browser quota rejection, back/forward-cache restoration, server tests or the full project check.

## Handoff

Repository invariance: after the review, this checkout's HEAD (`1109d98`), status and `git ls-remote --heads origin` matched the saved baseline. The reviewer's worktree was at `1109d98` and clean when the coordinator removed it and its T3 branch (`t3/review-delete-on-leave`). Stage131, a third and last round under the review skill's limit, reviews the next-visit resend.
