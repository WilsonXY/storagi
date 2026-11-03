# 153: Upload files by pasting them

- Status: completed; stage154 review FAIL, its P2 fixed; stage155 re-review FAIL, its P2 fixed
- Started / last updated: 2026-11-03 (Asia/Kuala_Lumpur)
- Coordinator thread: `01a4540a-64d7-40dc-8cb3-7e5d62393ad1`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from this session's runtime metadata)
- Workspace/branch and starting commit: `t3/enable-paste-file-upload`, `e7b9d45`
- Scope and acceptance criteria: the owner reported that copy-pasting files into the dashboard did not upload them and asked for paste to work. Pasting files (Ctrl+V or Cmd+V) anywhere in the dashboard must queue them exactly like a drop, including the folder refusal, while pasting text into the search box keeps working.

## Changes

- `web/src/ui.ts`: `fileDrop` also listens for `paste` on the window. When the clipboard carries `Files` and uploads are enabled, it prevents the default and passes the clipboard items through the same file/folder split as a drop (moved into a shared `deliver`). Pastes without files are left alone. After stage154, a paste into a text field whose clipboard also has `text/plain` is left alone too, so the text goes into the field; anywhere else the files upload. After stage155, a text field means a `textarea`, an `input` of type text, search, url, tel, email, password or number, or an element with `isContentEditable`; a checkbox or button no longer swallows the paste.
- `web/src/shelf.html`, `web/src/transfers.ts`: the composer says "Drop or paste files to put them on the shelf".
- `README.md`: the upload feature line mentions pasting.
- `web/tests/transfers.test.ts`: the drop helper builds paste events too; new tests for pasted files with a pasted folder refused, for a text paste left alone, and (after stage154) for a clipboard holding both text and a file, pasted into the search box, onto a checkbox (after stage155) and onto the page. The helper now dispatches bubbling events on a chosen target.

## Verification

- The new paste test failed before the change (paste not handled) and passed after it.
- `npm run format:check` and `npm run check`: PASS (server 154, web 96, acceptance 33 and deploy 11 tests, both typechecks and both builds).
- Real Chromium (Playwright, headless) against the synthetic preview service on a loopback port: a PNG was written to the browser clipboard and a real Ctrl+V pressed. The paste event carried `Files`, was prevented, "1 file queued" appeared and `image.png` uploaded onto the shelf. Then text on the clipboard pasted into the focused search box as `handoff`. Screenshots are kept outside Git.
- After the stage154 fix, the mixed-clipboard regression test failed first and then passed. In real Chromium a clipboard item holding `text/plain` and `image/png` pasted into the search box as `mixed` (event types `text/plain`, `Files`; not prevented; nothing queued), and on the page it was prevented and uploaded `image.png`.
- After the fix, local full checks could not finish because other work loaded the host (load average about 15 to 23 on 4 cores). The first post-fix run passed everything except two server half-open PATCH deletion tests (`interruption.test.ts`, the flaky timeout noted in stage134; this change touches no server code). The second passed the server, acceptance and deploy tests, but a web font-build test timed out and vitest workers failed to start. A serial web run was stopped at its time limit. What did pass locally: `web` `tsc --noEmit` (it caught a nullable `clipboardData`, fixed with a non-null assertion behind the existing `types` guard), `transfers.test.ts` 10/10, and Prettier on the changed files. CI's full run is the authoritative check for this commit.
- After the stage155 fix: the extended regression test failed first on the checkbox case and then passed; `transfers.test.ts` 10/10 and `web` `tsc --noEmit` PASS. In real Chromium, the mixed clipboard pasted with the Select all checkbox focused was prevented and queued an upload; the search and page cases behaved as before. This fix was verified by the coordinator only, with no third review round.

## Findings and limitations

Whether a browser exposes files copied in a file manager (not just a copied image) on paste depends on the browser and OS, and Storagi cannot change that. Not checked on physical Windows, Fedora KDE or Android devices. Android browsers generally offer no file paste outside text fields.

## Handoff

Stage154 reviewed `e81b8dc`; the coordinator fixed its P2. Stage155 reviewed `e4c91c1`; the coordinator fixed its P2. The coordinator opens the PR; no merge, tag or deployment.
