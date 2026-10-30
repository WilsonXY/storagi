# 118: Keep row checkboxes in step with the selection

- Status: completed; independent review in stage119
- Started / last updated: 2026-10-30
- Coordinator thread: `89498ba8-441e-4c13-8d08-c8669ebd58db`; trivial fix, not delegated
- Provider/model/effort: coordinator Claude Opus 5.5 (T3 reports `claude-opus-5-5`, effort high)
- Workspace/branch and starting commit: `fix/gesture-select-touch`, `6688a0d`
- Scope and acceptance criteria: the owner reported that, after selecting rows by dragging, tapping or clicking single checkboxes left some boxes showing the wrong state while the selection itself was right, on Android Chrome and desktop. Make each box match its row's selection after a direct click. Run `npm run check`, check formatting and repeat the browser reproduction.

## Decisions

The owner first said the phone drag gesture did not work. Asked to describe it, they said the drag works on Android Chrome and the problem is the stale checkbox afterwards, so both reports are this one bug.

Cause: the Inbox click handler cancelled every click in the checkbox column. When the click lands on the box itself, the browser has already flipped it. The handler then sets it from the selection, and once the click finishes the browser puts back the state it had before the click (the HTML spec's legacy-canceled-activation step). The old `queueMicrotask` re-sync did not help: after a real click, microtasks run between listeners, before that restore. jsdom's script `click()` runs them after the dispatch, which is why the existing test passed. On desktop the box fills the column, so most clicks land on it. On a phone the column is 36 px wide around an 18 px box, so taps land on it some of the time and on the label the rest, which fits "sometimes".

Fix in `web/src/dashboard.ts`: cancel the click only when it lands on the label (so the label does not forward a second click to the box) or the row is being deleted. A direct click on the box goes ahead, so the state `syncRows` sets is the one that stays. The microtask re-sync is removed.

## Verification

- RED→GREEN: the existing "direct checkbox clicks stay checked" test now clicks the box three times and checks `checked` straight after each `click()`, before any microtask, as in a real browser. On `6688a0d` it fails (`expected false to be true`); after the fix it passes.
- Browser reproduction against `test:preview` (loopback 5174, synthetic data), headless Chromium via the existing harness's playwright-core; script kept outside Git. Before: after a drag-select, clicking single boxes left rows selected but unchecked (desktop 1280×900, and a CDP touch tap at 390×844 mobile emulation). After: every row's checkbox matched its selection through drag, box clicks, label clicks and touch taps. Touch drag on the checkbox column and hold-then-drag on a row selected in emulation both before and after.
- `npm run format:check` and `npm run check`: see the handoff.

## Findings and limitations

No physical phone was used; the phone result comes from the owner's report and emulated touch. Touch gestures were not changed.

## Handoff

See the stage index row and the PR for the final check, review and CI results.
