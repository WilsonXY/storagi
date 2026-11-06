# 175: Retention menu contrast and tick action

- Status: completed (implementation; independent review follows)
- Started / last updated: 2026-11-07, Asia/Kuala_Lumpur
- Coordinator thread: adjustable-file-retention implementation and preview feedback
- Agent/task: coordinator; independent read-only review planned in stage 176
- Provider/model/effort: Codex `gpt-6.1-sol`, high, confirmed by runtime declaration; own session log not separately parsed
- Workspace/branch and starting commit: `feat/adjustable-file-retention`, `713102822cd4cb2fdd1215abadd4da5366fcf4d2`
- Scope and acceptance criteria: fix the owner's screenshot of pale native-option text on a white menu and replace the visible Save word with the requested tick icon. Preserve the native select, established colors, keyboard behavior and all retention policy semantics. Update the existing PR and private synthetic preview.

## Decisions

This is a small coordinator UI correction followed by one independent Claude Opus 5.5 high review of the committed change in stage 176. Do not invent a separate implementation delegate for this small UI correction. Use existing `--text` and opaque `--raised` on retention options; add no library or custom popup. The later owner instruction requests a tick instead of Save: reuse the existing SVG stroke style, button styling and loading spinner, retaining an accessible name and busy state.

## Changes

`web/src/style.css` explicitly supplies native options' text and background colors. The select already inherits the dark color scheme, but its options had transparent computed backgrounds and inherited light ink. The owner's browser supplied a light native menu underneath that ink. The Save action now shows a decorative tick, or the existing spinner while busy, with `Save retention` / `Saving retention…` accessible names and `aria-busy`. Existing loading test expectations were updated; save/confirmation behavior is unchanged.

## Verification

Before changing CSS, a temporary browser check against the real HTTPS synthetic preview observed all six option backgrounds as `rgba(0, 0, 0, 0)` with foreground `rgb(241, 243, 247)` and failed its opaque-menu assertion. The updated icon/accessibility assertions also failed first on missing accessible names before implementation. After implementation the same temporary check passed: all six options resolve to `rgb(241, 243, 247)` on opaque `rgb(17, 18, 20)`, including a light browser preference. Existing icon/pending-state DOM tests passed after the implementation.

`npm run check` passed: **43 server**, **115 web**, **11 HTTP acceptance**, **154 deploy-script tests**, both TypeScript checks and production builds. `npm run format:check` and `git diff --check` passed.

One initial full check failed when the existing unfinished-upload deletion test exceeded its six-second request timeout (`server/test/interruption.test.ts`). A headed browser capture was running concurrently. No server code changed; the full command passed when repeated without overlapping browser capture. This records the timeout without claiming a proven cause or changing unrelated tests.

The existing real-service browser proof passed again against the new build at 1440, 728 and 390 pixels, covering count confirmation, cancellation, focus and successful saves. Temporary Xvfb/Chromium capture reproduced the owner's unreadable white native menu before the fix, then showed the dark readable native menu and tick after it. Native Home/End/Enter behavior still selects the first/last options without submitting a save. Captures are under ignored `artifacts/retention-menu/`, with browser chrome/private hostname excluded from public proof. The coordinator inspected the expanded after capture visually.

Refreshed only the isolated synthetic preview's web assets. Its temporary user service, SQLite fixtures and saved policy were preserved; existing Tailscale mappings and production were untouched. T3 browser automation again reported an AppArmor sandbox block, so the local Chromium/Xvfb tooling supplied proof. Staged secret checks precede commits.

## Findings and limitations

Native menu painting is platform-specific. Linux Chromium with a light browser preference reproduced the reported popup and verified the corrected rendering and keyboard behavior. The owner's physical Windows/Fedora/Android browsers are not available here. No production files or authentication configuration are changed.

## Handoff

Committed implementation snapshot goes to independent review in stage 176, then PR #40 receives this fix and updated proof. CI remains required after push. No deployment or merge.
