# 20: Portable public paths

- Status: completed — stable implementation accepted; independent review/publication tracked separately.
- Planned: 2026-10-19T16:30:35.303372+00:00. Started: 2026-10-20T00:31:34.798256+08:00. Completed/updated: 2026-10-20T00:33:56.025057+08:00.
- Coordinator: /root, T3 thread mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a; actual runtime Codex gpt-6.1-sol/high.
- Agent/native session: `01a15500-6c21-76d1-af20-9bf4383bdecf`; Coordinator confirms task `node:delegated-task:command%3Amcp%3A37d80f3b-c600-4623-aff0-759b9c35169f%3Adelegate-task%3Astoragi-stage20-portable-public-paths`, child matching `thread:delegated-task:` identifier from delegate_task/task_status. Actual OpenAI `gpt-6.1-sol` / `high` confirmed from own native `session_meta.model_provider` and `turn_context.model` / `turn_context.effort` at `$HOME/.codex/sessions/2026/10/20/rollout-2026-10-20T00-30-53-01a15500-6c21-76d1-af20-9bf4383bdecf.jsonl`.
- Workspace/branch/starting HEAD: `$HOME/projects/storagi`, `feat/storagi`, `5ac9a1df7c3b2c0e5dc4b9126f5b2448de8d3da7`; starting `git status --short` empty. No commits permitted in this stage.

## Scope and acceptance criteria

Own `AGENTS.md`, `deploy/storagi.service`, `web/README.md`, and `docs/**` except `docs/implementation-log.md` and stages 19/21. Normalize every current tracked documentation/instructions/template occurrence of the private home/account and encoded Claude home/worktree-directory prefix. Keep deployment examples consistent and inactive. Preserve original results, source hashes, provider/model/effort and session IDs. No application source/dependencies, commits, branches, pushes, history edits, delegation or host changes. Coordinator owns the index, independent privacy review, PR/history handling, CI and any baseline rerun.

## Decisions

Read the owner profile, project instructions, README, design record, implementation log, full service unit, setup instructions, both package READMEs and the environment example. Applied full-cycle and ponytail FULL within the explicit sub-agent limits; pr-body for handoff reporting. Privacy-only substitutions do not add application tests.

Public repository references use `$HOME/projects/storagi`; the global profile uses `$HOME/.codex/AGENTS.md`. Unrelated parent-repository paths are described generically. Shell command displays quote `$HOME` paths. Historical stages 01–18 explicitly distinguish normalized displays from the original literal invocations, retaining their actual outcomes and identity/hash evidence. Claude proof references use `$HOME/.claude/projects/<review-worktree>/<session-id>.jsonl`: `<review-worktree>` is deliberately a placeholder, not a literal directory. Locate the unchanged private native log by the preserved session ID; its provider/model/effort evidence is unchanged. This locator semantic change is handed to the coordinator for privacy review and index reconciliation.

Original assigned documents were copied privately before substitution to `$HOME/.cache/storagi/stage20-private-originals/` (private directory and file permissions); original native sessions were read only and remain local. No original private path is repeated in this public record, test fixture or explanation.

The service is now a portable inactive system-service example: `User=storagi`, `Group=storagi`, code at `/opt/storagi`, root-controlled environment at `/etc/storagi/environment`, data at `/var/lib/storagi`, `ReadWritePaths=/var/lib/storagi`, and `ProtectHome=true`. No shell variables or `%h` are used in systemd directives. Setup documents account/group, directory ownership/access, built server/dashboard/dependencies and Node prerequisites. The existing read-only `server/.env.example` already has `DATA_DIR=/var/lib/storagi`; no change is necessary there.

## Changes

Assigned changed files (no commits created):

- `AGENTS.md`
- `deploy/storagi.service`
- `docs/design-and-feasibility.md`
- `docs/setup.md`
- `docs/stages/01-foundation.md`
- `docs/stages/02-file-service.md`
- `docs/stages/03-dashboard.md`
- `docs/stages/04-integration.md`
- `docs/stages/05-acceptance.md`
- `docs/stages/06-review-round-1.md`
- `docs/stages/07-handoff.md`
- `docs/stages/08-backend-review-fixes.md`
- `docs/stages/09-session-resume-fix.md`
- `docs/stages/10-review-round-2.md`
- `docs/stages/11-fix-acceptance.md`
- `docs/stages/12-cleanup-timeout-fix.md`
- `docs/stages/13-review-round-3.md`
- `docs/stages/14-review-round-3-fallback.md`
- `docs/stages/15-failure-path-fixes.md`
- `docs/stages/16-final-fix-integration.md`
- `docs/stages/17-final-fix-review.md`
- `docs/stages/18-publication.md`
- `docs/stages/20-portable-paths.md`
- `web/README.md`

## Verification actually run

- Initial `git rev-parse HEAD`, `git status --short`, `git branch --show-current`, `git ls-files`, required reads and targeted `rg` inspection completed successfully. Initial tracked-content audit identified private-path/account occurrences in the assigned documentation/unit, including all three original Claude review records.
- `python3` inline audit enumerated files with `git ls-files -z`, scanned the actual home/account values derived at runtime, generic home-path forms, encoded home-directory prefixes and URL-encoded home forms: **82 tracked files; zero matches after normalization**. Ignored build/artifact outputs were excluded. A filesystem-reference inventory was manually checked: remaining absolute references are portable system examples, `$HOME` references, generic `/home` or `/tmp`, or agent task identifiers such as `/root`, not private home/account paths.
- The same audit is preserved privately at `$HOME/.cache/storagi/stage20-checks/audit-tracked.py`; actual final command: `python3 "$HOME/.cache/storagi/stage20-checks/audit-tracked.py"`. Output: **82 tracked files, zero matches**, exit 0; saved as `audit-tracked.json` in that private checks directory.
- A separate inline Python comparison against the private originals confirmed retained long session/identity/hash tokens are unchanged across **18 historical stage records** (assertions passed, exit 0). No new runtime proof was inferred for historical agents.
- Own native-session parsing read only `session_meta` provider/session ID and `turn_context` model/effort: actual OpenAI `gpt-6.1-sol`, `high`. Safe extracted metadata is stored locally in `$HOME/.cache/storagi/stage20-checks/runtime-proof.json`; source reference is in the header. Requested settings were not treated as proof. Coordinator independently reconciled T3 identifiers and parsed the actual native proof.
- `systemd-analyze --version`: systemd **259 (259.5-0ubuntu3.4)**. `systemd-analyze verify deploy/storagi.service`: **exit 0**. Eight warnings refer to pre-existing unrelated host units (removed CPUAccounting options and legacy PIDFile paths); no Storagi warning. This validates unit analysis, not account creation, directory access, credentials or service startup.
- `git diff --check`: **exit 0**, including the final record. Final `git rev-parse HEAD` remains `5ac9a1df7c3b2c0e5dc4b9126f5b2448de8d3da7`; no agent commit or branch change. No check command failed in this stage.

## Findings and limitations

The coordinator should clarify one existing `server/README.md` sentence, outside this agent's write scope: the parent needs write access only if the application must create `DATA_DIR`; a precreated writable `/var/lib/storagi` needs no service write access to `/var/lib`. This was reported during work and is explained correctly in `docs/setup.md`. The environment example already matches the unit.

These edits sanitize current assigned files. Previously published commits can still contain old values; history/privacy remediation belongs to the coordinator and any required owner decision. No claim that an ordinary documentation edit erases published history. No heavy commands, application tests/builds, baseline check, live systemd start or network/OAuth/device validation ran here. All host services, accounts, mappings and settings were preserved. Independent review and CI remain coordinator work; no new reviewer verdict is claimed.

## Stable handoff

All assigned edits and this record are stable; no further edits after handoff. Coordinator receives the current diff, unchanged native logs, private originals and checks, the Claude locator normalization caveat, and the server README clarification. Reconcile the stage index/task metadata, run independent privacy/configuration review and any required baseline checks, then handle PR/CI and public history separately. No running command or server is left by this agent. Index and review completion are not claimed by this implementation record.
