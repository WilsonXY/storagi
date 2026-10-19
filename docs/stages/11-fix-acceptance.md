# 11: Independent acceptance after review fixes

- Status: in progress — preparation only; execution waiting for explicit coordinator readiness
- Started / last updated: 2026-10-19 21:39 / 21:44 +08:00
- Coordinator thread: `mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a`
- Agent/task/thread: fresh test sub-agent `storagi-stage11-fix-acceptance`; native Codex session `01a15465-248c-7993-a240-b0b060b61529`, confirmed by `printenv CODEX_THREAD_ID`. T3 task/thread identifiers not exposed in this child context.
- Provider/model/effort: Codex `gpt-6.1-sol`, high, confirmed by injected runtime information; own session log not independently inspected.
- Workspace/branch and starting commit: shared `$HOME/projects/storagi`, `feat/storagi`, `e8248f5a9d06744f2b31e553c2fbc48493bbcdee`.
- Scope: only `scripts/acceptance*` and this record. Independently check stage08/09 findings and rerun affected real-service/browser/optional generated 2GiB+1 proofs after stable handoffs; no production edits, commits, branches, push, posts, delegation or host changes. Coordinator owns index/review/PR.

## Decisions

Review fixes change authentication/locking/resume; refresh their behavior evidence before review round2. Run heavy checks sequentially.

Loaded full-cycle and ponytail full. Existing test harnesses are reused; production helpers remain untouched. Test-only independent acceptance does not implement a production fix or claim its own production RED/GREEN cycle. Preserve stage05 artifacts and records; new runs use `artifacts/acceptance-stage11/`. Temporary state remains under `$HOME/.cache/storagi/tmp`. One owned loopback server at a time, all closed after proof. No execution until explicit coordinator go; stage09 had the first test slot and stage08 now owns it.

## Changes

Preparation: extended the original mock browser harness with real dashboard/tus/WebStorage HEAD401/403 cases. Browser-side gating holds later PATCH chunks while pausing, then tests original saved URL/fingerprint/partial size/offset/reservation, login shell, sign-in/reselect, original resume offset and no extra POST. Added artifact-directory overrides to existing actual-service and optional large-file scripts so stage05 evidence is retained. These edits have not been executed or validated yet.

## Verification

Actually performed preparation only: read owner/project AGENTS, README, design, implementation log, API agreement, stage05/06/08/09/11 and existing harness/source contracts; inspected `git status --short`, branch/HEAD and native session metadata. No tests, builds, servers, browser launch, dependency install or heavy command run. Existing concurrent source changes belong to stage08/09 and remain untouched.

Planned after stable handoff and explicit go, sequentially:

- Fresh required T3 preview status/open check; earlier stage05 explicitly recorded AppArmor unsupported. Use installed external Playwright/Chrome if unsupported; no privileged setup or AppArmor changes.
- Independent API: pending owner flow survives anonymous login flood; no unauthenticated DB growth; flow tampering/expiry/replay denied; authorized GET login preserves session; stalled download permits parallel ranges/delete/unrelated expiry; immutable validators/If-Range; half-open PATCH resumes promptly with safe delete/cleanup; bidi controls rejected and ordinary Unicode accepted.
- Complete existing API acceptance, refreshed mock browser (including HEAD401/403), actual-service browser using production dashboard and synthetic signed identity, and optional generated local 2GiB+1 streaming proof after separate heavy-proof readiness.
- Actual-service HEAD401/403 case should seed a real browser partial/fingerprint, expire/revoke session, reselect/sign-in/reselect with original offset and no new reservation; record synthetic boundary explicitly. Preserve actual404/410 fresh-start behavior.
- Record exact executed commands/results/failures/cancellations, sanitized artifacts, final source hashes, runtime/browser/build metadata, cleanup and remaining limitations. No checks above are claimed passed yet.

## Findings and limitations

Real Google, WAN/device and deployment remain external acceptance.

Preparation questions sent to coordinator: stable backend handoff must confirm final Auth flow-cookie and replay-storage contract before fixture alignment. Stage09 reports final JS `index-DzQRuOKC.js` and CSS `index-CJGitPfX.css`, checks14/14/types/build pass; these are implementation reports, not independent acceptance results. All review findings remain open pending independent evidence.

## Handoff

08+09 stable handoffs →11acceptance →10freshreview →07finalhandoff.
