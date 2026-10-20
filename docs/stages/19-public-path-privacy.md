# 19: Public-path privacy audit and integration

- Status: completed — current files corrected and approved history replacement executed in22.
- Started/updated: 2026-10-19T16:30:35.303210+00:00.
- Coordinator: /root, T3 thread mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a; actual runtime Codex gpt-6.1-sol/high.
- Agent/task/session: coordinator, no child task.
- Branch/baseline: feat/storagi,0a37bc08bb359789a2050d9d230d3ab0f57c115b, clean.

## Scope and decisions

Coordinator audits tracked text, PR and reachable feature history; integrates normalization, verifies affected configuration and prepares a local history-redaction candidate without modifying remote history. Preserve original history privately for rollback and owner evidence; ask narrow permission only after the concrete proposal is reviewable.

Owner explicitly requests that actual filesystem paths not be public. Public records use repository-relative paths or $HOME-based references and must never reproduce machine-specific values in explanations, test assertions, or examples. Private original evidence stays outside tracked files. Every stage remains documented; actual commands/results distinguish prior execution from planned checks.

## Changes and verification

Pending. Initial coordinator audit found path/account literals throughout instructions, stage evidence and service template; PR body contains none and has no comments/reviews. PR CI was queued at inspection. Native watch stopped successfully for correction. No host changes.

## Limitations and handoff

Existing public feature commits contain old values; normal edits do not erase history. Preserve main and honor prior owner no-overwrite instruction. Prepare and review current-file fixes first, then any local-only rewritten feature candidate; do not force-push without narrow owner approval. No Google/deployment/setup authorization inferred.

## Audit and preparation actually performed

- Current tracked audit found actual home/account literals in instructions, setup/service examples and public stage evidence. Application source/tests/acceptance helpers use portable runtime home resolution; no application change needed for path privacy.
- Historical audit:23 feature-only commits at initial snapshot,49 unique affected blobs/377 blob appearances. Counts retained in private $HOME/.cache/storagi/privacy/historical-path-audit.json; no actual path values reproduced here. Later sanitization commits change these counts and will be audited separately.
- PR#1 body has zero actual machine-path matches, no comments/reviews. Three screenshots are application-only synthetic UI; no host path visible. Current CIqueued at audit; watch stopped successfully to prevent misleading completion while correction proceeds.
- Verified original-history Git bundle saved privately with owner-only permissions; contents not uploaded. Existing original local logs/model proof retained. git-filter-repo absent; python pip absent (inspection failure only). Official standalone git-filter-repo v2.47.0 downloaded from upstream tag to private cache, no host package install. --version exit0; tool source/hash metadata private, no repository dependency added.
- GitHub documentation confirms current-file edits do not remove old commits; rewrites can leave cached/SHA/pull-request references and clones. Support does not remove non-sensitive data routinely. No promise of retroactive erasure. Source: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository
- Concrete next: after stage20 stable sanitized commit, clone to a private bare candidate repo (not a worktree), rewrite only feature history using maintained tool, preserve main exact, verify current tree identical and historical path scan clean. Do not push candidate without owner exception to prior no-overwrite instruction. No remote change made by this preparation.

## Stable normalization accepted

Stage20 task_status completed, actual native proof independently parsed: one gpt-6.1-sol/high context in unchanged private native session. Public proof locator normalized to $HOME; recorded session IDs and historical model/hash evidence preserved. Coordinator independently repeated tracked audit:82 files,zero matches, exit0. Changed paths limited to docs/instructions/portable inactive unit; application/tests/dependencies unchanged. `systemd-analyze verify deploy/storagi.service` independently exit0; unrelated pre-existing host-unit warnings retained privately. No unit installed/started or user/directory created. Coordinator clarified server README: precreated writable DATA_DIR needs no parent write permission; app-created directory needs it. Added persistent public-path rule in AGENTS.

Current-file sanitization is ready for commit/history preparation and fresh review. Prior61 tests and browser proofs remain valid for unchanged app; no redundant app build/UI run. Native logs/original docs preserved privately; no actual account/home literals in public record. Fresh review21 must independently check current file scope, template semantics, normalization evidence caveat and candidate tree/history assertions before any PR update.

## Local history candidate and independent review

Sanitized source commitb36f0e0 created after zero-match scan and whitespace checks. Maintained git-filter-repo v2.47.0 used in private bare clone, feature-only revision scope excludingmain, private replacement rules for literal/encoded personal paths/account and messages. Main remains0d168b103455af4bbbee9a7da7b7fba545dadb21. Private tool log/report/backups retained; no remote history mutation.

Preliminary candidate57eacc93c6a08086be83b98aad1d6970d00939f0:24 feature commits/204unique blobs,zero path/header matches; current tree identical to b36f0e0 (c68525b8545966d5aea71378adde66cac62b6e97), git fsck pass, candidate remotes removed. Fresh review21 independently confirmed all of this and current docs/template consistency: actual gpt-6-astra/high proved, PASS/no findings. Parent HEAD/status/remote and child clean baseline matched; child removed. Coordinator can publish ordinary correction; no source fix required after review.

After metadata closeout, regenerate candidate against latest sanitized feature HEAD with same maintained transform, rerun current-tree identity/main/history/header/fsck audit, verify remote feature exact expected hash and preserve original private backup. Final report/reference stays private until approval. Proposed narrow operation is exact-lease replacement of feat/storagi only; no main/mirror/ref wildcard push and no merge/deployment. Earlier explicit owner instruction “do not overwrite existing remote history” requires exception even though current privacy task makes cleanup useful. GitHub cached/PR references and clones may still retain earlier content; do not promise complete erasure. Owner approval pending, not inferred from elapsed time.

Closeout scan initially flagged wording in a new PR note because slash-separated ordinary words resembled a generic home path. Reworded before publication; no actual private literal was added. Final scan repeated after correction. This was a documentation-pattern false positive, not a newly published exposure.

## Current public files corrected; history exception pending

Ordinary `git push -u origin HEAD` atb36f0e0 exit0 updated feat/storagi without rewriting history; follow-up review-record push at8e152f2 also exit0. PR#1 actual head verified8e152f2. Current tracked82-file scan remainszero, application unchanged, main preserved. PR body updated with privacy disposition while preserving allthree GitHub-hosted screenshot URLs; no actual personal paths in body. Checks remainqueued at actual read, not green. Watch remains stopped while owner history decision is pending; this is not a finished CI claim.

Final closeout commit adds only this status/index metadata. After it is published, candidate is regenerated privately with the same reviewed transform and exact tree/main/history audit. Final result and expected-lease hash stored in `$HOME/.cache/storagi/privacy/final-candidate-report.json`, not a public private-path transcript. Preliminary reviewed candidate is retained separately for comparison. Owner receives the concrete feature-only replacement proposal after verification; no forced mutation before reply. Original owner no-overwrite instruction is the source of this permission requirement, not an inferred skill rule.

## Owner exception received and executed

Owner authorized the narrow proposal with “go as long as you think it is safe.” Stage22 independently repeated lease/tree/main/complete-history/backup checks and successfully replaced only feat/storagi using exact --force-with-lease9e5757d. Published sanitized head4a928b2 has identical approved current content; main0d168b1 and unrelated worktree preserved. No reset or lost local changes. Historical pending-approval sections above retain the actual sequence, not the current status. Latest-head CI and final publication handoff are22; cache/clone limits remain. No merge/deployment.
