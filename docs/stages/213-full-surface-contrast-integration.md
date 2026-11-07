# 213: Preserve the unframed editor in contrast themes

- Status: completed; fresh review pending
- Started: 2026-11-07 Asia/Kuala_Lumpur
- Coordinator: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c
- Agent: coordinator fixes small review finding; Codex gpt-6.1-sol high (runtime)
- Branch/start: t3/text-copy-paste-transfer, 28ff45e
- Scope: native spacing border colour under forced colours only; no backend or policy changes.
- Acceptance: no visible inner frame in light/dark contrast palettes on phone/desktop; system text stays distinct; native full-form typing and long-draft footer clearance preserved. Fresh dedicated UI reviews 214/215 must both reach 9.

## Change and failing proof

Added actual-browser forced-colours dark/light checks against the system Canvas colour, with contrasting foreground and four AFTER screenshots. The new assertion failed on the previous built version: native borders computed to the contrast palette foreground rather than Canvas. Added one media-scoped border-colour declaration using Canvas. Native borders keep their geometry; system forced-colour adaptation stays enabled. No new dependency, colour hardcoding or focus proxy.

## Verification

RED evidence: artifacts/full-surface-3-contrast-red.log, expected native-border colour assertion, 0/1. Final results follow before committing and dispatching fresh reviews. Earlier complete checks and the diagnostic distinction between failed parallel web and passed serial web remain in stage 210.

## Final integration outcome

GREEN: actual-service/two-context browser 1/1, 65.6 seconds (clean command exit 0), including light/dark forced-colour phone/desktop checks, full-form native editing, long-draft top/middle/end footer clearance and all prior flows. Four contrast screenshots were directly inspected; the spacing frame is absent with distinct text. All 43 AFTER PNGs and result.json are current. One preceding run emitted a complete passing TAP summary but its process was reported terminated (143); it is not the final command result. The unchanged rerun exited 0.

All 149 web tests across 14 suites passed with one worker, both type checks passed, web build passed, full formatting and whitespace checks passed. Server 44, HTTP 11 and deployment 154 had passed for the preceding source; this iteration changes only one CSS colour declaration and browser proof, so those unchanged paths were not redundantly rerun. Remote default CI remains required. Staged pinned Gitleaks is run and logged before commit.

Ignored logs: artifacts/full-surface-3-{contrast-red,browser,browser-final,web,types,build,format,secrets}.log. No timeout/configuration, host-service, backend, production or preview change. Next stage: fresh independent reviews 214 (Opus) / 215 (Sol), dedicated UI/UX at least 9 each.
