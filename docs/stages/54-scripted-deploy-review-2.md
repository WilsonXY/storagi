# 54: Independent scripted deploy review round 2

- Status: FAIL; three P1 and one P2 accepted for stage55. Round-1 findings 1, 3, 4 and 5 resolved; 2 has a remaining signal window.
- Date: 2026-10-21, Asia/Kuala_Lumpur.
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844).
- Owner/task: fresh read-only reviewer returned findings; coordinator wrote this record.
- Actual provider/model/effort: OpenAI/gpt-6.1-sol/high, parsed by the coordinator from the reviewer's own native session (below).

## Scope

`5294828..dca1e40` with focus on `c364673..dca1e40`: stage53 fixes and the coordinator's quoted-environment parsing, with round-1 findings and responses in the brief.

## Round-1 status

Host header resolved (both probes send the derived authority; `:8443` covered; matches `URL.host` for origins `config.ts` accepts). Fail-open `ss` resolved. Late idleness resolved (refusal while `phase=build` removes the release, production unchanged). Rollback restoration failures resolved (`phase=manual` keeps exit 3). Failed stop/restart not fully resolved (below).

## Findings

- **P1 signal window after a failed stop** (`scripts/deploy.sh:146-147`). `phase` is cleared before HUP/INT/TERM are ignored; a TERM at that boundary (injected with a DEBUG hook) exits 1 with the service stopped and no restart or manual-recovery message.
- **P1 checkout cleanliness fails open** (`:73`). A failing `git status` with empty output passes; with `fetch.recurseSubmodules=false`, a corrupted index plus a modified tracked file deployed with exit 0.
- **P1 external symlinks escape verification** (`scripts/verify-release.sh:13`). Symlinks are hashed by target text only; a build producing `server/dist/src/main.js` pointing outside the release deployed, the target stayed writable, and verification still passed after its contents changed.
- **P2 DATA_DIR normalization differs from the app** (`scripts/deploy.sh:100`). `config.ts` trims values; the script does not, so `DATA_DIR="/x/data "` with databases in both paths backed up the wrong database. Double-quoted escapes stay literal while systemd decodes them. Also noted: an explicitly empty `PORT` defaults in the script although `config.ts` rejects it.
- Docs: the guide's unconditional claims about signal recovery and modified-release detection need correcting with these fixes.

## Reviewer checks

`npm run setup`; `npm run test:deploy` 35/35; six isolated fixture probes (four defects confirmed, ordinary failed-stop masking passed, default fetch rejected the damaged index); parser probes (matching/mismatched quotes, escaped quotes, empty values, `KEY=""`, CRLF); real `loadConfig` probe confirming trimming; documented bootstrap pipeline against a temporary destination; `bash -n`, whitespace, privacy. Full `npm run check`, real systemd and live HTTP not run.

## Invariance and cleanup

Native proof: `"$HOME/.codex/sessions/2026/10/21/rollout-2026-10-21T15-10-48-01a15d4c-5eed-7861-ba34-c0392f0f4771.jsonl"`, line1 provider openai, line8 model gpt-6.1-sol effort high. Parent HEAD, porcelain status and all remote heads matched the before snapshot. Reviewer worktree clean at `dca1e40`; coordinator removed only it and branch `t3/review-scripted-deploy-round-two`.

## Handoff

All four accepted; stage55 fresh fix task with regressions, stage56 fresh review with both rounds' findings and responses.
