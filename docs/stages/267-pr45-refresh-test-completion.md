# 267: PR 45 asynchronous refresh-test completion

- Status: completed (bounded implementation handoff)
- Started / completed: 2026-11-08 (Asia/Kuala_Lumpur)
- Coordinator: PR 45 failed-check follow-up, stage 268
- Agent/task: native `pr45_async_test_fix`; own session `01a1b789-3ac1-74a0-84b8-e791df6ee6df`
- Provider/model/effort: OpenAI / `gpt-6.1-sol` / high, confirmed in this child's own `turn_context` line 11 in `"$HOME/.codex/sessions/2026/11/08/rollout-2026-11-08T03-43-06-01a1b789-3ac1-74a0-84b8-e791df6ee6df.jsonl"`; own session metadata is line 1
- Workspace/branch and starting commit: `feat/shared-shelf-refresh`, `790378d0d59a5a1371e8b2491d8f91bd3346345b`
- Scope and acceptance: correct only the frozen-clock manual Refresh test's completion waits; reproduce CI's stale-render failure, preserve search/send/auth assertions and exactly one new Text GET, prove no-op Refresh fails, run web tests. No production edits, new dependencies, commits, remote writes or delegates.

## Coordination and root cause

Coordinator delegated this bounded repair after CI run `42407384007` failed `dashboard.test.ts`'s fresh-content assertion. The new GET was counted correctly, but its asynchronous JSON body and render had not finished after the helper's fixed fifteen microtasks. A started request does not imply rendered data. Initial Text loading has the same completion assumption.

A disposable 30 ms delay on only the manual-refresh response's `json()` reproduces the exact CI failure: request delta passes, but rendered notes remain `alpha note` and `beta note`. The existing production scheduler and Text response path are correct; no production change is needed.

An intermediate correction that waited for rendered content exposed a second test race when all Text response bodies were delayed: the preceding send could still have a future automatic refresh outstanding at the manual baseline. The normal button case counted two new GETs, and a no-op button could falsely pass through the send-triggered fetch. Those failures are preserved, not reported as a passing final repair. The coordinator accepted settling that preceding operation as part of this scope.

## Changes

Only `web/tests/dashboard.test.ts` changes. The test now waits for initial Text rendering, for the successful send's cleared draft plus idle shared-refresh indicator, and for the manual refresh's new rendered content. The manual request-count assertion remains exactly `before + 1`, measured after rendering. Search, authenticated POST and return-to-Inbox assertions remain.

Reused installed Vitest's `expect.poll` with explicit `{ interval: 0 }`; no helper, dependency, fixed sleep or production hook was added. Source inspection of Vitest 5.0.5's `createExpectPoll` confirms `interval` uses `??`, so zero is honored. Retries yield through Vitest's safe real timers. Its internal fake-timer advancement is zero, so no simulated time elapses and the shared one-second polling ticker cannot fire. An explicit final `Date.now()` assertion verifies that the original frozen timestamp is unchanged. Default polling timeout remains unchanged.

## Verification

- Initial RED: disposable manual-response JSON delay, original test — **failed** at fresh-content assertion, same stale notes as CI; GET delta had passed. Evidence: `artifacts/pr45-async-test/delayed-body-red.log`.
- Intermediate failure: all response bodies delayed, without settling the prior send — **failed** exact GET delta (three total versus expected two); replacing only the Refresh element with a listener-free clone falsely **passed**. Evidence: `unsettled-all-body-red.log` and `unsettled-noop-false-pass.log` in that same ignored folder.
- Final GREEN with only manual body delayed — **passed**. Final GREEN with all Text JSON bodies delayed — **passed**, including unchanged time and exactly one additional GET. Evidence: `manual-body-green.log` and `all-bodies-green.log`.
- Final no-op counterexamples — **failed as required**, both without delay and with all Text bodies delayed. Evidence: `noop-red.log` and `delayed-noop-red.log`. The clock does not advance to permit periodic recovery.
- Targeted unmodified service mock: `npm test --prefix web -- tests/dashboard.test.ts -t 'Text navigation filters notes'` — **passed** before the additional proven send-settlement guard; the final complete suite below covers that guard.
- Final `npm test --prefix web` — **199 passed**, 15 files, 38.13 seconds. Evidence: ignored `artifacts/pr45-async-test/web.log`.
- Prettier check of the changed test and `git diff --check` — passed.

All diagnostic delays and mutations were disposable and restored before the final web run. Source snapshots and reproducible probe drivers remain ignored under `artifacts/pr45-async-test/`; no delay or no-op injection enters the committed test.

## Findings and limitations

The web suite still emits existing jsdom media `pause/load` teardown warnings; all tests pass. This stage does not claim full repository checks, browser reruns, independent review or CI success. No app or browser-acceptance code changed. Coordinator owns remaining verification, review and PR work.

## Handoff

Uncommitted focused test change and this record are ready for the coordinator. Full web suite is complete and the heavy-run window is released. No process from this stage remains running.
