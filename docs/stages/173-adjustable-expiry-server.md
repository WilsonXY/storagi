# 173: Server retention policy and guarded settings save

- Status: completed
- Started / last updated / completed: 2026-11-05, Asia/Kuala_Lumpur
- Coordinator thread: current adjustable-file-retention implementation thread; plan in [stage 172](172-adjustable-expiry-implementation.md)
- Agent/task identifiers: native delegated task `/root/server_retention`
- Provider/model/effort: Codex, `gpt-6.1-sol`, high. The task inherited these settings; its active Codex rollout contained `turn_context` values `model=gpt-6.1-sol` and `effort=high`. Literal session paths remain outside Git.
- Workspace/branch and starting commit: shared `feat/adjustable-file-retention`, `ba9a093d4d8c8566fa73d565461b1a466c426e03`
- Scope and acceptance criteria: server policy, guarded API save and meaningful server coverage from [stage 171](171-adjustable-expiry-proposal-review.md). Frontend, API documentation, integration, review and PR belong to the coordinator.

## Decisions

Persist one SQLite setting with a thirty-day default; read it directly at the shared completion point. Accept 1, 7, 14, 30, 60 or 90 days, matching the coordinator's small option set. Validate acknowledgements as nonnegative safe integers. Do not add a cache, revision token, file-ID snapshot or cleanup lock.

Save runs in one synchronous immediate transaction and samples time once. Count and re-date only completed rows whose existing deadline is strictly later than that sample. A count exceeding the acknowledgement returns a conflict without writes. Success saves policy and original-completion-anchored deadlines atomically. Startup only creates the setting when missing and never re-dates existing files.

## Changes

- `server/src/storage.ts`: settings persistence, committed policy lookup, validation and guarded transactional save; all existing completion callers inherit the policy.
- `server/src/app.ts`: authenticated, same-origin, CSRF-protected `PUT /api/settings`, bounded JSON body parsing, conflict deletion count and success policy response; file listings include committed `retentionDays`.
- `server/test/settings.test.ts`: seven integration scenarios covering persistence, completion paths, destructive saves, validation and failure/cleanup overlap.

Shared changes were left uncommitted for the coordinator's combined implementation snapshot.

## Verification

- Initial TDD check: `TMPDIR="$PWD/.cache/tmp" server/node_modules/.bin/tsx --test server/test/settings.test.ts` failed because listing `retentionDays` was undefined instead of 30. The minimal implementation then passed the same first test.
- Expanded targeted check: the same command passed **7/7** tests.
- `TMPDIR="$PWD/.cache/tmp" npm test --prefix server`: **43/43 passed**, approximately 63 seconds, including existing interruption, cleanup, preview, auth and transfer tests.
- `npm run typecheck --prefix server`: passed.
- Prettier write/check on the three changed server files: passed. `git diff --check -- server`: passed.

The tests exercise default and nondefault restart persistence, existing and fresh completion, zero-byte and recovered completion, original timestamps, legacy saved deadlines surviving startup, exact expiry boundary, accurate conflict with zero mutation, a count increasing while acknowledgement is pending, a smaller accepted count, lengthening without revival, unchanged partial deadlines and inactivity rejection, actual cleanup deletion, authentication/origin/CSRF and malformed values, oversized JSON, and a SQLite trigger failure after deadline updates that rolls back both deadlines and future completion policy.

The cleanup overlap test pauses removal after cleanup has selected and checked an expired copy under its file lock, invokes the real HTTP settings-save path, then resumes removal. The expired copy is never extended, the live copy is extended, and the partial is unchanged. This exercises pending deletion rather than promising immediate physical space recovery.

## Findings and limitations

No server test failed after implementation. The mixed legacy-deadline startup case models a deadline written by an older release; it does not deploy or execute an old release. No real Google identity, private content, production service, deployment or exposure was used. Repository-wide formatting/secret checks, combined UI proof, independent review and PR remain coordinator work.

## Handoff

Coordinator receives the shared changes and passing server checks. API: `PUT /api/settings` accepts `{retentionDays, confirmDeletes?}`; 409 returns `{error, deleteCount}`, 200 returns `{retentionDays}`. `GET /api/files` additionally returns `retentionDays`. No commit, push, PR or deployment was performed by this child.
