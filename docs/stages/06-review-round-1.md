# 06: Independent review round 1

- Status: completed, FAIL — findings handed to new fix stages 08/09; new round 10 required.
- Started / completed: 2026-10-19 UTC; review baseline 37876ebc4800ba347051cd199d3590773f8089b6.
- Coordinator thread: `mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a`.
- Task: `node:delegated-task:command%3Amcp%3A84bfb7a9-ff9d-4f5a-9ea2-fc37786fe042%3Adelegate-task%3Astoragi-review-round1-claude-high`.
- Child thread: `thread:delegated-task:command%3Amcp%3A84bfb7a9-ff9d-4f5a-9ea2-fc37786fe042%3Adelegate-task%3Astoragi-review-round1-claude-high`.
- Provider/model/effort: Claude/Anthropic `claude-opus-5-5`, high, **verified independently from reviewer session log**, not merely requested options. No fallback used.
- Proof: `$HOME/.claude/projects/<redacted-home>--t3-worktrees-storagi-t3-6d0cf72f/099d5617-4b14-417d-a908-e55981ae6eae.jsonl`; coordinator parsed model and effort metadata: 32 occurrences each for the actual model/high. Native session `099d5617-4b14-417d-a908-e55981ae6eae`.
- Scope: fresh isolated read-only review of committed application/config/tests/docs against origin/main 0d168b1. Reviewer prohibited edits, docs writes, builds/installs, commits, branch changes, pushes, GitHub posts and delegation. Coordinator writes this record.

## Findings and dispositions

- B1 medium blocking, app.ts download pipeline inside per-file lock: stalled stream blocks deletion, parallel ranges and sequential expiry cleanup for unrelated rows. **Fix** in stage08: open an immutable file handle under lock, stream outside it; ensure cleanup remains safe and bounded. Add slow-client/delete/expiry regressions.
- B2 medium blocking, auth.ts public login flow table evicts oldest at100: anonymous flood can evict owner pending login. **Fix** in stage08 with bounded authenticated flow cookie or equivalent non-evicting request integrity. Keep state/nonce/PKCE, expiry/replay protection; no first-user binding.
- N1 medium functional, outer app lock prevents tus locker cancellation on half-open PATCH; resume can wait15minutes. **Fix** in stage08 using coordinated tus locking/cancellation without weakening cleanup/delete safety. Add half-open resume regression.
- N2 medium functional inference, download lacks immutable validators/If-Range, so browser resume can restart. **Fix** in stage08 with strong ETag/Last-Modified and correct If-Range tests; real browser-download recovery still needs proof before claiming it.
- N3 low, tus-js-client removes saved URL after resume HEAD401/403; login/reselect can start over while old reservation remains. **Fix** in stage09 via supported response hook and an actual-client regression preserving resume state.
- N4 low nuisance, cross-site navigation to login can rotate active session and break open tabs. **Fix** stage08: existing authorized session should redirect home without initiating a fresh flow; logout remains explicit/CSRF-protected.
- N5 low cosmetic, bidi override controls can disguise filename extensions. **Fix** stage08 by rejecting override/isolate controls, preserving ordinary Unicode names; focused validation regression.
- Simplification suggestion: remove manual tus response adapter/direct srvx dependency. **Investigate** in stage08; keep the observed broken-socket deadlock regression. Decline a preference that reintroduces the reproduced hang; minimize adapter where safe.
- Simplification suggestion: per-chunk disk check duplicates reservation. **Does not hold as equivalence**: unrelated host processes can consume disk during a long upload; checks preserve configured free-space margin. Retain unless stage08 demonstrates an equally safe simpler alternative.
- Flow table simplification is covered by B2.

Reviewer found OIDC cryptographic checks, owner/session allowlist, no bypass, controlled enrollment, Host/Origin/CSRF, UUID/file-path boundary, atomic quota/recovery, escaped rendering and inactive deployment boundary sound. Reviewer ran read-only inspection only, no tests; passing prior tests did not cover findings above.

## Verification and invariance

Coordinator saved parent before snapshot outside repository at `$HOME/.cache/storagi/review-round1-before.json`; after snapshot at `review-round1-after.json`. Exact HEAD37876eb, empty porcelain status (including untracked files), and remote heads (only main0d168b1) all MATCHED. Reviewer worktree starting/ending HEAD37876eb and clean status independently checked. T3 renamed its generated branch from t3/6d0cf72f to t3/review-storagi-implementation during orchestration; reviewer session's32 commands contain no branch/mutation command. Required commit/clean invariants held.

After result/evidence checks, coordinator ran `git worktree remove --force $HOME/.t3/worktrees/storagi/t3-6d0cf72f` and `git branch -D t3/review-storagi-implementation`; both passed. `git worktree list --porcelain` now lists only parent. No source edits from reviewer accepted.

## Handoff

Two distinct fresh implementation agents own bounded backend/frontend fixes with new records. Re-run combined checks and affected actual browser/large-transfer proofs; round10 is a fresh independent review with this full report and dispositions. No PR/public deployment yet; GitHub publication remains403 blocked.

Coordinator response after stages08/09/11: all B1/B2/N1-N5 fixes have passing implementation and independent acceptance evidence. B1 includes retired-open-descriptor quota accounting beyond the original suggestion. B2 uses native AES-GCM sealed flow cookie and bounded successful-owner replay ledger. Adapter simplification declined because tus.handle ultimately uses the same response-end path that reproduced the broken-socket deadlock; completion reconciliation now occurs once within the datastore lock. Per-chunk disk checks retained for other host disk consumers. Fresh round10 must independently judge these responses; this round's original FAIL verdict is preserved.
