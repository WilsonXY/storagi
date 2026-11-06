# 201: Shared completed-content retention backend

- Status: completed; coordinator integration and independent reviews follow
- Started / last updated: 2026-11-07 Asia/Kuala_Lumpur
- Coordinator: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c
- Agent/task: shared_retention_backend, distinct native implementation agent
- Provider/model/effort: inherited Codex gpt-6.1-sol high (runtime); reviewer settings are verified separately by coordinator
- Branch/start: t3/text-copy-paste-transfer, 55ddc75
- Scope/acceptance: stage200 backend, shared completed-file/Text retention and authenticated policy metadata; keep recorded deadlines, owner auth, partial inactivity, sessions and physical cleanup semantics

## Decisions and changes

`server/src/storage.ts` owns `SHELF_RETENTION_DAYS = 30` and one `shelfExpiresAt(at)` calculation. Both completed files and newly sent Text use that calculation. File uploads still begin retention on completion; Text starts on send. Partial-upload inactivity remains one day and sessions remain seven days. No new configuration, dependency, schema, migration or generic retention engine was introduced.

`GET /api/session` exposes authenticated `retentionDays` from this same constant, alongside existing authenticated/CSRF/profile fields. Coordinator frontend consumes it for shared labels and paste confirmation. The existing SQLite, scheduler and type-specific cleanup remain intact.

Stored `expiresAt` values stay authoritative. Existing Text deadlines are neither extended nor reconstructed from the new policy, and expired content is not revived at startup.

## Verification

The public-API parity test first failed with Text expiring the next day while a zero-byte completed file expired in30days, then passed after the shared calculation. A session-metadata regression first failed because `retentionDays` was absent, then passed after exposing the constant. No unauthenticated metadata access was added; its regression still expects401.

Text API suite passed8/8. Coverage includes exact Unicode/whitespace and restart, file quota independence, owner/CSRF/input bounds, literal30day parity with completed files, survival beyond the former24hour cutoff, liveness one millisecond before the deadline, denial exactly at expiry before physical cleanup, cleanup/capacity/startup, authenticated ETag/count expiry, and legacy24hour stored deadlines persisting across restart before being pruned exactly on expiry. Retention tests explicitly extend only their synthetic session rows before long clock jumps; production auth/session code and shared fixtures are unchanged.

Full server suite passed **44/44** in61.2seconds, and `npm run typecheck --prefix server` passed. Changed source/test files were formatted with Prettier; final whitespace check is part of the verification command. Ignored local logs: `artifacts/shared-retention-{api,session}-{red,green}.log`, `shared-retention-texts.log`, `shared-retention-server.log`.

## Handoff and limits

Owned changes are `server/src/{storage,app}.ts`, `server/test/texts.test.ts` and this record. No commits/pushes, network exposure, preview or production changes by this agent. Coordinator owns README/API documentation, web labels/formatting and browser time-advance/session handling beyond30days, full integration checks and independent reviews. Existing content is intentionally not retroactively retained longer.
