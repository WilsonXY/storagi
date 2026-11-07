# 228: Keep centered Text notifications inside the content area

- Status: completed integration; fresh reviews pending
- Started: 2026-11-07 Asia/Kuala_Lumpur
- Coordinator: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c
- Provider/model/effort: Codex gpt-6.1-sol high (runtime)
- Branch/start: t3/text-copy-paste-transfer,8f48bd2
- Scope: small coordinator correction for review-reproduced long Text notice overflow; no new delegated implementation stage.
- Acceptance: both spaced and unbroken realistic filename notices stay centered and fully contained at861/1000/1100/1440 and390; short notices and action/timer semantics unchanged, same live node across resize; fresh reviews229/230 dedicated UI/UX at least9.

## Approach and proof

Extend actual-browser layout fixtures on the real existing copied-notice element using the current duplicate-transfer message format from transfers.ts. Cover a spaced filename and150-character unbroken filename (synthetic), so both the toast frame and text stay contained. This is CSS layout proof; it does not pretend to exercise duplicate-upload business logic. Explicitly retain/check the same notice element across resize. Add bounded normal wrapping on desktop Text and allow the message span to shrink/wrap long tokens without changing action buttons or other screens. Existing full-feature acceptance remains in the final run.

## Results

RED/final GREEN, integration and secret outcomes follow before commit. Earlier review audits/cleanup passed. No backend, toast JS, dependencies, service, preview or production change.

## Final results

RED: the prior built app failed the new long-message viewport-bounds assertion (text-toast-center-2-browser-red.log). The correction adds desktop Text max-width and normal wrapping; the Text message span alone can shrink and wrap unbroken tokens, so action-button geometry is untouched. Text-only balanced padding and sidebar/content centering stay intact; Inbox/Settings retain previous behavior.

The first GREEN TAP run passed, but direct screenshot inspection caught an asynchronous Copy response replacing some newly edited long-message fixtures. That run is not counted as complete long-message proof. Hardened the proof to await a newly created live notice, assert the exact fixture remains, then measure/render it. Final text-toast-center-2-browser-verified.log passed1/1 in77.1seconds, clean exit0. Both spaced and150-character unbroken filename fixtures remain centered/contained at861/1000/1100/1440 and390. Four added long-notice screenshots are current and were inspected; all58 AFTER PNGs/result.json come from the final verified run. A real element-handle identity assertion now proves resize does not recreate the toast. Existing whole-feature and actual short Copy/Delete notice checks remain green.

Web156/156 across14 suites(one worker), both types/builds, full formatting/whitespace passed. Product CSS did not change after that integration run; the hardened proof was independently rerun and formatting rechecked. Staged pinned secret scan runs before commit. Backend/workflow source remains unchanged from previous green e2bfa08; remote default fullCI still required after push. No timeout/configuration/service/preview/production change.

Ignored logs: artifacts/text-toast-center-2-{browser-red,web,types,build,format-final,browser-final,browser-verified,secrets}.log. Fresh read-only reviews229/230 follow with UI-only>=9 each; coordinator keeps source frozen through both completions.
