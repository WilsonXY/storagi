# 53: Deploy review fixes

- Status: completed on branch; stage54 review pending. Nothing deployed.
- Started / completed: 2026-10-21, Asia/Kuala_Lumpur (completed about 15:10+08:00).
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844).
- Agent/task: distinct delegated fix agent (task id recorded by the coordinator).
- Provider/model/effort: Anthropic `claude-opus-5-5`, effort high, from the agent's own session log `"$HOME/.claude/projects/<worktree>/d77681bf-99ff-45fc-8a52-864f76939db6.jsonl"` (assistant messages record model `claude-opus-5-5` and effort `high`). The coordinator should confirm this independently.
- Workspace/branch: fresh T3 worktree, `fix/deploy-review-53` from 6c67a79.
- Scope and acceptance criteria: fix the five stage52 findings in `scripts/deploy.sh`. Each fix gets a regression that fails before it (RED) and passes after (GREEN). Update `docs/user-service.md`. Run `npm run check`, `bash -n`, shellcheck and `git diff --check`. No push, PR, tag, merge or deploy. No live service, private environment values or Tailscale.

## Decisions

- `PUBLIC_ORIGIN` is read with the same `sed` line parse as `PORT`/`DATA_DIR`, checked against `^https://[A-Za-z0-9.-]+(:[0-9]+)?$`, then turned into a Host authority by lowercasing and dropping `:443`. The app already refuses any non-canonical value at startup (`server/src/config.ts`: `origin.origin !== env.PUBLIC_ORIGIN`), so for a config the service can run with, these two steps change nothing. They are kept as the brief asked.
- The curl shim now behaves like `server/src/app.ts:74`: 400 unless the `Host` header equals `new URL(PUBLIC_ORIGIN).host`, computed in the test with real WHATWG URL parsing.
- One `idle()` function holds the fail-closed connection check. It is used by the early gate and by the new check after the build. `stopped()` checks `ss` the same way. Capturing output with `out=$(ss …) && [[ -z $out ]]` makes a non-zero or missing `ss` mean busy / still listening.
- **Small deviation:** the second idle check runs just before the backup directory and unit copy are created, not after them. These steps take milliseconds and touch no production state. Running the check first means a refusal leaves no empty backup directory, so "production untouched" still holds as a full snapshot. The check runs while the phase is still `build`, so a refusal removes the new release exactly as a failed build does. The build-phase exit message is now "stopped before cutover; removed releases/<name>, production untouched", because it now covers refusals too.
- Failed stop: the script ignores HUP/INT/TERM, then starts the service and waits up to 90 tries for `healthy "$prev"`. If the previous release is healthy, it exits 1 ("it is healthy again, nothing changed"). Otherwise it exits 3 with `MANUAL RECOVERY REQUIRED`. Ignoring signals matches `rollback()`, so Ctrl-C cannot cut short the restore and report exit 1.
- A shared `manual()` prints the `MANUAL RECOVERY REQUIRED` lines, sets `phase=manual` (a no-op case in `on_exit`) and exits 3. Setting a phase avoids changing the default `on_exit` case. Changing that case would let any unexpected pre-cutover command that exits 3 report a false "manual recovery".
- Rollback restore steps are best effort: each step still runs after an earlier one fails, and any failure is recorded (`current`, `unit`, `daemon-reload`, `start`, or `stop` if the service would not stop). Exit 2 only happens when no step failed and the previous release passes the health check. Otherwise the script prints "rollback failed at: <steps>" and exits 3, even if the service would answer. Running every step gives the best chance of leaving a working service for the owner to inspect.

## Changes

- `scripts/deploy.sh`: `idle()`, fail-closed `stopped()`, a `Host: $authority` header on every health probe (the deploy and rollback checks share `code()`), the `PUBLIC_ORIGIN` gate and authority, the second idle check after the build, the failed-stop health check with exit 3, per-step rollback tracking, and `manual()`.
- `scripts/deploy.test.ts`: a Host-enforcing curl shim, failure markers for the `ss` shim (`ss-fails`, `ss-listen-fails`), a late-busy marker set during `npm prune` in the build, `stop-kills`/`start-fails`/`break-unit-backup` markers for the systemctl shim, an optional `PUBLIC_ORIGIN` for the fixture, and a `setEnv` helper. New tests: refusal subtests `ss fails`, `missing PUBLIC_ORIGIN`, `http PUBLIC_ORIGIN`, `PUBLIC_ORIGIN with a path`, `quoted PUBLIC_ORIGIN`; a connection opened during the build; a non-default `PUBLIC_ORIGIN` port (`:8443`); a failed stop with a failed restart (exit 3); a failing listener check counts as not stopped; a failed rollback step gives exit 3 even when health passes. Two assertions in existing tests were updated for the new messages and the extra `show` calls after the restart.
- `docs/user-service.md`: the `PUBLIC_ORIGIN` requirement and Host header, `ss` failure means busy, the second idle check, the failed-stop exit codes 1/3, and exit 2 only when every restore step succeeded.

## Verification

All commands ran in the worktree with `TMPDIR="$HOME/.cache/storagi/tmp"` after `npm run setup` (exit 0).

- Whole-suite RED: the new test file against the original `scripts/deploy.sh` gave 20 pass / 14 fail of 34. The existing success test failed with exit 3 instead of 0, and the existing exit-2 rollback tests failed with exit 3 instead of 2. Their output showed "new release is not healthy" followed by `MANUAL RECOVERY REQUIRED`, which is the stage52 production failure the old shim hid. Each new regression also failed.
- Per-finding RED: each fix was reverted alone in the final script, and the matching tests were run with `--test-name-pattern`:

  | Finding | Reverted | Failing tests | Expected → actual exit |
  | --- | --- | --- | --- |
  | 1 Host header | `-H "Host: …"` removed | success, `:8443` port, two exit-2 rollbacks (4/4) | 0→3 (×2), 2→3 (×2) |
  | 1 origin gate | regex check disabled | 4 invalid-origin refusals | 1→3 |
  | 2 failed stop | old `start \|\| true; die` | failed stop + failed restart | 3→1 |
  | 2 (manual phase) | `phase=manual` removed | same test | 3→1 |
  | 3 ss fail-open | old `[[ -z $(ss …) ]]` in `idle`/`stopped` | `ss fails` refusal, listener check | 1→0 (×2) |
  | 4 late idleness | second idle check removed | connection opened during the build | 1→0 |
  | 5 rollback steps | unit restore not tracked | failed rollback step | 3→2 |

  The final script was restored byte-for-byte (`cmp`) after each run.
- GREEN: `npm run test:deploy`: 34/34 (12 top-level tests, 22 refusal subtests, about 36s).
- Full `npm run check`: exit 0 twice. Run 1 (before the `phase=manual` refinement) took 1m52s at load average about 1.1. Run 2 (final script) took 1m43s at load average about 2. Both runs: server 31/31, web 19/19, independent HTTP 11/11, deploy 34/34, both typechecks and both builds. No flaky server failure.
- `bash -n scripts/deploy.sh scripts/verify-release.sh`: pass. shellcheck v0.11.0 (the upstream binary under `"$HOME/.cache/storagi/tools/"`, not a repository dependency) on both scripts: exit 0, no findings.
- `git diff --check`: clean. Scanning the tracked diff for home paths, the host username and tailnet names found 0 matches.

## Findings and limitations

Responses to stage52:

- **P1 health probe Host header:** fixed. Both probes send `Host: <PUBLIC_ORIGIN authority>` in the deploy and rollback health checks. A missing, non-https, path-bearing or quoted `PUBLIC_ORIGIN` is refused before anything changes. The shim now enforces the app's contract.
- **P1 failed stop:** fixed. "Nothing changed" (exit 1) is only reported after the previous release passes the full health check again. Otherwise the script exits 3 with `MANUAL RECOVERY REQUIRED`. The existing "stop fails, restarted, exit 1" test still passes.
- **P1 socket inspection fails open:** fixed for the idle gate and for `stopped()`. A failing or missing `ss` counts as busy or still listening.
- **P1 idleness checked only before the build:** fixed. A second fail-closed check runs after the build, before the stop. A refusal there removes the new release and exits 1. The early check is kept.
- **P2 rollback ignores restoration failures:** fixed. Each restore step is checked, and any failure gives exit 3 even if health passes.

Limitations:

- No real systemd, curl-to-app, `ss` or production run happened. systemctl, curl and ss are PATH shims, and the "service" is a sleep process. The Host contract was not re-probed against the real app in this stage; stage52's reviewer and coordinator confirmed it (the right Host gives 200/401, a loopback Host gives 400).
- The live `PUBLIC_ORIGIN` was not read. If it is not canonical `https://host[:port]` (for example quoted), the first real deploy will refuse with exit 1, which fails closed. The running app already requires the canonical form.
- A signal arriving after `manual()` or the failed-stop restart begins is ignored until the script exits, by design.
- No live runtime, config, unit, service or Tailscale state was read or changed. Outside the worktree, the agent only used `"$HOME/.cache/storagi"` (temp files and the shellcheck binary) and read its own session log for model evidence.

## Handoff

Commit on `fix/deploy-review-53` (from 6c67a79). Stage54: a fresh independent review receives the original stage50 brief, the stage52 findings and these responses. After that the coordinator publishes. The first real `scripts/deploy.sh vX.Y.Z` is still an owner-approved step.

## Coordinator integration after handoff

Coordinator verified the agent's own session log (`claude-opus-5-5`, `"effort":"high"` on all 63 assistant entries), the live runtime/unit unchanged, and the diff against each finding. A read-only probe then ran the script's environment parsing and health logic against the live service (no `systemctl` writes, no values printed). It refused at the first gate: the live private environment double-quotes every value (valid systemd syntax; systemd strips the quotes), while the script read them literally, so PORT, PUBLIC_ORIGIN and DATA_DIR all failed. Fail-safe (exit 1, nothing changed) but the script could never deploy on this host; the stage53 test `quoted PUBLIC_ORIGIN` had asserted the opposite of the live format.

Fix: `env_value()` drops one pair of matching surrounding double or single quotes, as systemd does; regex/file gates still reject anything else. The test fixture now writes double-quoted values like the live file; `quoted PUBLIC_ORIGIN` became `mismatched quotes in PUBLIC_ORIGIN` (refused); new test `unquoted and single-quoted environment values deploy too`. RED: 21 failing (14 pass) with the old parsing; GREEN: `npm run test:deploy` 35/35; shellcheck v0.11.0 clean.

Live read-only probe after the fix: PORT, PUBLIC_ORIGIN and DATA_DIR gates pass; with the derived Host, live `/` → 200 and anonymous `/api/session` → 401; `ss` established/listener queries succeed (0 established, 1 listener). This is the first real-app confirmation of the health contract by the coordinator; real systemd stop/start remains unexercised until the first owner-approved deploy.
