# 256: Shared refresh integration and actual-service verification

- Status: in progress
- Started / last updated: 2026-11-08 (Asia/Kuala_Lumpur)
- Coordinator thread: shared Inbox/Text refresh (stage 249)
- Agent: coordinator integration, separate from stage 255 implementation delegate
- Provider/model/effort: Codex `gpt-6.1-sol`, high; own session `01a1b73e-974c-7df1-8e33-51f9dbd61411`, `turn_context` confirms model and effort. Evidence: `"$HOME/.codex/sessions/2026/11/08/rollout-2026-11-08T02-21-34-01a1b73e-974c-7df1-8e33-51f9dbd61411.jsonl"`.
- Workspace/branch and starting commit: `feat/shared-shelf-refresh`, `b44bb6d17beb896146b8f01a987bb69a990a9289`
- Scope and acceptance: integrate stage 255; preserve companion test intent; update documentation and timely actual-service browser checks; format, secrets, repository checks, reviewed PR and CI.

## Decisions and changes

README describes the shared 60-second refresh mechanism. Browser fake clocks are installed before dashboard scripts create timers. The initial cross-device receipt advances the shared scheduler by 60 seconds; subsequent cross-device gesture checks explicitly refresh after the other device completes its mutation. They no longer depend on five-second polls.

Actual-service browser checks exercise Inbox and Text cadence, hidden-tab suspension/return and the existing ten-second offline recovery. Visibility is a controlled document-property/event seam; HTTP requests and offline networking use the actual built dashboard/service with synthetic signed owner sessions and isolated data, bound to loopback.

Companion `test/strengthen-shelf-tests` owns discriminating manual Refresh/search tests, Undo context, narrow duplicate removal and same-frame geometry. Existing manual Refresh scenarios and the geometry assertion remain for that branch. No changes from application-fix PRs 43/44 are absorbed or reverted.

## Verification and failures

- Starting HEAD matched the requested commit. Partial Opus edits preserved; initial provider rate-limit failure remains recorded in stage 249.
- T3 preview status unavailable. First open rejected the blank URL; retry with a valid loopback URL failed: “This host blocks the sandbox T3’s browser runs in (AppArmor on Ubuntu 23.10+).” No host setup/security changes. Use the explicitly permitted local Playwright harness.
- `npm run format:check` passed. `npm run secrets:history` initially failed because Gitleaks was absent from PATH; rerun with the existing pinned Gitleaks 8.30.1 cache binary passed: 464 commits, no leaks. Added-line static scan found no new secret assignments, unsafe HTML or shell/eval calls.
- `npm run check` passed: 55 server tests, 197 web tests, 11 HTTP acceptance checks and 154 deploy checks (417 total), both typechecks and both production builds. Existing jsdom media teardown warnings remain as recorded in stage 255.
- First focused browser launch failed before any scenario: Chromium's Unix socket path was too long under this worktree's `artifacts` TMPDIR. Retried with the shorter `"$HOME/.cache/storagi/tmp"`; retained the failure log at `artifacts/shared-refresh/focused-launch-failed.log`.
- Focused actual-service proof (`server/node_modules/.bin/tsx --test artifacts/shared-refresh-proof.test.ts`, copied shared-check block from the tracked browser harness) passed for both views with zero browser errors. It asserts no GET before 60 seconds, then allows the existing one-second scheduler ticker, controlled hidden-tab suspension/return, and actual browser offline/ten-second recovery. No physical background-tab claim is inferred from the visibility seam.
- `server/node_modules/.bin/tsx --test --test-concurrency=1 scripts/acceptance-text-browser.test.ts scripts/acceptance-retention-browser.test.ts` passed **2/2**, 94.7 seconds total (Text 65.8 seconds, retention 26.5 seconds). Includes Text first load, immediate sends/deletes, manual Refresh, selection/copy/link/drafts/Undo, real file upload, shared retention and the new both-view refresh scenarios. Existing geometry assertion remained unchanged and passed locally; companion still owns its known CI race.
- Browser clocks are installed before page scripts and paused only during the new bounded refresh checks. Cadence tests reject five-second polling without waiting a minute. Later cross-device gesture tests explicitly Refresh after completed remote mutations. Companion discriminating manual Refresh assertions remain separate.
- Logs/results/screenshots: `artifacts/shared-refresh/` and `artifacts/text-handoff/` (ignored local synthetic evidence). A focused repeat captures offline/recovered screenshots for PR proof without changing product code.
- Remaining review/PR results recorded after execution.

## Handoff

Independent review follows committed code, with before/after Git invariance checks and verified reviewer session model/effort. No merge, tag, deployment, public exposure or live data changes.
