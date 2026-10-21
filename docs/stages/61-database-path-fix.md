# 61: Back up the database file the app opens

- Status: completed.
- Date: 2026-10-21, Asia/Kuala_Lumpur.
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844); coordinator integration (mechanical fix, not delegated).
- Provider/model/effort: Anthropic Claude Opus 5.5 from runtime.
- Branch: `feat/scripted-deploy` from `585d67a`.

## Changes

The app's config check now returns `path.join(dataDir, 'storagi.sqlite')`, the exact expression `storage.ts` opens, instead of the directory. The script uses that file for the existence gate and the database/WAL/SHM backup; `data_dir` is gone. Regression subtest `symlink then ..` in "the backup uses the DATA_DIR the app resolves". `docs/user-service.md` names the database file.

## Verification

- RED: the new subtest backed up `wrong db` (50 pass/2 fail). GREEN: `npm run test:deploy` 52/52; shellcheck v0.11.0 clean; `bash -n`.
- Full `npm run check` PASS: server 31/31, web 19/19, HTTP 11/11, deploy 52/52, both typechecks and builds.
- Read-only live probe with the committed helper definitions: `app_config` succeeds (port 8787), the returned database file exists, health with the returned host gives `/` → 200 and anonymous `/api/session` → 401; service PID and restart count unchanged.

## Remaining recorded P3s

Unbounded `systemd-run` before cutover (stage60); internal links outside hashed paths and unchecked symlink enumeration (stage56).
