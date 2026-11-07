# 217: Match Text deletion gestures and Undo to Inbox

- Status: completed implementation and integration; independent review pending
- Started: 2026-11-07 Asia/Kuala_Lumpur
- Coordinator: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c
- Provider/model/effort: Codex gpt-6.1-sol high (runtime)
- Branch/start: t3/text-copy-paste-transfer, 1f1b28b
- Owner scope: desktop delete gesture fails, dragged phone item shape looks wrong, post-gesture Undo differs from Inbox. Trace the complete existing Inbox path and use it as reference for Text.

## Initial investigation and hypotheses

The shared rowGestures handler explicitly skips all Text mouse pointerdown events when selection is null; a previous test intentionally asserted that mouse never swipes. This predicts the desktop mouse failure while phone and horizontal wheel gestures work. Text's square full-width card has zero horizontal inset and a first-card top-padding exception; Inbox rows use a consistent rounded padded surface. This predicts a malformed phone dragged silhouette. Text keeps a custom Deleting-in label and standalone Undo, while Inbox uses its existing morph with Deleted, Undo and a separate countdown. All are independently testable with actual native input and computed geometry/visual proof.

## Coordination and acceptance

Meaningful implementation stage 218 goes to a distinct native agent: read the full Inbox gesture/deferred-delete/row/morph paths, reproduce first, implement minimal reuse and regressions in Text/shared gesture source and unit tests. Coordinator owns actual-service browser acceptance, final integration, read-only reviewer records 219/220, preview/PR/CI. Do not create a new gesture engine or dependency. Do not weaken auth or change backend/retention/composer/typography/koi/navigation. Preserve native selection, touch scrolling and preference-off semantics with explicit safeguards; assess mouse content versus chrome paths using Inbox as reference.

Acceptance: real desktop mouse and trackpad delete/Undo, phone rounded drag surface and identical Inbox morph/countdown/timing, full/partial/cancel/vertical/rightward/pref-off behavior, controls and native selection, delayed DELETE/failure restoration/teardown, unchanged Inbox behavior. New regressions fail before fixes. Dedicated Opus 5.5 and Sol 6.1 high UI reviews must each reach 9 with no blocking correctness/security defect. Preserve read-only review invariance and cleanup.

## Baseline and handoff

Working tree was clean at start. Previous default remote CI passed at 1f1b28b; prior implementation and physical-device limits remain in stages 206–216. No services, production, private data or Tailscale mappings touched during diagnosis.

## Actual baseline reproduction

Coordinator ran the built-service acceptance against the unchanged 1f1b28b web build with a real desktop mouse drag on the blank action strip. It failed exactly at the assertion that the row starts swiping (false versus true), in 44.4 seconds. Ignored log: artifacts/text-delete-parity-browser-red.log. This establishes the reported desktop symptom independently of synthetic wheel tests. Baseline phone swipe and Undo images were inspected: square edge-to-edge row and the separate countdown/Undo presentation differ visibly from Inbox.

Implementation agent selected a clear native-input rule: desktop mouse swipes start on row padding/footer/expiry/gaps; actual note/URL content retains mouse selection. Touch swipes continue on content; trackpad works over wrapped notes. The native row title describes the desktop zone without adding repeated headings. Coordinator browser proof will compare real Inbox/Text morph computed styles on both widths and verify actual native note selection alongside mouse deletion.

## Implementation handoff

Distinct native agent completed stage 218: three requested behavior regressions first failed then passed; an additional stale-control regression was also reproduced and fixed. Final focused Text/Inbox 98 tests passed. Source remains frontend-only; shared morph shadow was moved unchanged into its existing token rule, confirmed delete and swipe use the same grace helper/constant, and native text selection retains its own mouse zone. README documents the desktop rule.

First coordinator GREEN browser attempt successfully began real mouse swiping but stopped in the new appearance-comparison helper because TypeScript transpilation injected a __name binding unavailable inside the browser. The helper was corrected to avoid an assigned nested function; this was a proof-adapter failure, not a product failure or pass. Evidence retained in artifacts/text-delete-parity-browser-green-first.log. Final whole-browser and integration outcomes follow.

The next browser run passed real desktop swipe/Undo, native mouse note selection, rounded/aligned phone dragging and desktop Inbox/Text morph style parity. It then timed out waiting for a newly uploaded Inbox fixture on the phone, whose file list polls on a separate schedule. Added an explicit actual Refresh on the phone before this comparison, without changing application code. The final run also starts desktop gesture proof from a fresh page after separately checking failed-send draft preservation, so gesture screenshots show the gesture rather than the earlier intentional error state. Both proof-adapter failures remain in ignored logs.

## Final integration verification

All required project checks passed sequentially: server 44, web 154 across 14 suites (one worker), independent HTTP 11, deployment 154, both type checks and builds, full formatting. No test timeout or runner configuration changed. Final actual-service two-context browser 1/1 passed in 73.0 seconds, command exit 0. It proves real mouse full/partial blank-row drags, native note selection, touch URL/note and trackpad behavior, rounded aligned phone reveal, and actual Inbox/Text pill font, radius, colour, shadow and height parity on desktop and phone. Existing whole-form typing, limit/contrast/scroll/focus/koi/navigation/auth/expiry/file paths remain covered.

All 47 current AFTER PNGs and result.json come from this final run. New desktop mouse drag/Undo and actual Inbox desktop/phone Undo reference images join the refreshed Text swipe/Undo images. Representative held/Undo images were inspected directly, including the actual phone Inbox reference. Baseline synthetic images remain under artifacts/text-delete-parity-before. Logs: artifacts/text-delete-parity-{server,web,http,deploy,types,build,format-final,browser-final}.log. Staged pinned Gitleaks is run before commit; fresh read-only Opus/Sol high reviews 219/220 follow, each dedicated UI/UX at least 9 and no blocking technical finding.

No backend, policy/deadline, composer, input frame, typography or navigation changes. Private preview/PR remain unchanged until reviews pass. Physical devices, software keyboards, native selection handles and assistive technology remain unverified.
