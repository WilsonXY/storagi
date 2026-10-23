# 70: Fix round 69 findings

- Status: completed; not independently re-reviewed
- Date: 2026-10-23 +08:00
- Owner: coordinator (Claude Code in T3 Code, thread `90da6e4a-818a-4e67-bc98-98f1606e3cd0`)
- Starting commit: `27bdfde`

## Changes

- **Selection:** on every selection change, any row being deleted is dropped from the selection, whatever caused the change. A drag replaying its starting selection can no longer put such a row back.
- **Focus:** if the focused Download or Delete button is replaced by the row's Undo, focus moves to that Undo.

## Verification

- Two tests failed on `27bdfde` and pass after: a held drag-select with a keyboard-confirmed delete in the middle, driven by real pointer events through the gesture code; and focus after a swipe replaces the focused Delete button.
- `npm run check`: 32 server, 88 web, 11 acceptance tests, both typechecks and builds pass.
