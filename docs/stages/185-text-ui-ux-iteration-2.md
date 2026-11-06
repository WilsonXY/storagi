# 185: Text UI/UX second refinement iteration

- Status: in progress
- Started / last updated: 2026-11-07 Asia/Kuala_Lumpur
- Coordinator thread: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c
- Agent/task: coordinator fixes to the concrete UI/UX review findings; no extra implementation delegate
- Provider/model/effort: Codex `gpt-6.1-sol` high (runtime)
- Workspace/branch and starting commit: `t3/text-copy-paste-transfer`, `3d0374c`
- Scope/acceptance: address stages 183–184 and repeat both dedicated UI/UX-only reviews until each overall score is at least 9; backend scores cannot compensate

## Changes and reasons

- Moved the existing actual koi canvas to the shelf backdrop, with a viewport-bounded height of at most 640px. This uses the already-empty area below/around content as clear water rather than adding a decorative hero or delaying pickup. Canvas size remains bounded even with many text cards.
- Phone fish now match Inbox's 80–130px range, desktop 110–190px. The editable text rectangle is fully masked; the form and received content dim fish separately. Tiny unmasked trail ripples are disabled for Text; blank-water splash/animation remains. All text/input stays clear while full koi are visible in open water. The same existing motion preference/lifecycle applies.
- Disabled Send has a solid muted surface rather than translucent white. Text pond uses the same offline grayscale/opacity as Inbox.
- The draft auto-grows up to 240px and shrinks when cleared; no native resize grip. It recalculates on activation/window resize. Long drafts remain scrollable and byte validation remains enforced.
- Link cards enter keyboard navigation at the actual anchor once; their wrapper is not another tab stop. Plain scrollable text retains keyboard access.
- Failed sends use short app wording with a separate check-before-retry line; known validation/capacity responses retain their actionable reason. Drafts remain exact. No raw browser error prefixes the network message.
- Clipboard denial keeps one inline recovery hint and the selected fallback text, with accessible description; removed the redundant toast.

## Verification

- Red: three meaningful Text regressions failed on previous code: raw error wording, redundant link keyboard stop, and missing bounded auto-grow. Updated behavior passed all 15 targeted Text/pond tests.
- Web typecheck/build passed before actual browser proof.
- Expanded built-service browser proof passed **1/1**: phone open water extends beyond the first pickup; canvas stays bounded; keyboard order/navigation and exact handoff still work. Added actual loading, settled Copy/error, delete confirmation, near/over limit, long multiline, and phone-menu destination focus screenshots. Existing failure and clipboard fallback remain covered.
- Coordinator inspected fresh empty/received phone and desktop/error images. Complete koi are now visible below content; no fish glyphs cross the editable area; disabled Send and grayscale error state are clean.
- Full project check and formatting results recorded after completion below.

## Findings and limitations

This is UI refinement only; backend/API/auth behavior is unchanged. Real physical phones, virtual keyboards and assistive technology remain unverified. Koi positions vary naturally with the real animation; screenshot capture is not a fixed illustration. No production service or network mappings changed.

## Handoff

Refresh only the existing isolated preview; commit before fresh Opus and Sol high worktree reviews. Next review records are 186 and 187. Both must independently rate UI/UX >=9; prior full-feature scores and the first Sol-only 9 do not complete the joint target.

### Additional phone focus check

Tracing deletion recovery found that deleting the final item focused the empty composer, which can reopen a phone keyboard unnecessarily. A failing regression reproduced focus on `text-draft`; the empty shelf now restores focus to the existing visible page title. Other-card deletion still focuses a remaining Copy control, and completion outside Text still leaves the other view alone.

### Final second-iteration verification

- Complete `npm run check`: server **41**, web **133**, independent HTTP **11**, deploy **154**, types/builds passed. Formatting and whitespace checks passed.
- The additional last-delete focus regression was added after that web phase; final full web rerun passed **134/134**, plus web types/build. The same final built UI passed the complete actual-service/two-context browser test **1/1** again with the expanded state proof and settled error capture. Final formatting passed.
- Fresh screenshots now include actual loading, copied feedback, clean/focused and near/over-limit input, long multiline cards, confirmation and recovery. First-phone-viewport pickup and a bounded pond with at least 100px open water beyond pickup passed.
- Refreshed only the authorized isolated Tailscale preview build. Production services, data, credentials and mappings were untouched.
- Ready for the next committed UI/UX-only review round. Neither the previous Sol 9 nor any backend score is reused as acceptance for this changed UI.
