# 19: Public-path privacy audit and integration

- Status: in progress.
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
