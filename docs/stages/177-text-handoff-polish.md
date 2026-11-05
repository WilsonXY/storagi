# 177: Text pickup accessibility and final polish

- Status: in progress
- Started / last updated: 2026-11-05 Asia/Kuala_Lumpur
- Coordinator thread: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c
- Agent/task: coordinator, small review fixes
- Provider/model/effort: Codex `gpt-6.1-sol` high (runtime)
- Workspace/branch and starting commit: `t3/text-copy-paste-transfer`, `13ddda0`
- Scope and acceptance criteria: resolve the shared accessibility finding and Opus low findings from stages 175–176; preserve all passing transfer/authentication behavior; final fresh reviews score every perspective at least 8 with successful invariance audit

## Decisions and changes

- Received items precede the composer in DOM and visual order at every width. Removed CSS reordering. A New text button jumps directly to the composer even with a long list. The phone still shows Copy/Open in its first viewport.
- Removed the generic pre's prohibited accessible name. Card actions describe their metadata; inline delete confirmation is a named group. Scrollable text retains keyboard access.
- The ETag now queries only ordered live IDs; text bodies load only when the conditional request misses.
- README explicitly limits Open to a single HTTP(S) URL and explains draft lifetime: network failures keep drafts in the open page; reload, sign-out and expired/revoked sessions clear them. No browser content persistence was added.
- Retained the early bounded body-reader response and Text-specific 304 handling: deliberate, tested limits, not new behavior for file callers. A rare stale inactive count is accepted until normal refresh, as documented in stage 175.

## Verification

- New regression first failed because the composer preceded pickup in the DOM. The updated test also checks New text focus, metadata descriptions and confirmation grouping.
- Browser proof adds real Tab-key progression from Text to New text, text content and Copy, before composer focus; checks New text jumps to the draft.
- Fresh test/build/browser results recorded below on completion.

## Findings and limitations

Stages 175–176 passed product scoring but the coordinator's remote-head snapshot gained an unrelated file-retention branch, so strict repository invariance was not met. They are not the final accepted audit. Final reviews use a new snapshot and fresh isolated tasks.

Physical devices, real Google OAuth and production deployment remain unverified. Existing SQLite deletion/privacy semantics stay as documented.

## Handoff

Final reviewers receive the full feature, previous findings/dispositions and refreshed screenshots. No merge/tag/deployment.

### Browser and targeted results

- Text interaction suite: **12/12 passed** after the new DOM-order regression failed on the previous layout.
- Actual built-service/two-browser acceptance: **1/1 passed**, 21.8 seconds in the test body. It now proves keyboard order and New text focus as well as the complete handoff path and first-viewport pickup.
- Both TypeScript checks and web build passed before the browser run. Phone and desktop screenshots were directly inspected after regeneration; pickup comes first in both DOM and visual layout, and the composer remains a one-click jump away.

### Final local verification

- Fresh full package tests passed: **41 server / 130 web**. Independent HTTP acceptance passed **11/11**. Both TypeScript checks, both production builds, formatting and diff whitespace checks passed.
- Deploy code is unchanged by this polish; its **154/154** tests passed in the preceding complete `npm run check`. CI reruns the complete check and the browser flow.
- All new first-round and second-round defects have regression coverage; current source/proof uses synthetic content only. Final reviews receive this committed version.
