# 63: Deploy test shim treats zombie processes as stopped

- Status: completed locally; CI result observed on PR#7.
- Date: 2026-10-21, Asia/Kuala_Lumpur.
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844); coordinator integration (test-harness fix).
- Provider/model/effort: Anthropic Claude Opus 5.5 from runtime.
- Branch: `feat/scripted-deploy` from `88cee46`.

## Failure

PR#7 CI run 39578877204 at `88cee46`: server 31/31 and HTTP 11/11 passed; deploy 48/52, with tests 14-17 (rollback paths) failing with `rollback failed at: stop`. Locally all 52 passed.

## Cause

The fake `systemctl`, `curl` and `ss` decided whether the fake service was alive with `kill -0`, which also succeeds for a killed process that has not been reaped (a zombie). The fake service sleeps are orphans; a desktop user manager reaps them at once, but under a parent that adopts without reaping they stay zombies and look alive, so the fake service never "stops". Reproduced locally by running the suite under a Python wrapper that sets `PR_SET_CHILD_SUBREAPER` and never reaps (`"$HOME/.cache/storagi/stage63/"`, outside Git): test 11 failed (`start` saw the zombie as running and skipped starting; health could not read its cwd → exit 3). Which test trips depends on which process ends up adopted, consistent with CI tripping 14-17. Test-harness only: the deploy script uses real `systemctl is-active`.

## Fix

One `alive` check shared by the three shims: the pid file exists and `/proc/<pid>/stat` shows a `(sleep)` process whose state is not `Z`.

## Verification

`npm run test:deploy` 52/52 normally and 52/52 under the non-reaping wrapper (previously 51/1). GitHub CI on the pushed head is the confirming run.
