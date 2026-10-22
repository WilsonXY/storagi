# System service under a dedicated account

Storagi runs as `storagi.service` under the system manager, as a dedicated `storagi` account inside a systemd sandbox. It replaces the earlier [user service](user-service.md) entirely; there is no dual mode. Why: the app is internet-facing through Tailscale Funnel, and as the owner's own user a code-execution bug would reach the owner's whole home folder (SSH keys, Git and gh credentials, other projects). Under this layout a compromise stays inside Storagi's own code, data and secrets. Decisions and verification are in [stage67](stages/67-system-account.md).

## Layout

```text
/opt/storagi/                      root:root 755
  releases/<release>/              root-owned, read-only, one per deploy
  current -> releases/<release>
/var/lib/storagi/                  storagi:storagi 700, DATA_DIR (objects/, storagi.sqlite*)
/etc/storagi/environment           root:root 600, read by systemd before it switches to storagi
/var/backups/storagi/<release>/    root 700, database copies taken by deploys
/etc/systemd/system/storagi.service       deploy/storagi.service, installed by hand
/usr/local/sbin/storagi-promote           scripts/storagi-promote, root:root 755, installed by hand
```

`storagi` is a system account with group `storagi`, no login shell and no home. It owns only `/var/lib/storagi`. The release code is root-owned and read-only, so the running app cannot change its own code, and the start-time check below still holds.

The unit ([deploy/storagi.service](../deploy/storagi.service)) keeps the user unit's behaviour: `Type=exec`, `ExecStartPre` start-time check, `Restart=on-failure` after 15 s with no start limit, 60 s stop timeout, `UMask=0077`. It adds the sandbox: the whole filesystem is read-only except `/var/lib/storagi` (`ProtectSystem=strict`, `ReadWritePaths`), home folders are invisible (`ProtectHome=true`), and the unit gets a private `/tmp` and `/dev`, no capabilities, no privilege gain, internet and local sockets only (`AF_INET AF_INET6 AF_UNIX`; it needs outbound HTTPS to Google for sign-in), the `@system-service` system call set, a read-only kernel and cgroup view, its own processes only in `/proc`, and no new namespaces, realtime or SUID/SGID files. It does not use `MemoryDenyWriteExecute=`, which breaks V8's JIT. `systemd-analyze security` scores it 1.7 ("OK"). Port 8787 on loopback is unchanged, so Funnel needs no change.

## Deploying

The owner creates a `vX.Y.Z` tag on reviewed `main` (only the owner can create `v*` tags). Then, from a clean checkout of `main`, as an ordinary user:

```sh
export TMPDIR="$HOME/.cache/storagi/tmp"
scripts/deploy.sh vX.Y.Z
```

[`scripts/deploy.sh`](../scripts/deploy.sh) runs without root. It refuses, building nothing, unless the argument is `vX.Y.Z`; `git status` succeeds and shows no tracked changes; after `git fetch origin --tags`, HEAD is `origin/main`; and the tag's commit is on `origin/main` and pushed to origin. It then builds `<tag>-<short sha>-<UTC time>` in a private staging dir under `"$HOME/.cache/storagi/staging/"` from `git archive` of the tag: `npm run setup` and `npm run check` (the same check as CI), server dev dependencies pruned, `web/node_modules` removed, the native SQLite binding loaded with the unit's `/usr/bin/node`, and `BUILD_MANIFEST` written (tag, commit, build time, deployer, Node version, content hash). Finally it runs `sudo /usr/local/sbin/storagi-promote <staging dir>`, so sudo asks for the password once the build is done. It removes the staging dir afterwards and exits with the helper's status.

[`storagi-promote`](../scripts/storagi-promote) does everything that needs root:

1. **Gates.** It refuses, with production untouched, unless it runs as root through sudo by an ordinary user; the argument is an absolute, canonical path (no `.`, `..`, `//` or symlink anywhere) to a directory that user owns, named like `v1.2.3-abc1234-20261022T010203Z`; no other deploy holds the lock on `/opt/storagi`; `current` points into `releases/`; the unit is installed; the environment is root mode 0600; the running release's config check succeeds (below); `storagi.sqlite` exists; no connection to the loopback port is open (an `ss` failure counts as open); and the release and backup names are new.
2. **Config check.** It does not parse the environment itself. The release's own `loadConfig` runs as `storagi` in a transient sandboxed unit (`systemd-run --uid=storagi`) with the service's `EnvironmentFile`, so systemd decodes the file and the app validates the result exactly as at service start. It prints only the port, the database file (joined as the app's storage does) and the `PUBLIC_ORIGIN` host; on a refusal, only the app's error message. systemd stops a check still running after 60 s (`RuntimeMaxSec`). Because release code prints these values and root uses them, the helper also requires a numeric port, a plain host and exactly `/var/lib/storagi/storagi.sqlite`.
3. **Copy.** The staging dir is read with the caller's own uid and groups (`setpriv`), piped through `tar`, and written by root with no capabilities, in a sandbox that can write only the new release dir. Links are copied as links and never followed, and a swapped directory can only reach what the caller could already read. The copy is then made read-only and readable, with setuid, setgid and sticky bits cleared. It must contain only root-owned regular files, directories and symlinks, and every symlink must resolve inside the release.
4. **Release checks.** The copy's own `scripts/verify-release.sh` runs as `storagi`, as at `ExecStartPre`; from here on only root can change the release, so the result still holds at start. The new release's config check must match the running one's (no settings migration). Because the copy takes a moment, it checks for open connections again.
5. **Cutover.** It stops the service. If it won't stop, it starts it again and exits 1 once the previous release is healthy, or 3 if it isn't. While stopped, it copies `storagi.sqlite` and any `-wal`/`-shm` (regular files only, never objects) to `/var/backups/storagi/<release>/` and compares them. The files are read as `storagi` (`setpriv`, bounded by `timeout`), so root never opens a path in `storagi`'s own directory, where a swapped link or FIFO could redirect it. Then it swaps `current` atomically, starts the service and waits up to about 90 s (startup Google discovery may fail and retry after 15 s) for `/` 200, anonymous `/api/session` 401 with the origin host as `Host`, and a main process whose working directory is in the new release. On success it keeps `current`, the previous release and the three newest releases, plus the three newest backups.

Any failure after the stop, including Ctrl-C, TERM or HUP, rolls back: stop, restore the previous `current`, start and check it. Exit 2 means the previous release is healthy again. Exit 3 prints `MANUAL RECOVERY REQUIRED` and any failed step: inspect `systemctl status storagi.service` and `journalctl -u storagi.service` yourself, and never run two app processes on one `DATA_DIR`. The database is never restored automatically, because the new process may already have written to it. Restore a backup only by hand, with the service stopped, and only after deciding that losing later uploads and sessions is acceptable. SIGKILL, a crash or power loss cannot be handled and may leave the service stopped or a partial release behind; check the service and start it or redeploy by hand. Ctrl-C at the terminal during the promote reaches the helper (sudo relays it), and `deploy.sh` then exits with the helper's status.

To roll back by hand, deploy an older tag the same way, for example `scripts/deploy.sh v1.0.1`. Only tags that contain `scripts/verify-release.sh` and `deploy/storagi.service` can be deployed. Storagi has no schema migrations; a future data-format change needs its own compatibility and backup plan before it is tagged.

**What the helper never does.** It never installs or changes a unit file, sudoers or anything outside `/opt/storagi`, `/var/backups/storagi` and the service lifecycle: a release's own unit could set `User=root`, so the unit changes only by the owner's hand. It never runs release code as root, and never sources or evaluates `BUILD_MANIFEST`. It clears the caller's environment (`bash -p`, every exported variable unset) and sets its own `PATH`, `IFS`, locale, umask and working directory. Its paths are constants; tests run a copy with only those lines rewritten, so no argument or variable gives a sudo caller a test seam. A change to `deploy/storagi.service` or `scripts/storagi-promote` reaches the host only when the owner reinstalls it; compare with `cmp` before deploying. Because of all this, a future passwordless sudo rule for an unprivileged deploy account allowing only this file adds no root access: that account can choose the code `storagi` runs, nothing more.

**Start-time check.** `ExecStartPre` runs [`scripts/verify-release.sh`](../scripts/verify-release.sh) from the release `current` points to, as `storagi`. It refuses to start unless the release has a complete `BUILD_MANIFEST` written by `scripts/deploy.sh`, its server and web files and symlink targets still match the recorded `CONTENT_SHA256`, and every symlink there resolves inside the release. A link to a file inside the release but outside those server and web paths is checked by target name only, not content. Crash restarts re-run it. It catches accidental changes, not deliberate ones: whoever builds a release also writes its manifest. Run it by hand with `(cd / && sudo -u storagi /opt/storagi/current/scripts/verify-release.sh)`.

## Migration from the user service (owner-run)

One session, about 15 minutes, with a few minutes of downtime between steps 5 and 6. Run every step in the same bash terminal (later steps use `old`, `rel`, `data` and `old_data_ok` from step 0), and each step only if the previous one passed. Never print the environment's values. Prerequisites: this change is merged, the checkout is clean at `origin/main`, transfers are idle, and you are at the host's terminal (sudo asks for your password).

**0. Preflight.**

```sh
git fetch origin && git status --short && git rev-parse HEAD origin/main   # no changes, two equal SHAs
old="$HOME/.local/lib/storagi"
rel=$(basename "$(readlink -e "$old/current")") && echo "$rel"            # v1.0.0-263865e-20261021T170734Z
"$old/current/scripts/verify-release.sh"                                  # verify-release: v1.0.0 … ok
ss -Htn state established 'sport = :8787'                                 # no output: no open transfers
id -u storagi 2>&1; ls /opt                                               # no such user; /opt has no storagi
data=$(sed -n 's/^DATA_DIR="\(.*\)"$/\1/p' "$HOME/.config/storagi/environment")
# The old data dir: absolute, canonical, not home or above it, holding only Storagi's entries.
old_data_ok() {
  [[ $data == /?* && $data == "$(readlink -f -- "$data")" && $data != "$HOME" && $HOME != "$data"/* &&
    $data != /var/lib/storagi && -f $data/storagi.sqlite &&
    -z $(ls -A -- "$data" | grep -vxE 'objects|storagi\.sqlite(-wal|-shm)?') ]]
}
old_data_ok && echo "old data: $data" || echo "STOP: DATA_DIR missing or not just Storagi data"
```

Stop here unless the last line printed `old data: …`. The guards in steps 5 and 9 rely on `old_data_ok`.

**1. Account and directories.**

```sh
sudo useradd --system --user-group --home-dir /nonexistent --no-create-home --shell /usr/sbin/nologin storagi
sudo install -d -o root -g root -m 755 /opt/storagi /opt/storagi/releases
sudo install -d -o root -g root -m 700 /etc/storagi /var/backups/storagi
sudo install -d -o storagi -g storagi -m 700 /var/lib/storagi
```

Check: `getent passwd storagi` shows a uid below 1000, home `/nonexistent` and shell `/usr/sbin/nologin`; `id storagi` lists only group `storagi`; `test ! -e /nonexistent && echo no-home`; `sudo stat -c '%U:%G %a %n' /opt/storagi /opt/storagi/releases /etc/storagi /var/backups/storagi /var/lib/storagi` shows `root:root 755`, `root:root 755`, `root:root 700`, `root:root 700`, `storagi:storagi 700`.

**2. Release into `/opt`.**

```sh
sudo cp -a "$old/releases/$rel" /opt/storagi/releases/
sudo chown -hR root:root "/opt/storagi/releases/$rel"
sudo chmod -R a+rX,a-w,a-st "/opt/storagi/releases/$rel"
sudo ln -s "releases/$rel" /opt/storagi/current
```

Check: `readlink /opt/storagi/current` is `releases/$rel`; `find "/opt/storagi/releases/$rel" \( ! -type l -perm /7222 \) -o ! -user root | head` prints nothing; `(cd / && sudo -u storagi /opt/storagi/current/scripts/verify-release.sh)` prints `verify-release: v1.0.0 … ok` (its hash uses relative paths, so the copy still matches); `(cd /opt/storagi/current/server && sudo -u storagi /usr/bin/node -e "new (require('better-sqlite3'))(':memory:').prepare('select 1').get(); console.log('sqlite ok')")` prints `sqlite ok`.

**3. Environment, with only `DATA_DIR` rewritten.**

```sh
sed 's|^DATA_DIR=.*|DATA_DIR="/var/lib/storagi"|' "$HOME/.config/storagi/environment" |
  sudo install -o root -g root -m 600 /dev/stdin /etc/storagi/environment
```

Check, printing names only: `sudo stat -c '%U:%G %a' /etc/storagi/environment` is `root:root 600`; `diff <(sed 's/=.*//' "$HOME/.config/storagi/environment") <(sudo sed 's/=.*//' /etc/storagi/environment) && echo same-keys`; `sudo grep -cx 'DATA_DIR="/var/lib/storagi"' /etc/storagi/environment` is `1`. Then the app's own check as `storagi`, printing only port and data dir:

```sh
sudo systemd-run --uid=storagi --gid=storagi --pipe --wait --quiet --collect \
  -p EnvironmentFile=/etc/storagi/environment -p WorkingDirectory=/opt/storagi/current/server \
  /usr/bin/node --input-type=module -e "const {loadConfig} = await import('./dist/src/config.js'); const c = loadConfig(process.env); console.log(c.port, c.dataDir)"
# 8787 /var/lib/storagi
```

**4. Unit and helper.**

```sh
sudo install -o root -g root -m 644 deploy/storagi.service /etc/systemd/system/storagi.service
sudo install -o root -g root -m 755 scripts/storagi-promote /usr/local/sbin/storagi-promote
sudo systemctl daemon-reload
systemd-analyze verify /etc/systemd/system/storagi.service
```

Check: `systemd-analyze verify` exits 0 and prints nothing about `storagi.service` (warnings about other host units are unrelated); `systemctl show storagi.service -p LoadState -p UnitFileState` is `loaded` and `disabled`; `cmp deploy/storagi.service /etc/systemd/system/storagi.service && cmp scripts/storagi-promote /usr/local/sbin/storagi-promote && echo same`; `stat -c '%U:%G %a %n' /usr/local/sbin /usr/local/sbin/storagi-promote` shows `root:root 755` for both; `systemd-analyze security storagi.service | tail -1` reports about 1.7 OK.

**5. Stop the user service and copy the data.** Downtime starts here.

```sh
ss -Htn state established 'sport = :8787'          # no output; otherwise wait and retry
systemctl --user stop storagi-user.service
systemctl --user is-active storagi-user.service    # inactive
ss -Htln 'sport = :8787'                           # no output: nothing listening
old_data_ok && sudo cp -a "$data/." /var/lib/storagi/ &&
  sudo chown -R storagi:storagi /var/lib/storagi && sudo chmod 700 /var/lib/storagi &&
  sudo diff -r "$data" /var/lib/storagi && echo same
```

Check: `same`; `sudo find /var/lib/storagi ! -user storagi | head` prints nothing; `sudo stat -c '%U:%G %a' /var/lib/storagi` is `storagi:storagi 700`.

**6. Switch services.**

```sh
systemctl --user disable storagi-user.service
sudo systemctl enable --now storagi.service
```

Check: `systemctl --user is-enabled storagi-user.service` is `disabled`; `systemctl is-enabled storagi.service` is `enabled`; after a few seconds `systemctl show storagi.service -p ActiveState -p SubState -p MainPID -p NRestarts` shows `active`, `running`, a PID and `0`; `journalctl -u storagi.service -n 30 --no-pager` shows `verify-release: v1.0.0 … ok` and no errors.

**7. Checks.**

```sh
host=$(sudo sed -n 's|^PUBLIC_ORIGIN="https://\([^"]*\)"$|\1|p' /etc/storagi/environment)
curl -s -o /dev/null -w '%{http_code}\n' -H "Host: $host" http://127.0.0.1:8787/              # 200
curl -s -o /dev/null -w '%{http_code}\n' -H "Host: $host" http://127.0.0.1:8787/api/session   # 401
pid=$(systemctl show -p MainPID --value storagi.service)
ps -o user=,group= -p "$pid"                        # storagi storagi
sudo readlink -f "/proc/$pid/cwd"                   # /opt/storagi/releases/v1.0.0-…/server
sudo ls -A "/proc/$pid/root/home" | wc -l           # 0: the service's own view of /home is empty
ls -A /home | wc -l                                 # more than 0 on the host
sudo grep -E ' /(home|root|run/user) ' "/proc/$pid/mountinfo"   # sandbox mounts over /home, /root, /run/user
tailscale funnel status                             # unchanged: / proxies http://127.0.0.1:8787
```

Then, on the phone with Tailscale off, open the Funnel address: the sign-in page loads. Sign in as the owner (an existing session should still work, as the database came along), upload a small file, download it and compare, then delete it.

**8. Rollback, valid only until step 9.**

```sh
sudo systemctl disable --now storagi.service
ss -Htln 'sport = :8787'                            # no output
systemctl --user enable --now storagi-user.service
```

Check with the two `curl` lines from step 7. Uploads made since step 6 are only in `/var/lib/storagi` and are not in the old data. The account, unit, helper and `/opt` copy can stay; to try again later, empty `/var/lib/storagi` with `sudo find /var/lib/storagi -mindepth 1 -delete` and repeat from step 5.

**9. Cleanup, only after every step-7 check passed.** This ends the rollback path. `"$HOME/.config/storagi"` holds the old environment and anything else kept there, such as a saved Google client JSON; move what you still need elsewhere first. The running service uses `/etc/storagi/environment`.

```sh
rm "$HOME/.config/systemd/user/storagi-user.service"
systemctl --user daemon-reload
systemctl --user reset-failed storagi-user.service 2>/dev/null || true
du -sh "$data" "$HOME/.local/lib/storagi" "$HOME/.config/storagi"    # what goes: old data, old releases, old config
old_data_ok && rm -rf -- "$data"
chmod -R u+w "$HOME/.local/lib/storagi" && rm -rf -- "$HOME/.local/lib/storagi"
rm -rf -- "$HOME/.config/storagi"
```

Check: `systemctl --user list-unit-files 'storagi*'` lists none; `ls -d "$data" "$HOME/.local/lib/storagi" "$HOME/.config/storagi"` reports three missing paths; `systemctl is-active storagi.service` is `active`; the two `curl` lines still give 200 and 401.

**10. First deploy with the new scripts.** After the owner tags `v1.0.1` on `main` (which includes this change) and its CI passed:

```sh
git checkout main && git pull --ff-only
cmp scripts/storagi-promote /usr/local/sbin/storagi-promote && echo helper-current
export TMPDIR="$HOME/.cache/storagi/tmp"
scripts/deploy.sh v1.0.1                            # sudo asks for your password after the build
```

Check: exit 0; `readlink /opt/storagi/current` is `releases/v1.0.1-…`; `ls /opt/storagi/releases` still has the v1.0.0 release as previous; `sudo ls /var/backups/storagi` has one backup; `journalctl -u storagi.service -n 20 --no-pager` shows `verify-release: v1.0.1 … ok`; the step-7 `curl` lines give 200 and 401; sign in and open the Inbox.

## Limits

- The deploy account chooses the release code. The helper keeps that code to `storagi` inside the sandbox, but cannot judge whether it is the intended code: provenance comes from the tag, checkout and CI gates in `deploy.sh`, which run as the caller.
- The staging copy is not size-bounded: a caller can fill the shared filesystem, as it already could from its own home.
- A caller can stop `sudo` or the helper (for example with SIGSTOP) and leave the service down until it is resumed or killed; the lock then blocks other deploys.
- The sandbox settings were checked with `systemd-analyze` and, where a user manager allows it, against Node and the HTTP acceptance tests (stage67). The full set under the system manager is first exercised in step 6.
