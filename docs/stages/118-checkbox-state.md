# 118: Keep row checkboxes in step with the selection

- Status: completed; independent stage119 review PASS, its findings fixed
- Started / last updated: 2026-10-30 (Asia/Kuala_Lumpur)
- Coordinator thread: `89498ba8-441e-4c13-8d08-c8669ebd58db`
- Agent/task/thread identifiers: none; the coordinator made this small fix itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (T3 reports `claude-opus-5-5`, effort high)
- Workspace/branch and starting commit: `fix/gesture-select-touch`, `6688a0d`
- Scope and acceptance criteria: the owner reported that, after selecting rows by dragging, tapping or clicking single checkboxes left some boxes showing the wrong state while the selection itself was right, on Android Chrome and desktop. Make each box match its row's selection after a direct click. Run `npm run check`, check formatting and repeat the browser reproduction.

## Decisions

The owner first said the phone drag gesture did not work. Asked to describe it, they said the drag works on Android Chrome and the problem is the stale checkbox afterwards, so both reports are this one bug.

Cause: the Inbox click handler cancelled every click in the checkbox column. When the click lands on the box itself, the browser has already flipped it. The handler then sets it from the selection, and once the click finishes the browser puts back the state it had before the click (the HTML spec's legacy-canceled-activation step). The old `queueMicrotask` re-sync did not help: during a user's click, microtasks run between listeners, before that restore. A script `click()` defers them until it returns, and the old test only checked after awaiting, so it passed. On desktop the 16 px box sits in a 28 px column; on a phone, an 18 px box in a 36 × 44 px column. Clicks and taps land on the box some of the time and on the label (which worked) the rest, which fits "sometimes".

## Changes

`web/src/dashboard.ts`: cancel the click only when it lands on the label (so the label does not forward a second click to the box) or the row is being deleted. A direct click on the box goes ahead, so the state `syncRows` sets is the one that stays. The microtask re-sync is removed.

`web/tests/dashboard.test.ts`: the existing "direct checkbox clicks stay checked" test now clicks the box three times and checks `checked` straight after each `click()`, before any microtask can run.

Commits: `159bd9e` (fix, test, records), then a follow-up with stage119's fixes.

## Verification

Private logs and the reproduction script are in `"$HOME/.cache/storagi/tmp"` and `"$HOME/.cache/storagi/repro"`, outside Git.

- RED→GREEN: on `6688a0d` the updated test fails (`expected false to be true`); after the fix it passes. Both stage119 reviewers reproduced this independently.
- Browser reproduction against `test:preview` (loopback 5174, synthetic data), headless Chromium via the existing harness's playwright-core. Before: after a drag-select, clicking single boxes left rows selected but unchecked (desktop 1280×900, and a CDP touch tap at 390×844 mobile emulation). After: every row's checkbox matched its selection through drag, box clicks, label clicks and touch taps. Touch drag on the checkbox column and hold-then-drag on a row selected in emulation both before and after.
- `159bd9e`: `npm run format:check` PASS; `secrets:check` (Gitleaks 8.30.1, checksum verified) no leaks; `npm run check` exit 0: 33 server, 88 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds (`check-118.log`).
- After stage119's fixes: `npm run format:check` PASS; `npm run check` exit 0 with the same counts (`check-118b.log`).

## Findings and limitations

No physical phone was used; the phone result comes from the owner's report and emulated touch. Touch gestures were not changed.

## Handoff

The coordinator committed, ran the stage119 review, fixed its findings and publishes the PR. No merge, tag or deployment.
