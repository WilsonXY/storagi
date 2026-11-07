# 234: Shared file and Text retention in the existing Settings flow

- Status: completed (frontend handoff; coordinator integration/review/CI follow)
- Started / last updated: 2026-11-07, Asia/Kuala_Lumpur
- Coordinator: adjustable-file-retention owner follow-up; plan in stage 232
- Agent/task: distinct native child `/root/shared_text_retention_frontend`
- Provider/model/effort: inherited Codex GPT-6.1 Sol/high requested settings; separate actual child session metadata unverified here. Coordinator owns independent reviewer evidence.
- Starting branch/head: `feat/adjustable-file-retention`, `2dee50205bd7e511a1958b6bc9b43cf1ad06621e`
- Scope: frontend integration and affected web tests. No commits, pushes, preview listeners or further delegation by this child.

## Coordination and decisions

The coordinator merged main's Text feature and assigned this bounded stage after backend stage 233 established the shared policy and expiry-aware Text validator. This child owns `web/src/{dashboard,text-shelf,transfers}.ts`, `web/src/shelf.html`, affected web tests and this record. No change to `transfers.ts` was necessary: the merged dynamic policy callback already supported the integration.

Preserve the existing Settings layout, duration menu, tick button, plain-green 900ms saved breath, confirmation dialog, focus/keyboard handling, loading/error patterns and responsive design. Main's owner-requested removal of both composer retention sentences (stage 206) is retained. Tests now check actual Settings selection and saved-policy baseline rather than the removed `retention-copy` element. No CSS, UI library, modal framework or second setting was added.

## Changes

- Settings names both files and text. Its description anchors age to upload completion or sending and says the setting is shared across devices. The destructive popup uses the combined `item/items` count and qualifies the unchanged originals statement as files on the owner's devices, avoiding a promise that typed Text exists elsewhere.
- The shared refresh button now selects the actual visible view: Settings opened from Text refreshes `/api/files` and the shared saved policy. Its accessible refresh label also follows the visible view when navigation changes. The existing keyboard activation uses the same button handler.
- Paste confirmation uses the latest listing's shared policy. Before the first listing resolves, committed session metadata supplies the initial duration, with 30 days only as the final fallback. No deletion policy is stored in localStorage.
- Text refresh updates an existing card's `datetime`, deletion tooltip, screen-reader expiry metadata and remaining label after a same-ID deadline change. Existing card, content/link nodes, focus and text selection remain intact. Unchanged deadlines avoid unnecessary metadata writes.
- Test fixtures handle the new Text listing and clear persisted tab state where a test navigates to Text, keeping tests independent.

## Verification

Three test-first vertical slices each failed on the intended behavior before the minimal source fix, then passed:

1. Settings opened from Text made no `/api/files` request when refreshed; the regression now proves the saved duration changes to the remote policy and the refresh label follows Settings.
2. Same-ID Text refresh retained its old `datetime`; the regression now proves the new deadline, tooltip, screen-reader metadata and remaining label while asserting identical card/content nodes, retained focus and selected text.
3. Paste confirmation displayed the 30-day fallback while the first listing was pending despite a committed 7-day session policy; the regression now proves 7 days initially and 14 days after the listing arrives. The existing test separately proves the latest listing wins over older session metadata.

Focused `npm test --prefix web -- --run tests/retention.test.ts tests/text-shelf.test.ts tests/transfers.test.ts` passed **75/75** across three files on Node 22.23.4. Full `npm test --prefix web -- --run` passed **180/180** across 15 files in 25.34 seconds on installed Node 22.22.1. The full suite emitted the existing jsdom media `pause`/`load` not-implemented diagnostics without test failures.

`npm run typecheck --prefix web` and `npm run build --prefix web` passed on the CI-matching cached Node 22.23.4; the build transformed 45 modules. Owned-file Prettier and `git diff --check` passed. Only the three intentional behavioral red runs failed. Literal local logs remain in ignored `artifacts/shared-retention-ui/` (`*-red.log`, `*-green.log`, `focused.log`, `full-web.log`, `typecheck.log`, `build.log`).

## Handoff and limitations

Source remains uncommitted for coordinator integration. The frontend consumes the unchanged Settings response shape and combined `deleteCount`; Text expiry refresh relies on stage 233's deadline-aware ETag. The coordinator receives the source and production web build for actual-service browser proof, broader integration checks, secret scanning, committed-snapshot independent review, PR update and CI. This child did not claim rendered browser proof, real OAuth/data validation, reviewer model evidence, deployment or PR completion.
