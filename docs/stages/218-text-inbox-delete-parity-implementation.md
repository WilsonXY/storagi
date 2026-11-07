# 218: Reuse Inbox deletion feedback and support desktop Text swipes

- Status: completed implementation; coordinator browser/integration review pending
- Started/completed: 2026-11-07 Asia/Kuala_Lumpur
- Coordinator: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c
- Agent/task: native text_delete_parity, shared checkout
- Provider/model/effort: OpenAI gpt-6.1-sol high (inherited runtime settings; implementation agent, not an independent reviewer)
- Branch/start: t3/text-copy-paste-transfer, 1f1b28b
- Scope: desktop gesture, rounded dragged Text row, and Inbox-parity confirmation/deletion/Undo states. No backend, retention, composer, font, navigation or service change.

## Diagnosis and decisions

Read the full shared rowGestures and deferredDelete implementations plus Inbox row generation, deleteFiles, click handling and morph/row styles. Text deliberately rejected all mouse pointerdown when no file selection model existed; an old test explicitly required that rejection. Text also used a square full-width card and first-row zero top padding, then showed a bespoke expiry-slot Deleting-in message with standalone Undo. Confirmed trash deletion skipped the grace entirely. These differences explained the owner's three symptoms.

Mouse dragging now starts on Text row padding or the blank footer/expiry/action gaps, while pointerdown inside the actual pre/link or a button/input keeps native behavior. Text contents remain selectable and native touch long-press stays intact. The blank region has a grab cursor and a native title identifying it; no visible instruction or extra heading was added. Wrapped-note trackpad and note/URL touch behavior are preserved. Inbox's selection model branch is unchanged.

## Changes

- Text cards have consistent positive padding and the same radius token as Inbox rows. A separator pseudo-element is hidden while dragging, so it does not square off the moving surface. Text and Inbox share the actual swiping background/z-index/transition rule. The existing red underlay remains shared.
- Replaced custom confirm/Undo controls with the shared morph classes: confirmation question, Cancel/Delete, green Deleted, Undo and a separate countdown, then the shared Deleting spinner. The same 30px desktop/40px phone pill dimensions and token typography/colours apply. Moved the existing subtle morph shadow from the Inbox-specific rule into the shared morph token; Inbox's appearance is unchanged.
- Both a completed swipe and confirmed trash deletion now call one small Text queueDelete, using the existing deferredDelete and GRACE_SECONDS constant. Expiry stays in its normal left slot. Undo/clock nodes remain stable between ticks; existing native-selection/poll/gesture settling guards remain.
- Existing immediate-delete tests now exercise the actual four-second grace. Stale hidden actions cannot reopen confirmation while counting down; a failed DELETE clears the busy state and restores real actions. Confirm transfers focus to Undo; keyboard Undo retains the existing Copy-focus restoration.

## RED and GREEN

First ran three new exact regressions against baseline source: desktop mouse whitespace drag, shared Deleted/Undo/countdown morph, and confirmed-trash grace. All three failed for their intended assertions. After implementation all three passed. Five existing tests then failed because they assumed immediate confirmed deletion or the old Deleting-in expiry wording; updated them to check the new shared timing and UI semantics.

A separate stale-hidden-action regression failed with the counting guard absent, then passed when the same safeguard used by Inbox was applied to Text. Added coverage of the committing spinner and failed-delete restoration. Final focused Text + Inbox run: 2 files, 98 tests passed (Text 34 and Inbox 64), one worker. Prior intermediate run passed 97 tests before the stale-control regression was added. Existing JSDOM media pause/load not-implemented messages come from unchanged Inbox preview cleanup; the suite passes.

Evidence is ignored local logs: artifacts/text-delete-parity-unit-red.log, unit-green.log, text-first.log, stale-red.log, unit-final.log and format.log. Formatting and git diff --check passed. No build or full heavy suite was run by this agent; coordinator owns the native-browser proof and full integration.

## Limitations and handoff

Desktop mouse swipe intentionally uses row chrome, not the selectable note/URL itself, so copying part of a note remains possible. Real mouse/touch/wheel layout, rounded drag geometry and computed Inbox/Text morph parity are being checked by the coordinator. Physical devices and native selection handles remain unverified. No commit, push, GitHub post, service change, preview change or delegation was made by this implementation agent.
