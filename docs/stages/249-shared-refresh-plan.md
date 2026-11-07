# 249: Shared Inbox/Text refresh plan

- Status: in progress
- Started / last updated: 2026-11-08 (Asia/Kuala_Lumpur)
- Coordinator thread: this T3 Code thread (owner-requested new thread for shared refresh)
- Agent/task/thread identifiers: coordinator and implementer are this thread; reviewers recorded in their own stage files
- Provider/model/effort: initial Claude Opus 5.5/high attempt stopped at the provider rate limit; owner explicitly resumed this thread on Codex `gpt-6.1-sol`/high. T3 capabilities confirmed inherited model and `reasoningEffort=high` on 2026-11-08. Actual session evidence will be recorded at verification.
- Workspace/branch and starting commit: `feat/shared-shelf-refresh` from `b44bb6d17beb896146b8f01a987bb69a990a9289`
- Scope and acceptance criteria: below

## Owner instruction

"I want the inbox and the text to have the same refreshes, using the same refresh mechanism. I don't want two separate code paths to be maintained and managed separately. I want both refreshes to happen every 60 seconds, just like the inbox did. ... follow the inbox mechanism as much as possible."

## Scope

Unify refresh scheduling and recovery, not just the Text interval constant.

- Inbox's `AutoRefresh` (60 s cadence, hidden-tab suspension, return-after-away refresh, queued-refresh deduplication) and `OfflineRetry` (10 s offline recovery) in `web/src/refresh.ts` become the only scheduler and retry path for both views.
- Remove Text's own timer, focus and visibility listeners from `web/src/text-shelf.ts`. Text keeps only its feature-specific fetch: `/api/texts`, ETag/304, revision guard against stale answers, inline error and empty-state text.
- Preserve first load, view activation, manual Refresh, post-mutation immediacy, hidden-tab behaviour, focus/visibility recovery, session expiry, offline recovery, deduplication, and selectable text/focus/Undo/drafts.
- Update refresh/retry messaging, README, unit and browser tests to 60 s.

Out of scope: companion branch `test/strengthen-shelf-tests` (weak-test strengthening, duplicate trimming, ARIA and the CI geometry assertion at `scripts/acceptance-text-browser.test.ts` near line 1248), the known cross-shelf file Delete and post-logout delayed-body bugs, and retention semantics (unchanged).

## Stages

| Stage | Owner | Bounded work | Acceptance checks |
| --- | --- | --- | --- |
| 249 | this thread (coordinator) | Plan, integration, PR, CI handling | Records complete; PR open; CI result reported |
| 255 | distinct Sol/high implementation delegate | TDD implementation of the shared mechanism | `npm run check`, format, secret scan, typechecks/builds; fake-time unit tests for both views; text browser acceptance with both pages |
| 257 | independent reviewer per owner profile (read-only, isolated worktree) | Review of the committed diff | Findings answered; repository invariance audited; reviewer worktree/branch removed; model/effort confirmed from reviewer logs |

Further review rounds, if any, get new files.

## Outcomes

The initial Opus attempt preserved partial source/tests, then failed with “Claude API rate limit reached” (2026-11-08 local). Owner superseded the Opus-only/wait decision with Sol/high. Starting HEAD remains the expected commit. No obsolete implementation children belong to this thread. Companion reserves stages 250–254; this thread uses 255 onward. Companion owns manual Refresh/search assertion strength, Text Undo context, duplicate trimming and same-frame geometry; preserve its timer-freezing and synchronous button/GET seams during later integration. No integration or merge of its branch is authorized here.
