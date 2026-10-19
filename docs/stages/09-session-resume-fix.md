# 09: Preserve resumable uploads across session expiry

- Status: implementation completed; stable handoff for integration, independent browser acceptance and fresh review
- Started / last updated / completed: 2026-10-19 21:38 / 21:42 / 21:42 +08:00
- Coordinator thread: `mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a`.
- Agent/task/thread: stage09 `storagi-stage09-session-resume`; native Codex session `01a15462-2660-79d0-8348-0e0c340cee99` (verified from `CODEX_THREAD_ID`). T3 child identifiers not yet independently inspected.
- Provider/model/effort: OpenAI/Codex `gpt-6.1-sol`, high, independently confirmed from this agent's session log: `$HOME/.codex/sessions/2026/10/19/rollout-2026-10-19T21-38-00-01a15462-2660-79d0-8348-0e0c340cee99.jsonl`. Parsed only `session_meta` provider/session ID and `turn_context` model/effort; these match the injected runtime. No fallback.
- Workspace/branch and starting commit: shared `$HOME/projects/storagi`, `feat/storagi`, `e8248f5a9d06744f2b31e553c2fbc48493bbcdee`.
- Scope: only `web/**` and this record. Reviewer N3: preserve stored tus URL after HEAD401/403, stop queue/show login, reselect with a fresh session resumes original URL/offset without a new reservation. Preserve404/410 behavior. Coordinator owns commits, integration, independent review, browser proof and PR.

## Decisions

Inspected installed tus-js-client 4.3.1 `lib/upload.js`: `_resumeUpload` removes stored URLs for HEAD 4xx except 423 and creates a new upload before reporting auth failure. Its supported `onAfterResponse` runs before that response branch. The hook calls the existing expired-session handler (which synchronously stops/aborts the queue without terminating partials) and throws on 401/403, preventing the URL-removal/default-create branch. Leave 404/410 untouched. No custom protocol, token persistence or authentication changes.

Used full-cycle, ponytail FULL, TDD and systematic debugging. The explicit bounded delegation leaves commits/review/PR and actual browser proof to the coordinator. Tests use the installed browser entry and real Upload/file reader/fingerprint/WebStorage; only HTTP transport is synthetic. This covers the actual library branch rather than repeating its behavior in a mocked Upload.

## Changes

- `web/src/transfers.ts`: seven-line supported response hook stops the queue and shows sign-in before tus handles an unauthorized response.
- `web/tests/session-resume.test.ts`: four real-client cases; create and interrupt a 12-byte original at offset 4, fail resume HEAD with 401/403, verify exact retained WebStorage entry and unchanged full reservation, sign in with a new CSRF value and reselect an equivalent File, verify original URL/offset and no new POST. Queued second file never starts. Successful completion removes the fingerprint. HEAD 404/410 discard expired partials and create a fresh upload normally.
- `web/tests/vite.mock.config.ts`: test-only next-HEAD auth-expiry control preserves partials across synthetic sign-in; state reports partial IDs/sizes/offsets and bounded latest 100 upload requests without content/credentials. No production entry imports it.
- `web/README.md`: documents session recovery, real-client coverage and exact browser-proof harness steps.
- No commits, branch changes, pushes, PRs, server-package changes, host/service/security changes or delegation by this agent. Shared concurrent backend/coordinator changes are outside this handoff.

## Verification

All npm commands ran in `web/` with `TMPDIR=$HOME/.cache/storagi/tmp`; Node v22.22.1, npm 9.2.0, installed tus-js-client 4.3.1, Vitest 3.2.7, Vite 7.3.7.

- **RED before production fix:** `npm test -- --maxWorkers=1 tests/session-resume.test.ts` → 2 failed (401/403), 2 passed (404/410). Both failures showed actual browser localStorage `{}` instead of the original tus entry, at the exact fingerprint-preservation assertion. No production edit preceded this run.
- **GREEN after hook:** same command → 4/4 passed, including fresh-session original URL/offset, unchanged creation count and fresh CSRF.
- First `npm run typecheck` caught TS2502 in the new test's self-referential parameter name. Renamed its local parameter; no production behavior changed.
- Final serialized `npm test -- --maxWorkers=1` → 14/14 passed across 3 files; `npm run typecheck` → exit 0; `npm run build` → exit 0. Entire test/type/build sequence completed before releasing the granted slot to coordinator.
- `git diff --check` → exit 0. Actual HEAD still `e8248f5a9d06744f2b31e553c2fbc48493bbcdee` at self-review; no agent commit.
- Built JS `web/dist/assets/index-DzQRuOKC.js`, SHA-256 `3b985e8c5331bf797a25f0ea9102d7ebf51926a3a1b0a90556816217ed086621`; previous production JS basename was `index-BXI1SmFE.js` (baseline stage05). CSS stays `index-CJGitPfX.css`, SHA-256 `bbbcfb626beff8d4766777d9a43c66563aaf10d1e3c0e281bceada168f9fd221`. Dist is ignored, regenerated locally only.

No listening server or browser started. No large tests run. Harness control is typechecked but its browser/HTTP acceptance is pending the acceptance agent; this is readiness, not browser proof.

## Findings and limitations

N3's reproduced fingerprint loss is fixed and covered by the real-client regression. Independent review is still required. Real Google authentication, deployment and intended-device validation remain outside this stage. Browser proof belongs to final acceptance after stable handoff.

## Handoff

Stable: stop edits after this handoff. Coordinator receives exactly the five files listed above (this record included), owns index update/commit/integration and fresh read-only review. Changed flows needing new browser proof are unauthorized resume HEAD 401/403 → locked shelf → synthetic sign-in → reselect → same partial URL/offset without another POST/reservation; 404/410 fallback remains covered by the real-client test.

Acceptance control: `POST /__test/resume-auth` with JSON `{ "status": 401 }` or 403; `GET /__test/state` shows reservations, partial metadata and upload request history. Full steps are in `web/README.md`. Coordinator notified of readiness and serialized slot release before final handoff. Backend owns the independent authenticated-login shortcut change and backend regressions; none touched here. No claim of deployment or real authentication validation.

Coordinator reconciliation: task `node:delegated-task:command%3Amcp%3A84bfb7a9-ff9d-4f5a-9ea2-fc37786fe042%3Adelegate-task%3Astoragi-stage09-session-resume`; matching `thread:delegated-task:` child identifier. T3 task_status confirmed completed codex/gpt-6.1-sol; source stable for acceptance11.
