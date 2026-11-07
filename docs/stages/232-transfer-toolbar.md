# 232: Transfer toolbar panel

- Status: implementation and coordinator verification completed; independent review passed with minor Settings spacing correction
- Started: 2026-11-07 Asia/Kuala_Lumpur
- Coordinator thread: 3758131b-e560-4358-964b-1b2d8fc1e509
- Agent/task identifiers: implementation agent /root/transfer_toolbar; independent review follows in a fresh worktree
- Provider/model/effort: coordinator Codex gpt-6.1-sol high (runtime); implementation gpt-6.1-sol high, confirmed by coordinator from turn_context model/effort in its session log (session 01a1b673-17de-7af1-9678-6a6dfccec412)
- Workspace/branch and starting commit: t3/top-right-transfer-panel, 08dfbcf
- Scope and acceptance criteria: remove sidebar Transfers navigation; add top-right split-panel icon toggle; closed on load; file upload/download starts open Transfers; manually toggle both directions; ease-out opening/closing with reduced-motion support; preserve responsive access, transfer controls and authentication.

## Coordination plan

1. A distinct implementation agent owns the frontend behavior, focused regression tests and this stage record.
2. Coordinator runs repository checks and responsive synthetic browser proof.
3. A distinct read-only reviewer examines committed code in a separate worktree; coordinator records invariance and cleanup in a new review stage.
4. Coordinator resolves findings, pushes a feature branch and opens a PR with current proof and CI results.

## Decisions

Use the owner's reference icon as a code-native outlined rectangle with a right-hand divider. Off means closed by default; the toolbar control remains available for manual opening. A new accepted file transfer opens it automatically.

## Changes

- `web/src/shelf.html` moves Transfers from sidebar/menu to an icon-only toolbar button after Refresh, using an outlined rectangle with a right-hand divider. The panel starts closed in markup.
- `web/src/dashboard.ts` updates expanded/hidden/inert state, returns focus from a closing panel, toggles narrow Transfers back to Inbox, preserves an open panel across the desktop breakpoint, and opens on accepted uploads, streamed downloads and browser-owned single/bulk downloads. Duplicate queue notices leave a manually closed panel closed.
- `web/src/style.css` animates desktop column width and panel opacity, plus narrow tab opacity/translation, over 240 ms ease-out. Discrete display changes preserve narrow exit transitions; reduced-motion disables these new transitions.
- `web/src/transfer-view.ts` removes the deleted sidebar counter update, retaining the panel count.
- Dashboard tests and the existing Text browser navigation helper use the toolbar control.

## Verification

- Focused first RED: toolbar test failed because Transfers was in the sidebar. After toolbar/default/toggle implementation it passed.
- Focused second RED: accepted-upload and browser-fallback-download checks expected expanded=true but observed false. Adding shared queue and download opening hooks made both pass.
- Final `npm test --prefix web -- --maxWorkers=1`: 158 tests in 14 files passed. Existing jsdom warnings for unimplemented video pause/load still appear in video-preview tests.
- `npm run typecheck --prefix web`: passed.
- `npm run build --prefix web`: passed (45 modules; production bundle built).
- Prettier applied to changed source/tests; `git diff --check`: passed.
- Coordinator reports synthetic running-app proof passing 1440/1180/1000/728/390 layouts, upload/manual-toggle/native-download flows, actual ease-out opening/closing and reduced motion, with zero page errors. Local evidence: `artifacts/transfer-toolbar/result.json`; proof script: `scripts/acceptance-transfer-panel.mjs`.

## Findings and limitations

The first attempted focused test could not run because dependencies were absent (`vitest: not found`); coordinator ran the repository setup, after which RED/GREEN and final checks ran normally. Browser-owned downloads open Transfers but retain browser-owned progress; this change does not invent progress reporting.

No live service, authentication, host routing or deployment changes authorized by this UI request. Physical-device and assistive-technology behavior remains unverified.

## Handoff

Coordinator receives implementation and tests without a commit. Run full repository checks, inspect final browser proof, commit and obtain independent review in a fresh worktree; review gets its own numbered record. All server/auth/storage behavior is unchanged. No new dependencies.

## Coordinator verification

- `npm run check`: passed (44 server tests, 158 web tests, 11 HTTP acceptance tests, 154 deploy/autodeploy tests, both typechecks and production builds).
- `npm run format:check` and `git diff --check`: passed.
- `scripts/acceptance-transfer-panel.mjs`: passed at 1440, 1180, 1000, 728 and 390 pixels; verifies real running ease-out transitions in both directions, default closed state, manual toggle, upload/download auto-opening, closing during completion, resize across the panel breakpoint, reduced motion and zero page errors. Local synthetic evidence and screenshots stay under ignored `artifacts/transfer-toolbar/`.
- Synthetic browser recording demonstrates default, manual open/close and automatic upload opening with readable holds. Hosted proof will be attached to the PR.
- Proof harness corrections during development: replaced obsolete file-row selectors and read animation easing from effect timing rather than keyframe easing. The final proof passed; these were harness failures, not product failures.
- Actual-service two-browser Text acceptance passed 1/1 in 83.5 seconds against the built assets and updated navigation helper.
