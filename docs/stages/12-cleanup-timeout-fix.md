# 12: Cleanup timeout isolation

- Status: completed — stable implementation handoff; coordinator integration/review pending
- Started: 2026-10-19T22:12:20+08:00; completed / last updated: 2026-10-19T22:14:03+08:00
- Coordinator thread: `mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a`
- Agent/task/thread: task suffix `storagi-stage12-cleanup-timeout`; T3 thread `thread:delegated-task:command%3Amcp%3A84bfb7a9-ff9d-4f5a-9ea2-fc37786fe042%3Adelegate-task%3Astoragi-stage12-cleanup-timeout`; native session `01a15481-25f1-71c2-bc55-642ede242bbe`.
- Provider/model/effort: Codex `gpt-6.1-sol`, high effort confirmed by this agent's injected runtime and independently parsed native `turn_context` fields (`model: gpt-6.1-sol`, `effort: high`). Live `orchestrator_capabilities` confirms inherited provider/model (catalog option defaults are not execution effort proof). Native log: `$HOME/.codex/sessions/2026/10/19/rollout-2026-10-19T22-11-52-01a15481-25f1-71c2-bc55-642ede242bbe.jsonl`.
- Workspace/branch and starting commit: `$HOME/projects/storagi`, shared `feat/storagi`, `52cad6cee1303e8890946fc160dee8ee4e23ca9f`; starting porcelain status empty.
- Scope: only `server/src/app.ts` cleanup function, `server/test/cleanup.test.ts`, this record. Fix stage10 L1: attempt later expired rows despite a lock/deletion failure, retain failed quota, report first failure after all attempts, preserve in-lock expiry recheck, coalescing and retry. Stage13 and index are coordinator-owned.

## Decisions

Only fix the cleanup pass isolation; preserve failure observability, quota and retry. No unrelated simplifications or new scope.

Use full-cycle + ponytail FULL + TDD. Owner's bounded instruction assigns integration, independent review, commits and PR workflow to the coordinator; this child does not delegate or perform those actions. Mock the existing `FileLocks.with` prototype only at the dependency boundary; real HTTP-created partials, database state and disk paths provide observable cleanup/quota/retry assertions without waiting for a real lock timeout or adding production hooks. Keep round2 S1/S2/S3 unchanged.

## Changes

Added `server/test/cleanup.test.ts` before production edits. Its deterministic first-row prototype lock failure tests cleanup rejection identity/coalescing, later-row disk+metadata deletion and quota release, failed-row disk+metadata/quota retention, and a succeeding next pass after fault removal. Only `cleanup()` in `server/src/app.ts` changes: catch each expired row's lock/removal failure, retain the first thrown value, then rethrow it after all rows. The small wrapper preserves even falsy/undefined thrown values. Existing removal ordering, in-lock refresh check, shared promise/reset and timer catch are unchanged.

Ending authored files are exactly the three scoped paths above; no commits, branch changes, delegation, pushes, GitHub actions, package/root edits or host changes. Ending HEAD remains starting `52cad6cee1303e8890946fc160dee8ee4e23ca9f`, branch `feat/storagi`. Shared index `docs/implementation-log.md` appeared modified during this task; this agent did not edit it and leaves it with the coordinator. No source artifacts outside the assigned files; server build output is ignored.

## Verification

All following commands run from `server/`, sequentially, with `TMPDIR=$HOME/.cache/storagi/tmp`.

- RED: `npx tsx --test test/cleanup.test.ts` — exit1, 0 pass/1 fail, expected assertion `later independent expired row must be removed`; actual later4-byte row was still present after the first timeout. This ran against unchanged production cleanup.
- GREEN: `npx tsx --test test/cleanup.test.ts` — exit0, 1 pass/0 fail (about2.1s).
- `npm test` — exit0, 30 pass/0 fail/0 skipped (about24.9s). Includes the existing refreshed-activity check, active-write takeover, download pin/quota and lifecycle regressions.
- `npm run typecheck` — exit0 (`tsc --noEmit`).
- `npm run build` — exit0 (`tsc`).
- `git diff --check` — exit0. Diff inspection confirmed only the cleanup function changed in production code; no config/API/dependency changes. Native session metadata parsed read-only to confirm model/effort.

No validation commands overlapped; no command exceeded one minute. Test fixtures use synthetic identity and tiny partial files under the required TMPDIR and close/remove themselves. No tests/servers remain active from this stage.

Read owner/project instructions, README, design, log, API agreement, stage10 and relevant cleanup/lock/storage/test code. One exploratory read used the nonexistent `server/src/locks.ts` path and exited1; corrected to `server/src/transfers.ts`. Optional unset environment-variable inspection returned1; session ID was obtained and no check/build failed during inspection.

## Findings and limitations

The expected RED failure is resolved. No independent review was performed by this child; coordinator combined checks and fresh third read-only review remain required. The focused regression injects lock timeout rather than unlink failure; both failures are inside the same per-row catch, with existing unlink-before-forget ordering unchanged. Timer logging is preserved by inspection, not a separate new test. This change affects expired-row cleanup only and is reversible in source; normal expiry deletion remains intentional. No deployment, real Google, intended-device or WAN validation was performed; these remain outside the stage. Round2 optional S1/S2/S3 simplifications were deliberately retained.

## Handoff

Stable handoff: stop edits after this record and final read-only repository check; no commands remain active. Coordinator receives the three scoped working-tree files and owns index reconciliation, combined checks, commit, fresh round13 independent review (special reviewer route applies because `gpt-6.1-sol` wrote the fix), and final07 PR/owner handoff. This stage does not claim final integration, independent review, publication or deployment complete.

Coordinator reconciliation: task `node:delegated-task:command%3Amcp%3A84bfb7a9-ff9d-4f5a-9ea2-fc37786fe042%3Adelegate-task%3Astoragi-stage12-cleanup-timeout` confirmed completed by task_status; no pending child runs. All three scoped files, including new cleanup.test.ts, will be committed in the final review baseline.
