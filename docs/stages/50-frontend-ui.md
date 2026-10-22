# 50: Frontend port UI

- Status: in progress
- Started: 2026-10-23 +08:00
- Coordinator thread: Claude Code (Claude Opus 5.5) in T3 Code, thread `90da6e4a-818a-4e67-bc98-98f1606e3cd0`
- Agent/task identifiers: filled in by the coordinator after delegation
- Provider/model/effort: requested Codex gpt-6.1-sol/high; actual values to be confirmed from the agent's own session evidence
- Workspace/branch and starting commit: delegated worktree from `30239b9` plus this record
- Scope and acceptance criteria: replace the current dashboard with the approved final design (`design/explorations/final/`) on the real service, using stage 49's modules; see the [handoff](../../design/explorations/HANDOFF.md).

## Owner decision (2026-10-23)

Downloads are hybrid: where `showSaveFilePicker` exists, a single-file download streams through `fetch` into the chosen file with in-page progress and speed; elsewhere (Firefox-based browsers, Android) it stays a plain link, and the page says the browser is handling it.

The implementing agent completes the sections below.
