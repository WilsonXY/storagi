# 68: Independent review of stage67, round 1

- Status: FAIL; three P1 findings, all fixed on branch (stage67 "Review fixes"). Round 2 (stage69) PASS.
- Date: 2026-10-22, Asia/Kuala_Lumpur.
- Coordinator thread: [system account](t3-thread://v1/mcp:58c7c620-37f5-4e62-b396-2997a42059c3); a fresh read-only reviewer returned the report, this thread wrote the record.
- Owner/task: T3 `delegate_task`, role review, worktree isolation, `clientRequestId` `storagi-stage68-review-round1`.
- Actual provider/model/effort: OpenAI/gpt-6.1-sol/high, parsed from the reviewer's own native Codex session `01a16035-dd61-7da0-9e89-9467e203364e` (cwd the reviewer worktree): `turn_context` line 8, model `gpt-6.1-sol`, effort `high`. Routing: Claude implemented, so Codex gpt-6.1-sol/high per the owner profile; no fallback.

## Scope

`da57560..c9f074d`: `scripts/storagi-promote`, the `scripts/deploy.sh` split, `deploy/storagi.service`, `scripts/deploy.test.ts`, the migration guide and records; the brief's helper security requirements, attacked as a passwordless unprivileged caller would.

## Findings

1. **P1, `scripts/storagi-promote` backup.** A malicious release running as `storagi` can open its data dir to the deploy caller, who swaps a checked database file for a symlink between the check and root's `install`/`cmp`, making root read a private file such as `/etc/shadow`. The reviewer reproduced the substitution non-root. Verdict: **fixed**. Root now never opens a path in `storagi`'s directory; `storagi` reads the files (bounded).
2. **P1, guide step 5.** `$data` was checked only after the privileged copy; an empty value makes `"$data/."` the root filesystem. Verdict: **fixed** with the step-0 `old_data_ok` guard on the copy.
3. **P1, guide step 9.** A mistaken `DATA_DIR` such as `$HOME` passed the cleanup guard and would be deleted. Verdict: **fixed**; the same guard requires a dir holding only Storagi's entries, not `$HOME` or above.

Over-engineering: none flagged ("the privilege split is warranted").

## Reviewer checks

`npm run setup && npm run check` PASS (server 31, web 19, HTTP 11, deploy 96, typechecks, builds); deploy 96/96 on bash 5.2; shellcheck 0.11.0, syntax on both bash versions, whitespace; `systemd-analyze security --offline` 1.7 OK and verify with the expected missing `ExecStartPre` path; isolated backup-race and migration-path probes confirming the findings; public-file privacy scan clean.

## Invariance and cleanup

Parent HEAD (`c9f074d`), full status and all remote heads matched before and after. The reviewer's session has no git, gh, sudo or patch write calls; its worktree ended clean at `c9f074d`. Worktree `t3-3c2bcf37` and branch `t3/system-account-security-review` were removed. An unrelated detached worktree that existed before the review was left alone.
