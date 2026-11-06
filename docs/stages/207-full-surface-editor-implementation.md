# 207: Full-surface Text editor implementation

- Status: completed; coordinator browser proof and independent reviews follow
- Started / completed: 2026-11-07 Asia/Kuala_Lumpur
- Coordinator: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c
- Agent/task: full_surface_editor, distinct native implementation agent
- Provider/model/effort: inherited Codex gpt-6.1-sol high (runtime); independent reviewer settings verified separately
- Branch/start: t3/text-copy-paste-transfer,41f5bf1
- Scope/acceptance: stage206; remove both composer retention sentences and make the actual native Text textarea fill the composer, preserving Send, count, typing/selection and earlier UI behavior

## Changes and decisions

Removed Inbox and Text hint markup plus their dashboard assignments and now-unused hint styles. The editor now describes only the still-present byte counter, with no dangling hint reference. The server-derived retention hint remains for file-paste confirmation. File Choose files keeps its desktop right alignment after removing the old spacer hint.

The Text form has zero padding; its native textarea occupies the whole card with the inherited card radius. Text padding preserves Inbox's top/left/right spacing and reserves70px at the bottom for desktop controls,74px on phones/coarse pointers. Empty editor minimums are138px desktop and146px narrow; the existing controller still grows within its240px limit and shrinks after clearing.

The action row overlays the lower card. It ignores pointer events except on Send, so blank footer/counter space naturally hits the textarea. Send remains independently interactive and keeps its44px touch target. No proxy click/focus handlers, new dependencies or backend changes. Existing no-inner-frame focus, native caret/selection, Inbox typography and full-page koi remain. Since the textarea is now the entire card, its existing zero-dim koi mask also protects the whole editing surface.

## Verification

RED/GREEN: revised transfer regression first found the unwanted composer sentence, then passed with both nodes absent, all editor aria-describedby targets present, and server45day paste-confirmation information retained. Focused transfer suite15/15 passed. Coordinator's old-build browser geometry check reproduced the missing full-surface behavior before CSS changes: native textarea bounds did not equal the form.

Final `npm test --prefix web` passed148/148, `npm run typecheck --prefix web` passed, and `npm run build --prefix web` passed. Existing failed-send preservation, auto-grow/cap/shrink, keyboard, copy fallback, gestures and navigation regressions remain green. Owned source/tests were formatted with Prettier and `git diff --check` passed. Ignored logs: artifacts/full-editor-hints-{red,green}.log and artifacts/full-editor-web.log. Final build assets are index-CjoQkmgU.css and index-iMVEgPiC.js.

## Handoff and limitations

Owned files: web/src/{shelf.html,dashboard.ts,style.css}, web/tests/transfers.test.ts, this record. No commits, pushes, service/network/preview/production changes. Coordinator owns actual-service mouse/touch hit-testing, empty/near-limit/long-draft screenshots, full integration checks and fresh Opus/Sol UI/UX reviews. Physical phones/native software keyboards/selection handles and assistive technology are unverified.
