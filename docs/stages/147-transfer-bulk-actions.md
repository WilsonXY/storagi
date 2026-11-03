# 147: Pause all and Cancel all in place of the resume hint

- Status: completed; stage148 review PASS
- Started / last updated: 2026-11-04 (Asia/Kuala_Lumpur)
- Coordinator thread: Claude Code session `2379f3dc-9091-40c4-84fd-e165040e2715`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from this session's runtime metadata)
- Workspace/branch and starting commit: `t3/056e3597` (T3 renamed it `t3/replace-upload-help-actions`), `95ae59b`; merged with `main` after PR #30
- Scope and acceptance criteria: the owner sent a screenshot of the Transfers panel with the hint "Interrupted? Choose the same file again in this browser to resume. Unfinished uploads expire after 24 hours." boxed, and asked to "remove this text. replacing it with pause all and cancel all button instead". Run `npm run check`, check formatting and try both buttons in Chromium on desktop and phone widths.

## Decisions

- **Pause all** pauses the running upload and every queued upload. Pausing only the running one would let the next queued upload start straight away.
- When nothing is left to pause but some uploads are paused, the same button reads **Resume all** and resumes them. Without it, 25 paused uploads would need 25 Resume clicks. Failed uploads are left alone; each keeps its own Retry.
- **Cancel all** cancels every transfer whose row offers Cancel: uploads that are running, queued, paused or failed, and downloads. Downloads cannot pause, so Pause all skips them.
- Both buttons, and their row, are hidden when they would do nothing. There is no confirmation, the same as the row Cancel button.
- The buttons reuse each row's own action, so their behaviour (server copy removal on cancel, the queue moving on) is the same as clicking each row.

## Changes

- `web/src/shelf.html`: the hint is replaced by a `.tr-bulk` row with `#pause-all` and `#cancel-all`.
- `web/src/transfer-view.ts`: the per-row action list moves into `actions(t)`, so the bulk buttons use the same rules; `summary()` shows, hides and labels the buttons.
- `web/src/style.css`: the bulk buttons share the row action buttons' look and touch sizes; the `.resume-note` rule is removed.
- `web/tests/transfer-view.test.ts`: a test for which transfers each button reaches, its label and when it hides.

## Verification

- The new test failed before the change (the hint was still there) and passes after it; web 102/102.
- `npm run format:check` PASS. First `npm run check` failed only in the server acceptance test "half-open PATCH yields promptly…" (`expired half-open PATCH blocked cleanup`) while a browser run loaded the host (load average 7); this is the timing flake also seen in stage137, and this change does not touch the server. Re-run alone: exit 0 (33 server, 102 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds).
- Chromium 1243 on the mock preview with five 24 MiB uploads and each chunk delayed 1.5 s (`bulk-actions.mjs`), at 1280 px and 390 px: the hint is gone and both buttons show; Pause all left all five paused, the running one stopped moving and the button read Resume all; Resume all put one back to uploading and four to queued; Cancel all cancelled all five and both buttons hid.
- After stage148 and merging `main` (PR #30, paste upload): `npm run format:check` PASS and `npm run check` exit 0 (33 server, 109 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds); the Chromium run at 1280 px and 390 px gave the same results.
- Private scripts, logs and screenshots are outside Git in `"$HOME/.cache/storagi/repro"`, `"$HOME/.cache/storagi/tmp"` and `"$HOME/.cache/storagi/proof-bulk"`.

## Findings and limitations

- Not tried on the owner's real devices or with real uploads over the internet connection.
- The hint text is gone, so nothing in the app now says that an interrupted upload resumes when the same file is chosen again, or that unfinished uploads expire after 24 hours. That was the owner's request.

## Handoff

Stage148 review PASS with one test suggestion, not taken (see stage148).
