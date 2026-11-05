# 172: Adjustable expiry implementation and integration

- Status: completed (implementation; independent review and PR follow)
- Started / last updated: 2026-11-05, Asia/Kuala_Lumpur
- Coordinator thread: current adjustable-file-retention implementation thread
- Agent/task identifiers: coordinator; server stage assigned separately in stage 173
- Provider/model/effort: Codex, `gpt-6.1-sol`, high, confirmed by the runtime declaration; server delegate independently checked active rollout model/effort fields (stage 173). Literal local session paths remain outside Git
- Workspace/branch and starting commit: `feat/adjustable-file-retention`, `ba9a093d4d8c8566fa73d565461b1a466c426e03`
- Scope and acceptance criteria: implement the minimal design in [stage 171](171-adjustable-expiry-proposal-review.md); preserve existing Settings and native paste-dialog concepts, prove the UI with synthetic fixtures, run repository checks, obtain independent review and open a PR.

## Decisions

The coordinator owns frontend implementation and integration. A distinct delegated agent owns server policy, API and server acceptance coverage in stage 173. A subsequent independent Claude Opus 5.5 high review receives a committed snapshot in an isolated worktree. This is the complete stage plan; fixes stay with the coordinator unless substantial new scope appears.

Use 1, 7, 14, 30, 60 and 90 days. This small positive whole-day set includes the established default and useful shorter/longer choices. Server validation accepts this same set. The retention policy is server state; existing local preferences remain device preferences.

## Changes

- Reused Settings rows, typography, colors, spacing and existing buttons; added a native select and Save action, without a new UI dependency.
- Reused the paste-confirm native dialog, popup CSS, Cancel-first focus and native focus containment. Dashboard shortcuts defer while it is open. Cancel/Escape clear acknowledgement, and changing duration requires an unacknowledged save. A larger server count requires a fresh click.
- Existing request handling carries JSON settings and conflict counts through auth/offline/error patterns. Saves show pending state, prevent duplicate submissions, keep failed selections retryable and refresh listing/copy after success. Shelf and paste copy use server policy; public metadata uses generic wording.
- Updated README, API contract and a subsequent design decision; historical records stay intact. Added focused web tests and a real-service browser proof.

## Verification

- TDD: first web test failed because the retention field did not exist; after implementation it passed. Conflict tests failed because the dialog did not exist and passed after implementation. A paste-copy assertion failed with fixed thirty-day text and passed with the shared-policy hook. A jsdom spy on an absent method was corrected to the existing dialog-attribute stub before judging behavioral failures.
- `npm run setup`: all lockfiles installed, zero audited vulnerabilities.
- `npm run check`: passed: **43 server**, **115 web**, **11 HTTP acceptance**, **154 deploy-script tests**, both TypeScript checks and production builds.
- `npm run format:check`, `git diff --check`: passed. Gitleaks 8.30.1 history scan: 376 commits, no leaks. Staged scan runs before commits.
- `TMPDIR="$HOME/.cache/storagi/tmp" server/node_modules/.bin/tsx --test scripts/acceptance-retention-browser.test.ts`: passed. Built app and real HTTP/SQLite saves used a signed synthetic identity and empty files. Checked exact counts, unchanged rows/policy on Cancel/Escape, focus restoration, duration reset, count growing from two to three, successful confirmation, harmless extension without revival and shared policy in a separate browser context. Zero page errors; no horizontal overflow at 1440, 728 and 390 pixels.
- Visually inspected labelled captures `artifacts/retention/settings-desktop.png` and `confirmation-390.png`; existing design is preserved. Also captured 728px, updated count and saved phone state. These ignored local artifacts are attached to the PR after review.

T3 preview failed because AppArmor blocks its browser sandbox. No host configuration changed; existing local Playwright tooling provided proof. Initial proof-script failures included a nonexistent cleanup method and a Chromium socket path exceeding its limit under the long worktree TMPDIR. Corrected the script and reran with the shorter documented home-cache TMPDIR; final proof passed. The temporary synthetic preview listener was stopped. Real-service proof closes its browser/listener and removes fixtures.

## Findings and limitations

No deployment, real Google login, production data access or service changes are authorized by this stage.

## Handoff

Server delegate completed [stage 173](173-adjustable-expiry-server.md). The combined committed snapshot goes to independent Claude Opus 5.5 high review in stage 174. No PR or deployment has occurred at this implementation handoff.
