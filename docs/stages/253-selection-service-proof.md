# 253: Disposable service and browser selection proof

- Status: completed (initial after-fix proof; final after-review recording delegated back to this agent)
- Started / last updated: 2026-11-08 (Asia/Kuala_Lumpur)
- Coordinator thread: `mcp:launch:e47359e10cea73eb04f1661ca2441c31bd23fb0e11ab41694432d71a2ef9e62a`
- Agent/task: native delegated `selection_service_proof`; bounded verification only, no application edits, commits or GitHub writes.
- Provider/model/effort: Codex / gpt-6.1-sol / high, confirmed in own session `rollout-2026-11-08T01-30-19-01a1b70f-aae9-7472-9dad-7e0f1c1dc7a4.jsonl` turn-context model/effort fields.
- Workspace/branch and starting commit: prepared `fix/text-inbox-selection`, `b44bb6d17beb896146b8f01a987bb69a990a9289`.
- Scope and acceptance criteria: follow stage 252; run actual built dashboard, authenticated service/SQLite and Chromium against disposable uploaded files and synthetic signed identity. Show stale controls cannot emit DELETE on Text after grace, retained file bytes, preserved Text/native selection/draft/link, active transfer across navigation, normal Inbox download/delete/Undo and Text Undo. Record a paced current-code demonstration after review fixes.

## Decisions

Use the existing fixture's synthetic signed identity and a loopback ephemeral listener. Browser diagnostic dependencies in the coordinator checkout are read-only; no services or files there are changed. Temporary service/profile storage uses a short task-specific `$HOME/.cache/storagi/selection-proof-tmp` directory; output is under ignored repository artifacts. Application authentication is unchanged.

## Changes

Prepared ignored `server/artifacts/selection-scope/proof.ts`. It owns and closes its fixture/browser, checks actual storage and authenticated downloaded bytes, captures DELETE requests, and records a paced owner demonstration under `artifacts/selection-scope/`.

## Verification

Successful actual invocation, with `STORAGI_DIAGNOSTICS_ROOT` pointing read-only at the coordinator checkout:

```sh
TMPDIR="$HOME/.cache/storagi/selection-proof-tmp" \
  STORAGI_DIAGNOSTICS_ROOT="$coordinator_checkout" \
  server/node_modules/.bin/tsx server/artifacts/selection-scope/proof.ts
```

Chromium **156.0.8078.4**, actual fixed production build, actual authenticated service/SQLite, synthetic signed identity and disposable upload data:

- Inbox selection → Text → old select-all, bulk Delete/Download, row Delete/confirmation, Ctrl+A and Delete: **zero DELETE requests** after 4.6 seconds. Original file remains in SQLite and its authenticated download returns identical bytes; Text remains.
- Native Text selection, actual clipboard copy and native link opening pass. Link target is intercepted synthetic HTML, with no external fetch. Unsaved draft survives Inbox/Text navigation.
- Real resumable upload held at PATCH while navigating to Text resumes and completes after release.
- Returning to Inbox permits selection and the bulk browser download. Bulk deletion + Undo retains the original file beyond grace. A separate intentional deletion emits exactly one file DELETE after grace and removes only that target.
- Text's own confirmation + Undo retains its note beyond grace.
- No browser page errors. Fixture, browser and task-specific processes closed after completion.

Evidence: ignored `artifacts/selection-scope/result.json`, `run.log`, `retained-file.png`, `selection-scope-fixed.webm`, and `contact-sheet.jpg`. Recording duration checked with ffprobe: **31.32 seconds**. Six-frame contact sheet visually inspected: selection, Text without selection bar, retained Inbox file and re-selection are clear. This initial run used uncommitted fixed source on starting HEAD; final after-review run will capture committed HEAD and source SHA-256.

## Findings and limitations

Shared preview automation unavailable: `preview_status` reported unavailable. A blank `preview_open` failed with: “This host blocks the sandbox T3's browser runs in (AppArmor on Ubuntu 23.10+).” No host browser/security setup was changed. Per the permitted fallback, use isolated local Playwright and the existing Chromium 156 binary. An initial `about:blank` open was rejected as an invalid preview URL, then a valid blank open established the AppArmor failure.

No production data, real OAuth, host services, network mappings, deployment or exposure is involved.

Harness failure corrected before successful proof: the first isolated Chromium launch failed because a UNIX `SingletonSocket` exceeded its path limit with the long repository TMPDIR. Retried with the short task-specific HOME cache path above; no application change or host setup change was needed. An attempted record edit also missed an exact patch context and was reapplied with correct context; no evidence was lost.

## Handoff

Initial actual-service/browser acceptance passes. Coordinator may commit this record before independent review; this agent will make no tracked edits during the repository invariance audit. After reviewer completion, rerun proof/recording from final current code when requested. The owner still requires companion fixes and combined CI before any deployment-readiness claim.
