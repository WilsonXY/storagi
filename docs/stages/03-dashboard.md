# 03: Dashboard

> Public-path normalization (stage 20): paths and command displays are normalized public references, not original literal invocations. Recorded results, identity metadata and hashes are unchanged; original evidence remains private locally.

- Status: completed — bounded implementation handed off; final browser proof/integration/review belong to coordinator and stage 05.
- Started: 2026-10-19 21:04 +08:00 (Asia/Kuala_Lumpur); last updated / completed: 2026-10-19 21:16 +08:00.
- Coordinator thread: `mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a`.
- Agent/task/thread: delegated dashboard implementation; native session `01a15443-ac48-7ba0-9741-84032568d423` (`CODEX_THREAD_ID`). Coordinator reconciliation: task `node:delegated-task:command%3Amcp%3A84bfb7a9-ff9d-4f5a-9ea2-fc37786fe042%3Adelegate-task%3Astoragi-stage03-web-v1`; child thread `thread:delegated-task:command%3Amcp%3A84bfb7a9-ff9d-4f5a-9ea2-fc37786fe042%3Adelegate-task%3Astoragi-stage03-web-v1`. T3 task_status confirmed completed and actual provider/model codex/gpt-6.1-sol.
- Provider/model/effort: Codex `gpt-6.1-sol`, high reasoning effort, confirmed by this agent's injected T3 runtime instructions. These are runtime-confirmed values, not inferred from requested delegation settings.
- Workspace/branch and starting commit: shared `$HOME/projects/storagi`, `feat/storagi`, `2f59b59d29aa13a465f9a57cb88c612a4b8f947a`.
- Scope and acceptance criteria: own `web/**` and this record only; plain TypeScript/Vite/tus dashboard per API agreement; meaningful RED/GREEN tests; passing test/typecheck/build. Owner/coordinator reassigned final browser screenshots and interactions to independent stage 05 during execution. No delegation, commits, branch changes, push, PR or host-service changes by this agent.

## Decisions

- Applied full-cycle, ponytail full and TDD. Use native browser controls (file input, progress/meter, search, modal dialog), plain TypeScript and CSS, no UI framework or icon dependency. Warm neutral shelf layout, orange action color, responsive mobile/desktop layouts; all assets local.
- Load `/api/session` before any private listing. Same-origin cookies for fetch and tus; CSRF token for file deletion/logout and all tus POST/PATCH/DELETE. Validate tus request origins and upload paths before attaching credentials/CSRF; ignore unsafe saved upload URLs. Keep tokens out of persisted fingerprints.
- One active transfer at a time with 8 MiB chunks. Pause yields its slot; resume rejoins the queue; cancellation terminates the partial. Use tus's persisted filename/size/modified-time fingerprint and remove it on success, so reselect resumes unfinished content while later completed duplicate uploads remain distinct copies. No whole-file buffering in the browser.
- Filename search runs over the protected complete Inbox response; newest-first sort and UUID suffixes distinguish repeated names. Filenames are escaped for HTML/attributes or assigned through textContent.
- Keep the mock service in `web/tests/vite.mock.config.ts`, invoked only by `test:preview`; production imports no mock/auth harness. Loopback bind and explicit web-only Vite filesystem allowlist avoid exposing project/private directories. Synthetic UI banner distinguishes proof from real Google/service operation.

## Changes

- `web/package.json`, lockfile, TypeScript and Vite config: independent package with dev/test/typecheck/build/test:preview scripts.
- `web/src/dashboard.ts`, `main.ts`, `style.css`, `index.html`, local favicon: Google-login shell, private dashboard, storage used/reserved/budget, 30-day expiry/original-retention explanation, Inbox newest-first/search/duplicate suffixes, download links and confirmed deletion. Includes empty/no-match, full-quota, expired-file/session and connection/retry states, keyboard focus styling, skip link and responsive layouts.
- `web/src/transfers.ts`: deliberate picker/drop, sequential queue, per-file byte progress/pause/resume/cancel, persistent tus resume, retry guidance, same-origin/CSRF protections, session-expiry stop, and storage reservation refresh on upload creation. Progress updates retain existing control nodes to preserve keyboard focus.
- `web/tests/dashboard.test.ts`, `transfers.test.ts`: 10 behavior checks covering session gating, sort/search/duplicates, hostile filename handling, deletion confirmation/CSRF, connection recovery, sequential/chunked/resumed transfers, pause/resume/cancel, session-expiry stop, quota/unsafe-origin handling, and reservation refresh.
- `web/tests/vite.mock.config.ts`, `web/README.md`: separate synthetic acceptance service and instructions. In-memory uploads <=64 MiB, delayed PATCH for interruption testing, uploaded-byte download, sample duplicate fixture metadata, test-only reset/session/quota/failure controls. Seed fixture download bodies are labelled synthetic, not represented large payloads.
- No commits made by this agent; coordinator will commit the shared integration baseline. Ignored build artifact: `web/dist/`.

## Verification

Actual commands used `TMPDIR="$HOME/.cache/storagi/tmp"` for npm work; no large `/tmp` artifacts.

- Initial inspection: `node --version` → v22.22.1; `npm --version` → 9.2.0; `git rev-parse HEAD` → assigned baseline; branch `feat/storagi`. Read AGENTS, owner profile, README, design, implementation log and API agreement.
- `npm install --prefix web --no-audit --no-fund` → success, 113 packages. npm emitted a transitive `whatwg-encoding` deprecation warning. Lockfile records installed versions; final build reports Vite 7.3.7, tests Vitest 3.2.7.
- RED/GREEN, session gate: `npm test --prefix web` first failed because no Google login existed (`expected '' to contain 'Google'`), then passed after the shell/session gate was implemented.
- RED/GREEN, Inbox: same command failed with no file rows (`[]` versus newest-first IDs), then passed after protected Inbox/search/rendering implementation.
- RED/GREEN, transfers: same command failed with zero Upload instances and missing pause control, then passed after queue/tus behavior implementation. Additional regression tests cover unsafe origins, quota/session errors and deletion safety; these are additional coverage, not claimed as separate RED cycles.
- RED/GREEN, connection recovery: same command failed because raw `Failed to fetch` lacked host/retry guidance, then passed with the connection/retry screen.
- RED/GREEN, reservation refresh: same command failed (`0 B reserved` versus expected `16 MiB reserved`) and passed after `onUploadUrlAvailable` refreshed server accounting.
- Final `npm test --prefix web` → **10/10 tests passed**, 2 files, at 2026-10-19 21:14 +08:00. No source changes after this final pass except none; final artifact checks were read-only.
- Final `npm run typecheck --prefix web` → success, exit 0.
- Final `npm run build --prefix web` → success, 29 transformed modules; `dist/index.html` 0.69 kB, CSS 15.62 kB, JS 75.56 kB (gzip 21.58 kB). Final production JS is `web/dist/assets/index-BXI1SmFE.js`; CSS `index-CJGitPfX.css`.
- `git diff --check -- web docs/stages/03-dashboard.md` → success before final documentation update; repeated at handoff. `git check-ignore web/node_modules web/dist` confirms generated files are ignored.
- Python assertions over production JS/HTML → no `/__test/`, synthetic CSRF or mock-banner strings. Confirms the separately invoked harness is absent from the production bundle.
- T3 `preview_status` → no tab. `preview_open` → explicit unavailable prerequisite: “This host blocks the sandbox T3's browser runs in (AppArmor on Ubuntu 23.10+). Run `sudo env "PATH=$PATH" t3 browser setup` on the host once to allow it, then try again.” No host changes made. Coordinator assigned fallback browser proof to stage 05, so this agent did not launch a duplicate server/browser. Harness readiness was sent to coordinator.

## Findings and limitations

- Coordinator reports an initial synthetic browser acceptance pass, but it overlapped final CSS/transfer reservation edits. It is **not final proof**. Stage 05 must rerun its browser interactions/screenshots after this stable handoff. This agent claims automated package checks, not its own browser proof.
- Google OAuth registration, real account login/authorization, production cookies/HTTPS, integrated backend behavior, multi-GB integrity/performance and actual Android background behavior remain unverified by this frontend stage.
- Resume needs the same original's tus metadata in the same browser and intact site storage; modified files, cleared/private storage or expired partials may require a fresh transfer. Source originals are never modified. Browser background execution is not guaranteed.
- Downloads use native attachment links, avoiding buffering multi-GB files in browser memory. The server remains authoritative for authorization and expiry at download time.
- No real/private files, host services, Serve/Funnel mappings, firewall/router configuration or deployment changed. Mock controls are limited to the separately started loopback test service.

## Handoff

Stable final source handoff at 2026-10-19 21:16 +08:00. No further `web/**` changes will be made without notifying coordinator. Final changes after the initial browser proof were: readable CSS formatting (same rules), host connection/retry screen, session-expiry/signout queue stop, input-before-listing guard, explicit web-only dev filesystem allowlists, and server reservation refresh on upload URL creation. Tests/docs reflect these behaviors.

Coordinator receives a passing web package and production `web/dist/`, plus this current record. Reconcile stage 03's coordinator-owned index row; integrate real service against API agreement; record acceptance agent's final mock-browser screenshots/flows and real integration evidence separately. Independent review/commit/PR remain coordinator responsibilities.

Acceptance harness command: `TMPDIR="$HOME/.cache/storagi/tmp" npm run test:preview --prefix web`, strict loopback port **5174**. This agent did not start a server. Full harness controls/limitations are in `web/README.md`. Suggested final proof: 390/728/1440 widths, search/duplicates, download/delete-confirmation, upload/pause/resume/cancel, reselect after reload, session expiry, quota errors, and reservation accounting. Preserve synthetic banner in screenshots; do not claim these as real OAuth/backend proof.
