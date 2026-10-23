# 57: Stop trimming PUBLIC_ORIGIN

- Status: completed.
- Date: 2026-10-21, Asia/Kuala_Lumpur.
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844); coordinator integration (two-line fix, not delegated).
- Provider/model/effort: Anthropic Claude Opus 5.5 from runtime.
- Branch: `feat/scripted-deploy` from `0817583`.

## Changes

`env_value` trims spaces/tabs only when asked (`trim`), used for PORT and DATA_DIR as `config.ts` does; PUBLIC_ORIGIN keeps any padding so the existing strict regex refuses it before the stop. Refusal test `space inside quoted PUBLIC_ORIGIN`. `docs/user-service.md`: trimming claim narrowed to PORT/DATA_DIR; the stage56 P3 internal-link limit stated. The second P3 (unchecked enumeration) is left as recorded.

## Verification

RED: the new subtest failed with the old parsing (41 pass/2 fail). GREEN: `npm run test:deploy` 43/43; shellcheck v0.11.0 clean; `bash -n`. Read-only live probe: the live PUBLIC_ORIGIN (quotes stripped, untrimmed) passes the gate. Full `npm run check` PASS: server 31/31, web 19/19, HTTP 11/11, deploy 43/43, both typechecks and builds.
