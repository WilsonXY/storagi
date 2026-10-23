# 63: bash 5.2 rollback fix found by PR CI

- Status: completed; GitHub CI on the pushed head is the confirming run (recorded on PR#7).
- Date: 2026-10-21, Asia/Kuala_Lumpur.
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844); coordinator integration.
- Provider/model/effort: Anthropic Claude Opus 5.5 from runtime.
- Branch: `feat/scripted-deploy` from `88cee46`.

## Failure

PR#7 CI run 39578877204 at `88cee46`: server 31/31 and HTTP 11/11 passed; deploy 48/52, tests 14-17 (every rollback path) failing with `rollback failed at: stop`. All 52 passed locally.

## First hypothesis (wrong, kept as a harmless harness fix)

The fake `systemctl`/`curl`/`ss` judged the fake service alive with `kill -0`, which also succeeds for an unreaped zombie. Under a local wrapper that adopts orphans without reaping (`PR_SET_CHILD_SUBREAPER`), a different test (11) failed for that reason, so the shims now share an `alive` check that reads `/proc/<pid>/stat` and treats state `Z` as stopped (commit `3977173`). CI run 39579733230 at `3977173` failed the same four tests: this was not CI's cause.

## Actual cause

The runner's ubuntu-24.04 has bash 5.2; this host has bash 5.3.9. Coordinator built GNU bash 5.2 (signature verified, private prefix under `"$HOME/.cache/storagi/bash52"`) and reproduced exactly the four CI failures. An xtrace of `rollback()` under bash 5.2 showed `stopped` succeeding (`inactive`, no listener) but `wait_for` still failing: its bare `return` ran during the EXIT trap, and in bash ≤5.2 a bare `return` in a trap handler takes the status from before the trap (the `exit 1` that started the rollback). bash 5.3 changed this, hiding it locally. A real deploy on a bash 5.2 host would have reported MANUAL RECOVERY REQUIRED (exit 3) after any failed cutover instead of rolling back.

## Fix

`wait_for` returns `0` explicitly (the script's only bare `return`), with a comment. The existing rollback tests are the regression on CI's bash 5.2.

## Verification

`npm run test:deploy` under bash 5.2: 52/52 (was 48/4); under bash 5.3: 52/52; shellcheck v0.11.0 clean. Full `npm run check` PASS: server 31/31, web 19/19, HTTP 11/11, deploy 52/52, both typechecks and builds. This one-line post-review change was not sent to a further independent review; the bash 5.2 reproduction and CI are its verification.
