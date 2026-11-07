# 253: Reject delayed Settings and Text mutations after session revocation

- Status: in progress
- Started / last updated: 2026-11-08 (Asia/Kuala_Lumpur)
- Coordinator thread: `mcp:launch:58c48d0d6d936d09acfea237c9ed99e7effc51a5ed17f69c018a9b99e0d9f66a`
- Provider/model/effort: Codex / gpt-6.1-sol / high, confirmed by T3 runtime and orchestrator inherited settings; implementation delegate evidence to be checked separately.
- Workspace/branch and starting commit: `fix/session-revocation-mutations`, `b44bb6d17beb896146b8f01a987bb69a990a9289`; prepared workspace verified clean, no checkout reconfiguration.
- Scope: revalidate the owner session after asynchronous body consumption, immediately before synchronous Settings/Text mutation, using the existing file-operation pattern.

## Decisions

The owner explicitly changed implementation from Opus 5.5/high to GPT-6.1 Sol/high after the previous attempt reported a five-hour Claude usage limit. The earlier attempt failed before implementation; its rate-limit evidence remains in this thread's history. No reset wait or replacement implementation thread is required.

Use existing authentication, Origin/CSRF guards and body parsers unchanged. Do not refactor sessions. No merge, release tag, deployment, exposure, real OAuth/data or unrelated host changes.

## Coordination and acceptance

1. A distinct Sol/high implementation task writes stage 254, adds actual loopback HTTP regressions with synthetic signed identity, isolated SQLite and controlled time, demonstrates RED before each route fix, and makes the smallest production change. Use a small route/revocation matrix covering logout and elapsed session expiry. Rejected requests must return 401 without changing policy, file deadlines, Text rows or validator state; cleanup must retain otherwise-live synthetic items. Valid delayed requests must succeed. Preserve existing malformed-body, Unicode, size, CSRF/auth and atomic retention coverage.
2. The coordinator inspects the result, runs required repository checks, formatting and secret scanning, and commits before review.
3. A fresh read-only worktree review uses Opus 5.5/high, with expressly authorized Astra/high fallback for Opus unavailability/usage limits. Confirm actual settings from reviewer session evidence. Record each review round separately, audit parent HEAD/status/remote heads and reviewer HEAD/status, and clean only reviewer-generated worktrees/branches.
4. Push a focused PR, link it immediately and handle CI. Companion branches `fix/text-inbox-selection`, `feat/shared-shelf-refresh` and `test/strengthen-shelf-tests` retain their scopes. Do not weaken unrelated checks or claim deployment readiness.

## Changes and verification

Implementation completed in [stage 254](254-revoked-session-mutations-implementation.md). Initial HEAD and clean status verified. Read repository/global AGENTS, README, design record, stage rules and full-cycle/Ponytail/TDD skills. Template is embedded in stage rules; no separate `TEMPLATE.md` exists.

## Findings and limitations

Historical real HTTP proof in the coordinator's `t3/review-deployment-risks` checkout is read-only reference only. Local evidence belongs under ignored `artifacts/session-revocation-253/`; public records use portable paths. Known companion browser geometry synchronization issue is outside this fix.

## Handoff

Implementation task completed: six deterministic actual HTTP tests and four production lines. Coordinator independently inspected the diff, RED/GREEN logs and implementation session line 10 (actual `gpt-6.1-sol`, `high`). No added-line static scan concerns; existing authentication/body parsers remain unchanged.

Coordinator verification: `npm run check` passed (61 server + 182 web + 11 HTTP acceptance + 154 deploy-script tests = 408), both typechecks and builds passed. `npm run format:check`, `git diff --check`, staged secret scan and history secret scan passed; history covered 439 commits. Gitleaks was installed in the existing cache but absent from PATH; reran using its documented cache path after the first staged-scan command exited 127. Evidence: ignored `artifacts/session-revocation-253/full-check.log`, `format.log`, `secrets-staged.log`, `secrets-history.log`. Installed web lockfile dependencies for the full check; no tracked dependency changes.

The first actual-service Text and retention browser attempts failed before app exercise because Chromium's Unix socket path exceeded the limit under the long repository TMPDIR. Preserved `browser-text.log` and `browser-retention.log`; retry uses the shorter `"$HOME/.cache/storagi/tmp/s253"` temporary directory. This is harness setup, not a product test failure. Retry results: actual-service shared Inbox/Text retention browser acceptance passed (1/1), including Settings save and confirmation across devices. Actual-service Text browser acceptance failed at initial `page.goto` (line 253, 15-second navigation timeout), before assertions; no source/test relaxation. Evidence: `browser-retention-retry.log`, `browser-text-retry.log`. This browser limitation remains explicit alongside passing security HTTP tests. Both runners finished and closed their synthetic services. Committed-code independent review and final PR/CI evidence remain pending.
