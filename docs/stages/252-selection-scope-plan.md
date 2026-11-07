# 252: Scope Inbox selection to the visible shelf

- Status: in progress
- Started / last updated: 2026-11-08 (Asia/Kuala_Lumpur)
- Coordinator thread: `mcp:launch:e47359e10cea73eb04f1661ca2441c31bd23fb0e11ab41694432d71a2ef9e62a`
- Agent/task: coordinator owns regression, implementation and integration; a distinct proof agent owns disposable service/browser evidence; a fresh independent reviewer owns read-only committed-code review.
- Provider/model/effort: Codex / gpt-6.1-sol / high, confirmed by this thread's own session `rollout-2026-11-08T01-29-20-01a1b70e-c239-7742-ab39-e3160dba1a6c.jsonl` (`turn_context.payload.model` and `.effort`), also matching orchestrator inherited options.
- Workspace/branch and starting commit: prepared `fix/text-inbox-selection`, `b44bb6d17beb896146b8f01a987bb69a990a9289`; clean starting status verified. No checkout created or reconfigured.
- Scope and acceptance: meaningful fake-time regression must fail before the fix; selecting an Inbox file then entering Text must remove actionable stale selection; old controls and keyboard actions must emit no file DELETE, even after four-second grace. Disposable authenticated actual-service/browser proof must show the file retained and Text intact. Return to Inbox must allow selection, download, deletion and Undo. Preserve drafts, native text selection/links, transfers and existing design.

## Decisions

Owner explicitly replaced Opus-only implementation with Sol/high after the initial Claude attempt hit its five-hour/API limit before implementation. Preserve that failed-attempt evidence in thread history. Independent review must attempt fresh Opus 5.5/high, then owner-authorized Astra/high fallback if usage-limited, with actual session evidence and Git invariance audits.

Use full-cycle, Ponytail full and TDD. Keep implementation separate from `feat/shared-shelf-refresh`, `test/strengthen-shelf-tests` and `fix/session-revocation-mutations`. No merge, tag, deployment, exposure, real OAuth, production data or host-service changes.

## Changes

`web/src/dashboard.ts` now shares the visible-Inbox predicate across navigation selection clearing, selection changes, bulk download, row actions, deferred-delete initiation and Ctrl+A. Desktop Inbox with the Transfers panel remains eligible. Existing pending deletion callbacks and global Undo remain unchanged. No markup, styling, transfer or deletion architecture changes.

`web/tests/dashboard.test.ts` adds one parameterized behavioral regression for Text, Settings and mobile Transfers. Each verifies no DELETE after five seconds from an old bulk control, then stale row confirmation, hidden selection controls, Ctrl+A and bulk download; returning to Inbox permits selection and bulk Undo.

## Verification

Starting HEAD/status verified. Required repository documents and owner profile read. Service/browser proof will use only disposable data and synthetic signed identity, bound to loopback.

- RED: `npm test --prefix web -- --run tests/dashboard.test.ts -t 'leaving Inbox'` failed all three cases on original production code: expected no DELETE but received `/api/files/new-id` after five seconds. Evidence: ignored `artifacts/selection-red.log`.
- GREEN: same command passed all three cases after the minimal fix (`artifacts/selection-green.log`).
- `npm run format:check` and complete `npm run check` passed: 55 server, 185 initial web, 11 HTTP acceptance and 154 deploy-script tests, both typechecks and builds. Expected existing JSDOM media-method diagnostics were printed by preview tests; no failed tests. After reviewer test suggestions, all 186 web tests and web typecheck passed.
- Staged Gitleaks 8.30.1 scans passed before each commit. Full-history scan passed: 439 commits, no leaks. Binary downloaded from official release and pinned repository checksum verified.
- Distinct actual-service proof passed with Chromium 156.0.8078.4, synthetic signed identity, disposable SQLite/uploads and authenticated retained-byte download; see stage 253. Final after-review recording is 32.88 seconds, source SHA-256 `3d432d704d33398cfde6e34f461ea864fefa3a6b67630d5ab5260cbf72cd3efb`, at committed `b2ec097`. Contact sheet visually checked; no production source changes followed review.
- Broader browser gate: retention passed. First combined invocation ran both browser files concurrently (unlike CI serial steps), and Text failed at its 15-second popup wait before later geometry assertions. Unchanged serial Text browser acceptance then passed in 90.07 seconds (`artifacts/text-browser-serial.log`). No assertion was weakened and this timeout is not attributed to the known geometry race.

## Findings and limitations

Known companion CI issue: Transfers geometry reads, owned by `test/strengthen-shelf-tests`. Earlier Opus implementation attempt failed before edits due to usage limit. Template is inline in `docs/stages/README.md`; no separate TEMPLATE.md exists.

Initial regression harness iteration attempted to click a row already removed by the buggy bulk action, causing a null-element error. Corrected ordering isolates the actual old global control first; the recorded RED then fails specifically on the unintended DELETE. No production code preceded the meaningful RED.

Coordinator confirmed the companion test/refresh tasks retain their own Opus instructions pending owner authorization. Do not absorb their implementation or weaken geometry assertions.

## Handoff

Implementation committed as `0b264e4`; test-only review corrections as `b2ec097`. Stage 254 preserves Opus usage-limit failure; stage 255 records independent Astra/high PASS and accepted low test suggestions. Stage 256 preserves a PASS verdict rejected as final audit because a companion remote branch appeared during the audit window. Fresh stage 257 review passed with independently verified actual model/effort, exact HEAD/status/all-origin-head invariance and clean reviewer checkout. Every temporary reviewer checkout/branch was removed. PR publication and CI remain. Companion test/refresh tasks stay on Opus until 5am by explicit owner decision; no merge/deployment readiness while remaining work and combined CI are unresolved.
