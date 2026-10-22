# 74: Host rollout of the system account and auto-deploy

- Status: completed. The system account, the manual v1.0.1 deploy, the auto-deploy install and the first unattended deploy (v1.0.2) all passed.
- Date: 2026-10-22 to 2026-10-23, Asia/Kuala_Lumpur (times below are +08).
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844), Anthropic Claude Opus 5.5. The owner ran every root step at the host's terminal; the coordinator checked each step's output and ran the read-only checks below. The coordinator ran no sudo.
- Scope: [docs/system-service.md](../system-service.md) migration steps 0-10 (stage67) and [docs/auto-deploy.md](../auto-deploy.md) install steps 0-8 plus the end-to-end test (stage70).

## Migration to the system account (2026-10-22)

Steps 0-9 passed as written. The coordinator ran the step-0 preflight read-only first (live v1.0.0, start-time check ok, no open transfers, the old data dir held only Storagi's entries). The new service started at 14:46:50 and was listening at 14:46:53, about a minute after the user service stopped. Step 7: local and public Funnel `/` 200 and anonymous `/api/session` 401; the main process runs as `storagi:storagi` from the v1.0.0 release copy under `/opt/storagi`; the service sees an empty `/home`; Funnel unchanged. The owner signed in on a phone off the tailnet and uploaded, downloaded, compared and deleted a test file. Step 9 removed the user unit, the old data dir, the old releases and the old config (about 1.1 GB); the owner kept the Google client JSON elsewhere first.

## Manual deploy of v1.0.1 (2026-10-22)

The owner created tag `v1.0.1` on GitHub at `0de583f` (merge of PR#12) and ran `scripts/deploy.sh v1.0.1`: exit 0. Stop 15:17:58, start 15:18:01, listening 15:18:02, about 3 s of downtime; `verify-release: v1.0.1 0de583f… ok`; `NRestarts` 0; local and public 200/401; v1.0.0 kept as the previous release; one database backup.

A coordinator instruction went wrong first. It told the owner to `git checkout main && git pull --ff-only` and then `git tag v1.0.1 && git push`. The coordinator's worktree had a stale local `main` without upstream at an early pre-rewrite commit, so the checkout landed there and the tag was made on that commit. GitHub rejected the push (GH013, tag creation restricted): the host's git account is not admin, and only admins may create `v*` tags. The owner then created the tag on GitHub; the local wrong tag blocked fetching it ("would clobber"). The coordinator deleted the local tag, pointed local `main` at `origin/main` with tracking, and kept the stale commit on a local branch. Nothing reached GitHub or production.

## Auto-deploy install (2026-10-23)

Steps 0-8 passed. Step 5's `systemd-analyze verify`, run as the owner as the guide said, failed with "is not executable: Permission denied" for the `ExecStart` script: the owner cannot look inside the account's 700 home. As root it exits 0 with nothing about the units; this change adds `sudo` to the guide. Step 4's test post returned 204 and the owner saw it in the channel. Step 6 reached the helper's own refusal, so sudo works in the unit's sandbox without a password. Step 7's tick logged `nothing to deploy (live v1.0.1)`, recorded `v1.0.1 - live`, `Result=success`. Timer enabled, next run within 15 minutes.

## End-to-end: v1.0.2 deployed by the timer (2026-10-23)

The owner created tag `v1.0.2` on GitHub at `23cb2da` (merge of PR#13). Its `check` run was `completed`/`success`, read through the same unauthenticated API call the poller makes. From the journal:

- 00:45:37 tick started; 00:45:39 `deploying v1.0.2 (23cb2da)`; build and full check as `storagi-deploy`.
- 00:48:33 sudo ran `storagi-promote` for `storagi-deploy` with no password; 00:48:34 service stopping; 00:48:36 `verify-release: v1.0.2 23cb2da… ok`; 00:48:37 listening; 00:48:38 `v1.0.2 (23cb2da) is live`. About 3 s of downtime.
- The service exited `Result=success`, status 0. No `alert not sent` line.
- `current` is the v1.0.2 release; v1.0.0 and v1.0.1 are kept. New MainPID, `NRestarts` 0. Local and public `/` 200, anonymous `/api/session` 401.

## Not verified

Owner sign-in after v1.0.2 (the app code is unchanged from v1.0.1). The owner's receipt of the v1.0.2 Discord message (the journal shows no failed post). The state file's `exit-0` line and the empty staging dir need root and were not read by the coordinator.

## Handoff

Production runs as `storagi` in its sandbox, and a new admin-created `v*` tag on `main` with passing CI goes live within about 15 minutes, with a Discord message. This change fixes the two guide lines found during the install.
