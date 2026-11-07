# 233: One committed retention policy for files and Text

- Status: completed (backend handoff; coordinator integration/review/CI follow)
- Started / last updated: 2026-11-07, Asia/Kuala_Lumpur
- Coordinator: adjustable-file-retention owner follow-up; plan in stage 232
- Agent/task: distinct native child `/root/shared_text_retention_backend`
- Provider/model/effort: inherited Codex GPT-6.1 Sol/high requested settings; separate actual child session metadata unverified here. Coordinator owns independent reviewer evidence.
- Starting branch/head: `feat/adjustable-file-retention`, `2dee50205bd7e511a1958b6bc9b43cf1ad06621e`
- Scope: backend integration only; one Settings duration for completed Inbox files and Text, original-time deadlines, combined confirmation and expiry-aware Text refresh. No commits/pushes or review delegation by this child.

## Coordination and decisions

The coordinator merged main's Text feature first and assigned this bounded server stage. This child owns `server/src/{storage,app}.ts`, `server/test/settings.test.ts`, `server/README.md` and this record. Frontend integration, broader docs, actual-service browser proof, remaining repository checks, committed-snapshot independent review and PR/CI remain with the coordinator. Server tests ran serially under the coordinator's exclusive heavy-test slot.

Reuse the existing SQLite `retentionDays` row and settings API/acknowledgement shape. Replace the competing fixed Text policy with the same small `shelfExpiresAt(at)` method used by completed files. It reads the committed setting, so failed transactions cannot advance an in-memory cache. Session metadata reads that same setting. No new configuration, schema, policy revision, ID snapshot, lock layer or retention framework.

## Changes

- `server/src/storage.ts`: newly sent Text and file completion use the shared committed policy/calculation. The existing immediate settings transaction samples now once, sums impending deletions from live completed file rows and live Text rows, and returns an insufficient combined acknowledgement before any writes. A confirmed save updates eligible file deadlines from `uploadedAt`, Text deadlines from `createdAt`, then policy in one transaction. Already-expired rows are excluded; partial inactivity and startup behavior are unchanged.
- Text ETags now hash each ordered live ID and expiry timestamp. Bodies remain immutable, but changed deadlines invalidate conditional refresh even when IDs are unchanged. No Text payload/schema extension was needed.
- `server/src/app.ts`: authenticated session `retentionDays` is read from SQLite. Existing `/api/files` policy/count and route/auth/CSRF/body guards are unchanged.
- `server/test/settings.test.ts`: add persisted new-Text/file/session parity and conditional-deadline-refresh tests. Extend existing cases with mixed exact-boundary counts, zero mutation, growing confirmation count, no revival, legacy startup deadlines, transaction rollback/future policy, malformed-request immutability and cleanup-overlap proof for Text as well as files.
- `server/README.md`: document one adjustable completed-content policy, combined confirmation, original timestamps and deadline-aware conditional refresh. Separate Text capacity, partial24h/session7d, physical cleanup and secure-erasure limits remain intact.

## Verification

Test-first vertical slices used the real fixture API and signed synthetic identity:

1. New Text/file policy and restart test failed because Text retained 30 days after setting14; passed after shared committed policy and session metadata changes.
2. Mixed shortening test failed because the API reported two file deletions instead of four combined file/Text deletions; passed after counting/updating both tables. Advancing one millisecond grows the count from4 to6 and requires a fresh acknowledgement without partial mutation.
3. Conditional refresh test failed with304 after a deadline-only change; passed after including expiry in the ETag. A fresh validator and an unchanged repeat save correctly retain304.

`tsx --test server/test/settings.test.ts server/test/texts.test.ts` passed **17/17**. The existing Text tests still prove default30day parity, capacity, auth/input bounds, exact expiry, cleanup and legacy deadlines. Added mixed extensions also prove rollback leaves both tables, policy and ETag unchanged, future Text retains the committed policy, and the actual settings endpoint can extend live file/Text deadlines during an expired file's pending unlink without reviving expired Text.

Full server run `tsx --test --test-concurrency=1 server/test/*.test.ts` passed **53/53** in122.4seconds on Node22.22.1, with no failures, skips or retries. `npm run typecheck --prefix server`, Prettier check of owned TypeScript files and `git diff --check` passed. Only the three intended TDD red runs failed. The coordinator was notified that the heavy-test slot is free. No server build, UI/browser proof or staged-secret scan was run by this child; those remain coordinator integration checks. Literal local logs stay in ignored `artifacts/shared-adjustable-backend/`; test temp files use quoted `$HOME/.cache/storagi/tmp`.

## Handoff and limits

Source remains uncommitted for coordinator integration. Settings still returns either `{retentionDays}` or409 with the combined `deleteCount`; no frontend-only metadata or separate Text policy was introduced. Coordinator must finish frontend labels/cache rendering, browser proof, required integration checks, independent review and CI. No real OAuth/data, production deployment, merge, tags or unrelated services/mappings were touched.
