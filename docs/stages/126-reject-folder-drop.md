# 126: Refuse dropped folders instead of uploading them as empty files

- Status: completed; stage127 review pending
- Started / last updated: 2026-10-31 (Asia/Kuala_Lumpur)
- Coordinator thread: `f6782541-21f6-4374-9f87-02f683b0f118`
- Agent/task/thread identifiers: none; the coordinator made this small fix itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (T3 reports `claude-opus-5-5`, effort high, in this thread's `orchestrator_capabilities` inherited options)
- Workspace/branch and starting commit: `fix/reject-folder-drop`, `26b594f`
- Scope and acceptance criteria: the owner sent a screenshot of a folder dragged from the file manager onto the shelf, which then listed it as a 0 B file, and asked for guarding so a raw folder is not "uploaded". A dropped folder must not be queued, the owner must be told why, and files dropped with it must still upload. Run `npm run check`, check formatting and reproduce in Chromium.

## Changes

- `web/src/ui.ts`: `fileDrop` reads `dataTransfer.items` and splits out entries whose `webkitGetAsEntry()` is a directory, passing their names separately from the files.
- `web/src/transfers.ts`: dropped folders get one error notice, "Folders can't be uploaded. Zip <names> first.", shown after the queued files' notice so it isn't replaced.
- `web/tests/transfers.test.ts`: a drop with one folder and one file queues only the file and shows the notice.

The "Choose files" picker cannot select folders (no `webkitdirectory`), so drag and drop is the only way in. The server is unchanged: a folder reaches it as an ordinary zero-byte (or failed) upload, which it cannot tell apart from an empty file.

## Verification

Private logs and scripts are in `"$HOME/.cache/storagi/tmp"` and `"$HOME/.cache/storagi/repro"` (`drop-126.mjs`, `drop-126/`), outside Git.

- Unit RED→GREEN: the new test failed before the change (no notice) and passes after it.
- Chromium 1248 headless at 1280 × 900 against `test:preview` (loopback 5174, synthetic data), dropping a real folder and a real ZIP through CDP `Input.dispatchDragEvent`. Chromium hands the folder over as a 4096-byte `File` with `isDirectory` true. On `26b594f` the drop shows "2 files queued", the folder appears in Transfers as `posters`, and its failed read puts the page offline. With the change the notice reads "Folders can't be uploaded. Zip posters first.", only `posters.zip` is uploaded and listed, and the page stays online.
- `npm run format:check` PASS. `npm run check` exit 0: 33 server, 91 web, HTTP acceptance and 154 deploy tests, both typechecks and builds (`check-126.log`).

## Findings and limitations

Firefox, Safari and Android drops were not reproduced; all of them implement `webkitGetAsEntry`. A browser without it would fall back to the old behaviour, since `?.` treats a missing entry as a file.

## Handoff

The coordinator commits, runs the stage127 review and opens the PR. No merge, tag or deployment.
