# 71: Independent review of stage70, round 1

- Status: completed; **FAIL**, 1 P1 + 1 P2, both accepted and fixed on the branch (stage70 "Review fixes"); round 2 in stage72.
- Date: 2026-10-22, Asia/Kuala_Lumpur.
- Coordinator: [auto-deploy thread](t3-thread://v1/mcp:06a77307-df93-47a9-a949-3e4546caa859) (record written by it from the reviewer's report and its own checks; the reviewer was read-only).
- Reviewer: fresh Codex task through T3 `delegate_task` (role review, worktree isolation). Model and effort **confirmed `gpt-6.1-sol`, reasoning effort `high`** from the reviewer's own Codex session log (`turn_context`: model `gpt-6.1-sol`, effort `high`, cwd the review worktree; Codex CLI 0.163.0). Native session `01a1629d-1e6b-7331-b862-82b931845550`.
- Baseline: `b224e71` on `feat/auto-deploy` (diff against `0de583f`).

## Findings

1. **P1: auto-deploy could downgrade a newer manual deploy.** The poller compared the candidate with the live tag before a build that takes minutes. If the owner deployed a newer tag by hand meanwhile, the poller's helper call then took the lock and promoted the older candidate. The reviewer reproduced it with the real scripts (`v2.0.0` live, then a queued `v1.1.0` promoted with exit 0). Suggested fix: repeat the check under the helper's lock without blocking the owner's rollbacks. **Accepted.**
2. **P2: the documented rollback was not safe while a tick runs.** `systemctl disable --now storagi-autodeploy.timer` stops the timer, not a service run already in progress, whose build could promote after the owner's rollback. Suggested fix: disable the timer, then stop or wait for the service, then roll back. **Accepted.**

No other findings. The reviewer's checks: `npm run setup`, `npm run test:deploy` 148/148, `npm run check` from a temporary copy PASS (server 31, web 19, HTTP 11, deploy 148, typechecks, builds), fixture probes reproducing P1, `bash -n`, sudoers validation, `git diff --check`, `systemd-analyze verify` (only the expected missing installed poller). Not exercised by the reviewer: anything privileged, the account, credential, Discord or a real deploy.

## Invariance and cleanup (coordinator)

- This checkout: `git rev-parse HEAD` `b224e71` before and after; `git status --short` empty before and after.
- `git ls-remote --heads origin`: identical except `claude/nifty-knuth-k90bhs` (`d558686` → `50a19f5`). Fetched and inspected: three commits authored by another Claude session at 07:56-08:02 UTC on unrelated design work; the reviewer is Codex with no push credentials and its own report and session show no push. Not caused by this review.
- Reviewer worktree `t3-e053e206` (branch `t3/review-auto-deploy`): at `b224e71` with a clean `git status --short`, as the reviewer also reported; only git-ignored dependencies and temp files outside it were written. Removed with `git worktree remove --force` and `git branch -D`.

## Handoff

Fixes in stage70 "Review fixes (stage71 round 1)"; fresh round-2 review in stage72.
