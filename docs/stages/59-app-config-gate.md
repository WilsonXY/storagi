# 59: Use the app's own loadConfig for deploy settings

- Status: completed; review60 confirmed the redesign (one P2 fixed in61, review62 PASS). Nothing deployed.
- Started / completed: 2026-10-21, Asia/Kuala_Lumpur (about 17:10–17:30+08:00).
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844).
- Agent/task: distinct delegated fix agent (task id recorded by the coordinator).
- Provider/model/effort: Anthropic `claude-opus-5-5`, effort high, from the agent's own session log `"$HOME/.claude/projects/<worktree>/667cd9dc-dc8e-4ce5-86c5-b9b5060fd859.jsonl"` (all 68 assistant entries at the time of writing record model `claude-opus-5-5` and effort `high`). The coordinator should confirm this independently.
- Workspace/branch: fresh T3 worktree, `fix/deploy-config-59` from 98b2d6a.
- Scope and acceptance criteria: close the stage58 P1 and P2 by removing `scripts/deploy.sh`'s copy of the app's configuration rules. Ask the app's own `loadConfig`, run by systemd with the service's `EnvironmentFile`, for port, data directory and origin host, before the build (running release) and after it (new release). Add regressions RED→GREEN, update `docs/user-service.md`, and run `npm run check`, `bash -n`, shellcheck, `git diff --check` and a privacy scan. No push, PR, tag, merge or deploy. No live service, private environment values or Tailscale.

## Decisions

- **One helper, `app_config <node> <release>`.** It runs `systemd-run --user --pipe --wait --quiet --collect -p EnvironmentFile="$env_file" -p WorkingDirectory=<release>/server <node> --input-type=module -e "$config_js"`. The JavaScript imports `./dist/src/config.js`, calls `loadConfig(process.env)` and writes `port`, `dataDir` and `new URL(origin).host` on three lines. The helper refuses (`die`, exit 1) unless the command exits 0 and `mapfile` reads exactly three non-empty lines. It then sets `port`, `data_dir` and `authority`. The `storagi.sqlite` existence gate on the returned `data_dir` stays.
- **Errors print only the app's message.** The brief's one-liner was wrapped in `try … catch (e) { console.error(e.message); process.exitCode = 1 }`. An uncaught `new URL()` failure makes Node print the error object, and that includes the rejected `input` value. I checked this locally with a probe string. `loadConfig`'s own messages name keys only (for example `Missing OWNER_GOOGLE_SUB`, `Invalid PORT`, `PUBLIC_ORIGIN must be an HTTPS origin without a path`), so the operator still sees why it refused.
- **Which node.** Before the build the check runs in the running release (`$prev`) with the node from the *installed* unit's `ExecStart`. After the build it runs in the new release with the node from the release's own unit, the same `$node` the native-binding check uses. A one-line `unit_node()` now serves both.
- **Early and late.** The early run sets the values for the first idle check and the database gate. The late run comes after `verify-release.sh` and `readlink -e`, and before the second idle check, the unit backup and the stop. Its raw three-line output must equal the early output byte for byte. Otherwise it dies with phase `build`: the release is removed, exit 1, production untouched. Settings are not migrated. Because the late output must equal the early one, it is already known to be three non-empty lines.
- **Deleted:** `env_value` (quote stripping, backslash refusal, trimming), the PORT presence and range parse, the PUBLIC_ORIGIN regex, the authority derivation and the redundant `/*` absolute-path test (`config.ts` requires an absolute path). The environment file existence and mode 600 gate stays.
- **Backslashes.** The refusal is gone. systemd decodes the file and the app validates the decoded value, and the service gets that same value, so there is nothing left to disagree on.
- **Tests run the real rules.** `before()` compiles the repository's `server` with its own `tsc -p server --outDir <temp>` (about 0.6 s). The compiled `src/config.js` goes into the hand-copied release and into each fixture build's `server/dist/src/config.js`. Both release `package.json` files declare `"type":"module"` as the real one does. The fixture environment gained `GOOGLE_CLIENT_ID` and `OWNER_GOOGLE_SUB`, because the real `loadConfig` checks every key, not just the three the script uses.
- **`systemd-run` shim:** it logs its arguments, reads `EnvironmentFile=` and `WorkingDirectory=`, then runs the command in that directory under `env -i sh -c 'set -a; . "$file"; exec "$@"'`. Shell quoting stands in for systemd's here: it matches for the quoted, single-quoted and unquoted values used. It does not model systemd's escape, whitespace or line-continuation rules.
- The installed fixture unit now uses the test's node (`process.execPath`), not `/usr/bin/node`, so the early check runs a known node.

## Changes

- `scripts/deploy.sh` (+25/−29): `unit_node`, `config_js` and `app_config` replace `env_value` and the PORT, PUBLIC_ORIGIN and authority lines. There is an early call against `$prev` and a late call against the new release with an equality check.
- `scripts/deploy.test.ts`: real compiled `config.js` in the fixture, the `systemd-run` shim, the extra required keys and the `process.execPath` unit. New refusal subtests: four non-canonical origins (`https://Example.invalid`, `:443`, `:08443`, `https://127.1`) and `previous release without the config check`. `DATA_DIR is trimmed…` became `the backup uses the DATA_DIR the app resolves`, with space, NBSP and CR subtests, each with a database in both directories. New test `a new release resolving different settings refuses before the stop`. The main test asserts the two `systemd-run` calls: environment file, working directory and node for the running release, then for the new one. Removed: the `backslash in DATA_DIR` subtest, whose behaviour no longer exists. `mismatched quotes in PUBLIC_ORIGIN` now expects the config-check refusal message (still exit 1, untouched).
- `docs/user-service.md`: the gate paragraph now says the script does not parse the environment. It asks the running release's own config check, run via systemd with the service's `EnvironmentFile`, for port, data folder and host, and refuses if the app would. The build paragraph now covers the new release's check and the refusal when settings differ. The description of quote dropping, trimming, backslashes and the PORT range is removed.

## Verification

All commands ran in the worktree with `TMPDIR="$HOME/.cache/storagi/tmp"` after `npm run setup` (exit 0).

- **RED:** the final test file against the original script (`git show HEAD:scripts/deploy.sh`, restored afterwards and confirmed with `cmp`): 39 pass / 12 fail of 51.

  | Stage58 case | Expected | Original script |
  | --- | --- | --- |
  | uppercase host `https://Example.invalid` | exit 1, no stop | exit 0 (deployed; the live app would refuse to start: stage58 saw exit 3) |
  | explicit `:443` | exit 1, no stop | exit 0 (same) |
  | leading-zero port `:08443` | exit 1, no stop | exit 3 |
  | `https://127.1` | exit 1, no stop | exit 3 |
  | DATA_DIR + NBSP, databases in both | backup `db bytes` | backup `wrong db` |
  | DATA_DIR + CR, databases in both | backup `db bytes` | backup `wrong db` |
  | padded `"https://example.invalid "` | exit 1, no stop | exit 1 (already fixed in stage57; still passes) |

  The other failures were expected. `previous release without the config check` and `a new release resolving different settings…` exited 0, because the old script never ran the app. In the main test, `systemd-run.log` is missing (the script never called systemd-run). `mismatched quotes…` exited 1 as before but with the old message. The space-padded DATA_DIR subtest already passed with the old trimming.
- **GREEN:** `npm run test:deploy` 51/51 (about 61 s).
- **Full `npm run check`:** exit 0 in 2m08s at load average about 1.4: server 31/31, web 19/19, independent HTTP 11/11, deploy 51/51, both typechecks and both builds. No flaky server failure.
- `bash -n scripts/deploy.sh scripts/verify-release.sh`: pass. shellcheck v0.11.0 (the upstream binary under `"$HOME/.cache/storagi/tools/"`) on both: exit 0.
- `git diff --check`: clean. Scanning the diff for home paths, the host username, the host name, tailnet names and the owner's email found 0 matches.
- Local evidence outside Git: the RED, GREEN and check outputs under `"$HOME/.cache/storagi/stage59/"`.

## Findings and limitations

Responses to stage58:

- **P1 PUBLIC_ORIGIN regex accepts non-canonical origins:** fixed by deleting the regex. The running app's `loadConfig` decides, so every form it rejects (uppercase, `:443`, leading zeros, short IPv4, invalid punycode, out-of-range ports, padding) refuses with exit 1 before the build. Four of these are regression tests. The health `Host` is `new URL(origin).host` from the app itself.
- **P2 DATA_DIR trimming differs from `.trim()`:** fixed by deleting the bash trimming. The backup, idle check and database gate use the `dataDir` the app returns. With NBSP or CR padding and a database in both directories, the app's directory is backed up (tests).
- Stage56 padded-origin case: still refuses (now with the app's message).

Limitations:

- Real `systemd-run` and systemd's `EnvironmentFile` parsing are not exercised by the tests. The shim uses shell sourcing, which matches only for these simple values. The coordinator's read-only live proof (stage58 assessment) covers the real path: exit 0 and three lines on the live release; the data directory holds `storagi.sqlite`; host and port give live `/` 200 and anonymous `/api/session` 401. I did not repeat it, because the brief forbids `systemd-run --user` for this agent.
- The early check trusts the running release's `server/dist/src/config.js`. The coordinator confirmed it exists in the live hand-copied release. If a future running release lacks it, the deploy refuses (test) and needs a manual decision.
- Comparing early and late output byte for byte also refuses harmless changes, for example if a future `loadConfig` canonicalizes `dataDir` differently. That is deliberate: no migration in a deploy.
- The transient unit inherits the user manager's environment as well as the `EnvironmentFile`. `loadConfig` reads only its own keys, and the service gets the same manager environment, so the two should agree. This is not tested.
- No real systemd, curl-to-app, `ss` or production run happened; systemctl, systemd-run, curl and ss are PATH shims.
- Outside the worktree the agent only used `"$HOME/.cache/storagi"` (temp files, shellcheck, evidence) and read its own session log for model evidence. No live runtime, config, unit, service or Tailscale state was read or changed.

## Handoff

One commit on `fix/deploy-config-59` (from 98b2d6a). Next: a fresh independent review of this change against stage58. The first real `scripts/deploy.sh vX.Y.Z` is still an owner-approved step.

## Coordinator verification after handoff

Coordinator confirmed the agent's own session log (`claude-opus-5-5`, `"effort":"high"` on all 75 assistant entries), the live runtime/unit/PID/restart count unchanged, and the script diff. The script's exact `unit_node`/`config_js`/`app_config` definitions, extracted from the committed file, were run read-only against the live release and private environment (no values printed): `app_config` succeeded with port 8787; the returned DATA_DIR holds `storagi.sqlite`; health with the returned host gives `/` → 200 and anonymous `/api/session` → 401; the `ss` idle query succeeds. This is the real-systemd evidence the test shim cannot provide.
