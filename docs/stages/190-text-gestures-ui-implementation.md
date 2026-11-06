# 190: Text gesture and full-page koi implementation

- Status: completed; coordinator browser proof and independent reviews follow
- Started / completed: 2026-11-07 Asia/Kuala_Lumpur
- Coordinator thread: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c
- Agent/task: text_gestures_ui, native delegated implementation
- Provider/model/effort: inherited Codex gpt-6.1-sol high (runtime); independent review logs will verify reviewer settings separately
- Branch/start: t3/text-copy-paste-transfer, 08df8b8
- Scope/acceptance: stage [189](189-text-gestures-and-full-page-pond.md); neutral input focus, expiry left and icon actions right, Inbox-style swipe deletion, full Text page koi; no retention/backend change

## Changes and decisions

The input retains a quiet neutral inset keyboard-focus indicator without the orange outline. Text cards put expiry first, then accessible icon-only Copy and trash controls. Touch targets remain 44px on phones.

Text uses the existing Inbox `rowGestures` with nullable selection and a configurable row selector, leaving its default file behavior intact. Text touch and trackpad swipes use the same threshold, red delete strip, release animation and gesture preference. Ordinary mouse dragging remains available for native text selection. Existing selection, interactive controls, and horizontal text/textarea wheel scrolling do not trigger deletion. Partial/vertical/cancelled gestures preserve the row. A released swipe offers inline Undo and a four-second countdown using the existing `deferredDelete`; failed deletion restores the row. Trash confirmation remains keyboard accessible.

Unreleased gestures cancel on navigation/pagehide. Dashboard pagehide flushes released Text deletions inside its existing keepalive section, matching Inbox. Teardown cancels pending timers instead of acting after sign-out. Pending operations cannot schedule duplicate deletes.

The Text pond now uses a sticky viewport-sized canvas within a full-height section; it fills open water throughout scrolling without allocating a canvas as tall as an entire long list. The previous 640px cap and unused bottom gutter are removed. Existing input/content masks and visibility/motion/offline behavior remain. Visible static Text ponds repaint on scroll so masks follow the moving content; hidden or swimming ponds do not receive redundant static painting.

## Verification

Failing then passing focused tests covered icon action order, full/partial/vertical/cancelled touch swipes and Undo/commit, gesture preference and native wheel scrolling, navigation/pagehide cancellation, failed DELETE recovery, teardown, released-delete flush and native mouse text selection. The initial icon test failed because Copy preceded time; the swipe test failed because no Undo existed; flush failed because it was absent; mouse-selection failed because dragging armed deletion. Each passed after implementation. Test harness corrected zero-delay post-swipe click suppression before exercising Undo.

`npm test --prefix web`: 14 files / 139 tests passed before the final mouse-selection regression; the final added regression passed independently. `npm run typecheck --prefix web` and `npm run build --prefix web` passed. Final focused Text/pond tests passed 22/22, including a failing-then-passing static-scroll repaint regression (visible/static only). Final web type check passed. Formatting of owned source/tests and `git diff --check` passed. Existing jsdom media pause/load warnings appeared during dashboard preview teardown; suites still passed. Coordinator will run complete final checks and actual-service browser proof after integration, including final source rebuild.

## Handoff and limits

Owned source: `web/src/{gestures,text-shelf,dashboard}.ts`, `web/src/style.css`; focused tests: `web/tests/{text-shelf,dashboard-ponds}.test.ts`. No commits, pushes, network exposure or production changes were performed by this implementation agent. Text retention remains 24 hours after sending.

Physical-device gestures/native keyboards and assistive technology are unverified. Coordinator owns native browser touch proof, tall/scrolling canvas proof, screenshots, independent Opus/Sol UI-only reviews and PR handoff.
