# 49: CI hardening, Dependabot and vitest advisory fix

- Status: in progress; local checks pass, review51 pending.
- Date: 2026-10-21, Asia/Kuala_Lumpur.
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844); coordinator-owned (small change, not delegated).
- Provider/model/effort: Anthropic Claude Opus 5.5 from runtime.
- Branch/base: `ci/harden-checks` from `origin/main` 1fa9cd8.

## Changes

- `.github/workflows/check.yml`: PRs, pushes to `main`, weekly schedule and manual dispatch; per-ref concurrency cancelling superseded PR runs; `ubuntu-24.04`; 15-minute timeout; npm cache keyed on both lockfiles. Job id stays `check`, the required status in the owner ruleset.
- `.github/dependabot.yml`: weekly Actions updates; weekly npm updates for `/server` and `/web`, minor/patch grouped, semver-major ignored (security updates unaffected).
- `web`: `vitest` ^3.2.4 → ^5.0.5. Every 4.1.x release (4.1.11 needed for the fix) crashes npm 9 and 10 (`Cannot read properties of null (reading 'edgesOut')` in peer-set resolution), reproduced in an empty directory; 5.0.5 installs cleanly. Lockfile diff touches dev-only packages only (scripted comparison); web audit 0 vulnerabilities.

## Decisions

No `.nvmrc`: `node-version: '22'` already resolves to the newest Node 22 (≥22.22 required). No lint added (none configured; out of scope).

## Verification

- Web: 19/19 tests, typecheck and build pass; production bundle hash unchanged (`index-CaM_JQ4K.js`), confirming no shipped change.
- Independent HTTP acceptance 11/11, both typechecks and builds pass.
- Server: two standalone runs 31/31. Two full `npm run check` runs under host load (load average ≈4) each hit different timing-sensitive server tests (three half-open PATCH tests, then download idle-timeout `ECONNRESET`); `server/` is byte-identical to `origin/main`. Logs: `"$HOME/.cache/storagi/stage49-*.log"`.
- Workflow/Dependabot YAML parse; GitHub-hosted CI result recorded at publication.

## Findings and limitations

Pre-existing flaky server timing tests under local load are reported, not fixed (outside scope). CI on the new workflow not yet observed.

## Handoff

Commit, fresh read-only review51, then PR. Stage50 branches from this commit.
