# 145: Confirm pasted files before uploading

- Status: completed; stage146 review PASS; owner follow-up (title spacing) and a close-timing fix after it, verified by the coordinator
- Started / last updated: 2026-11-03 (Asia/Kuala_Lumpur)
- Coordinator thread: `01a4540a-64d7-40dc-8cb3-7e5d62393ad1`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from this session's runtime metadata)
- Workspace/branch and starting commit: `t3/enable-paste-file-upload`, `132baec` (stage142 work, PR #30)
- Scope and acceptance criteria: after trying the stage142 preview, the owner found that pasting on the site uploads straight away and asked for a mistake-proof step, such as a pop-up asking to confirm the upload. Pasted files must wait for an explicit yes. Drops and the file picker are deliberate and stay immediate.

## Decisions

- A native `<dialog>` opened with `showModal()`: the browser supplies the backdrop, focus containment and Escape to cancel. It reuses the sign-out confirmation's `confirm-pop` look, centred on screen.
- Focus starts on Cancel, so a stray Enter after an accidental paste uploads nothing. Upload needs a click or Tab then Enter.
- A second paste while the dialog is open adds its files to the same list rather than opening another dialog.
- Pasted folders are still refused right away with the existing notice; only files are offered.

## Changes

- `web/src/ui.ts`: `fileDrop` takes a separate `paste` callback; drops still go to `drop`.
- `web/src/transfers.ts`: pasted files collect in a pending list shown in the dialog (title with the count, each name and size, total, "Kept 30 days."). Upload queues them; Cancel, Escape or teardown (sign-out, expiry) drops them. Names are set as text, never as markup.
- `web/src/shelf.html`: the `#paste-confirm` dialog. `web/src/style.css`: centring, backdrop and file list styles.
- `web/src/dashboard.ts`: the dashboard's keyboard shortcuts (`/`, `U`, Escape, Ctrl+A) do nothing while the dialog is open.
- `web/tests/transfers.test.ts`: jsdom has no modal dialogs, so the tests stub `showModal` and `close`. Tests cover confirm, cancel, Escape, a second paste joining the list, a file name holding markup, the text-paste cases from stage142 and the shortcut guard.

## Verification

- The five rewritten paste tests failed before the change and passed after it. The shortcut test failed with the guard removed and passed with it. `transfers.test.ts` 13/13 and `web` `tsc --noEmit` PASS.
- Real Chromium (headless, Playwright) against the synthetic preview service on a loopback port, with real Ctrl+V. Pasting an image opened "Upload 1 pasted file?" with focus on Cancel and nothing queued. A second paste made it "Upload 2 pasted files?". Escape closed it with nothing queued, and so did Enter on the default focus. Upload queued `image.png`. At 390 × 844 the dialog is centred and readable. Screenshots are kept outside Git.
- Full check, with the host at load average about 4 to 10 on 4 cores. `npm run format:check` PASS. The first web run failed 54 tests in other files: teardown called `confirm.close()` unconditionally and jsdom has no `close`, so sign-out and expiry teardown threw. Fixed by closing only an open dialog, which is also correct in browsers; the web suite then passed 100/100. Acceptance 11/11 (one earlier run failed the half-open PATCH case, then passed), deploy 154/154, both typechecks and builds PASS. The server suite failed one or two download-lifecycle timing tests (`socket hang up`) in each full run, 32/33 at best; `download-lifecycle.test.ts` alone passed 3/3 twice. This change touches no server code, and CI passed the server suite on `132baec`.

## Findings and limitations

The dialog only guards pastes; a mistaken drop still uploads at once, as before. Physical devices, Firefox and Safari were not exercised.

## Handoff

Stage146 reviewed `fa94306`: PASS, no findings. The coordinator updates PR #30; no merge, tag or deployment.

## Owner follow-up after stage146

The owner tried the preview and asked for more room between the dialog title and the file list. A test on the owner's Windows machine (Helium 156, a Chromium browser) over SSH also exposed a timing bug.

- Real Windows test: a throwaway Helium profile in the owner's desktop session, launched by a one-off scheduled task, with the real Windows clipboard. The scheduled task, test profile and files were removed afterwards, and the owner's clipboard was saved and restored. A file put on the clipboard the way Explorer copies it reached the page as `Files` (`application/x-zip-compressed`) and opened "Upload 1 pasted file?". A copied bitmap arrived as `image.png` and also opened the dialog. The owner's earlier "no confirmation" report came from testing a drag, which uploads at once by design.
- Timing bug: browsers fire a dialog's `close` event a task after `close()`, and the pending list was cleared in that event. When the test closed the dialog and pasted straight away, the new paste joined the stale list ("Upload 2 pasted files?"). The late event would then have emptied the list, so Upload would have queued nothing. Fixed: a newly opened dialog starts a fresh list, Upload empties the list itself, Upload does nothing unless the dialog is open, and the `close` listener is gone. The jsdom stub now fires `close` a task later, as browsers do. A new test, and the existing cancel test under that stub, failed before the fix and pass after it.
- Spacing: `.paste-confirm .cp-title` has 6px of bottom padding, so the title text sits 16px above the list's first divider instead of 10px (measured in Chromium).
- `transfers.test.ts` 14/14 and `web` `tsc --noEmit` PASS. Full check: see the index row. This follow-up was verified by the coordinator only, with no further review round.

The paste upload records were numbered 137 to 141 until `main` took 137, 138, 140 and 141 (and an open branch took 139); they were renumbered 142 to 146 when `main` was merged into this branch.
