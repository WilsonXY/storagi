# 254: Shelf-test cleanup integration and candidate CI

- Status: in progress
- Started / last updated: 2026-11-08 Asia/Kuala_Lumpur
- Coordinator thread: branch `test/strengthen-shelf-tests`; [plan 250](250-test-cleanup-plan.md).
- Agent/session: coordinator session `01a1b73e-8d4d-7e83-a1e2-9e62c9ed4c4a`.
- Provider/model/effort: actual Codex `gpt-6.1-sol`, high, verified by coordinator from its own `turn_context` in `"$HOME/.codex/sessions/2026/11/08/rollout-2026-11-08T02-21-32-01a1b73e-8d4d-7e83-a1e2-9e62c9ed4c4a.jsonl"`. The coordinator also read both delegates' own session contexts and confirmed the same actual model/effort.
- Starting commit: `b44bb6d17beb896146b8f01a987bb69a990a9289` in the existing owner-prepared worktree.
- Scope and acceptance: integrate stages 251/252, run required checks and secrets scans, preserve all unique boundary/security/lifecycle/race coverage, commit before isolated independent review, audit review invariants and cleanup, open/link a scoped PR and handle candidate CI. No merge/tag/deploy/exposure or source scheduler changes.

## Integration and coordination

Both Sol/high delegates completed bounded stages without committing or changing product sources. The earlier Opus usage-limit failures and partial edits are preserved in stage 250. Stage 251 reports 101 web and 25 server tests passing, plus three mutation red/green checks. Stage 252 reports all three browser acceptances passing, real-click Refresh red/green checks at both cadences including frozen clocks, and moving-layout/52px/overflow counterexamples. The coordinator inspected the diffs and ignored proof results, and reran formatting of all six changed scripts/tests plus `git diff --check`: passed.

The shared-refresh companion reserves stages 255 onward. It owns cadence/recovery source and browser timing, and explicitly preserves our immediate Refresh/search and geometry assertions. Stage 252 released the heavy-run window; the companion now runs its own full checks/browser acceptance. This coordinator holds its full check until the companion releases that window. Counterexamples and private machine evidence remain ignored.

A fresh fetch shows owner-merged application fixes #43 (backend revocation) and #44 (selection scoping) on `origin/main` at `ecb9190`. Integrate this current base before candidate validation; the application fixes remain base history, outside the cleanup PR diff. No change is imported from the unmerged shared-refresh branch.

## Verification

Pending full integration checks, review, and candidate CI. Browser and mutation results are detailed in [251](251-unit-test-cleanup.md) and [252](252-browser-test-cleanup.md).

## Findings and limitations

Production, real OAuth, external exposure and physical devices remain outside this test-only change. The existing large acceptance tests remain single tests; no harness rewrite was introduced.

## Handoff

In progress. No PR yet.
