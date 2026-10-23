# 112: Independent review of 111

- Status: FAIL, 2 blocking factual findings, both fixed.
- Date: 2026-10-24 +08:00
- Reviewer: delegated T3 review task `storagi-112-tailscale-rollout-review-r1`, Codex `gpt-6.1-sol` / `high`, confirmed from its own session log (`turn_context`). Fresh worktree at `707719d`; read-only by instruction. It checked record 111's claims against the live host with read-only commands.
- Scope: `git diff 5fb6a99 707719d`: record 111 and its log row.

## Result

Live state and HTTP checks match the record; owner confirmations are labelled as such; privacy and the log row pass.

## Findings and verdicts

1. **Blocking: "public DNS was up within about 8 minutes" was not supported.** The app restart at 01:39:26 does not show when public DNS worked; the guide's step-6 check from the host resolves the name through the tailnet, not public DNS. Fixed: the record now says the first public resolution was not observed.
2. **Blocking: wrong coordinator thread ID.** The Claude coordinator is T3 thread `d16900b2-19ea-4c3c-9430-1ab5fec1472f`, continuing Codex thread `f68c7bfe-052b-47c5-8f82-e2df7d42e7d4`. Fixed in 111 and in record 108, which had the same error.

## Read-only checks

Before and after: this worktree's HEAD (`707719d`), `git status` (clean) and `git ls-remote --heads origin` hash were unchanged. The only new `git worktree list` entry was the reviewer's, at `707719d` with a clean status; it and its branch were removed afterwards.
