# 64: First scripted deploy (v1.0.0)

- Status: completed; deployed and healthy. Owner sign-in and a real file transfer after the deploy are not verified.
- Date: 2026-10-22, Asia/Kuala_Lumpur.
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844); the coordinator ran the deploy and verified the facts below. Recorded by [P3 hardening](t3-thread://v1/mcp:ca0d018b-e41f-422f-aceb-4c0c4d5d6cf9) (Anthropic Claude Opus 5.5 from runtime), which did not deploy or touch the runtime.
- Release: tag `v1.0.0` on `main` at `263865e` (merge of PR#10).

## How `main` got there

PR#7 (scripted deploy) merged into `ci/harden-checks` instead of `main`: its base was not retargeted after #6 merged, because the repository did not delete head branches automatically. It was re-landed unchanged as PR#10; the merged tree equals the CI-tested `a225d74` tree. The owner has since enabled "Automatically delete head branches".

## Deploy

The owner created and pushed lightweight tag `v1.0.0` at `263865e`; CI on that commit passed. The coordinator ran `scripts/deploy.sh v1.0.0` from a clean checkout at `origin/main`: exit 0. In-release check: server 31/31, HTTP 11/11, deploy 52/52.

## Verification

- Stop 01:10:06 +08, start 01:10:10, listening 01:10:11: about 4 s of downtime.
- New MainPID, `NRestarts` 0. Its cwd is inside `releases/v1.0.0-263865e-20261021T170734Z/server` under `"$HOME/.local/lib/storagi"`.
- Journal shows the `ExecStartPre` line `verify-release: v1.0.0 263865e… ok`; a manual re-run of `"$HOME/.local/lib/storagi/current/scripts/verify-release.sh"` passes.
- `BUILD_MANIFEST` has TAG, COMMIT, BUILT_AT, `DEPLOYED_BY=scripts/deploy.sh` and NODE `v22.22.1`.
- Public Funnel origin: `/` 200, anonymous `/api/session` 401.
- Rollback target kept: previous release `main-39179ed-20261020-service-v1`. Database backup in `backups/v1.0.0-263865e-20261021T170734Z`.

## Not verified

No owner Google sign-in and no real file transfer after the deploy.

## Handoff

Production runs the first scripted, stamped release. Stage65 hardens two recorded P3s for the next tag; it changes nothing deployed.
