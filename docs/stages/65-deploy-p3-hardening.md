# 65: Bounded config check and checked symlink enumeration (two recorded P3s)

- Status: completed on branch; independent review stage66 PASS, no findings.
- Date: 2026-10-22, Asia/Kuala_Lumpur.
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844). This stage: [P3 hardening](t3-thread://v1/mcp:ca0d018b-e41f-422f-aceb-4c0c4d5d6cf9), owner of stages 64 and 65.
- Provider/model/effort: Anthropic Claude Opus 5.5 from runtime.
- Branch: `fix/deploy-p3-hardening` from `263865e`.
- Scope: the P3s "no timeout around `systemd-run`" (stage60) and "symlink enumeration failure unchecked" (stage56). Internal links to files outside the hashed paths stay a documented limit (`docs/user-service.md`, start-time check).

## Decisions

- **`RuntimeMaxSec=60`, not coreutils `timeout`.** Measured with a harmless transient `sh -c 'echo hi; exec sleep 30'` under the host's user manager (systemd 259): `timeout 2` (TERM) and `timeout -s INT 2` both stop the `systemd-run` client (status 124), but the unit keeps running and holds the `--pipe` stdout, so `$(...)` still returns only after 30 s. `-p RuntimeMaxSec=2` makes systemd stop the unit: `systemd-run` exits 1 after 2.1 s and `--collect` removes the failed unit (`could not be found` afterwards). The existing `|| die` path then refuses with exit 1 before anything stops; on the second call the build-phase trap also removes the new release. A hang of `systemd-run` itself, with no unit started, is not bounded; every other `systemctl --user` call would hang the same way.
- **Symlink loop:** `wait $!` after `done < <(find ...)` returns the process substitution's status (checked on bash 5.2.0 and 5.3.9), so a failing `find` dies.
- **Hashing finds:** errexit is off inside `$(...)` (no `inherit_errexit`), so in the default verify mode a failing first `find` in the `{ ...; ...; }` group was skipped and the group took the second one's status. The two now join with `&&`, and verify mode checks `hash=$(content_hash) || die`. `--print-hash` runs at top level with errexit on and already failed on either find (probe); it now also fails on the symlink find. Hash output is unchanged, so stamped releases still verify.

## Changes

- `scripts/deploy.sh`: `-p RuntimeMaxSec=60` on the config check, with a comment.
- `scripts/verify-release.sh`: `wait $! || die`, `&&` between the hashing finds, checked `hash=$(content_hash)`.
- `scripts/deploy.test.ts`: the fake `systemd-run` reads `RuntimeMaxSec`; with `$STATE/config-hangs` it exits 1 when bounded and otherwise finishes normally (standing in for a hang the test cannot wait for). New refusal case `config check hangs`; the argument-log assertion now requires `-p RuntimeMaxSec=60` on both calls. New test `a failing find in the release hash fails verify-release`: a `find` shim that lists everything and then exits 1 for `-type l -print0`, `-type f -print0` or `-printf`; both verify modes must fail.
- `docs/user-service.md`: one sentence on the 60 s bound.

## Verification

- RED before the fixes: deploy 50/57. The three find subtests printed `verify-release: v1.1.0 … ok`, `config check hangs` deployed, and the argument-log assertion failed.
- GREEN: `npm run test:deploy` 57/57 under bash 5.3.9 and under the bash 5.2.0 build (52 existing plus 5 new). shellcheck v0.11.0 clean.
- `npm run setup && npm run check` PASS: server 31/31, web 19/19, HTTP 11/11, deploy 57/57, both typechecks and builds. No timing flake this run.
- Not exercised: the real `systemd-run` with the deploy's own arguments against a hanging app config. The bound was measured with the probe above, and the fixture emulates it.

## Findings and limitations

The third stage56 P3 (internal links to files outside the hashed paths) stays a documented limit. Nothing deployed, tagged or merged; the live service, runtime and configuration were not touched.

## Handoff

Stage66 independent review (Codex gpt-6.1-sol/high per owner routing, Claude implemented). The next owner tag deploys this with the existing procedure.
