# 250: Shelf test cleanup and CI alignment correction plan

- Status: in progress
- Started: 2026-11-08 Asia/Kuala_Lumpur
- Coordinator thread: this T3 thread (branch `test/strengthen-shelf-tests`)
- Provider/model/effort: original coordinator Claude Code `claude-opus-5-5`, high; resumed coordinator Codex `gpt-6.1-sol`, high, per explicit owner override. T3 capabilities report inherited model and `reasoningEffort: high`; own session evidence is checked at integration.
- Workspace/branch and starting commit: `test/strengthen-shelf-tests` at `b44bb6d`
- Scope and acceptance criteria: implement the owner-accepted test-review recommendations and correct the failing CI Choose-files alignment assertion. Fewer irrelevant tests and stronger meaningful coverage, with no blanket purge and no product behaviour changes.

## Owner-accepted scope

1. Dashboard Text test (`web/tests/dashboard.test.ts`, "Text navigation uses authenticated JSON mutations, search and manual refresh") checks only a placeholder and clicks Refresh without asserting a new GET. It passed when the Refresh handler did nothing on Text. Keep the CSRF/JSON/credentials POST check; assert manual Refresh requests fresh Text data without advancing the poll clock; test real search filtering or narrow the claim. The browser manual-refresh click in `scripts/acceptance-text-browser.test.ts` can be satisfied by the periodic poll; make it discriminate the button.
2. `web/tests/text-shelf.test.ts` compares Undo `aria-describedby` with Copy's, so `null === null` passes. Assert a nonempty reference that resolves to this note's metadata; keep Copy/Undo context and focus coverage.
3. Trim or merge only demonstrable duplicates (candidates listed in stages 251 and 252). Keep any case with a distinct failure condition; preserve security, lifecycle, race, ETag, retention and browser-parity coverage. Literal UI values follow the design contract, not a blanket "tautology" rule.
4. Keep the file-only and Text-only destructive-confirmation tests in `server/test/settings.test.ts`. A realistic mutation (scalar `COUNT(*)` replaced by `SUM(CASE ...)`, which yields `NULL` on an empty table) bypasses confirmation while the mixed test still passes. Do not remove or multiply them.
5. Correct the CI "Choose files remains right-aligned" assertion. Root cause (coordinator analysis, confirmed by reproduction): the transfer panel opens on upload and the `.body` grid animates for 240 ms; the test reads `#composer` and `#choose` boxes in two separate round trips, which can land on different animation frames. Read both rects in one synchronous browser evaluation, keep the visibility/bounds checks and the 20 px alignment meaning; no sleeps and no loosening.

Out of scope: shared 60 s Inbox/Text scheduling (parallel thread on `feat/shared-shelf-refresh`, stage 249), the known cross-shelf deletion and delayed-body-after-logout production bugs, and any browser harness rewrite.

## Stages

| Stage | Agent                                     | Scope                                                                                     |
| ----- | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| 251   | Codex delegate, Sol high       | Unit/server tests: items 1 (unit), 2, 3 (unit/server candidates), 4 kept                  |
| 252   | Codex delegate, Sol high       | Browser acceptance: items 1 (browser), 3 (browser candidates), 5                          |
| 253   | Opus 5.5 high, or authorized Astra high fallback, read-only       | Independent review of the committed diff (owner reviewer routing)                         |

Stages 251 and 252 edit disjoint files and run in parallel in this worktree. Stage agents do not commit; the coordinator integrates, runs the full checks, commits and requests review.

## Coordination

- Assertions must work with both the current 5 s Text poll and the forthcoming shared 60 s cadence, and must not depend on advancing a poll timer.
- Conflicts with the companion branch are resolved without weakening either side's tests.
- Browser checks run against the synthetic actual service on loopback with the CI-pinned Playwright 1.64.1 / Chromium 1248, never production or real OAuth. Temporary files go under the home cache, not `/tmp`.

## Failures

The original Opus coordinator and both native implementation agents terminated at the five-hour usage limit (HTTP 429); partial edits in three test files are preserved. Both original children are terminal, with no duplicate active owners. The owner explicitly authorized Sol/high on resumption; stages 251 and 252 now have bounded Sol/high T3 delegates. The current Opus limit authorizes Astra/high as review fallback if Opus remains unavailable. Each stage records subsequent failures and retries.

## Resumption coordination

- Starting HEAD verified unchanged at `b44bb6d17beb896146b8f01a987bb69a990a9289`; three partially edited tests and this plan preserved.
- Unit task suffix `0920fe81-b9eb-4b97-9472-b4189384a539`; browser task suffix `24a30157-689e-4a4d-bd00-c9692c4cf13b`. Both use shared isolation and explicitly requested Sol/high; no new implementation checkout.
- Companion shared-refresh coordinator confirms it reserves stage 255 onward and preserves frozen-timer manual/search and synchronous button-dispatch GET assertions. Its source changes and PRs #43/#44 remain outside this diff.
