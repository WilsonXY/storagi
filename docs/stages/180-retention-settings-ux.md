# 180: Retention saved-state and motion UX

- Status: completed (implementation handoff; coordinator integration pending)
- Started / last updated / completed: 2026-11-07, Asia/Kuala_Lumpur
- Coordinator thread: adjustable-file-retention owner preview feedback
- Agent/task: `/root/retention_saved_ux`, distinct native UI implementation agent; coordinator owns integration and proof
- Provider/model/effort: inherited Codex GPT-6.1 Sol/high requested settings; actual model/effort unverified by this delegated stage. Coordinator must confirm session evidence before publishing reviewer-routing claims.
- Workspace/branch and starting commit: `feat/adjustable-file-retention`, `1fc343d4d66b3cfa50046fcdd9c13ad1b33474aa`
- Scope and acceptance: remove dropdown bounce; show the committed server duration by default; enable tick only for a different draft and disable on reverting/success; align Settings refresh status to the right like Inbox. Preserve confirmation, cancellation and loading semantics.

## Plan and decisions

One bounded native implementation stage with focused test-first behavior changes and its own completion record. Coordinator inspects the supplied clip, exercises the updated actual-service browser proof, runs remaining required checks and refreshes the private preview. Independent committed-snapshot Opus 5.5/high review uses stage 181 with verified session evidence, read-only invariance and cleanup. No extra implementation stages or new UI framework.

Use the existing listing's committed `retentionDays` as the saved value and the current control value as the draft. Do not introduce a localStorage copy or extra settings endpoint. The coordinator clarified the owner's default-value expectation during this stage: reopening Settings discards an unsaved draft and shows the current saved duration. This supersedes the original navigation-preservation instruction. Re-entry first resets to the last listing value and reuses `auto.now()` to refresh that existing listing. Clicking Settings again while already editing leaves the draft alone. Preserve a deliberately different draft during refresh, including one chosen while the entry refresh is pending; when unchanged, follow the latest server policy. Keep the tick disabled before load, while saving, and when draft equals committed policy. Guard the submit path as well as the button. A conflict or failed save is still unsaved; successful saves establish the new baseline. A confirmation retry must retain its acknowledged duration/count even if a concurrent listing now matches its days.

Remove motion for this duration control/menu only; retain unrelated app animations. The Settings status should retain Inbox's right alignment at desktop and phone widths.

## Changes

- `web/src/dashboard.ts`: replace the sticky dirty flag with comparison against the existing listing baseline. Preserve a truly different draft on refresh, recognize equality when returning to saved policy, reset/fetch on Settings re-entry, and set the returned save policy as the new baseline. Disable the tick for loading/equality and guard direct form submission. Keep the displayed confirmation days/count authoritative for acknowledged retries. Cancel returns focus to the enabled tick, or the duration trigger when the tick is disabled; completed saves return focus to the trigger.
- `web/src/style.css`: remove only the retention menu's inherited popup animation and the retention trigger's active scaling/transform transition. Reuse the existing opacity treatment to make the disabled tick visible, preserving loading spinner opacity. Give Settings update status the same trailing auto margin as the phone header, keeping existing countdown/refresh behavior.
- `web/tests/retention.test.ts`: add saved-default, disabled/unmodified/direct-submit, changed/revert/success, refresh/baseline convergence, Settings re-entry, pending-entry refresh, initial loading and matching-policy confirmation retry coverage. Existing failures/409 retry, exact count, Cancel/Escape, acknowledgement reset and menu tests remain. The save fixture now commits successful response policy to its later GET listing so it reflects server truth.
- `scripts/acceptance-retention-browser.test.ts`: start the actual synthetic service at a non-default 60-day saved policy. Assert initial/changed/reverted/reopened/saved tick state, successful focus restoration, real computed menu animation and pressed-trigger transform, and Settings/Inbox/right-padding alignment at 1440/728/390px. Use a different draft for the existing native Tab-to-tick path. Preserve existing keyboard/menu, count, cancellation, viewport, touch-target, typography, atomic-save and second-device proof.
- `web/src/shelf.html` did not need changing. No backend changes, dependency additions, commits, pushes, browser sessions or listeners were made by this agent.

## Verification

All commands ran serially. Test-first vertical slices used the following suffixes after `npm test --prefix web -- --run tests/retention.test.ts`:

| Suffix | Expected red observation | Green result |
| --- | --- | --- |
| `-t 'only a draft different'` | Unmodified 60-day saved policy left tick enabled. | Passed after equality/submit guards. |
| `-t 'refresh preserves'` | Draft remained 7 after remote policy first matched 7 and then changed to 14. | Passed after removing sticky dirty state. |
| `-t 'reopening Settings'` | Re-entry showed unsaved 7 instead of saved 60. | Passed after re-entry reset and listing refresh. |
| `-t 'only a draft different'` (focus assertion added) | Completed save left focus on now-disabled tick. | Passed after enabled-control focus fallback. |

- `npm test --prefix web -- --run tests/retention.test.ts`: **17 passed** after final assertions and formatting.
- `npm test --prefix web`: **13 files / 128 tests passed**. Existing media-preview cleanup coverage printed jsdom's unimplemented `HTMLMediaElement.pause/load` diagnostics; no tests failed.
- `npm run typecheck --prefix web`: **passed**.
- `npm run build --prefix web`: **passed**, 44 modules transformed.
- `npx prettier --write web/src/dashboard.ts web/src/style.css web/tests/retention.test.ts scripts/acceptance-retention-browser.test.ts`: ran. The following check still flagged the browser proof; formatting that file once more corrected it.
- `npx prettier --check web/src/dashboard.ts web/src/shelf.html web/src/style.css web/tests/retention.test.ts scripts/acceptance-retention-browser.test.ts`: **passed** after the correction.
- `git diff --check`: **passed**.

One initial combined focused run failed solely because a new assertion expected the confirmed PUT to be the final fetch, while the successful save correctly followed it with GET `/api/files`. The assertion was corrected to inspect the PUT payload without rejecting the required refresh; the subsequent focused suite passed. No production change was made to satisfy that harness error.

The actual-service browser script was updated but not run by this delegated stage, per the coordinator's bounded assignment. Rendered motion, alignment, native focus/tabbing and screenshots therefore remain unverified here until coordinator execution. Full repository checks, private preview and independent committed-snapshot review remain with the coordinator.

## Findings and handoff

The dropdown inherits `.confirm-pop`'s overshooting `pop-in` animation. Settings hides the search flex spacer, leaving the update status beside the breadcrumb. Existing saved-policy listing already provides the initial selected duration, but the action is enabled even without a change. No server or deployment behavior needs changing.

The coordinator receives four scoped source/test files plus this record, no commit. Run the updated browser proof against the current production build, inspect captures, finish the remaining repository checks and stage 181 review, then refresh the private synthetic preview and PR. Keep all literal local evidence outside Git. Browser proof now expects the synthetic initial saved policy to be 60 days; successful 7-day save disables the tick and focuses `#retention-days`.

## Coordinator integration

Inspected the supplied four-second clip and the inherited overshooting popup curve; kept the private desktop recording/contact sheet outside Git. The actual-service browser proof passed against the final delegated build: server-saved 60 default, changed/reverted and re-entry behavior, no-op submission guard, successful save establishing a disabled baseline, focus fallback, actual computed menu animation `none`/zero active animations and pressed trigger transform `none` before screenshot animation disabling. Settings status right edge matches Inbox/header padding at 1440/728/390. The original count/confirmation, cancellation, keyboard, short-viewport and shared-device checks still pass. Desktop and saved-phone captures were visually inspected.

The private preview was refreshed without changing its service, policy, files or Tailscale mappings. A separate live-preview check passed saved-default, changed/reverted tick states, a blocked no-op form submit, no menu animation and status right alignment; policy/files were unchanged. T3 preview again reported its AppArmor sandbox block, so existing local Chromium tooling supplied proof.

Remaining repository checks ran serially. The server suite passed 42/43 but the unchanged `uploads deletion safely cancels a half-open PATCH` test exceeded its existing 6-second request deadline. The exact case passed when rerun alone (`tsx --test --test-concurrency=1 --test-name-pattern='uploads deletion safely' server/test/interruption.test.ts`), without modifying source, skipping any case from the original full run or changing thresholds. This is a full-run timing failure plus an isolated pass, not a clean one-shot full-suite result; clean CI remains required. **11 HTTP acceptance**, **154 deploy-script tests**, server TypeScript/build, full formatting and diff checks passed. Delegated **128 web tests** and web TypeScript/build remain valid; no source changed after them. Staged Gitleaks is run before the committed review snapshot.

Independent Opus 5.5/high review uses stage 181. Actual reviewer session evidence, read-only invariance and cleanup are checked separately. No merge, release or production deployment.
