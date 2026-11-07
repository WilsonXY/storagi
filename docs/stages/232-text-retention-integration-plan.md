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
