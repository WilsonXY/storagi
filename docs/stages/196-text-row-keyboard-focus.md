# 196: Text row keyboard focus and touch target polish

- Status: in progress
- Started: 2026-11-07 Asia/Kuala_Lumpur
- Coordinator/task: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c; coordinator handles small review fixes
- Provider/model/effort: Codex gpt-6.1-sol high (runtime)
- Branch/start: t3/text-copy-paste-transfer, 01af1f1
- Acceptance: resolve required clipped keyboard focus finding in stage194 and cheap coarse-touch/Undo-context gaps. Preserve all owner requirements and native selection safeguards. Fresh independent high-effort Opus/Sol UI-only reviews recorded in stages197–198 must both reach9/10.

## Plan

Clip Text items only while a swipe runs. Keep URL focus inside its scrollable preformatted body. Browser proof uses real keyboard focus and checks outline bounds against all clipping ancestors for note, URL, trash and Undo, with screenshots. Verify 44px targets on an actual coarse-pointer tablet browser context and context metadata for Undo.

## Implementation and verification

The new browser focus check reproduced clipped first-note outlines against the committed CSS: the computed outline extended beyond the hidden Text-items ancestor. Idle Text items now allow overflow; clipping activates only while a row has the swiping class. URL focus uses an inset outline because its preformatted parent scrolls vertically. This preserves visible keyboard rings without reintroducing an input outline.

Coarse-pointer controls now use the existing phone 44px target rules at tablet widths too. Browser proof first failed the 728px touch Copy target, then the media rule was extended. Undo now references the same note metadata as Copy; its new regression failed before the attribute was added and passed afterwards.

Final web suite passed146/146 and web typecheck/build passed. Unchanged backend/deployment coverage remains the complete stage189 check, and CI will repeat all project checks. Browser acceptance adds real keyboard focus on note, URL, trash and Undo, validating computed outline bounds against every clipping ancestor. Touch-tablet targets and screenshots join all previous actual-service touch/trackpad/handoff/failure/expiry checks. Final outcome is recorded below before review dispatch.

## Deliberate limits

Keep native selection protection rather than deleting while text remains selected. Keep banners in document flow so they cannot cover content, accepting their small additional scroll height. Hard koi mask edges remain the previously accepted cosmetic trade-off. Physical native selection handles and assistive technology are unverified. No backend/auth/retention or dependency changes.

Final expanded browser acceptance passed **1/1** in62.1 seconds, with unclipped note/URL/trash/Undo keyboard focus, 44px coarse-tablet Copy/Delete targets, all earlier native touch/trackpad/Undo/handoff checks, viewport koi coverage, expiry/auth denial and zero page errors. Thirty synthetic screenshots were refreshed; the five new focus/tablet captures were inspected directly. Full formatting and whitespace checks passed. Ignored evidence: `artifacts/ui-gestures-3-{web,browser,format}.log` and `artifacts/text-handoff/`.
