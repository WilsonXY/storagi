# 232: Integrate current main and one adjustable Inbox/Text lifetime

- Status: in progress
- Date: 2026-11-07, Asia/Kuala_Lumpur
- Coordinator: top-level adjustable-file-retention owner follow-up on PR #40; runtime Codex GPT-6.1 Sol/high
- Starting branch/head: `feat/adjustable-file-retention`, `4a9626da8cc80c96df328b27adfb19cd2b07ed86`
- Incoming main: `08dfbcf`, merge of Text PR #41
- Scope: one server-saved retention choice applies to new and existing live file and Text items, using upload completion or Text creation time. Preserve reviewed design, owner auth, partial inactivity, shared-data safety and all newly merged Text behavior.

## Coordination and plan

The coordinator fetches and merges `origin/main` into this feature branch, without changing the separate main checkout. Distinct bounded native agents then own backend implementation (stage 233) and frontend integration (stage 234). Coordinator owns API/design/README documentation, actual-service proof, remaining repository checks, merge/integration, PR and CI. Stage 235 is a fresh committed-snapshot independent review using Opus5.5/high, role review and worktree isolation; use only the explicitly authorized Astra/high fallback if unavailable. Verify actual model/effort, repository invariance and cleanup. Cancel a superseded unavailable task before cleanup/fallback so a delayed quota resume cannot recreate a removed checkout.

No extra planning/reviewer agents, modal system, policy revision/snapshot protocol or per-feature setting. One SQLite setting and existing Settings control remain the source of truth.

## Main merge

Five files conflicted: storage, HTTP routes, dashboard, shelf markup and transfer confirmation. The coordinator retained both Text routes/schema/cleanup and adjustable file policy, combined listing `textCount` with `retentionDays`, and retained the Text request adapter's unknown JSON bodies, conditional headers and authenticated304 handling. File paste confirmation retains the dynamic policy getter.

Main's owner-requested removal of both composer retention sentences (stage 206) is preserved. The old branch's `retention-copy` span and its write were removed, rather than reintroducing the sentence. Related retention tests/proof must now assert actual Settings/server state instead of that removed copy. Main's Text layout, gestures, focus/deletion feedback, toast placement, ponds and type sizes remain intact. Both TypeScript checks pass after conflict resolution. This is a compile-checked merge baseline, not a claim that the new shared adjustable behavior already works.

## Implementation acceptance

Backend: Text creation and file completion read the same committed SQLite policy; session/file metadata expose it. One immediate settings transaction samples now once, counts impending expirations across both live item types, rejects an insufficient acknowledgement with zero mutation, then atomically re-dates eligible files from uploadedAt and Text from createdAt and commits policy. Expired entries cannot be revived; no startup rewriting. Preserve partial24h, session7d, separate Text capacity and periodic cleanup. Text ETags must change when expiry dates change, not only when IDs change, so conditional refresh does not retain stale deadlines. Meaningful coverage includes restart/default/nondefault, existing/new content, combined counts and fresh acknowledgement, exact boundaries, rollback, no revival and conditional refresh.

Frontend: reuse the existing Settings layout, menu, tick/green breath, dialog and keyboard behavior. Clearly name both files and Text; show the combined destructive count without claiming typed Text has an original elsewhere. Preserve main's quiet composers, sidebar/navigation and current Text design. Settings policy refresh must work even when opened from Text, and paste copy must use current shared policy. Refresh Text deadlines through its existing conditional-refresh path; no second setting or duplicated localStorage policy. Update obsolete proof references to the deliberately removed composer hint.

## Verification and boundaries

Run focused red/green implementation checks, affected suites, actual-service browser checks for both features and repository-required tests/types/build/format/secret checks. Build only synthetic proof; use isolated loopback listeners and existing authorized private preview. No real OAuth/data, production files, unrelated services/mappings, deployment, merge of the PR or tags. Public records use portable paths; private literal logs stay ignored.

## Integration and actual-service proof

Backend stage [233](233-shared-adjustable-text-retention-backend.md) and frontend stage [234](234-shared-adjustable-text-retention-ui.md) completed their bounded implementation/test handoffs. The coordinator updated the current README, API agreement and a subsequent design decision, preserving historical records. Main was fetched again after implementation and remained at `08dfbcf`.

Extended the existing actual-service retention browser proof with two synthetic Text entries and a second phone browser. The popup initially counts three mixed items; advancing one millisecond grows the count to four and requires fresh acknowledgement. Cancel/Escape and insufficient acknowledgement preserve both tables and policy. A harmless extension invalidates Text's conditional validator, refreshes existing card metadata, and does not revive expired entries. Settings opened from Text refreshes the shared policy. A newly uploaded zero-byte file and newly sent Text both receive matching 60-day windows from their original timestamps. Existing no-op save, menu keyboard/positioning, typography, responsive layout and plain-green saved breath checks remain.

The first integrated browser attempt failed because its new assertion searched for a complete filename in visible row text: Inbox deliberately splits the stem and extension into separate cells. The coordinator corrected the proof to use the existing accessible full-filename selection checkbox. No application change was needed. The rerun passed (one test, about 27 seconds). Main's complete two-device Text browser acceptance then passed (one test, about 77 seconds), covering its existing send/copy/selection/gestures/deletion/Undo/layout and quiet composer behavior. Both run against the real service with isolated signed synthetic identities, not mocked API responses. Screenshots and logs remain in ignored `artifacts/shared-adjustable-integration/` and `artifacts/text-handoff/`; rendered Settings, combined-count popup and phone Text screenshots were inspected.

The coordinator also added the shared retention browser acceptance to CI after main's existing Text browser acceptance, reusing its pinned Playwright/Chromium installation. No new package or parallel heavy job was introduced.

`npm run check` passed in one complete run on cached CI-matching Node 22.23.4: **53 server tests, 180 web tests, 11 HTTP acceptance tests and 154 deployment-script tests**, followed by both TypeScript checks and both production builds (45 web modules). Existing jsdom media pause/load diagnostics did not fail tests. Full formatting, staged secret scanning and committed-snapshot review follow before PR update. Literal command logs remain ignored rather than publishing private paths.
