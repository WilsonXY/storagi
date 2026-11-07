# 184: Retention save success pulse

- Status: completed (delegated implementation; coordinator proof, review and PR follow)
- Started / completed: 2026-11-07, Asia/Kuala_Lumpur
- Coordinator: adjustable-file-retention owner follow-up on PR #40
- Agent/task: distinct native child `/root/retention_success_pulse`
- Provider/model/effort: inherited Codex GPT-6.1 Sol/high requested settings; separate actual session model/effort evidence unverified by this child. Reviewer routing remains the required independent Opus 5.5/high route.
- Starting branch/commit: `feat/adjustable-file-retention`, `173ba55da13b26de93c20f16be34411207ecafde`
- Scope: a quick green mesh-gradient breath in/out on the existing tick after a successful retention save. Keep the button's shape, size, icon and position; no bounce or restored success text.

## Coordination and decisions

One bounded delegated implementation stage owns `web/src/dashboard.ts`, `web/src/style.css`, the existing retention unit tests and this record. The coordinator owns the actual-service browser proof/recording, remaining repository checks, committed-snapshot independent review in stage 185, private preview, commits and PR/CI. No extra implementation stages or framework.

Use one 900ms cue, tied to a successful PUT after the existing listing refresh settles and the spinner has been replaced by the tick. It appears only while Settings is visible. A draft choice, no-op submit, ordinary GET refresh, pending save, error, conflict or cancellation does not start success feedback. Clear the old cue on a changed duration, new save, leaving Settings and dashboard disposal so the next successful save can replay it. Keep the existing disabled-equals-saved behavior.

The CSS mesh uses layered green radial gradients over the existing `--positive` status color. Fade its opacity and the button's disabled opacity in/out; do not move, scale or resize the control. Honor OS `prefers-reduced-motion` for this new cue: show the same short still mesh with no CSS animation. The existing Swimming koi preference deliberately ignores OS motion settings; its meaning and implementation remain unchanged.

## Changes

- `web/src/dashboard.ts`: a scoped `is-saved` class and one cleanup timer. A local success flag sets the cue only in the settled save path, after rendering the disabled tick. Existing loading/error/confirmation/focus behavior remains. The timer and class clear on the existing lifecycle paths; disposal uses the existing cleanup collection.
- `web/src/style.css`: mesh on the button's `::before` layer, with the existing tick/spinner painted above it. Normal motion uses `retention-saved` and `retention-saved-mesh`, both 900ms. The disabled opacity rule excludes the active cue; the animation returns to the same 0.45 opacity. Reduced motion disables both animations and shows the still green layer for the timer's duration. No DOM changes.
- `web/tests/retention.test.ts`: one focused lifecycle test verifies no cue for draft/pending work, a cue after the post-save refresh, disabled/non-busy settled state, no success copy, 900ms expiry, replay, changed-draft/navigation/disposal clearing and no cue on GET refresh. Existing failure and increasing-count confirmation tests now also assert the relevant absent/present cue states in Settings. Fake timers are restored after each test.

During integration, the coordinator spotted that default animation fill could expose a full-opacity neutral button after the CSS animation ended but before a delayed timer callback. Both animations now use fill mode `both`, retaining the endpoint until cleanup. Reduced motion still uses `animation: none`. This CSS-only refinement received a fresh build and formatting check, without repeating the unchanged logic suite.

## Verification

Commands ran serially, using the existing dependencies:

- TDD red: `npm test --prefix web -- --run tests/retention.test.ts -t 'successful saves give'` failed because the settled successful save had no `is-saved` cue.
- TDD green: the same command passed after the scoped lifecycle implementation.
- Focused suite: `npm test --prefix web -- --run tests/retention.test.ts` — **20 passed**.
- Full web suite after final lifecycle assertions: `npm test --prefix web` — **13 files / 131 tests passed**. Existing jsdom media `pause/load` diagnostics appeared; no test failed.
- `npm run typecheck --prefix web` — **passed**.
- `npm run build --prefix web` — **passed**, 44 modules; rerun after the animation-fill refinement.
- Prettier check of the three owned source/test files — **passed**.
- `git diff --check` — **passed**.

The single expected red assertion is the only failed test run in this stage. No backend, dependencies, service/listener configuration, commits, pushes or GitHub actions were changed by this child.

## Handoff and limitations

Coordinator can use `#retention-save.is-saved`, root animation `retention-saved`, pseudo-element `::before` animation `retention-saved-mesh` and the 900ms timeout for real-browser proof. In reduced motion, both animation names should compute to `none`, with pseudo-element opacity 1 during the short cue. Capture an actual in/out sequence without screenshot animation disabling and confirm stable control bounds, returned disabled state, replay and no cue on failed/conflicting saves. Preserve empty success status and existing confirmation proof.

Rendered gradient appearance, real animation timing, OS reduced motion and browser focus are not verified by this delegated stage. The coordinator must exercise the actual service and inspect appropriate proof, finish remaining repository checks, get stage 185 independent review with actual model/effort evidence and checked invariance/cleanup, update the authorized synthetic preview and PR #40, then handle CI. No deployment or merge.

## Coordinator integration and proof

Extended `scripts/acceptance-retention-browser.test.ts` and reran it against the real built dashboard/service with synthetic signed identity and empty files. **Passed** at the existing desktop/phone widths. Actual CSS sampling confirms three radial gradients, 900ms duration, mesh opacity 0 → 0.984 → approximately 0, unchanged 34×34 bounds and transform `none`. The peak capture samples native CSS animation time; a separate unaltered recording shows its real timing and replay across two successful saves. Reduced-motion emulation confirms zero cue animations, still mesh opacity 1, disabled tick and transform `none`, then ordinary cleanup. Existing conflict/confirmation, focus, cancellation, no-op guard, shared policy and right-alignment proof remains. No success text was restored.

The normal/reduced-motion phone captures and a contact sheet of the **11.76-second** recording were visually inspected. The recording is about 1 MB and contains only app content with an explicit synthetic-proof banner. Full formatting and diff checks passed. Local full server/HTTP/deployment checks from stage 182 remain valid for unchanged backend/deploy code; this follow-up freshly runs the affected web suite, TypeScript/build and browser proof. Required CI runs the whole repository check set after push. Staged secret scanning runs before commits.

Independent committed-snapshot review and its actual model/effort, invariance and cleanup evidence belong to stage 185. No deployment, merge or unrelated service change.

## Post-review coordinator follow-up

Stage 185 returned PASS and independently inspected the rendered captures/recording. A minor concurrent-policy edge was reproduced by a new test: a different policy arriving in the queued post-save listing can leave the current selection ready to save. Its unwanted success cue failed the new assertion before the fix. One added condition now starts the cue only when the rendered tick is disabled. The existing lifecycle test also covers a successful save finishing after navigation to Inbox, with no late cue on re-entry. No CSS or backend change was needed.

After these fixes, **132 web tests (13 files)**, web TypeScript/build, full formatting/diff checks and the refreshed actual-service browser proof passed. The final peak capture and recording contact sheet were visually inspected; the refreshed unaltered recording is **11.84 seconds**, about 1 MB, with two normal-timing saves. Earlier 11.76-second proof refers to the reviewed snapshot, not this final capture. Reviewer model/effort, all findings, repository invariance and worktree cleanup are recorded in stage 185. Staged Gitleaks passed before the review snapshot and runs again for final changes. Required full CI is checked after push.

## CI failure and test synchronization correction

Required CI on `2509d9a` passed all 43 server tests, then failed one of 132 web tests: the final success-cue assertion in the increasing-count confirmation case. The unchanged test passed ten local runs on Node 22.22.1 but reproduced the exact failure on CI's Node 22.23.4. The coordinator downloaded that official runtime into the home cache and verified its archive against the official SHA-256 manifest; no global runtime or service was changed.

A temporary diagnostic showed the selected/saved copy already at 7 days but `aria-busy` still `true` when the assertion ran. The test's fixed 30 microtask iterations did not guarantee completion of the successful PUT plus listing refresh on the newer runtime. This excludes an expired 900ms cue or a competing policy update as the observed cause. The diagnostic was removed. Application code, animation and fixture behavior are unchanged.

Replace that final fixed-step wait with `vi.waitFor` on the real settled state (`aria-busy="false"`), matching the existing browser proof's completion condition. Keep every acknowledgement, pulse and closed-dialog assertion. This is a bounded coordinator repair of the existing reviewed proof, with no additional delegated stage or redesign. The previously failing case passed ten executions (`--repeats=9`) on Node 22.23.4 after the fix; no tests were skipped, no retry flag or increased timeout was used. A fresh full repository run on that exact runtime follows before push.

On Node 22.23.4, the fresh aggregate run passed **43 server**, **132 web** and **11 HTTP acceptance** tests, then ended with SIGTERM (exit 143) during deployment tests. No assertion failure was reported there, but that run did not finish and is not recorded as a clean one-shot pass. The remaining commands were run separately on the same runtime: **154 deployment-script tests**, both TypeScript checks/builds and full formatting passed. Diff checks passed. All required local checks therefore completed across the split runs. Application source/assets did not change, so the existing rendered proof remains current. Staged Gitleaks runs before the correction commit; full required CI must pass on the new head. No new review delegation is needed for this bounded test-synchronization repair after the passing stage 185 review.
