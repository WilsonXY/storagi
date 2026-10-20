# 41: Persistent service activation and recovery acceptance

- Status: completed reviewed activation and automatic recovery; owner continuity and independent44 acceptance pending.
- Started / last updated: 2026-10-20T22:51:47+08:00.
- Coordinator thread: [implementation](t3-thread://v1/mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a).
- Owner/task/model: coordinator Codex gpt-6.1-sol/high from injected runtime; no independent review claimed here.

## Authorization and scope

Owner says “next we go” to installation/autostart/crash-recovery and WAN testing. Existing user manager/linger allow bounded Storagi-only activation without sudo. Preserve all owner files, original DATA_DIR/credentials, current public origin and Funnel/private mappings. No reboot, power setting or unrelated service changes.

Before stopping trial, prepare versioned code/dependency release outside data, verify exact runtime hashes/native binding/config load/unit syntax, take private metadata/rollback records and obtain independent review PASS. Activate only the approved Storagi user unit after graceful exact-PID shutdown confirms no second writer. Verify enabled/active state, correct loopback binding, Google authorization/anonymous denial and persistence metadata. Test automatic failure recovery only without active owner transfers; preserve all objects and sessions, do not inspect owner payloads. No actual whole-host reboot claimed.

## Rollback

Keep original trial runtime/environment and record exact processes/units/release pointers. If service fails, stop/disable only this new unit and restore original trial after port/store exclusivity verified. Never run two app processes on one DATA_DIR, move/delete owner data or reset Tailscale.

## Preparation actually completed

On 2026-10-20, coordinator checked both candidate user-unit names and the existing system-unit name: not-found/inactive, no fragments/drop-ins. `systemctl --user list-unit-files 'storagi*'` returned zero unit files and exit1; `set -e` stopped that batch before subsequent checks. Repeated the remaining read-only checks separately: current user state active, Linger=yes, exact recorded trial PID/executable/cwd/entry point match. No stop or install occurred. Earlier sudo probe required interactive auth; existing user manager avoids that dependency.

A private Python stdlib preparation operation required the runtime root and both candidate unit paths absent, checked existing config0600/data0700, and confirmed no server/web source diff from merged main39179ed. Created a fresh mode0700 release at `"$HOME/.local/lib/storagi/releases/main-39179ed-20261020-service-v1"`, copied only server dist/node_modules/package.json/package-lock.json and web/dist, and created the previously absent current symlink. Verified3012 file SHA256s against original runtime,4 internal symlink targets,89,693,141 total file bytes. Escaping symlinks rejected. Private exact manifest `"$HOME/.cache/storagi/stage41-runtime-manifest.json"` mode0600 records source262d504/application39179ed and every copied hash; no credentials/data copied. Original trial continues running from the original checkout, so the candidate pointer does not switch the live app.

`/usr/bin/node --env-file=… --input-type=module` imported only candidate config and the copied better-sqlite3 binding. loadConfig accepted the unchanged private environment, expected port8787 and200GiB budget; SELECT1 on an in-memory SQLite DB passed, Node v22.22.1. No production database opened or second server started. `systemd-analyze --user verify deploy/storagi-user.service` exited0 without diagnostics after preparation. Unit/guide39 remains frozen; its earlier missing-prerequisite observation is retained as historical fact.

Full baseline `TMPDIR="$HOME/.cache/storagi/tmp" npm run check` exited0: server31/31, web19/19 and independent HTTP11/11 passed; both typechecks and both builds passed. Private log `"$HOME/.cache/storagi/stage41-baseline-check.log"` retains actual output. Post-build rehash of all3012 candidate source files matched the prepared release, so the newly rebuilt artifacts did not change its validated identity. No service install/start/enable, trial stop, reboot, mapping or power/config/data mutation during preparation.

## Outcome

After actual43 PASS, coordinator resampled idleness three times (no established loopback app connections, no open object descriptors), reverified exact trial PID/executable/cwd/entry point, candidate3012 hashes, unit hash, original environment/config permissions and complete Serve JSON. Private rollback snapshot `"$HOME/.cache/storagi/stage41-live-before.json"` contains exact original startup/PID/log and preservation metadata; mode0600. No credential values or owner payloads are published.

Sent SIGTERM only to the reverified original trial PID. It exited gracefully; loopback8787 was clear before starting any successor. Opened the existing SQLite database read-only only during that stopped interval: PRAGMA quick_check ok, aggregate files/tus/sessions/secrets counts retained privately; no row identities/secrets read and connection closed before start. Original database and objects stayed in place. Installed the reviewed unit as mode0600 at `"$HOME/.config/systemd/user/storagi-user.service"`, preserving any existing parent directory; `systemctl --user daemon-reload` then `enable --now storagi-user.service` exited0. Private enable log and activation result retained. No system unit installed, sudo/linger changes or second live writer.

Initial applied readiness: active/running/enabled, NRestarts0, exactly one127.0.0.1:8787 listener owned by the new main PID, cwd the immutable candidate server. Applied /proc fields confirmed Umask0077/NoNewPrivs1. Local root200; anonymous session/list/download401; existing HTTPS root200/session/list401, nosniff present. Environment byte hash/inode, SQLite inode, object size/mtime digest and complete Serve/Funnel JSON matched before. Original checkout runtime retained for rollback; no original data moved/deleted. Evidence `"$HOME/.cache/storagi/stage41-{activation,ready}.json"` (separate filenames) and enable.log.

With a fresh three-sample idle check and exact new main PID/release identity, ran `systemctl --user kill --kill-whom=main --signal=SIGKILL storagi-user.service` once. This was an explicit idle crash test, not a manual restart or graceful stop. Confirmed old process exit/listener gone; during the15second restart delay, read-only SQLite quick_check ok and all four aggregate table counts identical, then closed it before restart. Systemd automatically launched a different PID and returned readiness in16.033seconds, NRestarts0→1, Result=success. Local root200, anonymous session/list/uploadHEAD401 again. Original DB/config identity, object metadata and every mapping unchanged. Evidence `"$HOME/.cache/storagi/stage41-crash-recovery.json"`, mode0600. No extra authentication/session insertion or Google bypass used.

No activation or recovery failure occurred. Source41 baseline and native checks are above; private process/status records distinguish the stopped historical trial from current systemd ownership. Independent44 acceptance follows before publication. Existing manager/linger and enabled default.target dependency prepare boot startup; no cold reboot, home-unlock behavior, host awake/lid change, real owner cookie continuity or WAN transfer is claimed by this coordinator proof.
