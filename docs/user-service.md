# Persistent service in the existing user manager

Prepared unit: [deploy/storagi-user.service](../deploy/storagi-user.service). The owner-approved installation is now active; automatic recovery passed. The preparation task itself did not install or activate it. [Stage41](stages/41-service-activation.md) owns the reviewed live handoff and behavior proof; [stage40](stages/40-service-and-domain-review.md) reviews first. The existing system-service example in [setup](setup.md) is a separate deployment option, not part of this procedure.

The host preflight found systemd259, a running owner user manager and existing `Linger=yes`. Linger starts that manager at boot and retains it after logout; enabling this unit attaches it to the user's `default.target`. This prepares autostart without sudo or changing linger. On2026-10-21 the owner accepted boot autostart as working from this configuration and waived a physical reboot test; no observed cold boot is claimed. The owner confirms power/lid behavior is already configured and working. No further reboot or power/network changes are planned unless an issue is reported or the owner requests them.

## Layout and preflight

Run as the existing app owner, from the repository root. Keep the exact current Google credentials, owner subject, HTTPS origin, port and absolute `DATA_DIR`; no data, SQLite, flow key or session migration. The private environment remains at `"$HOME/.config/storagi/environment"`. Its directory and the existing data directory must be owner-owned mode0700, environment file0600; inspect permissions locally without printing contents. Do not recursively change a populated data tree. Values use systemd environment-file assignments (`KEY=value`, no `export`, shell sourcing or variable expansion); `DATA_DIR` needs its existing literal absolute value, not `$HOME` or `%h` text. Missing/unreadable configuration fails startup; the unit has no optional-file prefix or authentication fallback.

```text
$HOME/.local/lib/storagi/
  releases/<unique-release>/
    server/package.json, package-lock.json, dist/, node_modules/
    web/dist/
    BUILD_MANIFEST, scripts/verify-release.sh   (scripted releases only)
  current -> releases/<unique-release>
  backups/<release>/                     (database copies from scripted deploys)
$HOME/.config/storagi/environment       (existing private configuration)
existing absolute DATA_DIR             (separate persistent owner data)
```

Before touching anything, privately record the original exact Node PID, executable, working directory, environment-loading procedure and release/pointer state for rollback. Never dump process environments, credentials, database/session contents or raw journals into proof. Confirm no existing user/system Storagi unit, drop-in, mask or other supervisor conflicts; if one exists, stop this procedure and reconcile it before overwriting or starting anything:

```sh
systemctl --user list-unit-files 'storagi*'
systemctl --user show storagi-user.service -p LoadState -p FragmentPath -p DropInPaths -p ActiveState -p MainPID
systemctl show storagi.service -p LoadState -p FragmentPath -p ActiveState -p MainPID
loginctl show-user "$(id -u)" -p Linger -p State
/usr/bin/node --version
```

Confirm `/usr/bin/node` is the validated Node22.22+ runtime on Node22; private config and data are accessible to this same user; enough persistent space exists for another release; code/data paths do not overlap. Inspect any other matching unit before continuing. Preserve unrelated services and mappings. No root account, system account, new linger setting or user-namespace sandbox is required. `UMask=0077` restricts newly created files; `NoNewPrivileges=true` prevents privilege gains through exec. The process still has the owner's ordinary file access: this is not dedicated-account or root-enforced filesystem isolation.

## Prepare a candidate without replacing the running app

Use the exact compiled artifacts and dependency tree already validated together on this host. Initial copy, from the repository root, after selecting a new release name:

```sh
runtime_root="$HOME/.local/lib/storagi"
release_id=validated-commit-and-unique-build-id  # choose a fresh name for this candidate
release="$runtime_root/releases/$release_id"
install -d -m 700 "$runtime_root" "$runtime_root/releases"
mkdir -m 700 "$release"                     # must fail if the release already exists
install -d -m 700 "$release/server" "$release/web"
cp -a -- server/dist server/node_modules server/package.json server/package-lock.json "$release/server/"
cp -a -- web/dist "$release/web/"
```

Run each step only if the preceding step succeeded. Do not copy `.env`, data or a private environment into a release. Preserve the matching dependency tree, including SQLite's native binding; no production dependency install or bypass. Verify file hashes against the validated source tree, package metadata, executable Node version/native binding compatibility, and both server/web build trees. Reject symlinks escaping into a mutable checkout or another release. Record sanitized counts/hashes and the source commit/build identity in stage41; a copy alone is not verification. Do not start a second app to test the candidate against the live store.

On the first installation only, when `current` is absent, `ln -s "releases/$release_id" "$runtime_root/current"` prepares the pointer without moving the original live app. If `current` already exists, retain it and its target; candidate activation waits for the stopped-service update procedure below. Check that `current/server/dist/src/main.js`, `current/server/node_modules`, `current/server/package.json` and `current/web/dist/index.html` are present and traversable, then run:

```sh
systemd-analyze --user verify deploy/storagi-user.service
```

This native check validates directives/dependencies and the `/usr/bin/node` executable, not the JavaScript argument's existence, private environment values, filesystem permissions or Google readiness. Report missing release prerequisites separately even if verification exits0. `%h` is the home of the user manager's owner, expanded by systemd, not by a shell. The relative server/web release layout matches the app's compiled static-directory resolution.

## Reviewed handoff and acceptance

Proceed only after independent service review PASS (stage40; fallback43 after its API limit) and with owner transfers idle. Reconfirm the original exact PID still belongs to this app and the expected loopback port; send `kill -TERM "$original_pid"` only to that verified PID, never `pkill`. Wait for its exit and verify no writer or listener remains before starting the unit. If graceful stop fails, pause and investigate; do not force-kill or launch another writer. Keep the original runtime and private startup procedure available for rollback.

After that clean stop, install only the new user unit (the preflight must have established no conflicting destination). A hand-copied first release has no `BUILD_MANIFEST`, so the unit's `ExecStartPre` start-time check would refuse it: install the bootstrap unit without that line, then adopt the release with the first scripted deploy (see below).

```sh
install -d -m 700 "$HOME/.config/systemd/user"
grep -v '^ExecStartPre=' deploy/storagi-user.service |
  install -m 600 /dev/stdin "$HOME/.config/systemd/user/storagi-user.service"
systemctl --user daemon-reload
systemctl --user enable --now storagi-user.service
systemctl --user is-enabled storagi-user.service
systemctl --user show storagi-user.service -p ActiveState -p SubState -p MainPID -p NRestarts -p Result
journalctl --user -u storagi-user.service -n 40 --no-pager
```

Review journals locally and publish only sanitized outcomes. `Type=exec` confirms Node was executed, not that asynchronous Google discovery/listening finished. Require a stable PID, exactly one writer, expected `current` release, unchanged data/config, loopback-only expected port, real app readiness and anonymous file denial before calling activation successful. Keep the already-approved HTTPS route unchanged. Existing owner sign-in/session and Inbox continuity need confirmation without exposing values. Do not call `systemctl status` output alone proof of readiness.

The user manager cannot order against the system's `network-online.target`. Google discovery during app startup can fail with exit1; `Restart=on-failure`, `RestartSec=15s` and unit-local `StartLimitIntervalSec=0` keep retrying after outages without exhausting a finite burst. Persistent configuration errors also retry every15seconds until stopped/fixed; use local journals to diagnose. This policy handles exits, not a hung process or an unavailable upstream that never completes. No watchdog/readiness loop is added. A clean exit, SIGTERM or explicit service stop does not trigger failure recovery.

After readiness, only with owner transfers idle, record `MainPID`/`NRestarts`, revalidate that PID, then induce one main-process failure using `systemctl --user kill --kill-whom=main --signal=SIGKILL storagi-user.service`. This is a destructive crash test, distinct from graceful maintenance. Wait through the15second delay; require a new stable PID, increased `NRestarts`, readiness/anonymous denial and preserved owner session/Inbox/object state. Do not use `restart` or SIGTERM as evidence of automatic failure recovery. Record actual results in41, failures included. No reboot or WAN acceptance is implied.

## Updates and rollback

Updates are tag deploys. The owner creates a `vX.Y.Z` tag on reviewed `main` (only the owner can create `v*` tags). Then the owner or an agent runs, from a clean checkout of `main` with the service owner's Node and npm:

```sh
export TMPDIR="$HOME/.cache/storagi/tmp"
scripts/deploy.sh vX.Y.Z
```

[`scripts/deploy.sh`](../scripts/deploy.sh) derives every path from `$HOME` (runtime above, the private environment and `"$HOME/.config/systemd/user/storagi-user.service"`). It refuses, changing nothing, unless the argument is `vX.Y.Z`; `git status` succeeds and shows no tracked changes in the checkout and, after `git fetch origin --tags`, its HEAD is `origin/main`; the tag's commit is on `origin/main`; no other deploy holds `.deploy.lock`; `current` points into `releases/`; the unit is installed; the environment is mode 0600, its `DATA_DIR` holds `storagi.sqlite` and its `PUBLIC_ORIGIN` is `https://host[:port]`; and no connection to the loopback port is open (an `ss` failure counts as open). Only `PORT`, `DATA_DIR` and `PUBLIC_ORIGIN` are read from the environment, as plain text: one pair of surrounding quotes is dropped as systemd does, then spaces and tabs are trimmed as the app does. A value containing a backslash, a relative `DATA_DIR`, or a `PORT` that is present but empty or outside 1–65535 is refused; an absent `PORT` means 8787. The health checks send `PUBLIC_ORIGIN`'s host as the `Host` header, because the app answers 400 to any other host. Tailscale keep-alive connections close a few minutes after the last request, so retry later if it reports open connections.

It builds a fresh `releases/<tag>-<short sha>-<UTC time>` from `git archive` of the tag, runs `npm run setup` and `npm run check` there (the same check as CI), prunes server dev dependencies, removes `web/node_modules`, loads the native SQLite binding with the unit's `/usr/bin/node`, writes `BUILD_MANIFEST` (tag, commit, build time, deployer, Node version, content hash) and makes the release read-only. The server only writes `DATA_DIR`. Because the build takes minutes, it checks again for open connections just before the stop. Any failure or refusal up to here removes the new release and exits 1 with production untouched.

Cutover: stop the service. If it won't stop, the script starts it again and exits 1 once the previous release is healthy, or 3 (`MANUAL RECOVERY REQUIRED`) if it isn't. While stopped, it copies `storagi.sqlite` and any `-wal`/`-shm` (never objects) to `backups/<release>/` (0700 directory, 0600 files, compared after copying) next to a copy of the installed unit. Then it installs the release's unit, runs `daemon-reload`, atomically swaps `current` (`current.next` then `mv -T`), starts the service and waits up to about 90 seconds (startup Google discovery may fail and retry after 15 seconds) for `/` 200, anonymous `/api/session` 401 and a main process running from the new release. On success it keeps `current`, the previous release and at most the three newest releases, plus the three newest backups.

Any failure after the stop, including Ctrl-C, TERM or HUP, rolls back (signals are ignored once the restart after a failed stop or the rollback begins). SIGKILL, a crash of the script or power loss cannot be handled and may leave the service stopped or a partial release behind: check `systemctl --user status storagi-user.service` and start or redeploy by hand. The rollback: stop, restore the previous `current` and unit, `daemon-reload`, start and check the previous release. Exit 2 means every restore step succeeded and the previous release is healthy again. Exit 3 prints `MANUAL RECOVERY REQUIRED` and any failed restore step, even if the service answers: inspect the service and journal yourself and never run two app processes on one `DATA_DIR`. The database is never restored automatically, because the new process may already have written to it; the script prints the backup path. Restore a backup only by hand, with the service stopped, and only after deciding that losing later uploads and sessions is acceptable.

**Start-time check.** The unit's `ExecStartPre` runs [`scripts/verify-release.sh`](../scripts/verify-release.sh) from the release `current` points to. It refuses to start unless that release has a complete `BUILD_MANIFEST` written by `scripts/deploy.sh`, its server and web files and symlink targets still match the recorded `CONTENT_SHA256`, and every symlink there resolves inside the release (the deploy refuses a build that makes one leaving it). Crash restarts re-run it, so such a release keeps failing every 15 seconds until it is fixed or redeployed. It catches accidental changes, not deliberate ones: anyone who can write the release can also rewrite the manifest, and `scripts/` and `BUILD_MANIFEST` themselves are not hashed. Run it by hand with `"$HOME/.local/lib/storagi/current/scripts/verify-release.sh"`.

**Adopting the running release.** The release active since [stage41](stages/41-service-activation.md) was hand-copied: it has no manifest or scripts, and its installed unit has no `ExecStartPre`. The first scripted deploy is the adoption. It installs the new unit together with its stamped release, so the start-time check never meets the unstamped release. If that deploy rolls back, the old unit and the hand-copied release come back together. Do not install the new unit by hand before then.

**Manual rollback.** Deploy an older tag with the same command from `main`, for example `scripts/deploy.sh v1.2.2`. It goes through the same gates, build, check and backup. Only tags that contain `scripts/verify-release.sh` can be deployed. Database backups stay in `"$HOME/.local/lib/storagi/backups/"`.

Storagi has no schema migrations. A future data-format change needs its own compatibility and backup plan before it is tagged, because running older code on newer data is not automatically safe.

If a first manual activation fails, `systemctl --user disable --now storagi-user.service`, confirm its processes and listener have exited, then restore only the original app using its privately recorded startup procedure. Never change `DATA_DIR`, delete owner objects or sessions, reset networking or remove rollback artifacts to fix startup. Boot autostart is owner-accepted as working with the physical reboot test waived; distinguish that acceptance from an observed reboot result.
