# 206: Full-surface Text editor and quieter composers

- Status: in progress
- Started: 2026-11-07 Asia/Kuala_Lumpur
- Coordinator: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c
- Provider/model/effort: Codex gpt-6.1-sol high(runtime)
- Branch/start: t3/text-copy-paste-transfer,41f5bf1
- Scope/acceptance: owner requests removal of both composer Kept sentences, and the actual Text textarea to cover the whole form so any non-action point starts typing. Keep Send separately interactive, counter/readability, native selection/keyboard and no inner frame.

## Coordination

Distinct native implementation agent owns web source/focused tests and record207. Coordinator owns actual-browser hit tests/screenshots, integration, Opus/Sol high reviews208–209, PR and private preview. Prefer native textarea occupying the entire card with padded text and overlaid action controls, avoiding a proxy click handler on a small editor. Remove dangling aria-describedby and unused hint setup/styles; paste-confirmation retention information remains outside the two owner-marked sentences. Shared30day backend policy is unchanged. Both fresh reviewers must score dedicated UI/UX>=9 with no blocking logic/security finding. Preserve earlier owner constraints, full koi, Inbox font and gestures. Production/mappings untouched.

## Additional owner steering

Owner reports received text feels too small and supplies a note-list screenshot. Coordinator increases note/link reading size from14px to16px, preserving Inbox's Leon Sans family and400 weight; this supersedes the earlier exact14px filename-size requirement. Editor/metadata sizes remain as designed. Browser proof checks the new16px size and shared family/weight explicitly.

## Coordinator integration and proof

Implementation is recorded in207. Old-build actual-browser geometry assertion failed because the textarea occupied only its inner62px area. Full-surface implementation then passed actual-service mouse/touch hit-testing at five padding/blank positions per device, each targeting the native textarea and accepting real typed characters. Long60KiB input stayed within240px and scrolled clear of Send; byte-counter hits passed through; Choose files stayed right aligned after its hint was removed. This initial browser run passed1/1 before the owner's later size increase.

The new16px reading-size assertion then failed against14px, after which coordinator changed only the note/link reading size. Main Inbox family/weight and editor/metadata sizing remain unchanged. The final browser run below must use this rebuilt version. Server README no longer describes removed composer hints; shared30day backend policy remains untouched.

Final rebuilt-source actual-service two-context browser acceptance passed1/1 in55.5seconds, including16px note text, native full-form mouse/touch click-and-type, counter pass-through, bounded long-draft scrolling clear of Send, both composer sentence removals, right-aligned Inbox control, and all prior handoff/gesture/focus/koi/expiry checks. Thirty-one refreshed synthetic screenshots include the new Inbox-without-retention view; focused-phone, normal-phone and Inbox shots were inspected directly. Complete final npm run check passed server44/web148/HTTP11/deploy154/types/builds; full format/whitespace passed. Ignored logs: artifacts/full-surface-{check,browser-final,format}.log plus the preceding red logs. Backend retention remains unchanged30days with existing deadlines preserved.
