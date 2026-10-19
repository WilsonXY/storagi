# 15: Failure-path bug fixes

- Status: completed — implementation verified, stable source accepted by coordinator; independent review tracked separately in17.
- Started: 2026-10-19T15:45:14.027783+00:00.
- Last updated / stable handoff: 2026-10-19T15:51:11.087556+00:00.
- Coordinator thread: `mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a`.
- Owner: distinct implementation sub-agent; native session `01a154d6-a0b5-7772-896b-5eb6b360c86d`.
- T3 child thread (confirmed by own `t3_thread_configuration`): `thread:delegated-task:command%3Amcp%3A37d80f3b-c600-4623-aff0-759b9c35169f%3Adelegate-task%3Astoragi-stage15-failure-path-fixes`. Coordinator-confirmed returned taskId `node:delegated-task:command%3Amcp%3A37d80f3b-c600-4623-aff0-759b9c35169f%3Adelegate-task%3Astoragi-stage15-failure-path-fixes` matches the actual delegate_task/task_status result. Native model/effort proof remains own turn_context, not this configuration.
- Provider/model/effort: actual OpenAI `gpt-6.1-sol`, `high`, confirmed by own session metadata and `turn_context` in `$HOME/.codex/sessions/2026/10/19/rollout-2026-10-19T23-45-14-01a154d6-a0b5-7772-896b-5eb6b360c86d.jsonl`.
- Starting branch/commit: shared `feat/storagi`, `5b10bffcd6ddacb20e378b568a31caf625529451`; initial working tree clean. Prior `4039e298` was before the coordinator planning commit.

## Scope and decisions

Distinct agent owns server/src/app.ts, relevant server tests, web/src/dashboard.ts, relevant web tests, this record only. L2 close SQLite even when active cleanup rejects, preserve rejection. L3 failed logout must leave transfer selection/pumping usable; successful logout or 401/403 must still stop and protect transfers. RED→GREEN meaningful real-flow regressions and sequential package checks. No commits or host changes.

Owner authorized fixes with “go” after stage14 review; implementation and review are separate tasks, simple remedies preferred. Stage14's original findings remain preserved.

## Changes and verification

Required owner/profile, README, design, implementation log and stage14 read. Loaded full-cycle, ponytail FULL and test-driven-development. Explicit task limits leave commit/review/UI/publication to coordinator and prohibit delegation. Sequential heavy slot held by this task until stable handoff. Planned: L2 regression RED→GREEN, L3 regression RED→GREEN, focused/full server and web tests/typecheck/build with `TMPDIR=$HOME/.cache/storagi/tmp`; no root combined check.

Inspection failure: attempted `cat web/src/dashboard.test.ts web/src/transfers.test.ts web/src/transfers.ts` exited2 because tests are in `web/tests/`. Correct files subsequently read; no test/build had run and no source changed. No separate log was saved for this inspection error; raw command/result is retained in the native session log above. Other inspection reads succeeded. Actual execution logs are under `$HOME/.cache/storagi/stage15/`.

### Actual edits and RED→GREEN

- `server/test/cleanup.test.ts`: added regression using the existing authenticated loopback fixture and FileLocks boundary. Block active cleanup, call close, observe HTTP close with SQLite still open, release cleanup to throw the exact synthetic error; assert both cleanup and close preserve that error and SQLite is closed. Finally releases the gate, settles both promises, restores the lock and closes/removes the fixture even on RED. Deferred promises use the repo’s supported ES2023 constructors.
- `server/src/app.ts`: wrap only `await cleaning` in try/finally that closes storage. HTTP close order/behavior stays as before.
- `web/tests/session-resume.test.ts`: extend the existing synthetic transport fixture in this test file, using installed browser tus Upload/file reader/WebStorage and real dashboard/setupTransfers logic. Network and 500 logout errors leave selection usable, resume at offset 4 and pump a second file. 204/401/403 logout tests hold an active PATCH, observe its transport abort, verify no queued or retained-picker work starts, preserve fingerprint/partial and resume with fresh CSRF and no new reservation. The test transport is the only synthetic transfer boundary; production transfer lifecycle is not mocked.
- `web/src/dashboard.ts`: delete the pre-request stop; successful logout and 401/403 already route through showLogin, which stops transfers. No other production changes.

Observed command results (all execution logs under `$HOME/.cache/storagi/stage15/`; each test uses `TMPDIR=$HOME/.cache/storagi/tmp`):

1. `npm --prefix server test -- --test-name-pattern='close waits'` → exit1, 30 passed/1 failed, `l2-red.log`. Harness mistake: appended Node filter was ignored after script file glob, so full server suite ran rather than focused test. Only failure is the new SQLite-open assertion (true !== false), reproducing L2. No teardown failures.
2. From server: `./node_modules/.bin/tsx --test --test-name-pattern='close waits' test/cleanup.test.ts` → exit1, 1 failed as expected, `l2-focused-red.log`. Error preserved and HTTP close checks passed before SQLite-open assertion failed. Production still unchanged.
3. Same focused server command after the finally change → exit0, 1 passed, `l2-focused-green.log`.
4. `npm --prefix web test -- tests/session-resume.test.ts -t 'failed logout'` → exit1, 2 failed/4 skipped, `l3-focused-red.log`. Both network and 500 show an empty transfer queue after selection; expected completed uploads absent. Production dashboard still unchanged.
5. Same focused web command after deleting premature stop → exit0, 2 passed/4 skipped, `l3-focused-green.log`.
6. `npm --prefix web test -- tests/session-resume.test.ts` after adding 204/401/403 active-stop/resume checks → exit0, 9 passed, `l3-session-regressions.log`.
7. `git diff --check` → exit0. Shared coordinator-owned docs/browser script edits appeared during work; neither edited nor reverted by this task.

Full package commands run sequentially from the repo root, each prefixed with `TMPDIR=$HOME/.cache/storagi/tmp` and redirected to the named log under the artifact directory:

8. `npm --prefix server test` → exit0, 31 passed/0 failed, `server-test.log` (23.93s).
9. `npm --prefix server run typecheck` → exit0, `server-typecheck.log`.
10. `npm --prefix server run build` → exit0, `server-build.log`.
11. `npm --prefix web test` → exit0, 19 passed/0 failed across 3 files, `web-test.log`.
12. `npm --prefix web run typecheck` → exit0, `web-typecheck.log`.
13. `npm --prefix web run build` → exit0, Vite production build, `web-build.log`.

No typecheck/build/runtime warnings or unexpected test failures occurred. Initial failing RED runs and the ignored filter/read-path mistakes are recorded above. No command exceeded one minute; all async exec sessions were awaited to a terminal exit code. No root combined command, independent HTTP acceptance command, browser or standalone app server was run. Only temporary authenticated loopback test fixtures listened; their teardown completed (no cancelled tests). Installed dependencies/lockfiles untouched.

Additional evidence: `native-proof.json` contains only selected own session metadata and actual turn_context model/effort/cwd, with source log path; `stable-source-sha256.json` identifies the four stable source/test files; `process-check.json` reports no owned test/build/server processes at handoff; two unrelated preexisting Python loopback report servers were observed, excluded and preserved. Actual T3 thread read additionally confirms parent/child relationship and active run ordinal 1. No credentials/private contents were recorded. Read-only final `git diff --check` passed (exit0, empty log); status contains the five owned paths plus the three coordinator-owned shared edits. Results are captured in `final-diff-check.log`/`final-status.log` below.

## Findings and limitations

L2/L3 implemented and package verification passed. Production delta is one try/finally and removal of one premature stop call; both are reversible with no data migration. Scope affected is application shutdown and dashboard logout/transfer availability. Synthetic failure injection covers the lock and transport boundary; tests execute real storage/dashboard/transfers/tus behavior. This task did not independently review its own diff.

Actual browser interaction, root combined/HTTP acceptance, independent review, commit and publication are coordinator-owned next steps, not proof provided here. PR publication previously 403 and current API push=false. Google OAuth, intended-device/network and deployment remain separate unverified setup.

## Handoff

**Stable source signal:** all four owned source/test files are final; no own test/build/server process remains. Serialized heavy slot is released to the coordinator at terminal handoff. No more edits or commands that mutate application source will be made by this task.

Changed only `server/src/app.ts`, `server/test/cleanup.test.ts`, `web/src/dashboard.ts`, `web/tests/session-resume.test.ts`, and this stage record. Built outputs are ignored. No commit, push, branch operation, delegation, root/index/other-stage/browser-script/mock-file/dependency edit, host service or exposure change was performed. Coordinator-owned changes to the shared index, stage16 and browser script were observed and preserved.

Coordinator should reconcile its returned taskId and stage index, run combined/UI proof, commit, obtain the owner-selected fresh read-only review and handle publication. Coordinator accepted the stable handoff and updated the index; further verification/review remains separately recorded in16/17. No deployment, real Google, intended-device/network or PR/CI proof is claimed.
