# 255: Shared Inbox/Text refresh implementation

- Status: completed (bounded implementation handoff)
- Started / last updated / completed: 2026-11-08, Asia/Kuala_Lumpur
- Coordinator thread: shared Inbox/Text refresh, [stage 249](249-shared-refresh-plan.md); integration and actual-service checks belong to [stage 256](256-shared-refresh-verification.md)
- Agent/task/thread identifiers: stage255 implementation child; own Codex session `01a1b73f-b785-7fb3-bc02-59ce8ae05532`
- Provider/model/effort: OpenAI / `gpt-6.1-sol` / high, confirmed from this child's own session evidence: `session_meta` line 1 (`model_provider=openai`) and `turn_context` line 10 (`model=gpt-6.1-sol`, `effort=high`) in `"$HOME/.codex/sessions/2026/11/08/rollout-2026-11-08T02-22-48-01a1b73f-b785-7fb3-bc02-59ce8ae05532.jsonl"`. The stage255 user brief appears at line 17. This is implementation evidence, not reviewer evidence.
- Workspace/branch and starting commit: existing shared checkout, `feat/shared-shelf-refresh`, `b44bb6d17beb896146b8f01a987bb69a990a9289`
- Scope and acceptance: only `web/src/refresh.ts`, `web/src/dashboard.ts`, `web/src/text-shelf.ts`, relevant web unit tests and this record; one shared 60-second scheduler and 10-second offline recovery, immediate activation/manual/mutation fetches, pending-fetch deduplication, visibility/focus recovery, owner authentication, ETag/revision and existing interaction/retention behavior. No delegates, commit, push or PR in this stage.

## Decisions

Preserved the existing uncommitted Opus source and tests, as explicitly required by the owner. Applied full-cycle, Ponytail full and TDD to the remaining bounded implementation; did not delete previous work to manufacture a new RED phase. New regression tests exposed remaining gaps before the additional production edits. Existing behavior and the preserved partial implementation also received characterization checks.

`AutoRefresh` owns scheduling, focus/visibility recovery and trailing-fetch deduplication for both shelves. The existing `OfflineRetry` calls the same scheduler. Inbox data stays maintained for sidebar counts, Settings and transfers; Text bodies are fetched only while Text is active. Text keeps feature-specific fetching, ETag/304, revision checks and inline errors, with no independent refresh timer or focus/visibility refresh listener.

Reviewed all production `createTextShelf`, raw Text refresh and `auto.now()` callers, including Settings saves, file deletion and transfer completion/failure hooks. The only raw `texts.refresh()` call is inside the shared scheduler. Text activation and successful send/committed deletion request that scheduler. Settings entry/save already use it; opening Settings changes the view before the queued fetch starts, so hidden Text bodies are not fetched. Returning to Text fetches immediately with the conditional validator intact.

## Changes

- Preserved the Opus shared scheduling, deferred-start deduplication and focus recovery changes in `refresh.ts` and `dashboard.ts`, plus removal of Text's private polling/loading coordination.
- Added shared post-send and post-delete fetch requests. Mutation revision guards still reject older answers, and multiple mutation triggers during an active fetch share one fresh follow-up.
- Made recovery depend on the combined listing result. A successful Inbox response cannot stop recovery for a Text network/server/body failure. Successful listing headers or Text 304 responses do not clear offline status before sibling requests and response bodies settle. Normal non-listing request behavior and client-error handling remain intact.
- Kept the existing Text card nodes, selectable content, expiry metadata updates, drafts, search, focus, Undo and transfer behavior.
- Added focused fake-time tests for asymmetric failures/recovery, mutations during a pending conditional fetch, both shelves' focus recovery, Text auth expiry and contained timer/queued errors. Preserved Opus cadence/manual/hidden tests and extended their hidden offline retry coverage.
- Corrected two existing deletion fixtures so a post-delete server listing reflects the mocked successful deletion or 404. Their focus, removal and privacy assertions remain intact.
- No ending commit: changes remain uncommitted for the coordinator. README, browser scripts, other stage records and companion cleanup/geometry were not edited by this child.

## Verification

Commands below actually ran from the repository root. All reported unit results are Vitest results; no browser or real OAuth claim is inferred from them.

1. Preserved baseline: `npm test --prefix web -- tests/refresh.test.ts tests/text-shelf.test.ts tests/dashboard.test.ts` — **115 passed**, 3 files.
2. RED: `npm test --prefix web -- tests/text-shelf.test.ts -t 'Text send and committed deletion'` — **1 failed** as intended: expected two shared scheduler requests after send, got one (activation only).
3. GREEN: same command after routing mutation success through the shared callback — **1 passed**, 38 skipped; checks both send and committed deletion.
4. RED: `npm test --prefix web -- tests/dashboard.test.ts -t 'failure keeps the shared'` — **3 failed** as intended: offline banner incorrectly hidden for Text network, server and body failures after successful Inbox completion.
5. GREEN: same command after combined-result recovery handling — **3 passed**, 67 skipped.
6. `npm test --prefix web -- tests/dashboard.test.ts -t 'during a pending shared fetch'` — **2 passed**, 70 skipped. Sends/deletes do not overlap Text GETs; the trailing pair fetches other-device changes, skips stale mutation-era data and uses the invalidated ETag correctly, then resets the 60-second cadence.
7. First broader run: `npm test --prefix web -- tests/refresh.test.ts tests/text-shelf.test.ts tests/dashboard.test.ts tests/retention.test.ts tests/session-resume.test.ts tests/transfers.test.ts` — **169 passed, 2 failed**, 6 files. Both failures were stale deletion fixtures returning rows after mocked successful deletion/404; corrected only those fixtures.
8. Fixture correction check: `npm test --prefix web -- tests/text-shelf.test.ts -t 'delete already removed|confirmed deletion never'` — **2 passed**, 37 skipped.
9. Broader regression run: `npm test --prefix web -- tests/refresh.test.ts tests/text-shelf.test.ts tests/dashboard.test.ts tests/retention.test.ts tests/session-resume.test.ts tests/transfers.test.ts tests/dashboard-ponds.test.ts` — **172 passed**, 7 files. Includes shared cadence, ETag/304 and revision behavior, selectable content/focus, drafts, Undo/deferred deletion, retention and transfers. No unhandled refresh errors were reported.
10. Latest additional checks: `npm test --prefix web -- tests/dashboard.test.ts -t 'share one 60|shared focus recovery|locks both shelves'` — **5 passed**, 71 skipped. Includes hidden-tab offline recovery, brief/long blur with combined visibility/focus events for each shelf, and Text 401/403 clearing private content and stopping the scheduler. These checks overlap the broader run; their totals should not be added together as unique tests.
11. `npm run typecheck --prefix web` — **passed**, `tsc --noEmit`.
12. Local Prettier write on the six owned source/test files, followed by a write on the last edited dashboard test — passed. `git diff --check` — passed.

## Findings and limitations

- The baseline and broader dashboard tests print jsdom's existing `HTMLMediaElement.pause/load` implementation warnings from preview teardown; they do not fail the suite and are unrelated to refresh errors. Left them for their existing ownership.
- No independent review, full repository checks, staged secret scan, browser acceptance or production deployment was performed by this child. The coordinator owns integration/browser/full checks and review. No files were staged here, so a staged scan would not validate this uncommitted change.
- Did not touch the companion's general assertion cleanup, Undo context, duplicate trimming or geometry race; no companion branch was merged. Known separately scoped file-delete and post-logout delayed-body issues remain outside this stage.
- Real Google OAuth, physical-device background behavior and real remote networking were not exercised.

## Handoff

Coordinator receives the in-place, uncommitted implementation and tests with the Opus work preserved, plus actual RED/GREEN evidence above. Complete repository/browser verification, inspect the final integrated diff, commit, obtain the routed independent review with its own model/effort evidence, and handle the PR/CI. No model fallback or delegate was used by this child.
