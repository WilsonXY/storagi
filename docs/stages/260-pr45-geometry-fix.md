# 260: PR 45 geometry assertion repair

- Status: completed (bounded implementation handoff)
- Started / last updated / completed: 2026-11-08 (Asia/Kuala_Lumpur)
- Coordinator thread: PR 45 failing-check repair, stage 259
- Agent/task/thread identifiers: native implementation task `pr45_check_fix`, Codex session `01a1b76d-7eb9-7c93-9950-b4eec4546344`
- Provider/model/effort: OpenAI / `gpt-6.1-sol` / high, confirmed by this child's own `session_meta` and `turn_context` evidence in `"$HOME/.codex/sessions/2026/11/08/rollout-2026-11-08T03-12-48-01a1b76d-7eb9-7c93-9950-b4eec4546344.jsonl"`. Fork metadata identifies this task; `turn_context` confirms model and effort.
- Workspace/branch and starting commit: `feat/shared-shelf-refresh`, `47650cce65f463b2d3879ba7e54b541a3a03d610`
- Scope and acceptance criteria: investigate the failed Choose files alignment assertion; correct only its geometry sampling; preserve alignment, other browser assertions and timers; actual-service browser acceptance and negative alignment checks. No commits, remote writes or companion branch integration.

## Decisions

Used systematic debugging and Ponytail full. The existing CI failure is the initial RED evidence: run `42403121307` failed the assertion at `scripts/acceptance-text-browser.test.ts:1259`. No production code change is necessary.

The upload flow calls `openTransfers()`, removing `panel-closed`. The desktop `.body` grid animates its second column from zero to the details width over 240 ms. The composer and its right-aligned button move together. Separate awaited `boundingBox()` calls can measure the composer before the transition advances and the button afterward, creating a false apparent gap.

## Changes

`scripts/acceptance-text-browser.test.ts` now samples both rectangles inside one synchronous browser evaluation. It requires both widths to be positive and the actual right-edge gap to be between 0 and the original 20 px upper limit. This preserves detection of hidden/zero-size content and left/center placement, and also rejects a button overflowing the composer. No sleeps, retries, CSS changes or disabled animations are introduced into the acceptance scenario.

## Verification

- Deterministic local reproduction uses the real `web/src/shelf.html` and `web/src/style.css`, Chromium, and a paused real CSS grid transition. An ignored diagnostic samples the composer at transition time 0 ms and the button at 200 ms: old mixed-time gap **155.3125 px**, despite a same-frame actual gap of **12 px**. It asserts that the old check rejects valid alignment and the corrected check accepts it.
- Negative checks move the real composer row to `flex-start` and `center`, move the button outside its card, and hide it; the bounded same-frame predicate rejects each case.
- Diagnostic source/log: `artifacts/pr45-check/geometry-repro.mjs` and `artifacts/pr45-check/geometry-repro.log` (ignored local evidence).
- Prettier on the edited acceptance script and `git diff --check`: passed.
- Actual-service Text browser acceptance: explicitly handed to coordinator stage 259 alongside retention acceptance, after repository checks, to avoid concurrent heavy jobs. This implementation stage does not claim a full actual-service acceptance result.

## Findings and limitations

Only the flaky test sampling changes. Real OAuth, physical-device animation timing and WAN behavior are not exercised. No production server or host settings changed.

## Handoff

Coordinator inspected the focused diff and reproduction evidence. Coordinator owns repository-wide checks, actual-service Text/retention acceptance, independent review, commit/push and existing PR update. Implementation remains uncommitted.
