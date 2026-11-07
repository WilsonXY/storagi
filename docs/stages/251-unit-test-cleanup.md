# 251: Shelf unit-test cleanup

- Status: completed
- Started / last updated / completed: 2026-11-08 Asia/Kuala_Lumpur
- Coordinator thread: the shared `test/strengthen-shelf-tests` thread; [stage 250](250-test-cleanup-plan.md).
- Agent/task/thread identifiers: bounded unit task suffix `0920fe81-b9eb-4b97-9472-b4189384a539`; implementation session `01a1b73f-aa4c-7fb0-af64-7cabc21c4c26`.
- Provider/model/effort: Codex `gpt-6.1-sol`, `high`, verified from this agent's own `turn_context` payload (`model` and `effort`) in `"$HOME/.codex/sessions/2026/11/08/rollout-2026-11-08T02-22-45-01a1b73f-aa4c-7fb0-af64-7cabc21c4c26.jsonl"`. This is actual session evidence, not requested settings alone.
- Workspace/branch and starting commit: shared worktree, `test/strengthen-shelf-tests`, `b44bb6d17beb896146b8f01a987bb69a990a9289`.
- Scope and acceptance criteria: own only `web/tests/dashboard.test.ts`, `web/tests/text-shelf.test.ts`, `server/test/texts.test.ts` and this record. Finish preserved partial Opus assertions; prove immediate manual Text GET/fresh rendering with a frozen clock, real search filtering, active Undo's nonempty meaningful metadata reference, and mutation sensitivity. Keep authenticated JSON/CSRF/credentials POST, Inbox parity, Copy context/focus, and distinct tests. Remove only demonstrated duplicates. Run relevant tests and format owned TypeScript files. No source changes, full check, commits, pushes or PR.

## Decisions and coordination

- Read repository/global agent instructions, README, design record, stage rules and stage 250. Applied Full-cycle and Ponytail full within the explicit bounded-child instructions; integration, full checks, independent review and PR remain the coordinator's responsibility.
- Original Opus children failed at the usage limit before completion. Their dashboard and Undo partial edits were preserved and completed under the owner's explicit Sol/high override. No further agents were started.
- The browser child owns `scripts/` and stage 252. This child neither edited nor built those files. The companion shared-refresh stage owns scheduling; no scheduler or other product source was changed.
- Mutation work uses a synthetic copy of `web/src`, the two owned web tests and Vite config under ignored `artifacts/stage251/web`. Browser builds see the unchanged live source. Every temporary mutation uses `try/finally` with byte-for-byte restoration; live source hashes are checked before/after. No mutation was applied to live source.
- Settings' file-only and Text-only confirmation cases remain completely untouched. The coordinator's M7 scalar-count-to-`SUM(CASE ...)` mutation yields `NULL` for the other empty table: it bypasses single-shelf confirmation while mixed-shelf coverage can still pass. These cases have distinct failure conditions; they are not duplicates. This stage ran their original tests, and does not claim to have rerun M7.

## Changes

- Dashboard: preserve lazy Text loading and Inbox rows/title, assert initial two-note rendering and case-insensitive filtering through the shared search input, retain exact authenticated POST options, then change synthetic server data. With fake timers frozen (no timer advancement), assert a new Text GET synchronously during Refresh's click, then assert the replacement note is rendered after promises settle. This works independently of the current 5-second or companion 60-second poll cadence.
- Undo: exercise a released swipe so Undo is active; reject hidden Undo, absent/empty description IDs, unresolved IDs and references outside this note's card. Require hostname plus creation/expiry metadata and the same nonempty context as Copy. Existing keyboard Undo-to-Copy focus and single-announcement coverage remains.
- Removed four standalone duplicate tests; retained the distinct session JSON assertions by merging them into the existing Text security test.

| Removed case | Retained replacement and reason |
| --- | --- |
| Text draft's old cap/shrink test | The inset-aware auto-grow test checks intermediate inset height, the same 240px cap, and shrink after clearing. The implementation uses one arithmetic expression for both cases; there is no separate no-inset branch. |
| Text's isolated `30d left` display | The changed-deadline test asserts `14d left` through the same day-formatting branch, plus metadata/date/title refresh, stable card/content, selection and focus. Browser retention coverage is owned separately by stage 252. |
| Text's standalone shared-retention session metadata | Settings tests cover persisted/nondefault session retention, default 30-day metadata after rollback, and anonymous session rejection. Preserve the distinct `authenticated === true` and exact CSRF-token checks inside the existing Text owner-auth/CSRF test. |
| Default file/Text 30-day comparison | Text persistence/expiry tests retain exact 30-day creation deadline and boundary lifecycle checks; file lifecycle retains `uploadedAt + 30 * DAY`; Settings directly compares file/Text deadlines at 14 days after restart and separately checks zero-byte/recovered completions at 14 days. Together these cover defaults, policy sharing, nondefault values and the special completion paths. |

Distinct security, lifecycle, race, ETag, metadata refresh, focus, Copy context, gestures and deletion-grace tests were kept. `server/test/settings.test.ts` is byte-for-byte unchanged from HEAD.

## Verification

- `npm test --prefix web -- tests/dashboard.test.ts tests/text-shelf.test.ts`: **101 passed**, 2 files. Existing jsdom media `pause`/`load` diagnostics appeared without test failures.
- `TMPDIR="$HOME/.cache/storagi/tmp" server/node_modules/.bin/tsx --test server/test/texts.test.ts server/test/settings.test.ts server/test/lifecycle.test.ts server/test/auth.test.ts`: **25 passed**, 0 failed, approximately 70.5 seconds. Includes both untouched single-shelf confirmation cases. Private local log: ignored `artifacts/stage251/server-tests.log`.
- `node_modules/.bin/prettier --write web/tests/dashboard.test.ts web/tests/text-shelf.test.ts server/test/texts.test.ts`, followed by the same command with `--check`: **passed**, all three owned TypeScript files formatted.
- Synthetic mutation runner: `python3 artifacts/stage251/mutations.py`, using the repository's installed Vitest, copied Vite config and `--maxWorkers 1`: **passed**. Baseline: 2 targeted tests passed. Each mutation exited 1 at the intended assertion; each immediately restored targeted test passed with exit 0. The runner exited 0, confirmed exact synthetic-byte restoration, and confirmed unchanged hashes for both live source files. Private evidence: ignored `artifacts/stage251/mutations.json`, runner script and corresponding `.log` files.

| Synthetic mutation | Observed red result | Restored green result |
| --- | --- | --- |
| Replace Text Refresh's call with a no-op | Immediate GET assertion expected 2, received 1; no poll clock was advanced | 1 targeted test passed |
| Route Text search to the existing Inbox renderer | Expected only `beta note`, received both `alpha note` and `beta note` | 1 targeted test passed |
| Remove both Copy and Undo `aria-describedby` attributes | Nonempty-ID assertion failed with an empty array; the old null-equality loophole is closed | 1 targeted test passed |

- `git diff --check -- web/tests/dashboard.test.ts web/tests/text-shelf.test.ts server/test/texts.test.ts docs/stages/251-unit-test-cleanup.md`: **passed**.
- `git diff --exit-code HEAD -- server/test/settings.test.ts web/src server/src`: **passed**, confirming untouched Settings confirmation tests and no product-source diff.

## Findings and limitations

- The original Opus usage-limit failures are inherited coordination failures recorded in stage 250; no work was discarded.
- No product fix, scheduler change, browser harness change, real OAuth, production access, deployment, or exposure was attempted.
- Full `npm run check`, independent review and commits/PR are intentionally left to the coordinator under the bounded task instructions.

## Handoff

The coordinator receives three tested/formatted test-file changes and this completed stage record, with all changes uncommitted. Stage 252 retains ownership of browser edits. Run integration/full checks, record any companion-branch conflict resolution without weakening these assertions, then commit and obtain independent review under the authorized reviewer route. No command started by this child remains running.
