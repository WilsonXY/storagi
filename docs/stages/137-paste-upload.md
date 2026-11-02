# 137: Upload files by pasting them

- Status: completed; stage138 review pending
- Started / last updated: 2026-11-03 (Asia/Kuala_Lumpur)
- Coordinator thread: `01a4540a-64d7-40dc-8cb3-7e5d62393ad1`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from this session's runtime metadata)
- Workspace/branch and starting commit: `t3/enable-paste-file-upload`, `e7b9d45`
- Scope and acceptance criteria: the owner reported that copy-pasting files into the dashboard did not upload them and asked for paste to work. Pasting files (Ctrl+V or Cmd+V) anywhere in the dashboard must queue them exactly like a drop, including the folder refusal, while pasting text into the search box keeps working.

## Changes

- `web/src/ui.ts`: `fileDrop` also listens for `paste` on the window. When the clipboard carries `Files` and uploads are enabled, it prevents the default and passes the clipboard items through the same file/folder split as a drop (moved into a shared `deliver`). Pastes without files are left alone.
- `web/src/shelf.html`, `web/src/transfers.ts`: the composer says "Drop or paste files to put them on the shelf".
- `README.md`: the upload feature line mentions pasting.
- `web/tests/transfers.test.ts`: the drop helper builds paste events too; new tests for pasted files with a pasted folder refused, and for a text paste left alone.

## Verification

- The new paste test failed before the change (paste not handled) and passed after it.
- `npm run format:check` and `npm run check`: PASS (server 154, web 96, acceptance 33 and deploy 11 tests, both typechecks and both builds).
- Real Chromium (Playwright, headless) against the synthetic preview service on a loopback port: a PNG was written to the browser clipboard and a real Ctrl+V pressed. The paste event carried `Files`, was prevented, "1 file queued" appeared and `image.png` uploaded onto the shelf. Then text on the clipboard pasted into the focused search box as `handoff`. Screenshots are kept outside Git.

## Findings and limitations

Whether a browser exposes files copied in a file manager (not just a copied image) on paste depends on the browser and OS, and Storagi cannot change that. Not checked on physical Windows, Fedora KDE or Android devices. Android browsers generally offer no file paste outside text fields.

## Handoff

Stage138 is the independent review. The coordinator opens the PR; no merge, tag or deployment.
