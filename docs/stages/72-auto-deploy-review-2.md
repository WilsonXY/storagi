# 72: Independent review of stage70 after round-1 fixes, round 2

- Status: completed; **FAIL**, 2 P2, both accepted and fixed on the branch (stage70 "Review fixes (stage72 round 2)"); round 3 in stage73.
- Date: 2026-10-22, Asia/Kuala_Lumpur.
- Coordinator: [auto-deploy thread](t3-thread://v1/mcp:06a77307-df93-47a9-a949-3e4546caa859) (record written by it from the reviewer's report and its own checks; the reviewer was read-only).
- Reviewer: fresh Codex task through T3 `delegate_task` (role review, worktree isolation). Model and effort **confirmed `gpt-6.1-sol`, reasoning effort `high`** from the reviewer's own Codex session log (`turn_context`, cwd the review worktree). Native session `01a162af-758c-7e51-85ec-10b670f66e7f`.
- Baseline: `8205709` (whole change against `0de583f`, round-1 fixes against `b224e71`).

## Findings

1. **P2: the upgrade guard trusted an unvalidated live release name.** The helper took the running tag from the release directory name without checking its shape; the earlier `current` gate accepts any directory in `releases/`. Reproduced with a genuine `v1.1.0` release renamed `releases/bootstrap`: the deploy account then promoted `v1.0.0` with exit 0. Normal deploys only create validated names (the helper's own regex; the migration copied a valid one), so this needed a root-made layout, but the guard should not depend on it. **Accepted.**
2. **P2: re-enabling after a manual rollback could redeploy the rejected tag.** If the owner deployed `v1.2.0` by hand, drained the timer before any tick saw it live, and rolled back, the state file never recorded `v1.2.0` and re-enabling deployed it again. Reproduced. **Accepted.**

Round-1 status per the reviewer: P1 resolved for standard release names (finding 1 is the remaining gap); P2's disable-and-drain order resolved, the re-enable step incomplete (finding 2). The reviewer's checks: `npm run check` in a temporary copy PASS (server 31, web 19, HTTP 11, deploy 151, typechecks, builds); `npm run test:deploy` 151/151 under bash 5.2.0; fixture probes reproducing both findings, also on 5.2; shellcheck, `bash -n`, sudoers parsing, `git diff --check`; `systemd-analyze verify` (only the missing installed poller; a `/usr/bin/true` copy verified). Not exercised: anything privileged, credentials, Discord, a real deploy.

## Invariance and cleanup (coordinator)

- This checkout: `8205709` with a clean `git status --short` before and after.
- `git ls-remote --heads origin`: identical before and after.
- Reviewer worktree `t3-6daf7d44` (branch `t3/review-autodeploy-round-two`): at `8205709`, clean `git status --short`. Removed with `git worktree remove --force` and `git branch -D`.

## Handoff

Fixes in stage70 "Review fixes (stage72 round 2)"; fresh round-3 review in stage73.
