# 171: Temporary text persistence and authenticated API

- Status: completed
- Started / last updated / completed: 2026-11-05 Asia/Kuala_Lumpur
- Coordinator thread: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c
- Agent/task: native delegated `text_backend`; shared implementation checkout
- Provider/model/effort: inherited coordinator Codex gpt-6.1-sol high; inherited runtime settings, independent session-log proof not checked by this agent
- Workspace/branch and starting commit: `t3/text-copy-paste-transfer`, `c369208`
- Scope and acceptance criteria: backend contract and checks in [stage 170](170-text-handoff.md); only `server/` and this record changed; no commit, push or PR by this agent

## Decisions

Reuse the existing SQLite database and owner session/CSRF/origin boundary. A separate `texts` table keeps the bounded text shelf independent of file quota and resumable transfers. Text retention is 24 hours, at most 100 live items, and 64 KiB UTF-8 per item. The JSON body limit is 512 KiB so six-byte JSON escapes do not reduce the useful text limit. Bound streaming input before concatenating or parsing it. Reject malformed UTF-8 and lone UTF-16 surrogates because exact round trips matter.

## Changes

- `server/src/storage.ts`: create and prune text rows at startup, list only live rows, atomically prune/check capacity/insert, and delete by ID. Same-millisecond creation order uses SQLite row order.
- `server/src/app.ts`: authenticated `GET /api/texts`, JSON `POST /api/texts` returning the created item (201), and `DELETE /api/texts/<uuid>` (204). Reuse no-store and existing security headers. Minute cleanup also prunes expired texts.
- `server/test/texts.test.ts`: HTTP checks for exact Unicode/whitespace preservation, newest order, persistent restart, file-quota independence, auth/CSRF/origin, JSON/type/content limits, escaped/invalid Unicode, chunked oversized bodies, deletion, expiry, cleanup and full-shelf capacity recovery.
- `server/README.md`: API, bounds, expiry, status codes and ordinary SQLite deletion semantics.

## Verification

- TDD red: `server/node_modules/.bin/tsx --test server/test/texts.test.ts` failed 4/4 against the missing API (404 instead of 201/200/400).
- Initial green: same command passed 4/4 after implementing storage/routes.
- Added invalid Unicode regression: validation test failed with 201 instead of 400 for a lone surrogate; added validation and strict UTF-8 decoding, then the four HTTP tests passed.
- `npm run typecheck --prefix server`: passed in the final combined run. An earlier run caught test result casts, then caught ES2024 `String.isWellFormed` under the existing ES2023 target; corrected both without changing the target.
- `TMPDIR="$HOME/.cache/storagi/tmp" npm test --prefix server`: passed **40/40** in 49.4 seconds, including all four new text tests and existing auth, upload, interruption, cleanup, preview, storage and download tests.
- Local Prettier formatted the three changed TypeScript files.
- A direct in-memory SQLite round trip confirmed embedded NUL bytes survive as text.

## Findings and limitations

No real OAuth credentials or production service were used. These checks use the existing signed synthetic issuer and isolated loopback HTTP fixtures. Real device handoff, UI and release/deploy remain coordinator stages. SQLite deletes rows rather than guaranteeing secure erasure of WAL pages/backups. No link content is fetched. A text body uses the service's existing request timeout.

## Handoff

Coordinator can consume the specified API unchanged. `GET` returns `{texts: [{id,text,createdAt,expiresAt}]}` with ISO dates; `POST` returns the item directly. Errors: 400 invalid/empty text, 413 size limits, 415 content type, 409 capacity, 404 missing/deleted, 410 expired but not cleaned, 405 unsupported method. All protected API checks happen before reading the body. Changes are left uncommitted for coordinated integration and independent Opus/Sol review.
