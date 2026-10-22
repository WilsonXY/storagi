# 49: Frontend port foundation

- Status: in progress
- Started: 2026-10-23 +08:00
- Coordinator thread: Claude Code (Claude Opus 5.5) in T3 Code, thread `90da6e4a-818a-4e67-bc98-98f1606e3cd0`
- Agent/task identifiers: filled in by the coordinator after delegation
- Provider/model/effort: requested Codex gpt-6.1-sol/high; actual values to be confirmed from the agent's own session evidence
- Scope and acceptance criteria: see the [handoff](../../design/explorations/HANDOFF.md). Bring the reusable prototype parts into `web/` as TypeScript (fonts, brand icons, tokens, `KoiPond`/`KoiMark`/`orbitLoader`, formatting, speed/ETA, auto-refresh timing, selection with drag ranges, sorting, delayed delete with undo, offline retry timing, preferences), with unit tests; extend `server/src/static.ts` for the owner's icons with tests. No UI rewrite (stage 50). `npm run check` passes.

The implementing agent completes the sections below.
