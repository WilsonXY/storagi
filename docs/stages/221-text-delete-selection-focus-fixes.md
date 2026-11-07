# 221: Correct desktop selection and deferred-deletion focus

- Status: completed integration; fresh review pending
- Started: 2026-11-07 Asia/Kuala_Lumpur
- Coordinator: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c
- Provider/model/effort: Codex gpt-6.1-sol high (runtime)
- Branch/start: t3/text-copy-paste-transfer, 79cdbea
- Scope: small required review fixes F1/F2 and related low-cost tooltip/row-stability polish F3/F5; no new delegated implementation stage.
- Acceptance: selected-note then mouse swipe works without caller clearing ranges; native content selection still works; confirmed deletion never steals subsequent composer/other-field focus, including delayed response; preserve fallback focus when appropriate; no false tooltip or row jump; fresh dedicated UI reviews 222/223 both at least 9.

## Reproduction and approach

Two new real-DOM unit regressions fail on baseline: selected note blocks blank mouse swipe, and delayed confirmed DELETE moves focus from continued draft typing to the header. Browser proof now keeps the real selected range before the next mouse swipe and asserts composer focus after confirmed deletion, rather than hiding either path with a test reset.

Clear stale selection only for Text mouse presses on non-content/non-control chrome before evaluating engaged(); actual pre/link and touch behavior remains native. At DELETE completion, restore focus only when it is body or inside the departing card. Remove the unconditional row title and use existing grab/text cursors; reserve icon-line height for the shorter shared morph. Full integration and proof outcomes follow.

## Verification outcome

Both new unit regressions first failed for the intended behaviors, then passed. The old built app also failed the strengthened actual-browser confirmed-delete focus assertion (false vs true), recorded in artifacts/text-delete-parity-2-browser-red.log. Final browser 1/1 passed in 69.9 seconds with clean command exit 0. Crucially, the real mouse selection remains live before a blank-area mouse drag; no test-side range clearing hides the bug. Selected-note-to-swipe now succeeds, continued draft typing retains focus after confirmed deletion, native content selection stays intact, and measured desktop/phone row heights stay identical during Undo. The new selected-note-to-swipe screenshot was inspected directly. All 48 AFTER images/result.json are current.

Final frontend integration: web 156/156 across 14 suites with one worker, both type checks/builds, full formatting/whitespace passed. Existing server 44, HTTP 11 and deployment 154 checks passed on 79cdbea, whose backend/workflow source is unchanged; they were not redundantly rerun for this small frontend correction. Remote default full CI remains required. Staged pinned Gitleaks is run before commit. No test timeout/configuration or host services changed.

Ignored evidence: artifacts/text-delete-parity-2-{unit-red,unit-green,browser-red,web,types,build,format,browser-final,secrets}.log and text-handoff/result.json. Both old reviewer worktrees and actual branches were removed only after coordinator invariance/settings checks passed. Fresh read-only reviews 222/223 follow; parent source remains frozen through both completions. Private preview/PR remain unchanged until acceptance.
