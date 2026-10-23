# 60: Independent review of the loadConfig deploy gate

- Status: FAIL on one P2 (no P1); accepted for stage61. Redesign confirmed to close the configuration-divergence class.
- Date: 2026-10-21, Asia/Kuala_Lumpur.
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844).
- Owner/task: fresh read-only reviewer returned findings; coordinator wrote this record.
- Actual provider/model/effort: OpenAI/gpt-6.1-sol/high, parsed by the coordinator from the reviewer's own native session (below).

## Scope

Stage59 redesign (`98b2d6a..26404bf`) and a final pass over `5294828..585d67a`, calibrated as in stage56/58.

## Assessment

The real `loadConfig` closes the earlier decoding/validation mismatches: the unit has no `Environment=` overrides, both checks use its environment file, appropriate Node and physical server directory, and user services inherit the manager environment like the transient unit. The early/late comparison refuses changed settings before the stop; embedded newlines fail the three-line gate; `systemd-run` failures fail closed; invalid-URL errors do not echo input. No explicit timeout around `systemd-run` (both calls precede cutover; the config module is synchronous): P3 hardening, recorded.

## Finding

- **P2 backup path can differ from the app's database path** (`scripts/deploy.sh:161`, from raw `c.dataDir` at `:97`; compare `server/src/storage.ts:14`). `storage.ts` opens `path.join(DATA_DIR, 'storagi.sqlite')`, which removes `link/..` lexically; the shell follows the symlink first. With `DATA_DIR=<data>/link/..`, `link` pointing elsewhere and databases in both places, the deploy exited 0 having backed up the wrong database. Reviewer reproduced it and confirmed the real `Storage` location.

## Reviewer checks

`npm run setup`; `npm run check` PASS (server31, web19, HTTP11, deploy51, typechecks, builds); six temporary probes (five pass, the backup-correctness probe confirms the P2); `bash -n`; `git diff --check`. No real systemd or live checks.

## Invariance and cleanup

Native proof: `"$HOME/.codex/sessions/2026/10/21/rollout-2026-10-21T17-26-33-01a15dc8-a855-7c91-8c0c-2bb637b7f117.jsonl"`, line1 provider openai, line8 model gpt-6.1-sol effort high. Parent HEAD, porcelain status and remote heads matched the before snapshot. Reviewer worktree clean at `585d67a`; coordinator removed only it and branch `t3/review-deploy-config-gate`.
