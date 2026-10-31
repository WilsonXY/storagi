# 130: Rewrite the README

- Status: completed; stage131 review pending
- Started / last updated: 2026-11-01 (Asia/Kuala_Lumpur)
- Coordinator thread: this T3 thread (Claude `claude-opus-5-5`)
- Agent/task/thread identifiers: none; the coordinator made this documentation-only change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`)
- Workspace/branch and starting commit: `docs/readme-rewrite`, `9d2b1df`
- Scope and acceptance criteria: the owner said the README was "so randomly written" and asked for a proper rewrite. Keep every fact, command and link that is still true, update stale status, and keep the `#formatting-and-secret-checks` anchor that `docs/setup.md` and `docs/verification.md` link to. No code changes.

## Changes

`README.md` is reorganised into Features, Status, How it works, Repository layout, Development (build and check; formatting and secret checks), Deployment, Working on Storagi and License. The Gitleaks install block and checksum are unchanged. The secrets paragraph is split into a list. The deployment links are a table.

The old status still described the system-account move (stage67) as pending and the Tailscale node move as a guide only. The new status reflects stage74 (the service runs as `storagi`, auto-deploy installed) and stage111 (served from its own Tailscale node), and keeps the same unmeasured items. Crash recovery is attributed to the earlier user service (stage41), since it was not repeated under the system unit.

## Verification

- Every relative link in the README resolves to a tracked file; the heading `### Formatting and secret checks` still produces the anchor used by `docs/setup.md` and `docs/verification.md`.
- Facts were checked against `package.json`, `server/package.json`, `web/package.json`, `docs/setup.md`, `docs/system-service.md`, `docs/verification.md` and the stage index rows for 41, 74, 78 and 111.
- `npx prettier --check README.md` PASS. No personal paths or host usernames in the README.

## Handoff

The coordinator commits, runs the stage131 review and opens the PR. No merge, tag or deployment.
