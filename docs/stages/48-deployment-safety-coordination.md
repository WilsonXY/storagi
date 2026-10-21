# 48: Deployment/CI safety audit and coordination

- Status: completed.
- Date: 2026-10-21, Asia/Kuala_Lumpur.
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844).
- Provider/model/effort: Anthropic Claude Opus 5.5 (`claude-opus-5-5`) from runtime; high effort requested by the session, not independently proven.
- Branch/base: audit read-only on `origin/main` 1fa9cd8.

## Scope

Owner asked for a CI/CD and deployment safety check against Bokli's laptop-era deployment. Read-only audit of repository workflows, units, deployment docs, live service state (no secret values read), Tailscale mappings and GitHub settings visible to the agent account.

## Findings

- CI: one `Check` job on every push and PR, `ubuntu-latest`, Node `22`, SHA-pinned actions, `contents: read`; no timeout, concurrency, cache or scheduled drift run; branch pushes with PRs ran twice.
- Deployment: the reviewed user-service procedure is prose executed by an agent; the live release `main-39179ed-20261020-service-v1` was copied from a developer build with a private hash manifest. No source drift since then (later `main` commits change docs, README and the unit file only); installed unit matches the repository byte-for-byte; config `0600`/`0700`; loopback-only listener.
- GitHub: `main` reports `protected: false`, zero rulesets, zero tags; `luna-agent1` has push. Bokli has protected `main` and an owner-only `v*` tag ruleset. Actions/security settings unreadable (403, not admin).
- Dependencies: server production audit clean; web dev-only `vitest`/`tinypool` (2 critical, 1 moderate). No Dependabot.
- Runtime: Funnel exposes the app publicly with Google owner login as the only gate; the user service runs as the owner without filesystem isolation (Bokli had Cloudflare Access in front). The inactive dedicated-account system template would contain this; owner decision pending.
- A synthetic mock Vite preview (`npm run test:preview`, port5174) from the primary checkout, started 2026-10-20 18:24 under a Codex app-server scope, was still running and served to the tailnet.

## Actions

- Owner approved stopping the preview: SIGTERM to its npm/Vite processes only; listener and processes confirmed gone. `tailscale serve --https=5174 off` removed only that mapping; Funnel443→8787 and all other mappings unchanged; Storagi service active.
- Prepared importable ruleset JSON outside Git (`"$HOME/storagi-rulesets/"`): `Protect main` (default branch; no deletion/force push; PR required, 0 approvals; required `check` from GitHub Actions app15368; Repository admin bypass) and `Protect release tags` (`refs/tags/v*` creation/deletion/force-push restricted; Repository admin bypass). Owner applies them; agent verifies afterwards.

## Handoff

Stage49 CI hardening, stage50 scripted deploy, reviews51/52. Ruleset application and the dedicated-account decision are owner actions.

Owner applied both rulesets by import (2026-10-21). Agent-account read: `Protect main` active on `~DEFAULT_BRANCH` (deletion, non_fast_forward, pull_request with 0 approvals, required status `check`), `Protect release tags` active on `refs/tags/v*` (creation, deletion, non_fast_forward); `main` reports `protected: true`; `current_user_can_bypass` is `never` for the agent on both. No test tag was pushed (a misconfigured rule would have created a real tag).
