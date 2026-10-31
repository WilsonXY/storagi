# 133: Third independent review of delete on leave

- Status: completed; FAIL, four P2s in the next-visit resend; the owner chose to drop the resend, so the code they apply to was removed
- Started / completed: 2026-11-01 (Asia/Kuala_Lumpur)
- Coordinator thread: `a17f8d53-6344-4999-8ff8-d4a3521e6708` (Claude `claude-opus-5-5`)
- Reviewer (owner routing for Claude-written changes): Codex `gpt-6.1-sol`, reasoning effort high, run as a read-only T3 review task in a fresh worktree. Its own native session log records provider `openai` (`session_meta`, line 1) and model `gpt-6.1-sol` with effort `high` (`turn_context`, line 10).
- Reviewed: the next-visit resend `1109d98..16f8fa5`, with the whole change `9d2b1df...16f8fa5` for context
- Planned as stage131; renumbered because the README rewrite merged to `main` used 130 and 131.

## Findings and responses

The reviewer confirmed that the save-before-flush ordering, the collection of pending ids, the merge and dedupe, the parallel dispatch, the zero tick and the pagehide-only keepalive were correct, that authentication stayed fail-closed, and that both new tests failed without the resend. It ran the 96 web tests and the web typecheck from a snapshot outside the checkout (PASS), and a probe suite (eight passed, four failed, reproducing the findings below). The coordinator checked each finding against the code before deciding.

1. P2: two tabs could lose each other's saved deletes, because startup replaced the whole saved list after its own resends finished.
2. P2: returning with the Back button restores the page from the back/forward cache without running the dashboard's startup, so nothing was resent.
3. P2: if a closing page's DELETE failed and the row came back, deleting it again and pressing Undo left the older saved delete armed for the next visit.
4. P2: a saved id with a lone surrogate (`"\ud800"`) passes the string check, but `encodeURIComponent` throws, which stopped the dashboard loading on every visit.

**Owner decision:** the coordinator verified all four, noted that this was the review skill's third and last round and that each round had found new edge cases in the saved-list approach, and offered three options: drop the resend and keep the limit, fix all four and review a fourth time, or switch to a bulk-delete endpoint. The owner chose to **drop the resend and keep the limit**. `web/` was restored to `1109d98`, which stage132 reviewed; the four findings no longer apply. The remaining limit (more than 256 copies counting down at unload leaves the extras until they expire) is recorded in stage128.

The reviewer did not run real browser navigation, keepalive-quota rejection, server tests or the full project check.

## Handoff

Repository invariance: after the review, this checkout's HEAD (`16f8fa5`) and status matched the saved baseline. `git ls-remote --heads origin` differed: `main` moved from `9d2b1df` to `460a248` when PR #27 (the README rewrite, another thread's work) was merged, and its branch `docs/readme-rewrite` was deleted. The reviewer's worktree was at `16f8fa5` and clean when the coordinator removed it and its T3 branch (`t3/review-delete-on-leave`).

Final code (resend removed, `main` at `460a248` merged): `npm run format:check` PASS; `npm run check` exit 0 with 33 server, 94 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds (`check-133.log`). The headless Chromium reproduction on loopback port 5185 passes: reload during the grace deletes, closing the tab during a bulk delete deletes both copies, and Undo then reload keeps the copy (`leave-133.log`). No merge, tag, deployment or host changes.
