# 56: Independent scripted deploy review round 3

- Status: FAIL; one P1 accepted for stage57, two P3 recorded. Round-2 findings resolved.
- Date: 2026-10-21, Asia/Kuala_Lumpur.
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844).
- Owner/task: fresh read-only reviewer returned findings; coordinator wrote this record.
- Actual provider/model/effort: OpenAI/gpt-6.1-sol/high, parsed by the coordinator from the reviewer's own native session (below).

## Scope

`5294828..0817583` focusing on `dca1e40..0817583` (stage55 fixes). Brief asked for P1 only where production can realistically break or a safety check is silently bypassed on this host; hardening-only items P3.

## Round-2 status

Signal window fixed (DEBUG-trap regression passes and checks the restart). Failed `git status` fixed. External/dangling symlinks refused at stamping and start; internal links and invocation through `current` work. DATA_DIR trimming, backslash refusal, absolute DATA_DIR and empty/out-of-range PORT handled.

## Findings

- **P1 trimming PUBLIC_ORIGIN can leave production down** (`scripts/deploy.sh:99-106`). `PUBLIC_ORIGIN="https://example.invalid "` passed preflight after trimming, but systemd keeps the space and `config.ts:6` requires the untrimmed value to equal the canonical origin, so the new start and the rollback start both fail. Reviewer confirmed with the real `loadConfig` in a temporary HOME: exit 3, service stopped. Coordinator confirmed in `config.ts` (`origin.origin !== env.PUBLIC_ORIGIN`; PORT goes through `Number()`, which ignores surrounding whitespace; DATA_DIR is trimmed).
- **P3 internal links to files outside the hashed paths** (`scripts/verify-release.sh:15-19`): e.g. `server/dist/link -> ../../scripts/x.js` passes the boundary check and its target content is not hashed. Requires an unusual build layout plus later modification. Recorded as a documented limit, not fixed.
- **P3 symlink enumeration failure unchecked** (`:16`): the process-substitution producer's status is ignored; only a selective `find` failure lets an external link through. Recorded, not fixed.

## Reviewer checks

`npm run setup`; `npm run test:deploy` 42/42; `npm run check` PASS (server31, web19, HTTP11, deploy42, typechecks, builds); focused probes (parser aborts, PORT handling, physical resolution through `current`, external-link rejection, the findings); real-config probes via `tsx`; `bash -n`, whitespace, privacy.

## Invariance and cleanup

Native proof: `"$HOME/.codex/sessions/2026/10/21/rollout-2026-10-21T15-35-13-01a15d62-bb0c-7eb0-9c66-fe2c56f8f193.jsonl"`, line1 provider openai, line8 model gpt-6.1-sol effort high. Parent HEAD `0817583` and all remote heads matched the before snapshot; the parent's only working-tree changes were the coordinator's own stage57 edits made after the review returned. Reviewer worktree clean at `0817583`; coordinator removed only it and branch `t3/scripted-deploy-review-round-three`.
