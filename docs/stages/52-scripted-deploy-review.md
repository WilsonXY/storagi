# 52: Independent scripted deploy review

- Status: FAIL; four P1 and one P2 accepted for stage53.
- Date: 2026-10-21, Asia/Kuala_Lumpur.
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844).
- Owner/task: fresh read-only reviewer returned findings; coordinator wrote this record.
- Actual provider/model/effort: OpenAI/gpt-6.1-sol/high, parsed by the coordinator from the reviewer's own native session (below).

## Scope

`5294828..c364673`: `scripts/deploy.sh`, `scripts/verify-release.sh`, `scripts/deploy.test.ts`, the unit's `ExecStartPre`, `package.json`, operator docs and records, including the coordinator's origin-tag gate. Read-only; repository tests with temporary HOME allowed.

## Findings

- **P1 health probe Host header** (`scripts/deploy.sh:16`). Curl sends `Host: 127.0.0.1:<port>` but the app rejects any Host other than the `PUBLIC_ORIGIN` authority (`server/src/app.ts:74`), so a healthy release answers 400/400 and every deploy and rollback ends in manual recovery. Reviewer confirmed with the real app and real curl (correct Host gives 200/401). Coordinator independently confirmed the live service returns 400 to a loopback-Host request. The curl shim hid it.
- **P1 failed stop can leave production down with exit 1** (`:120`). The branch clears the phase, ignores a failed restart and claims nothing changed.
- **P1 socket inspection fails open** (`:84`, `:15`). An `ss` failure with empty output counts as idle/no listener; a fixture where every `ss` exited 1 deployed with exit 0.
- **P1 idleness checked only before the build** (`:84`). A transfer starting during the multi-minute build is not detected before the stop.
- **P2 rollback ignores restoration failures** (`:40`). With `set +e`, failed pointer/unit/reload/start steps can still report exit 2 if HTTP health passes.

## Reviewer checks

`npm run setup`, `npm run test:deploy` 24/24, four temporary fixture probes confirming the stop/restart, socket, stale-idleness and rollback-restoration defects, a temporary real-app HTTP probe with synthetic OIDC confirming the Host defect, `bash -n` both scripts, `git diff --check`. Full `npm run check` and real systemd not run. Temporary harnesses removed.

## Invariance and cleanup

Native proof: `"$HOME/.codex/sessions/2026/10/21/rollout-2026-10-21T14-44-53-01a15d34-a2cb-7052-998c-0ccfe457d105.jsonl"`, line1 provider openai, line8 model gpt-6.1-sol effort high. Parent HEAD, porcelain status and all remote heads matched the before snapshot. Reviewer worktree clean at `c364673` (only ignored `node_modules`); coordinator removed only that worktree and its branch `t3/scripted-deploy-review`. No live service, private values or Tailscale accessed.

## Handoff

All five findings accepted. Stage53 fresh implementation task fixes them with regressions (Host-enforcing curl shim, failing `ss`, late busy connection, failed stop+restart, failed restoration step). Stage54 fresh review receives the original brief, these findings and stage53 responses.
