# 186: Plain green retention save breath

- Status: completed (delegated CSS handoff; coordinator proof, review and PR follow)
- Started / completed: 2026-11-07, Asia/Kuala_Lumpur
- Coordinator: adjustable-file-retention owner follow-up on PR #40
- Agent/task: distinct native child `/root/retention_plain_green`
- Provider/model/effort: inherited Codex GPT-6.1 Sol/high requested settings; actual separate child session evidence is unverified here.
- Starting branch/commit: `feat/adjustable-file-retention`, `60b4111f20247a0cb1cc9996a9daa1bb89054473`
- Scope: replace the save tick's mesh gradient with plain green and make the existing brief opacity breath visible in both OS motion modes. Preserve its geometry and all save semantics.

## Coordination and decisions

The owner reported that the breath was not applied and explicitly rejected the mesh gradient. The coordinator inspected the supplied private recording and reported a constant green hold for about 900ms followed by an abrupt return to grey. A coordinator-run native Chromium probe under reduced-motion emulation reproduced zero CSS animations and overlay opacity samples `[1, 1, 1]` at 0/450/899ms. This matches the scoped reduced-motion override in the source. This child read the source but did not independently inspect the private recording or run that probe.

Use the existing `--positive` green with the same 900ms opacity-only breath in both OS motion modes. Remove only this cue's suppression rule. The effect remains non-spatial: no translation, scaling, drift, bounce or size change. Other motion rules, OS/owner settings and the Swimming koi preference remain untouched. The existing successful-save lifecycle, timer, equality/loading state, errors, confirmation and focus behavior remain unchanged.

One bounded delegated stage owns only `web/src/style.css` and this record. The coordinator owns browser proof updates, tests/types/build, red/green and rendered proof, a new recording, stage 187 independent review, private preview, commits and PR/CI. No extra implementation stage or new test mirroring CSS is needed for this reversible visual edit.

## Changes

- `web/src/style.css`: replace three radial gradient layers with `background: var(--positive)` on the existing `::before` layer.
- Rename the overlay animation from `retention-saved-mesh` to `retention-saved-color`.
- Remove the cue-specific `prefers-reduced-motion` block that disabled the opacity fade and forced the layer to a constant opacity of 1. Keep both existing 900ms keyframes, easing and `both` fill mode.
- No JavaScript, markup, dependencies, backend, historical records or other motion concepts changed.

## Verification

- `npx prettier --check web/src/style.css`: **passed**.
- `git diff --check`: **passed**.
- Inspected the scoped source diff: it contains only the plain color, animation rename and removal of the cue-specific suppression rule. No new trust boundary or dynamic input.

No application tests, type checks, build, rendered checks or browser recording were run by this child, per the coordinator's assignment. No commits, pushes, listeners, service changes or child agents were created.

## Handoff and limitations

Coordinator should rebuild and exercise the real save flow under both `no-preference` and `reduce`, assert a plain `--positive` overlay and sampled opacity rising then falling, confirm stable control bounds and cleanup/replay, and capture the updated visual proof. The existing private probe's `[1, 1, 1]` failure is coordinator-provided red evidence; actual green and full-flow results remain with the coordinator. Get stage 187 independent review with actual reviewer model/effort evidence, repository invariance and worktree cleanup, then update PR #40 and complete CI. No deployment or merge.

## Coordinator integration and proof

The tight native-browser probe failed before the CSS change with 0 animations and opacity `[1, 1, 1]` under reduced-motion emulation. After rebuilding and refreshing the already-authorized isolated preview assets, it passed with 2 animations and opacity `[0, 0.984, approximately 0]`. No policy/files or service/Tailscale mappings were changed by that probe or asset refresh. The owner's actual OS preference cannot be determined from a recording; the visible behavior matches the previously tested suppression branch, which was reproduced independently.

Updated the existing actual-service browser proof to assert a plain `rgb(63, 192, 122)` positive-color layer and `background-image: none`. Reuse one native-animation sampler for both motion modes. Both pass with the same 900ms in/out curve, stable 34×34 bounds, transform `none`, successful-save disabled state and ordinary cleanup. Existing conflict, Cancel/Escape, keyboard/focus, increasing-count and shared-device proof still passes. The separate unaltered two-save recording now explicitly uses and labels reduced-motion emulation; it is **12.24 seconds**, about 1 MB. Both peak captures and the recording contact sheet were visually inspected. The owner's private desktop clip and analysis remain outside Git and are not public proof.

Fresh **132 web tests**, web TypeScript/build, full formatting/diff checks and the actual-service Chromium proof passed. Commands used CI's verified Node 22.23.4 for package tests/types/build. No application JavaScript or backend changed. The unchanged backend/deployment checks last passed in full CI on `60b4111`; required full CI is checked again after this push. Staged Gitleaks runs before commits. Independent committed-snapshot review in stage 187 records actual model/effort, findings, read-only invariance and cleanup. No deployment or merge.
