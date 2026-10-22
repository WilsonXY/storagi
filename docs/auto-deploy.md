# Auto-deploy on `v*` tags

A systemd timer on the host polls GitHub every 15 minutes. When the owner has pushed a new `vX.Y.Z` tag on `main` and that commit's CI passed, it deploys the tag with the same [`scripts/deploy.sh`](../scripts/deploy.sh) and root helper as a manual deploy ([system service](system-service.md)), as a dedicated low-privilege account `storagi-deploy`, and posts the outcome to Discord. Decisions and verification are in [stage70](stages/70-auto-deploy.md).

GitHub gets no way into the host: no self-hosted runner, no inbound connection, no stored token. The repository is public, so the host reads it with anonymous git over https and the unauthenticated GitHub API (60 requests an hour per address; a tick makes at most one).

## How a tick works

`storagi-autodeploy.timer` starts `storagi-autodeploy.service` (`Type=oneshot`, `User=storagi-deploy`) every 15 minutes, up to a minute late at random, and after boot if a tick was missed. The service runs [`scripts/storagi-autodeploy`](../scripts/storagi-autodeploy) from the account's own clone, `/var/lib/storagi-deploy/storagi`:

1. **Lock.** It takes a lock on `/var/lib/storagi-deploy/autodeploy.lock`; if another run (for example one started by hand) holds it, this tick does nothing.
2. **Update.** `git fetch --force --prune --prune-tags --tags origin` mirrors `main` and the tags as they are on GitHub now, including tags moved or deleted there, and `git reset --hard origin/main` resets the clone. It then runs the updated poller from the clone, so the poller and `deploy.sh` that run are always reviewed `main`. No network: exit 0, next tick.
3. **Pick.** It reads the live tag from the `TAG=` line of `/opt/storagi/current/BUILD_MANIFEST` (as data; it is never sourced). The candidate is the highest `vX.Y.Z` tag (no leading zeros, nothing after the patch number) whose commit is on `origin/main`. It is deployed only if it is newer than the live tag and than every tag in the state file (below). So the poller never downgrades, never retries a tag that failed, and never redeploys a tag the owner rolled back from.
4. **CI.** It asks `GET /repos/WilsonXY/storagi/commits/<sha>/check-runs?check_name=check` for the tag's commit. Every `check` run from GitHub Actions on it must be completed with conclusion `success`. No run yet or one still running: next tick. Any other conclusion (failure, cancelled, timed out): the tag is recorded as `ci-failed`, one Discord alert, never retried. Rate limit (HTTP 403/429), any other HTTP status, no network or an unreadable answer: nothing recorded, next tick.
5. **Deploy.** `scripts/deploy.sh <tag>` from the clone, with `TMPDIR` under the account's home. Its exit status decides:

| Exit | Meaning | Recorded | Discord |
| --- | --- | --- | --- |
| 0 | deployed and healthy | `exit-0` | green: `✅ Storagi v1.2.3 is live` |
| 75 | nothing done: transfers open, another deploy holds the lock, origin unreachable, `main` moved on, or the tag is no longer newer than the live release (the helper repeats that check under its lock, so a manual deploy during the build wins) | nothing | none; tried again next tick |
| 1 | build or check failed, or refused before cutover; production untouched | `exit-1` | red: `❌ Storagi v1.2.3 not deployed` |
| 2 | cutover failed, previous release healthy again | `exit-2` | orange: `⚠️ Storagi v1.2.3 rolled back` |
| 3 | MANUAL RECOVERY REQUIRED | `exit-3` | red: `🚨 Storagi v1.2.3: manual recovery required` |

Any other status counts as 1. A recorded tag is never retried; a newer tag still is. The service exits with `deploy.sh`'s status when a deploy fails, so `systemctl --failed` shows it until the next tick.

**State file.** `/var/lib/storagi-deploy/autodeploy.state`, one line per tag: `<tag> <commit> <outcome>`, where the outcome is `exit-N`, `ci-failed`, `rolled-back` (added by the owner, below), or `live` (with `-` for the commit) when the poller first sees a newer tag live, for example after a manual deploy. Read it with `sudo cat /var/lib/storagi-deploy/autodeploy.state`.

**Discord.** Each message is one embed with a coloured bar: a title with the tag and outcome, linking to the tag on GitHub, and a line with the short commit, plus for failures the outcome, exit code and a pointer to `journalctl -u storagi-autodeploy`. A CI failure is red `❌ Storagi v1.2.3 not deployed`. No host names, paths, settings or logs. A failed post is logged (`alert not sent (curl exit N, HTTP M)`) and changes nothing else; it is not retried.

**The webhook URL is a secret.** The owner stores it as `/etc/credstore/storagi-discord-webhook` (root, mode 600). systemd copies it for each run with `LoadCredential=` into a private directory only that run can read. Bash reads it, checks it looks like `https://discord.com/api/webhooks/<id>/<token>`, and hands it to curl as a config on a pipe (`curl -K /dev/fd/N`), so it is never in a process's arguments, the journal or the state file.

## Threat model

**`storagi-deploy` can** read the public repository, build and test it, read the live `BUILD_MANIFEST` and run `sudo /usr/local/sbin/storagi-promote <dir>` without a password. Through the helper it can choose which built code `storagi` runs, as before only inside the `storagi` sandbox; the helper accepts from this account only a release whose tag is newer than the live one (a race guard, not a security boundary: the account writes the release name itself). In normal operation the poller only picks owner tags on `main` whose CI passed.

**It cannot** gain root or run any other command through sudo (the helper runs no caller code as root and changes nothing outside `/opt/storagi`, `/var/backups/storagi` and the service lifecycle; see [what the helper never does](system-service.md#deploying)); read Storagi's data (`/var/lib/storagi`, `storagi` 700) or environment (`/etc/storagi/environment`, root 600); change units or sudoers; read the owner's home (`ProtectHome`, and file permissions); write to the filesystem outside its home and temporary directories (`ProtectSystem=strict`; `/opt/storagi` and `/var/backups/storagi` are writable in the unit's namespace only for the root helper, and their permissions keep the account out); or push to GitHub (it has no credentials).

**Who decides what ships.** Only the admin owner can create, move or delete `v*` tags (GitHub ruleset), `main` changes only through a PR with the required `check`, and the poller also requires the tag's commit to be on `main` with `check` passed. Compared with a manual deploy, the human pause between pushing a tag and the cutover is gone: a stolen owner GitHub session or a GitHub-side compromise could ship code within 15 minutes, still only as `storagi` in its sandbox.

**Build code.** `npm ci` from the reviewed lockfile runs dependency install scripts as `storagi-deploy`. Such code has the account's powers above, including reading the webhook credential during the run; the impact of a leaked webhook is posts to that Discord channel (delete the webhook in Discord and install a new one). It cannot see the owner's home or other users' files.

**Limits.** No alert is sent while a tag waits (CI pending, busy, offline); if a tag is not live within an hour, read the journal. If the service is stopped mid-deploy (shutdown), the helper still rolls back, but the run may end before it records or alerts; the next tick tries again. The account can fill the disk, or keep the service busy, as any deploy caller could ([limits](system-service.md#limits)).

## Install (owner-run)

One session, about 15 minutes, no downtime. Prerequisites: this change is merged, the [system service](system-service.md) runs, you are at the host's terminal in a clean checkout of `origin/main` (sudo asks for your password), and you have a Discord webhook URL for the channel (Server settings → Integrations → Webhooks → New Webhook → Copy Webhook URL). Run each step only if the previous one passed.

**0. Preflight.**

```sh
git fetch origin && git status --short && git rev-parse HEAD origin/main   # no changes, two equal SHAs
systemctl is-active storagi.service                                         # active
sed -n 's/^TAG=//p' /opt/storagi/current/BUILD_MANIFEST                     # the live tag, e.g. v1.0.1
id storagi-deploy                                                           # no such user
command -v git curl jq flock npm /usr/bin/node                              # six paths
```

**1. Account.**

```sh
sudo useradd --system --user-group --home-dir /var/lib/storagi-deploy --no-create-home --shell /usr/sbin/nologin storagi-deploy
sudo install -d -o storagi-deploy -g storagi-deploy -m 700 /var/lib/storagi-deploy
```

Check: `getent passwd storagi-deploy` shows a uid below 1000, home `/var/lib/storagi-deploy` and shell `/usr/sbin/nologin`; `id storagi-deploy` lists only group `storagi-deploy`; `sudo stat -c '%U:%G %a' /var/lib/storagi-deploy` is `storagi-deploy:storagi-deploy 700`. What it can reach (run from `/`):

```sh
cd /
sudo -u storagi-deploy cat /etc/storagi/environment                 # Permission denied
sudo -u storagi-deploy ls /var/lib/storagi                          # Permission denied
sudo -u storagi-deploy sed -n 's/^TAG=//p' /opt/storagi/current/BUILD_MANIFEST   # the live tag
cd -
```

**2. Clone.**

```sh
(cd / && sudo -u storagi-deploy git clone --quiet https://github.com/WilsonXY/storagi.git /var/lib/storagi-deploy/storagi)
(cd / && sudo -u storagi-deploy git -C /var/lib/storagi-deploy/storagi rev-parse HEAD); git rev-parse origin/main   # two equal SHAs
(cd / && sudo -u storagi-deploy git -C /var/lib/storagi-deploy/storagi remote -v)   # only https://github.com/WilsonXY/storagi.git
sudo ls -l /var/lib/storagi-deploy/storagi/scripts/storagi-autodeploy               # executable, owner storagi-deploy
```

The clone has no credentials, and the account has none to add.

**3. Helper and sudoers.** The helper changed in this stage (busy refusals exit 75), so reinstall it.

```sh
sudo install -o root -g root -m 755 scripts/storagi-promote /usr/local/sbin/storagi-promote
sudo visudo -c -f deploy/storagi-deploy.sudoers                      # parsed OK
sudo install -o root -g root -m 440 deploy/storagi-deploy.sudoers /etc/sudoers.d/storagi-deploy
sudo visudo -c                                                       # every file parsed OK
```

Check: `cmp scripts/storagi-promote /usr/local/sbin/storagi-promote && echo same`; `sudo stat -c '%U:%G %a' /etc/sudoers.d/storagi-deploy` is `root:root 440`; `sudo -l -U storagi-deploy` lists `(root) NOPASSWD: /usr/local/sbin/storagi-promote` and nothing else. If `visudo -c` reports an error, remove the file at once (`sudo rm /etc/sudoers.d/storagi-deploy`) before closing the terminal.

**4. Webhook credential.** Paste the URL at the silent prompt; it never reaches the shell history or a command line.

```sh
sudo install -d -o root -g root -m 700 /etc/credstore
read -rs -p 'Discord webhook URL: ' url && printf '%s\n' "$url" |
  sudo install -o root -g root -m 600 /dev/stdin /etc/credstore/storagi-discord-webhook; unset url; echo
```

Check, without printing it: `sudo stat -c '%U:%G %a' /etc/credstore/storagi-discord-webhook` is `root:root 600`; `sudo grep -cE '^https://discord(app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+$' /etc/credstore/storagi-discord-webhook` is `1`. Optional test post (the URL goes to curl as a config on stdin): `sudo sh -c 'printf "url = \"%s\"\n" "$(cat /etc/credstore/storagi-discord-webhook)" | curl -q -s -o /dev/null -w "%{http_code}\n" -H "Content-Type: application/json" -d "{\"content\":\"Storagi auto-deploy test\"}" -K -'` prints `204` and the message appears in the channel.

**5. Units.**

```sh
sudo install -o root -g root -m 644 deploy/storagi-autodeploy.service deploy/storagi-autodeploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemd-analyze verify /etc/systemd/system/storagi-autodeploy.service /etc/systemd/system/storagi-autodeploy.timer
```

Check: `systemd-analyze verify` exits 0 and prints nothing about these two units (lines about other host units are unrelated). It needs `sudo`: as the owner it cannot look inside the account's 700 home and reports the `ExecStart` script as not executable; `cmp deploy/storagi-autodeploy.service /etc/systemd/system/storagi-autodeploy.service && cmp deploy/storagi-autodeploy.timer /etc/systemd/system/storagi-autodeploy.timer && echo same`; `systemctl show storagi-autodeploy.service -p User -p LoadState` is `storagi-deploy` and `loaded`.

**6. sudo inside the sandbox.** The unit's sandbox settings, running the helper with a well-formed but missing staging dir. Reaching the helper's own refusal proves the rule needs no password and does not set no-new-privileges, and that the helper accepts `storagi-deploy` as the sudo caller.

```sh
sudo systemd-run --uid=storagi-deploy --gid=storagi-deploy --pipe --wait --quiet --collect \
  -p ProtectSystem=strict -p 'ReadWritePaths=/var/lib/storagi-deploy /opt/storagi /var/backups/storagi' \
  -p ProtectHome=yes -p PrivateTmp=yes -p ProtectProc=invisible -p ProtectKernelTunables=yes \
  -p ProtectKernelModules=yes -p ProtectKernelLogs=yes -p ProtectControlGroups=yes -p ProtectHostname=yes \
  -p RestrictNamespaces=yes -p RestrictRealtime=yes -p LockPersonality=yes -p SystemCallArchitectures=native \
  sudo -n /usr/local/sbin/storagi-promote /var/lib/storagi-deploy/.cache/storagi/staging/v0.0.0-0000000-20000101T000000Z
# storagi-promote: the staging dir must be an existing absolute path with no symlink, . or .. in it
```

Any other message (for example `a password is required` or `no new privileges`) means the deploy would fail: stop here and report it.

**7. One tick by hand.** With no tag newer than the live one, this only updates the clone and records the live tag.

```sh
sudo systemctl start storagi-autodeploy.service      # returns when the tick is done
journalctl -u storagi-autodeploy -n 20 --no-pager    # storagi-autodeploy: nothing to deploy (live v1.0.1)
sudo cat /var/lib/storagi-deploy/autodeploy.state    # v1.0.1 - live
systemctl show storagi-autodeploy.service -p Result  # success
```

**8. Timer.**

```sh
sudo systemctl enable --now storagi-autodeploy.timer
systemctl list-timers storagi-autodeploy.timer       # NEXT within 15 minutes
```

## End-to-end test with a real tag (later)

When the next change is merged, create the tag as the admin owner on GitHub (Releases → Draft a new release, new tag `v1.0.2`, target `main`). A `git push` of the tag from the host is rejected: its git account is not admin, and the ruleset lets only admins create `v*` tags. After CI on that commit passes, within about 15 minutes:

- Discord shows `Storagi v1.0.2 (<sha>) is live.`
- `journalctl -u storagi-autodeploy -n 60 --no-pager` shows `deploying v1.0.2`, the build, `storagi-promote: … live` and `v1.0.2 (…) is live`.
- `readlink /opt/storagi/current` is `releases/v1.0.2-…`; `journalctl -u storagi.service -n 20 --no-pager` shows `verify-release: v1.0.2 … ok`; the two `curl` lines from [migration step 7](system-service.md#migration-from-the-user-service-owner-run) give 200 and 401; sign in and open the Inbox.
- `sudo cat /var/lib/storagi-deploy/autodeploy.state` ends with `v1.0.2 <commit> exit-0`; `sudo ls /var/lib/storagi-deploy/.cache/storagi/staging` is empty.

To exercise the busy path, keep a download running when the tick fires: the journal shows `not deployed (exit 75: busy, …); trying again next tick` and the deploy follows on a later tick.

## Operating it

- **Disable:** `sudo systemctl disable --now storagi-autodeploy.timer` stops future ticks, but not one already running. Then wait until `systemctl is-active storagi-autodeploy.service` prints `inactive` or `failed` (it shows `activating` during a tick; a build takes several minutes), or end the tick with `sudo systemctl stop storagi-autodeploy.service` (a build is abandoned, a cutover rolls back). Manual `scripts/deploy.sh` keeps working as before; re-enable with `sudo systemctl enable --now storagi-autodeploy.timer`.
- **Run a tick now:** `sudo systemctl start storagi-autodeploy.service`.
- **Roll back by hand:** first disable the timer and wait for a running tick to end (above), then `scripts/deploy.sh vOLD` from your checkout as before. Otherwise a tick already building a tag newer than `vOLD` would put it live after your rollback. Before re-enabling, mark the tag you rolled back from (say `v1.2.0`) so the poller never deploys it or anything older again; it may never have seen that tag live: `printf 'v1.2.0 - rolled-back\n' | (cd / && sudo -u storagi-deploy tee -a /var/lib/storagi-deploy/autodeploy.state)`. Check with `sudo tail -n 3 /var/lib/storagi-deploy/autodeploy.state`, then re-enable the timer. The next tag after `v1.2.0` deploys as usual.
- **Retry a failed tag:** tag a new patch release with the fix, or deploy that tag by hand. To let the poller retry the same tag, remove its line, as the account: `(cd / && sudo -u storagi-deploy sed -i '/^v1\.2\.3 /d' /var/lib/storagi-deploy/autodeploy.state)`.
- **Changes to the units, sudoers file or helper** reach the host only when you reinstall them (steps 3 and 5); compare with `cmp` after merging such a change. The poller and `deploy.sh` update themselves from `main`.
- **Uninstall:** disable the timer, then `sudo rm /etc/systemd/system/storagi-autodeploy.{service,timer} /etc/sudoers.d/storagi-deploy /etc/credstore/storagi-discord-webhook && sudo systemctl daemon-reload && sudo userdel storagi-deploy && sudo rm -rf /var/lib/storagi-deploy`.

## Unit settings

[`deploy/storagi-autodeploy.service`](../deploy/storagi-autodeploy.service): `Type=oneshot` so a tick that is still running is not started twice; `TimeoutStartSec=30min` for `npm ci`, the full check and the build on this laptop; `TimeoutStopSec=5min` so a stop during a cutover leaves the helper time to roll back (up to about 150 s) before SIGKILL; `UMask=0077`.

The sandbox has one constraint: sudo and the helper run inside the unit, so every setting also binds root there. sudo must gain root through its setuid bit and the helper needs root's capabilities (`setpriv` changing uid, reading `/proc/<pid>/cwd` of `storagi`'s process, `ss` over netlink), so:

| Setting | Why |
| --- | --- |
| `ProtectSystem=strict`, `ReadWritePaths=/var/lib/storagi-deploy /opt/storagi /var/backups/storagi` | Build code can write only the account's home and temporary directories, not other world-writable places in the filesystem. The helper (root) writes releases and backups in this namespace, so those two stay writable; their root-only permissions keep the account out. |
| `ProtectHome=true` | The owner's and other users' homes are invisible to the build, whatever their permissions. The helper does not need them. |
| `PrivateTmp=true` | A private `/tmp`; builds use `TMPDIR` under the home anyway (`/tmp` is a small RAM disk on this host). |
| `ProtectProc=invisible` | The build cannot see other users' processes or their command lines. Root keeps seeing all, which the helper's health check needs. |
| `ProtectKernelTunables`, `ProtectKernelModules`, `ProtectKernelLogs`, `ProtectControlGroups`, `ProtectHostname` | Read-only kernel settings and cgroups, no module loading, no kernel log, no hostname change, for root too; neither sudo nor the helper needs any of them (the helper reaches systemd over its socket). |
| `RestrictNamespaces`, `RestrictRealtime`, `LockPersonality`, `SystemCallArchitectures=native` | System calls nothing here uses. |
| `UMask=0077` | Files the build creates are private; the helper sets release permissions itself. |
| not `NoNewPrivileges` | It would stop sudo from gaining root through its setuid bit. |
| not `CapabilityBoundingSet`, `PrivateDevices`, `ProtectClock`, `RestrictSUIDSGID` | The first three remove capabilities or devices from root in this unit too, and the account, an ordinary user, has no device or clock access to remove. `RestrictSUIDSGID` only blocks setting those bits, which the account cannot use on anything root runs, and the helper clears them itself. Kept off as briefed. |
| not `SystemCallFilter`, `RestrictAddressFamilies`, `ProcSubset=pid`, `MemoryDenyWriteExecute` | sudo-rs's PAM stack, `setpriv` and `ss` (netlink) cannot be run as root here, so a filter that blocks one of their calls would only show up as a failed deploy; `ProcSubset=pid` hides `/proc/cpuinfo` from Node's build tools; V8 needs writable executable memory. Candidates to add after the first real deploys. |

`systemd-analyze security` rates the unit as exposed (mostly for root, its capabilities and the network the build needs); the account's own reach is bounded by file permissions, which these settings back up.

[`deploy/storagi-autodeploy.timer`](../deploy/storagi-autodeploy.timer): `OnCalendar=*:0/15`, `Persistent=true` (a tick missed while the host was off runs at boot), `RandomizedDelaySec=60`.
