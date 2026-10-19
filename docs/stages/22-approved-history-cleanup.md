# 22: Approved feature-history privacy cleanup

- Status: approved feature-history replacement completed; new-head CI pending.
- Started/updated: 2026-10-19T17:10:57.666774+00:00.
- Coordinator: /root, T3 mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a, actual injected Codex gpt-6.1-sol/high. Coordinator-owned stage; no new implementation/review agent.
- Owner authorization: “go as long as you think it is safe” after the concrete feature-only exact-lease proposal. This grants the narrow exception to earlier no-overwrite instruction; it does not authorize main, other refs, merge/deployment or removal from other people's clones.
- Canonical source and expected remote lease:9e5757d561197c68bb93408f0ffebf5bb7f7f548, feat/storagi. Main0d168b103455af4bbbee9a7da7b7fba545dadb21.
- Prepared candidate:4a928b22cf80e4c5cd8acf7da10fc5591a3c73d2.26 feature commits/210unique blobs,zero private path/header matches, fsck passed. Source/candidate current tree both4ea5722295396447d24f777a6345db30222963d4.

## Scope and safety conditions

Use the prepared candidate already proposed to the owner. Preserve current content, original main, user changes and unrelated worktrees. Create a new private original-history bundle at the exact lease and verify it. Import candidate objects into a private local ref, assert object/tree/history identities, then use a single explicit `refs/heads/feat/storagi` destination with exact --force-with-lease. Abort if remote lease/main changed. No mirror/wildcard/default push. Record actual operation outcome after execution.

This plan/index is written before the operation and remains as known coordinator-only uncommitted documentation while the approved tree is published. No reset or checkout discards files. Canonical branch can be moved with compare-and-swap only after confirming identical trees; preserve these documentation edits, then commit/push closeout normally. Original private evidence retained; public paths normalized, no literal home/account values added.

## Verification before execution

- Actual preflight: canonical HEAD/remote feature9e5757d, clean full porcelain, main0d168b1. PR#1 open/mergeable, no comments/reviews; both old-head Check jobs SUCCESS (runs39287465426/39287452787). New-head CI not yet run or claimed green.
- New unrelated worktree t3/test at main detected in git worktree list. It is outside this coordinator's ownership and remains untouched; prior review worktrees already removed.
- Actual fresh privacy reviewer21 gpt-6-astra/high PASS with own session proof, parent/remote/child invariance and cleanup. It independently verified preliminary24-commit candidate; coordinator subsequently audited the proposed26-commit closeout candidate (same maintained transform/current-tree identity/main/fsck). No new application code or configuration changes here.

## Planned commands and artifacts

Private cache `$HOME/.cache/storagi/privacy/` contains final-candidate-report.json, candidate.git, original backups and original native evidence. Repeat all guards, save exact operation snapshot/backup, import only candidate feature ref, push explicit feature destination with exact lease, verify remote feature/main and unrelated local refs. Update PR privacy disposition, retain all three hosted synthetic screenshots, push documentation closeout normally, resume native T3 CI watch. Stop watch at final handoff.

## Limitations and handoff

This cleans reachable feature history on the branch, not cached SHA/PR views, forks/clones or server garbage collection. No guarantee of retroactive erasure; GitHub limitations already disclosed in19/21. No account/host/service/Google/network/deployment changes. Pending actual push result, canonical synchronization, public scan and new CI results.

## Actual execution and results

- Owner approval recorded before mutation. Exact remote source lease9e5757d/main0d168b1 confirmed again, local source clean before known stage22/index documentation edits. Verified private bundle at exactsource saved with owner-only permissions; original logs and earlier backup retained.
- Fresh repeat audit of candidate:26 feature commits/210 unique blobs, including commit headers and filenames,zero actual private values; fsck exit0. Candidate current tree identical to approved source4ea5722295396447d24f777a6345db30222963d4. Main unchanged. No app/tests/dependencies/template changes added by execution.
- Imported only candidate feature ref into a temporary private local ref. `git push --force-with-lease=refs/heads/feat/storagi:9e5757d561197c68bb93408f0ffebf5bb7f7f548 origin refs/storagi-privacy/approved-4a928b2:refs/heads/feat/storagi` exit0: explicit feature-only9e5757d→4a928b22cf80e4c5cd8acf7da10fc5591a3c73d2. No mirror/default/other-ref push.
- Independent remote read verified feature4a928b2 and exact main0d168b103455af4bbbee9a7da7b7fba545dadb21. Canonical local branch synchronized with compare-and-swap9e5757d→4a928b2 after current-tree identity check; no reset/checkout or lost documentation edits. Remote-tracking feature checked; temporary private ref removed.
- Unrelated t3/test worktree at originalmain preserved; no command operated on it. All coordinator-owned review worktrees already cleaned. Private result `$HOME/.cache/storagi/privacy/approved-rewrite-result.json` records approval, exact refs/tree, verified backup and successful operation. All home locators normalized in this public record.
- No operation failed; all planned guards passed. Only current stage/index documentation remained modified afterward and is committed/pushed normally next. Main and existing host services unchanged.

Current privacy files and reachable rewritten feature history are clean. Earlier cache/PR/SHA references and other clones are outside this operation, as disclosed before approval; no complete-erasure claim. PR metadata is updated to reflect actual approval/execution, retain all three hosted screenshots and resume latest-head T3 CI watch. New-head success not claimed before observation.
