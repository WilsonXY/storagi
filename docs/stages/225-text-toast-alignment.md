# 225: Align Text notifications with the content column

- Status: completed integration; fresh reviews pending
- Started: 2026-11-07 Asia/Kuala_Lumpur
- Coordinator: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c
- Provider/model/effort: Codex gpt-6.1-sol high (runtime)
- Branch/start: t3/text-copy-paste-transfer, e2bfa08
- Owner request: the Text-deleted toast is not centered under the Text content.

## Diagnosis and bounded change

The shared body-level toast correctly uses fixed left:50% / translateX(-50%), which centers it in the whole viewport. The Text composer/list center excludes the 240px desktop sidebar, so the toast sits 120px left of that axis. The owner's cropped reference shows the same displacement. Align active Text notifications with the content column when the sidebar is visible; keep phone/tablet viewport centering and existing Inbox/other screens unchanged. Use the existing sidebar token and responsive breakpoint rather than layout JavaScript or a second toast implementation.

## Acceptance and workflow

Actual built-service bounds must place copied/deleted Text toasts on the composer/list center at desktop widths, on the viewport axis with sidebar hidden, including resize while a toast is visible. Preserve queue/action/timing, selection-bar avoidance and all earlier UI. This is a small coordinator correction, not a separately delegated implementation stage. Fresh read-only Opus/Sol high UI reviews 226/227 must both reach 9. Project checks appropriate to CSS/proof change and remote CI must pass; no unrelated services/data/mappings or production change.

## Implementation and proof

The new actual-browser assertion failed on the old built app at 861px, exactly where the 240px sidebar appears (artifacts/text-toast-center-browser-red.log). The correction is scoped to the visible Text shelf, excluding Settings even when Text is the last tab. At widths above 860px it adds half the existing sidebar-width token to fixed left:50%; narrower screens retain the existing viewport axis. Text-only Text notices also get symmetric 16px inner padding; action toasts retain their prior padding. No toast JavaScript, queue/action/timer, vertical selection-bar avoidance or other page position was changed.

Final actual-service/two-context browser 1/1 passed in 71.7 seconds, clean exit0. It measures Copy notice versus composer center at 390/728/860/861/1000/1440/1920, message versus pill center, viewport bounds, live resizing without recreation and navigation to Inbox/Settings. It also captures and asserts actual desktop/phone Text-deleted notices while preserving the deletion/continued-typing checks. Earlier whole-feature editing/copy/gesture/Undo/focus/koi/auth/expiry/file checks remain green. Six new toast screenshots join all refreshed existing proof; representative desktop/phone delete notices were inspected directly. Owner's uploaded image stays private; baseline public-safe synthetic copy notice is retained separately.

Web156/156 across14 suites with one worker, both typechecks/builds, full formatting/whitespace pass. Prior e2bfa08 remote CI passed complete server/HTTP/deploy and browser checks; backend/workflow source is unchanged, so those suites were not redundantly rerun for this CSS-only correction. New remote full CI is still required after push. Staged pinned Gitleaks is run before commit. Logs: artifacts/text-toast-center-{browser-red,web,types,build,format,browser-final,secrets}.log; current text-handoff/result.json.

No new dependency, JS state or layout observer. The change is a small coordinator correction; read-only reviews226/227 follow and require dedicated UI/UX at least9 each without backend/test credit. No private preview, service, data or mapping change before acceptance. Physical devices/software keyboards/AT remain unverified.
