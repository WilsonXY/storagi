# 109: Independent review of 108

- Status: FAIL, 2 blocking findings and 2 suggestions, all fixed in 108's follow-up commit; re-reviewed in 110.
- Date: 2026-10-24 +08:00
- Reviewer: delegated T3 review task `storagi-109-tailscale-node-review-r1`, Codex `gpt-6.1-sol` / `high`, confirmed from its own session log (`turn_context` model and effort). Fresh worktree at `b39b919`; read-only by instruction.
- Scope: `git diff cebe0f4 b39b919`: the unit, the guide, README/setup pointers and record 108; records 101-107 for privacy only.

## Findings and verdicts

1. **Blocking, `docs/tailscale-node.md`: rollback was numbered step 7** while the guide says to run every step in order, so an owner following it would roll back and then retire the old mapping, leaving Storagi unreachable. Fix: rollback is now an unnumbered section, run only if step 6 failed; retiring the old address is step 7.
2. **Blocking, `docs/tailscale-node.md`: retiring the old address removed all of the host's port 443** without checking it still held only Storagi. Other tools can change it during the DNS wait, and `serve --https=443 off` removes every handler on the port. Fix: step 7 first prints `only-storagi` only if the host's 443 holds exactly `/` → `http://127.0.0.1:8787`, and says to stop otherwise. Checked against the live host config (`only-storagi`) and a fake config with another backend (`STOP`).
3. **Suggestion, `README.md`: "now belongs" claimed the move was done.** Fix: says an owner-run guide moves it.
4. **Suggestion, `docs/tailscale-node.md`: the security-score check had no pass threshold.** Fix: removed.

The reviewer found no blocking defect in the unit and no privacy leak in records 101-107.

## Read-only checks

Before and after: this worktree's HEAD (`b39b919`), `git status` (clean) and `git ls-remote --heads origin` hash were unchanged. The reviewer's worktree was the only new entry in `git worktree list`, at its starting commit `b39b919` with a clean status; it and its branch were removed afterwards.
