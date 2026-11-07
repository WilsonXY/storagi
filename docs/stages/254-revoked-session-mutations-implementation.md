# 254: Revalidate delayed Settings and Text mutations

- Status: completed (bounded implementation and focused validation)
- Started: 2026-11-08 01:30 +08:00 (Asia/Kuala_Lumpur); completed: 2026-11-08 01:36 +08:00
- Coordinator: [stage 253](253-revoked-session-mutations-plan.md), coordinator thread recorded there.
- Implementation task/session: `01a1b70f-c44f-7020-b555-70b2d488aca8`.
- Provider/model/effort: OpenAI / `gpt-6.1-sol` / high. Confirmed from this agent's own session: `session_meta.model_provider=openai`, `turn_context.model=gpt-6.1-sol`, `turn_context.effort=high` (line 10). Source: `"$HOME/.codex/sessions/2026/11/08/rollout-2026-11-08T01-30-26-01a1b70f-c44f-7020-b555-70b2d488aca8.jsonl"`; portable extract in ignored `artifacts/session-revocation-253/model-evidence.json`.
- Workspace/branch and starting commit: prepared `fix/session-revocation-mutations`, `b44bb6d17beb896146b8f01a987bb69a990a9289`. Stage 253 was already untracked and was left untouched.
- Scope/acceptance: delayed-body Settings PUT and Text POST must revalidate the session immediately before mutation, returning 401 after logout or elapsed expiry without changing shelf state. Valid delayed requests must work. Preserve existing parsing, limits, Unicode, authentication, Origin/CSRF and atomic retention behavior.

## Decisions

Read global/project AGENTS, README, the design record, stage rules, stage 253 and the full-cycle, Ponytail full and TDD skills. The owner's bounded implementation instruction reserves commits, full checks, independent review and PR work for the coordinator. No subdelegates were started.

Reused the existing file-operation `auth.session` fail-closed check in each route after body parsing/shape validation. There is no asynchronous boundary between each new check and its synchronous storage mutation. No session abstraction or body parser changed.

Inspected the existing Settings/Text tests, fixture, signed synthetic identity and upload helper before adding tests. Historical stage 241 and its ignored `artifacts/backend-review-241/proof.mts` were read in the existing `t3/review-deployment-risks` worktree only; no sibling edits or service changes.

## Changes

- `server/src/app.ts`: four production lines, two session checks, before `saveRetention` and `addText`.
- `server/test/session-revocation.test.ts`: six parameterized real HTTP cases, Settings/Text × logout/elapsed expiry/valid delay. Existing fixture supplies signed synthetic identity, isolated on-disk SQLite, loopback and controlled time.
- `docs/stages/254-revoked-session-mutations-implementation.md`: this implementation/handoff record. No ending commit; implementation remains uncommitted as requested.

The Settings probe wraps only that incoming request's real async iterator. It signals after the parser consumed the first chunk and requested another. The Text probe observes the first data event after the real parser's data handler. Each test verifies `complete=false`, `readableEnded=false` and a still-valid session before revocation. Logout is completed over HTTP, or the clock advances to the actual stored session deadline (no database expiry rewrite); `/api/session` then returns 401 before the remaining bytes are sent. No sleeps or timing races coordinate the overlap. A five-second socket timeout only bounds a failed probe.

## Verification

All command paths below are repository-relative; ignored evidence is under `artifacts/session-revocation-253/`. Node was `v22.22.1`, npm `9.2.0`. Created `artifacts/session-revocation-253/tmp` and used it as `TMPDIR`; the final matrix used its `matrix` subdirectory to isolate runner IPC.

Dependency setup: `TMPDIR="$PWD/artifacts/session-revocation-253/tmp" npm ci`, then the same environment with `npm ci --prefix server`. Both passed; logs `setup-root.log`, `setup-server.log` (no audit findings).

TDD was sequential per route:

1. **Settings RED, unchanged production code:** `TMPDIR="$PWD/artifacts/session-revocation-253/tmp" server/node_modules/.bin/tsx --test server/test/session-revocation.test.ts > artifacts/session-revocation-253/red-settings.log 2>&1`. Only Settings cases existed at this step. Logout and elapsed expiry failed with **actual 200, expected 401**, response `{"retentionDays":1}`; valid delay passed (1 pass, 2 failures; exit 1).
2. Added only the Settings check; same test command with output `green-settings.log` passed all 3 cases (exit 0).
3. Added Text rows to the matrix, leaving Text production code unchanged. Same command with output `red-text.log`: Settings cases and valid delayed Text passed; Text logout/expiry failed with **actual 201, expected 401**, returning a newly persisted synthetic Text (4 passes, 2 failures; exit 1).
4. Added only the Text check. `TMPDIR="$PWD/artifacts/session-revocation-253/tmp/matrix" server/node_modules/.bin/tsx --test server/test/session-revocation.test.ts > artifacts/session-revocation-253/green-matrix.log 2>&1` passed **6/6**, exit 0.

No-mutation proof in all four rejection cases: exact snapshots of retention policy, every file row (including original timestamps/deadlines), every Text row and the Text list validator remain equal before and after the response. Explicit real cleanup then runs; all snapshots still match and the file's physical bytes still equal `retained file`. The seeded file/Text are two days old before the delay; even at the real session deadline they remain within their saved 30-day retention. The rejected Settings request asks for one day with acknowledgement of both deletions, so an erroneous commit would expire both and cleanup would remove them.

Valid delayed Settings returns 200 and commits the acknowledged one-day deadlines from original creation/completion times. Valid delayed Text returns 201, preserves exact whitespace and Unicode even when the HTTP body is split inside a UTF-8 character, uses the current controlled send timestamp and shared retention, adds exactly one row and changes the validator. Existing file rows/policy and the original Text remain intact.

Additional focused validation:

- `TMPDIR="$PWD/artifacts/session-revocation-253/tmp" server/node_modules/.bin/tsx --test server/test/settings.test.ts server/test/texts.test.ts server/test/app.test.ts server/test/auth.test.ts > artifacts/session-revocation-253/focused-existing.log 2>&1`: passed **25/25**, exit 0 (89.4 seconds). Includes malformed/type/size/Unicode rejection, Origin/CSRF/auth guards, retention confirmation boundaries, transaction rollback and cleanup overlap. Followed the long-running-commands skill while retaining the process handle and log through completion.
- `TMPDIR="$PWD/artifacts/session-revocation-253/tmp" npm run typecheck --prefix server > artifacts/session-revocation-253/typecheck.log 2>&1`: passed, exit 0 (also passed before the Text production change).
- `node_modules/.bin/prettier --write server/test/session-revocation.test.ts` formatted the new test before each RED run. `node_modules/.bin/prettier --check server/src/app.ts server/test/session-revocation.test.ts` and `git diff --check`: passed, exit 0.

## Findings and limitations

The first test command stopped before tests because dependencies were absent (`node_modules/.bin/prettier: No such file or directory`); installed only root/server lockfile dependencies and reran successfully. No RED claim relies on this setup failure.

The first final-matrix attempt overlapped a separate focused test runner and failed before tests with `tsx` IPC `EADDRINUSE` under the shared temporary directory. Preserved `green-matrix-attempt1.log`, then reran with a separate `tmp/matrix` directory; 6/6 passed. This was a runner failure, distinct from the four intentional regression failures.

No live OAuth/data, browser work, deployment, exposure, merge, release tag, commit or push. No independent review/full repository checks are claimed here. Companion frontend branches remain separate.

## Handoff

Coordinator receives the uncommitted minimal production change, six HTTP tests, this completed record and ignored RED/GREEN/model evidence. All focused checks finished successfully; no validation processes remain running. Coordinator owns full repository checks, secret scan, commit, independent review and PR.
