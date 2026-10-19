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
