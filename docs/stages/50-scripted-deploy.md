# 50: Scripted tag deploy, release stamp and start-time verification

- Status: completed on branch; review52 pending. Nothing deployed.
- Started / completed: 2026-10-21, Asia/Kuala_Lumpur (completed about 14:40+08:00).
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844).
- Agent/task: distinct delegated implementation agent, task `node:delegated-task:command%3Amcp%3Aaa1cf953-f6fd-4c46-8cda-656192ed3b8e%3Adelegate-task%3Astoragi-stage50-scripted-deploy-v1` (id recorded by the coordinator).
- Provider/model/effort: Anthropic `claude-opus-5-5`, effort high, confirmed by the coordinator from the agent's own session log `"$HOME/.claude/projects/<worktree>/73ccae9d-1e6a-45d6-94b7-a63b71552aac.jsonl"` (assistant message model and recorded effort).
- Workspace/branch: fresh T3 worktree, `feat/scripted-deploy` from 198bc2f (stage49).
- Scope and acceptance criteria: replace the agent-executed prose update procedure with a tag-gated `scripts/deploy.sh <tag>`, a stamped read-only release checked at start by `scripts/verify-release.sh` (`ExecStartPre`), node:test coverage in `npm run check`, and updated operator docs. No push, PR, tag, merge or deploy. No reads of private environment values, no `systemctl --user` on the real service and no writes to the real runtime, config or unit directories.

## Decisions

- The owner protects `main` and `v*` tags (stage48). The script only runs from a clean checkout whose HEAD is `origin/main` after `git fetch origin --tags`, and only deploys a tag whose commit is on `origin/main`. Storagi has no schema migrations, so the database is backed up but never migrated or restored automatically.
- **Deviation:** the native SQLite check and the manifest `NODE` use the binary in the release unit's `ExecStart` (`/usr/bin/node` in the real unit) rather than a hard-coded `/usr/bin/node`. Production behaviour is the same. Tests can then point the fixture unit at the test runner's node, because GitHub's ubuntu-24.04 runner may have no `/usr/bin/node`, and the brief allowed no env seams.
- Extra refusal gates, beyond the brief: the installed unit must exist, so rollback can restore it, and `DATA_DIR/storagi.sqlite` must exist, so a misparsed `DATA_DIR` (for example a quoted value) stops before cutover instead of during the backup.
- A failed build removes its partial release, so failed builds never count toward pruning. All failures before the stop exit 1. `PORT`/`DATA_DIR` are read with `sed` from `KEY=value` lines only; values are never printed.
- The content hash is one `sha256sum` over sorted `sha256sum` lines of every regular file plus sorted `path -> target` lines for symlinks. `deploy.sh` gets it from the release's own `verify-release.sh --print-hash`, so the hash code exists once. It takes about 1.1s on a 3,016-entry, 84 MB tree.
- The server writes only under `DATA_DIR` (`server/src/app.ts`, `storage.ts`: mkdir, SQLite and objects there). Its static directory is resolved relative to the compiled module and only read. So the release can be read-only.
- Bootstrap: a hand-copied first release has no manifest, so the first-installation guide now installs the unit without its `ExecStartPre` line (`grep -v … | install -m 600 /dev/stdin …`). The first scripted deploy then adopts the release.

## Changes

- `scripts/deploy.sh` (new): gates; build in `releases/<tag>-<short sha>-<UTC yyyymmddThhmmssZ>` (mode 0700, `git archive | tar`, `npm run setup`, `npm run check`, `npm prune --omit=dev`, remove `web/node_modules`, native binding load); `BUILD_MANIFEST`; `chmod -R a-w`; the release's own verify; then cutover. Cutover: copy the old unit, stop, wait for inactive with no listener (60 tries), back up `storagi.sqlite{,-wal,-shm}` (0700/0600, `cmp`-verified), install the unit 0600, `daemon-reload`, swap `current` (`current.next` + `mv -T`), start, then up to 90 health tries (`/` 200, `/api/session` 401, MainPID cwd inside the new release). Rollback runs on any failure or HUP/INT/TERM after the stop: exit 2 when healthy, 3 with `MANUAL RECOVERY REQUIRED`. On success it prunes releases (keeps current, previous and the 3 newest by mtime) and backups (keeps the 3 newest).
- `scripts/verify-release.sh` (new): resolves its own physical release by default. It checks that the manifest exists and every field is non-empty, `DEPLOYED_BY=scripts/deploy.sh`, the `TAG` regex, a 40-hex `COMMIT`, and the recomputed `CONTENT_SHA256`. It prints the reason on stderr; on success it prints `verify-release: <tag> <commit> ok`.
- `deploy/storagi-user.service`: added `ExecStartPre=%h/.local/lib/storagi/current/scripts/verify-release.sh`; everything else unchanged.
- `scripts/deploy.test.ts` (new) and root `test:deploy`, run in `check` before typecheck.
- `docs/user-service.md`: layout (manifest, scripts, backups), bootstrap unit install, and a rewritten "Updates and rollback" section (tag deploy, gates, build, cutover, rollback and exit codes, start-time check, adoption of the hand-copied release, manual rollback by deploying an older tag, backup location). The first-installation section is kept.
- `README.md`, `docs/setup.md`, `docs/verification.md`: the check description now mentions the deploy-script tests.

## Verification

All commands ran in the worktree with `TMPDIR="$HOME/.cache/storagi/tmp"` after `npm run setup` (exit 0).

- RED: the tests ran against empty scripts first: 0/23 pass. GREEN: `npm run test:deploy`: 23/23 pass (7 top-level tests, 16 refusal subtests), about 21s.
- Coverage:
  - Success: `current` swapped; manifest fields; release 0500 with read-only files; `web/node_modules` removed and prune run in `server/`; the fake service runs from the new release after the installed unit's `ExecStartPre` passed; the unit is installed 0600 and identical to the release's; stop → daemon-reload → start order; the backup holds DB and WAL only (no objects, 0700/0600, identical bytes); release and backup pruning, including a read-only old release; a second deploy keeps the first as previous.
  - Refusals, each leaving a full snapshot of runtime, unit, config and data identical, with no stop or reload: no argument, non-version tag, two arguments, tracked change, HEAD not `origin/main`, missing tag, tag not on main, tag only in this checkout (coordinator addition), missing or out-of-tree `current`, missing unit, missing environment, mode 0640, missing database, established connection, existing release name, lock held.
  - Failures: a failing check (exit 1, untouched, no stop); a failed stop (exit 1, started again, nothing changed); an unhealthy new release (exit 2, previous `current` and unit restored, service back on the old release); SIGTERM during cutover (exit 2, restored); an unhealthy rollback (exit 3, `MANUAL RECOVERY REQUIRED`, backup path printed). Every run asserts a synthetic environment secret never appears in the output.
  - verify-release: passes on a fresh release through its default self-resolution. It fails on a tampered file, a retargeted symlink, a missing manifest, wrong `DEPLOYED_BY` and an empty `NODE`.
- Mutation checks: each of six one-line sabotages made the suite fail. The six: rollback unit restore removed, read-only chmod removed, idle gate disabled, HEAD gate disabled, TERM trap removed, `web/node_modules` removal skipped.
- Full `npm run check`: exit 0 in 1m44s (load average about 1). Server 31/31, web 19/19, independent HTTP 11/11, deploy 23/23, both typechecks and both builds. No flaky server failure on this run. Log `"$HOME/.cache/storagi/stage50-check.log"`.
- `bash -n` on both scripts: pass. shellcheck is not installed on the host, so I ran the upstream v0.11.0 release binary from `"$HOME/.cache/storagi/tools/"` (not a repository dependency). First run: SC1010 on the word `phase=done`, renamed. Final run: exit 0, no findings.
- `systemd-analyze --user verify deploy/storagi-user.service`: exit 1. Its output says the `ExecStartPre` command `"$HOME/.local/lib/storagi/current/scripts/verify-release.sh"` "is not executable: No such file or directory". This is expected: the live hand-copied release has no scripts until the first scripted deploy adopts it. There were no other diagnostics. It only reads unit and path metadata.
- `ss` filter syntax was checked against a temporary loopback `python3 -m http.server` on an unused port. `ss -Htln 'sport = :P'` shows the listener. `ss -Htn state established 'sport = :P'` lists only the server side of a connection. Neither prints anything for an unused port.
- The native binding one-liner loads the worktree's real `better-sqlite3` with `/usr/bin/node` v22.22.1 from `server/`.
- `git diff --cached --check`: clean. Scanning the staged diff for home paths, the host username, tailnet names and the git identity found 0 matches.

## Findings and limitations

- No real systemd, Tailscale or production run happened. Systemd, curl and ss were PATH shims, and the "service" was a sleep process. Real `Type=exec` start timing, journal output, `ExecStartPre` under the user manager and the 90-second Google-discovery window are untested until the owner's first real deploy.
- Coordinator integration (after the agent handed off): the agent reported that a tag existing only in the deploying checkout was accepted. Because tag creation is the owner's release decision, the coordinator added a gate requiring `git ls-remote origin` to show the tag at the same commit (peeled for annotated tags) and a refusal test `tag only in this checkout`. RED: that subtest failed without the gate (22 pass/2 fail); GREEN: `npm run test:deploy` 24/24. Coordinator `npm run check` then passed: server 31/31, web 19/19, HTTP 11/11, deploy 24/24, typechecks and builds.
- `npm run check` inside a real release includes the server timing tests that stage49 found flaky under load. Such a failure aborts the deploy with production untouched; rerun it.
- Tailscale keep-alive connections to the loopback port make the idle gate refuse until they close.
- Only tags that contain `scripts/verify-release.sh` can be deployed, so tags from before this stage cannot be.
- The new unit will refuse the current hand-copied release, so it must not be installed by hand. The first scripted deploy is the adoption (documented).
- No live runtime, config, unit, service or Tailscale state was read or changed. The environment file was never read. The only command that touched the real home was the read-only `systemd-analyze` verify. The temporary `http.server` used an unrelated port and was stopped.

## Handoff

Commit on `feat/scripted-deploy` (stacked on stage49). Review52 follows: fresh read-only review, Codex gpt-6.1-sol/high per owner routing. After that the coordinator publishes. The owner applies the tag ruleset and creates the first tag. The first real `scripts/deploy.sh vX.Y.Z` is an owner-approved deployment step that adopts the hand-copied release.
