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
  current -> releases/<unique-release>
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

After that clean stop, install only the new user unit (the preflight must have established no conflicting destination):

```sh
install -d -m 700 "$HOME/.config/systemd/user"
install -m 600 deploy/storagi-user.service "$HOME/.config/systemd/user/storagi-user.service"
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

Build and validate future source changes in a separate checkout using [setup](setup.md), then copy the matching completed server/dependencies/web output into a fresh versioned release and verify it as above. Never rebuild a live release or serve mutable developer `dist`. Preserve the previous release, unit and unchanged private configuration. A source commit alone does not identify rebuilt dependencies/assets; retain build/hash evidence. Schema-changing updates require their own compatibility/backup plan before activation; old code rollback is not automatically safe after a data-format change.

For an ordinary compatible update, with transfers idle, `systemctl --user stop storagi-user.service`; confirm exit, port clearance and store exclusivity. Privately save `readlink "$runtime_root/current"`. Create a fresh sibling symlink (`ln -s "releases/$release_id" "$runtime_root/current.next"`, only if that name is absent), then atomically replace the pointer (`mv -T -- "$runtime_root/current.next" "$runtime_root/current"`). Start the unit and repeat readiness/preservation checks. Stop before changing the pointer so server modules and static files cannot straddle releases. Retain the previous release until acceptance completes.

If first activation fails, `systemctl --user disable --now storagi-user.service`, confirm its processes/listener have exited, then restore only the original app using its privately recorded exact startup procedure/environment. If an update fails, stop the unit, confirm exclusivity, atomically restore a fresh symlink to the recorded previous release and start/check it. Never run old and new app processes together, change `DATA_DIR`, delete owner objects/sessions, reset networking or remove rollback artifacts to fix startup. A failed stop blocks rollback startup too. Report service/enablement state and remaining failures honestly. Boot autostart is owner-accepted as working with the physical reboot test waived; distinguish that acceptance from an observed reboot result.
