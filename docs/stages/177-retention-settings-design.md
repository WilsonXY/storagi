# 177: Retention controls and confirmation design consistency

- Status: completed (implementation handoff; coordinator integration pending)
- Started / last updated / completed: 2026-11-07, Asia/Kuala_Lumpur
- Coordinator thread: adjustable-file-retention owner design feedback
- Agent/task: `/root/retention_design`, dedicated native UI implementation agent; coordinator verifies integration and preview
- Provider/model/effort: inherited Codex GPT-6.1 Sol/high requested settings; actual model and effort remain unverified by this delegated agent. Coordinator must check session evidence before publishing reviewer-routing claims.
- Workspace/branch and starting commit: `feat/adjustable-file-retention`, `cda2d8101235e43a482eab27bda89201efba9314`
- Scope and acceptance criteria: replace the remaining OS-painted dropdown with a dedicated, accessible styled menu; make the tick action square and equal in height to the duration control; align retention dialog typography and button sizes with existing Settings. Preserve server semantics and the established design language.

## Decisions

The owner rejected the native menu appearance even after its contrast fix, the tick button's proportions and the dialog's type scale. This authorizes a dedicated styled duration menu. Reuse existing button, SVG, popup surface/radius/shadow, typography, spacing, focus and loading patterns. Do not add a library, design system, general-purpose dropdown abstraction or modal framework.

Plan: one distinct native agent implements this bounded UI correction with focused behavior tests and writes this record. Coordinator verifies full checks and synthetic browser proof, updates the private preview and commits. A fresh read-only Claude Opus 5.5 high review uses stage 178, committed worktree isolation, actual model/effort evidence and invariance/cleanup checks. Coordinator handles review findings and updates PR #40/CI. No extra delegated stages.

The custom menu must support selection, visible selected state, arrow/Home/End navigation, Enter/Space activation, Escape/focus return, Tab/outside dismissal and disabled loading. Keep acknowledgement reset and existing Cancel/Escape semantics. Keep rendering and focus scoped to this feature. Use the existing Settings text scale (15px heading, 13px body/control) and normal button size for this dialog; do not redesign other flows or change the font family.

## Changes

- `web/src/shelf.html`: replace the native select with one duration trigger and a dedicated listbox containing the same six `type="button"` options. Retain `#retention-days` and its `.value`/`.disabled` semantics. The trigger labels include the duration, options expose selected state and show the existing tick SVG.
- `web/src/dashboard.ts`: keep the trigger value as the single draft duration; add scoped open/close, selected focus, wrapping arrows, Home/End, Escape focus return and propagation stop, Tab/Shift+Tab dismissal before native traversal, outside-pointer/focus dismissal and navigation dismissal. Native buttons retain Enter/Space activation. Disable choices and close the menu during saves. Block dashboard shortcuts while open and retain the old select's shortcut isolation when the closed trigger has focus. All new listeners use the existing abortable `listen` cleanup.
- `web/src/style.css`: reuse `.btn` and `.confirm-pop` surface, shadow, radius, color, focus and spacing concepts. Both controls use the existing 34px control height; save is square with a fixed footprint for tick/spinner. Options use 44px touch targets below 640px and bounded, scrollable height on short screens. Retention confirmation alone adopts the Settings 15px heading/13px body/normal 13px buttons and comfortable spacing. Existing font family and other popups are unchanged.
- `web/tests/retention.test.ts`: exercise actual menu clicks rather than changing a select value; cover draft-only selection, selected focus, keyboard movement/Escape, shortcut isolation, outside/focus/Tab/navigation dismissal and loading, alongside existing CSRF, failure/retry, deletion-count, acknowledgement reset and confirmation checks.
- `scripts/acceptance-retention-browser.test.ts`: choose durations through the actual menu; add native Enter/Space and Tab/Shift+Tab checks, equal-height square-control and confirmation-type-scale assertions, expanded-menu captures at 1440px and 390px and the phone option-height check. Existing atomic-save/count/cancellation/multi-device proof remains.
- No commits, pushes, listeners or browser sessions were started by this delegated stage.

## Verification

Test-first checks were run serially as vertical slices. Each targeted command below first failed for the missing behavior and passed after its implementation:

| Command suffix after `npm test --prefix web -- --run tests/retention.test.ts` | Expected red observation | Green result |
| --- | --- | --- |
| `-t 'duration menu marks'` | Existing control was `SELECT`, expected `BUTTON`. | 1 passed |
| `-t 'menu navigation keeps'` | ArrowDown left the menu hidden. | 1 passed |
| `-t 'outside pointer'` | Outside pointer left the menu open. | 1 passed |
| `-t 'Tab dismisses'` | Tab left the menu open. | 1 passed (both directions checked) |
| `-t 'leaving Settings'` | Navigation left the menu open. | 1 passed |
| `-t 'closed duration trigger'` | Slash moved focus to Search from the trigger. | 1 passed |
| `-t 'failed saves'` | Loading left the menu open. | Focused suite passed after closing/disabling choices |

- `npm test --prefix web -- --run tests/retention.test.ts`: **10 passed** after the implementation and formatting.
- `npm test --prefix web`: **13 files / 121 tests passed**. The unchanged media-preview cleanup coverage printed jsdom's unimplemented `HTMLMediaElement.pause/load` diagnostics; these did not fail tests. A sibling worktree's separate Vitest run overlapped on the host; it was left untouched, and this stage ran no second heavy job concurrently.
- `npm run typecheck --prefix web`: **passed**.
- `npx prettier --check web/src/dashboard.ts web/src/shelf.html web/src/style.css web/tests/retention.test.ts scripts/acceptance-retention-browser.test.ts`: **passed**.
- `npm run build --prefix web`: **passed** (44 modules transformed).

The coordinator owns `npm run check`, actual-service browser proof, screenshots, preview and independent review. This delegated stage intentionally did not run the browser script or a listener. Browser-native activation/tab traversal, rendered geometry/type scale and cross-browser behavior therefore remain unverified at this handoff until those checks run. Screenshots must exclude private hostnames and contain only labelled synthetic data.

## Findings and limitations

The prior patch fixed contrast and added the requested tick but left native menu geometry/selection colors and mismatched control heights. Dialog title/body/action sizes were 14/12.5/12px versus the Settings 15/13/13px scale. Historical records remain intact.

## Handoff

Coordinator receives the six scoped files, no commit, and the passing web checks above. Browser targets are `#retention-days` (button trigger with string value), `#retention-options` (listbox), `#retention-options [role="option"][value="7"]` or exact accessible option names such as `7 days`/`1 day`, and `.retention-picker` for containment. New menu captures are `duration-menu-1440.png` and `duration-menu-390.png` under the script's existing artifact directory. Coordinator runs full checks and browser proof, verifies screenshots, obtains the independent stage 178 review and handles integration/commit/push/PR/preview.

## Coordinator integration and UI proof

The coordinator reran the updated actual-service browser script against the delegated production build. It passed, including actual menu selection and Enter/Space activation, Tab/Shift+Tab dismissal, the exact 34px square/equal-height controls, 44px phone options, 15/13/13px confirmation typography and the original atomic-save/count/cancellation/focus/shared-device checks. CSS animations are disabled only while taking screenshots so captures show settled typography; running-app animations remain unchanged. Expanded-menu captures at 1440/390 and confirmations at 1440/728/390 were visually inspected and use labelled synthetic data without browser chrome or private hostnames.

A separate preview check measured the prior trigger as 92×36px next to a 36×28px tick, and the new trigger as 116×34px next to a 34×34px tick. Before/after computed styles confirm the same Leon Sans family; the dialog now matches Settings heading/body sizes and normal action sizing. Cancel left the synthetic preview's policy and files unchanged. Refreshed only the isolated preview's web assets, preserving its temporary service, fixtures, policy and Tailscale mappings.

T3 browser automation again reported that AppArmor blocks its browser sandbox. No host configuration was changed; existing local Chromium tooling supplied the checks. The coordinator is running the remaining server/HTTP/deploy/type/build checks serially, reusing the delegated passing web checks rather than repeating them without a source change. Formatting and staged-secret checks are required before the committed review snapshot.

The first coordinator server run passed 42/43 tests but timed out in the existing `files deletion safely cancels a half-open PATCH` test's 6-second request. Source server files were unchanged. A retry using `TMPDIR="$HOME/.cache/storagi/tmp" server/node_modules/.bin/tsx --test --test-concurrency=1 server/test/*.test.ts` passed all 43 tests without changing any timeout or skipping tests. This establishes a clean serial result; it does not prove the precise cause of the shared-host timing failure. No unrelated process was stopped. Remaining HTTP/deploy and server type/build results are recorded at final handoff.

Final coordinator check set: **43 server tests passed** with one worker; **11 HTTP acceptance tests**, **154 deployment-script tests**, server TypeScript/build, full formatting and `git diff --check` passed. Combined with the delegated **121 web tests**, web TypeScript/build and the successful real-service browser proof, this covers the repository's complete check set without duplicating the successful web run. The aggregate `npm run check` command itself was not rerun after the delegated web result; its component checks were run serially as listed. Staged Gitleaks 8.30.1 passed before the review snapshot; it is rerun after record updates.

Additional short-viewport checks at 844×390 and 740×360 verified that the bounded menu scrolls, the last option remains reachable/visible through End/Enter, and choosing it still does not submit a save. The temporary proof initially called Playwright's input-only `inputValue()` on the new button; corrected the proof to read the button's reflected value attribute and reran. This was a harness error, not an app failure. The final screenshots show settled animations, matching typography and balanced controls.

## Review fixes and corrected short-viewport proof

Stage 178 returned FAIL for a plausible null-focus-destination click-dismissal bug while accepting the design and other behavior. The coordinator added a regression which failed because `focusout` with a null destination hid the menu, then changed the guard to dismiss only a known outside destination. Outside pointer, Tab, navigation and known-outside-focus dismissal remain covered. The regression passes. WebKit is not installed, so a physical Safari reproduction is unverified; the event property is covered in DOM and real Chromium flow.

Correction to the preliminary short-viewport result above: that temporary probe initially measured the opening animation. Repeating after the animation settled found clipping at 740×360. The coordinator added scoped room-aware above/below placement and a resize update, reusing the app's existing viewport-clamping concept; there is no general positioning layer. A permanent browser assertion now checks the entire menu and last option after the animation finishes at 844×390 and 740×360. The corrected final checks pass, including the standalone preview check, and the redundant minimum-width rule was removed.

After these source fixes, all **122 web tests**, **11 focused retention tests**, web TypeScript/build and full formatting passed. The real-service browser proof passed again, including the null-destination event, pointer choice, short viewport bounds, geometry/fonts and all existing cancellation/count/focus/shared-policy assertions. The preview was refreshed and verified; its policy/files were preserved by the Cancel checks. Server/HTTP/deploy and server type/build results above remain valid because those source files are unchanged. A fresh read-only re-check is recorded in stage 179; the original stage 178 FAIL is retained.

## Final handoff

Stage 179 returned PASS, confirmed independently as Opus 5.5/high with 48 model/effort fields in its own log; both review worktrees were verified read-only and removed. The coordinator then handled small scroll/Escape integration refinements: reuse the positioning callback on page scroll, and let Escape dismiss an open menu even after focus lands on the body. Tests were extended first and failed before the changes. An initial close-on-scroll approach caused a real-browser option-click timeout during automatic scrolling; it was rejected in favor of updating the existing placement calculation.

Final affected checks passed: **122 web tests**, web TypeScript/build, the real-service browser flow (including body-focused Escape, null-destination clicks, actual keyboard traversal, all viewports and policy/count/cancellation checks), and the separate live-preview font/geometry/Cancel preservation check. Final captures are in ignored `artifacts/retention-design/final-ui/`. Source server and deployment code stayed unchanged from their passing checks. Formatting, staged Gitleaks and PR CI are checked before final handback. The private synthetic preview remains available; production is untouched.
