# 58: Focused independent review of stage57

- Status: FAIL; one P1 and one P2 accepted for stage59 (redesign of the environment gate).
- Date: 2026-10-21, Asia/Kuala_Lumpur.
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844).
- Owner/task: fresh read-only reviewer returned findings; coordinator wrote this record.
- Actual provider/model/effort: OpenAI/gpt-6.1-sol/high, parsed by the coordinator from the reviewer's own native session (below).

## Scope

Stage57 fix (`0817583..5f1415d`) and a final pass over `5294828..5f1415d`, calibrated: P1 only for realistic production breakage or a silently bypassed safety check on this host.

## Findings

- Stage56 quoted-padding case fixed, but the broader mismatch remains.
- **P1 PUBLIC_ORIGIN regex accepts non-canonical origins** (`scripts/deploy.sh:114`): uppercase hosts, explicit `:443`, leading-zero ports, short IPv4 (`127.1`), invalid punycode, out-of-range ports pass the script but `config.ts:6` rejects them after URL canonicalization. Real-`loadConfig` fixtures: uppercase, `:443`, `:08443`, `127.1` each exited 3 with the service stopped.
- **P2 DATA_DIR trimming differs from JavaScript `.trim()`** (`:100`, `:109`): a quoted DATA_DIR ending in NBSP or CR keeps the suffix in bash but not in the app; with databases in both directories the wrong one was backed up (exit 0).
- PORT accepted forms resolve consistently with `Number()`; no further P1/P2 in the full pass; recorded P3s unchanged.

## Reviewer checks

`npm run setup`; `npm run test:deploy` 43/43; real-config origin matrix and PORT/DATA_DIR probes via `tsx`; isolated reproductions (four origin outages, two wrong-backup cases); `bash -n`; `git diff --check`. Full `npm run check` not run.

## Coordinator assessment

Rounds 54, 56 and 58 each found a new divergence between the script's bash copy of the app's configuration rules and `config.ts`. Patching cases one by one does not converge. Stage59 removes the copy: the script asks the app's own `loadConfig` for the effective port, data directory and origin host, with the environment loaded by systemd itself (`systemd-run --user --pipe --wait -p EnvironmentFile=...`). Coordinator proved this read-only on the live host with the live release's `dist/src/config.js`: exit 0, three lines; the returned data directory contains `storagi.sqlite`; the returned host with the returned port gives live `/` → 200 and anonymous `/api/session` → 401. No values printed; service PID/restart count unchanged.

## Invariance and cleanup

Native proof: `"$HOME/.codex/sessions/2026/10/21/rollout-2026-10-21T15-48-08-01a15d6e-8b6c-79a2-b8dc-bc6c4d0f6b83.jsonl"`, line1 provider openai, line8 model gpt-6.1-sol effort high. Parent HEAD, porcelain status and remote heads matched the before snapshot. Reviewer worktree clean at `5f1415d`; coordinator removed only it and branch `t3/review-deploy-origin-fix`.
