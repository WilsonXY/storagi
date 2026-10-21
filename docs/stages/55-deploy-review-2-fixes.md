# 55: Deploy review round 2 fixes

- Status: completed on branch; stage56 review pending. Nothing deployed.
- Started / completed: 2026-10-21, Asia/Kuala_Lumpur (about 15:15–15:40+08:00).
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844).
- Agent/task: distinct delegated fix agent (task id recorded by the coordinator).
- Provider/model/effort: Anthropic `claude-opus-5-5`, effort high, from the agent's own session log `"$HOME/.claude/projects/<worktree>/10930643-4767-4483-9c25-bde8affd4282.jsonl"` (all 53 assistant entries at the time of writing record model `claude-opus-5-5` and effort `high`). The coordinator should confirm this independently.
- Workspace/branch: fresh T3 worktree, `fix/deploy-review-55` from 6bd02ad.
- Scope and acceptance criteria: fix the four stage54 findings in `scripts/deploy.sh` and `scripts/verify-release.sh`, each with a regression that fails before the fix (RED) and passes after (GREEN). Correct the unconditional claims in `docs/user-service.md`. Run `npm run check`, `bash -n`, shellcheck, `git diff --check` and a privacy scan. No push, PR, tag, merge or deploy. No live service, private environment values or Tailscale.

## Decisions

- **Signal window:** the failed-stop branch now runs `trap '' HUP INT TERM` before `phase=`. A signal before the trap still finds `phase=cutover` and rolls back. A signal after it is ignored, so the restart and health check always run.
- **Checkout status:** `status=$(git … status …) || die "git status failed in the checkout"`, then `[[ -z $status ]]`. A failing `git status` now refuses instead of counting as clean.
- **External symlinks:** `content_hash` checks every symlink under the hashed paths before hashing. `readlink -e` must resolve to a path under the release's physical root (`pwd -P`). Dangling or looping links fail `readlink -e`, so they are refused too. The same function runs at stamping (`--print-hash`) and at start (`ExecStartPre`). Links inside the release, such as `node_modules/.bin`, still pass. A link into the release but outside the hashed paths (for example into `scripts/`) is allowed, as the brief asked: the boundary is the release root.
- `deploy.sh` now stores the hash in `hash=$(… --print-hash …)` before writing the manifest heredoc. A failure in a command substitution inside a heredoc does not stop the script under `set -e`. Before, a refused hash would have left an empty `CONTENT_SHA256`, and the build would only have failed later at the verify step. Now the deploy stops at the cause, with phase `build` (release removed, exit 1).
- **Environment normalization:** after removing quotes, `env_value()` refuses any value containing a backslash. It then trims leading and trailing spaces and tabs (`[[:blank:]]`), as `config.ts` `.trim()` does for these values. Trimming only spaces and tabs is enough here. Any other whitespace (for example a CRLF `\r`) still fails the PORT, PUBLIC_ORIGIN or DATA_DIR gate, so the deploy refuses: it fails closed and never accepts a value the app would reject. Whitespace outside the quotes (`KEY= "v"`) also keeps the quotes and is refused.
- **PORT:** this matches `config.ts` `number('PORT', 8787, 1)` together with the `> 65535` check. An absent `PORT` line means 8787 (`grep -q '^PORT='`). A line that is present but empty or blank refuses. So does anything that is not 1–5 digits in the range 1–65535. Leading zeros are normalised (`08080` → 8080) as `Number()` would. `Number()` also accepts forms like `0x50` or `1e3`; the script refuses them, which is stricter and fails closed.
- **DATA_DIR:** must also be absolute, as `config.ts` requires. This is one extra condition on the existing gate; otherwise a relative value would be resolved against the deploy's working directory.
- Regression for the signal window: a `BASH_ENV` file installs a DEBUG trap in the deploy script. It arms when `phase` is `cutover`, then sends TERM to the script before every top-level command once `phase` is empty. This hits the exact boundary the reviewer probed (the command after `phase=`), and after the fix it also covers every later command in that branch. The `stop-kills` shim marker makes the failed stop actually kill the service, so a skipped restart is observable.

## Changes

- `scripts/deploy.sh`: signal ignore before `phase=` in the failed-stop branch; checked `git status`; `env_value()` backslash refusal and trimming; PORT presence and range; absolute `DATA_DIR`; content hash computed before the manifest heredoc.
- `scripts/verify-release.sh`: `content_hash` refuses symlinks that resolve outside the release or dangle.
- `scripts/deploy.test.ts`: the fixture exposes its `env` (for `BASH_ENV`), and the fixture build creates an external symlink when `$STATE/external-link` exists. New refusal subtests: `git status fails` (corrupt `.git/index`, `fetch.recurseSubmodules=false`, modified tracked file), `empty PORT`, `PORT out of range`, `backslash in DATA_DIR` (the literal backslash directory exists with a database). New tests: `a build with a symlink leaving the release refuses before the stop`, `DATA_DIR is trimmed like the app before the backup` (a database exists in both `<data>` and `<data> `), `a signal after a failed stop does not skip the restart`. In the main test, the `relinked` verify case now points to a different internal target (still a `CONTENT_SHA256` failure). New external and dangling link cases re-stamp the manifest with `--print-hash` where that succeeds and must fail with "outside the release".
- `docs/user-service.md`: the gate list covers the `git status` check and environment normalisation. Signal recovery now says when signals are ignored and that SIGKILL, a script crash or power loss cannot be handled. The start-time check now covers symlinks and says it catches accidental changes, not deliberate ones: `scripts/` and `BUILD_MANIFEST` are not hashed, and anyone who can write the release can re-stamp it.

## Verification

All commands ran in the worktree with `TMPDIR="$HOME/.cache/storagi/tmp"` after `npm run setup` (exit 0).

- Whole-suite RED: the new test file against the original scripts gave 33 pass / 9 fail of 42. Each refusal subtest (`git status fails`, `empty PORT`, `PORT out of range`, `backslash in DATA_DIR`) and the external-link build test deployed with exit 0 instead of 1. The trim test backed up `wrong db` instead of `db bytes`. In the signal test the output ended at "stopping storagi-user.service", with no restart and no "healthy again" message. The main test failed because a stamped release with an external link passed `verify-release.sh` (status 0).
- Per-finding RED: each fix was reverted alone in the final scripts, and the whole deploy suite was run:

  | Finding | Reverted | Failing tests (of 42) | Expected → actual |
  | --- | --- | --- | --- |
  | 1 signal window | `phase=` back before `trap ''` | signal after failed stop (1) | restart and "healthy again" → script exited after "stopping" |
  | 2 git status | old `[[ -z $(git status …) ]]` | `git status fails` (1, plus parent) | exit 1 → 0 |
  | 3 symlinks | link check disabled | main test (external link verified), external-link build (2) | verify ≠0 → 0; deploy exit 1 → 0 |
  | 4 trim | trimming removed | DATA_DIR trimmed (1) | backup `db bytes` → `wrong db` |
  | 4 backslash | backslash check disabled | `backslash in DATA_DIR` (1, plus parent) | exit 1 → 0 |
  | 4 empty PORT | old `${port:-8787}` | `empty PORT` (1, plus parent) | exit 1 → 0 |

  `PORT out of range` was RED against the original script (exit 0). In this table it stayed green, because the range check is a separate line from the reverted presence logic. The final scripts were restored and confirmed byte-identical (`cmp`) after the runs.
- GREEN: `npm run test:deploy`: 42/42 (16 top-level tests, 26 refusal subtests, about 47s).
- Full `npm run check` with the final scripts: exit 0 in 1m57s at load average about 1. Server 31/31, web 19/19, independent HTTP 11/11, deploy 42/42, both typechecks and both builds. No flaky server failure.
- `bash -n scripts/deploy.sh scripts/verify-release.sh`: pass. shellcheck v0.11.0 (the upstream binary under `"$HOME/.cache/storagi/tools/"`) on both scripts: exit 0. A first draft of the PORT range check drew SC2015 and then SC2309. It was rewritten as three plain lines instead of being suppressed. A probe of the final form: `8787`, `08080`→8080 and `65535` accepted; `0`, `65536`, an empty value, `x1` and 20 digits refused.
- `git diff --check`: clean. Scanning the diff for home paths, the host username and tailnet names found 0 matches.

## Findings and limitations

Responses to stage54:

- **P1 signal window after a failed stop:** fixed. Signals are ignored before `phase` is cleared, so no point in the branch exits 1 with the service stopped. The DEBUG-hook regression sends TERM before every command after the clear.
- **P1 checkout cleanliness fails open:** fixed. A failing `git status` refuses with exit 1, and production is untouched (snapshot equal, no stop).
- **P1 external symlinks escape verification:** fixed in the shared hash path. A build that creates an outside link refuses before the stop (release removed, production untouched). `verify-release.sh` refuses a release with an outside or dangling link even when its manifest was stamped with that link. Internal links still pass.
- **P2 environment normalization:** fixed for trimming, backslashes and empty or out-of-range `PORT`. `DATA_DIR` must also be absolute.
- **Docs:** corrected as described in Changes.

Limitations:

- No real systemd, curl-to-app, `ss` or production run happened. systemctl, curl and ss are PATH shims, and the "service" is a sleep process. The signal test uses a bash DEBUG hook, which checks the order in the branch but not real signal timing.
- Signals after the failed-stop restart or rollback begins are ignored by design. SIGKILL, a script crash or power loss during cutover can still leave the service stopped; the guide now says so.
- `verify-release.sh` detects accidental changes only. A writer of the release can re-stamp `BUILD_MANIFEST`, and `scripts/` is not hashed. This predates this stage and is now documented.
- The live environment was not read. A live value with surrounding blanks, a backslash or an empty `PORT` would now change behaviour: blanks are trimmed as the app does, and the other two are refused. The coordinator's stage53 probe found the live gates passing with quoted values; whether those values contain blanks or backslashes is unverified here.
- Outside the worktree the agent only used `"$HOME/.cache/storagi"` (temp files, shellcheck) and read its own session log for model evidence. No live runtime, config, unit, service or Tailscale state was read or changed.

## Handoff

Commit on `fix/deploy-review-55` (from 6bd02ad). Stage56: a fresh independent review receives both rounds' findings and these responses. The first real `scripts/deploy.sh vX.Y.Z` is still an owner-approved step.
