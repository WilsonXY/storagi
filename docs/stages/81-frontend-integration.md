# 81: Frontend port integration

- Status: completed
- Started / completed: 2026-10-23 +08:00
- Coordinator thread: Claude Code (Claude Opus 5.5) in T3 Code, thread `90da6e4a-818a-4e67-bc98-98f1606e3cd0`; the serving model per turn is not independently proven here
- Workspace/branch: `t3/apply-frontend-overhaul`, fast-forwarded to stage 79 (`30239b9`) and stage 80 (`883da87`)
- Scope: audit both delegated stages, verify independently, fix what the audit found, compare the result with the prototype in a browser

## Audit of stage 80

The coordinator read the full diff. Findings that held up:

- Coverage was complete: every state and interaction in the brief, the three must-keep notices the prototype lacked (resume line, full-shelf banner, session-expired line on the locked card), hybrid downloads, and the harness `offline` control.
- Preserved tests changed selectors only (`#files`→`#groups`, `.transfer-status`→`.tr-status`, `#logout`→`#signout-confirm`); expected values are unchanged.
- The tus queue logic (CSRF, the 401/403 stop that keeps the saved upload URL, safe-URL check, focus-safe buttons) is unchanged apart from the speed and offline hooks.
- No inline `style=` in any template; one CSS and one JS entry plus three fonts.
- At 574 lines the TS came in under the 900–1,000 budget because the code is dense like the prototype (25 KB against the prototype's 38 KB), not because scope was missing.

## Integration fixes (coordinator)

1. `pagehide` tore the dashboard down, so a page restored from the back/forward cache stayed visible but no longer responded. Removed; pending deletes still never send when the page is closed, because their timers die with it.
2. A single-copy bulk delete said "1 copies deleted".
3. Sort buttons had labels like "size, sorted ascending"; restored the prototype's "Size, sorted smallest first".
4. The settings switches said only "Saved"; restored "Saved · the koi swim" and the other three messages.
5. The sign-out note counted "N transfers"; restored the prototype's "1 upload and 1 download will stop."
6. The budget read "200.0 GiB"; now "200 GiB" as designed.
7. The toast appeared and vanished without its slide (the CSS existed, the code never used `.out`), and the selection count did not roll; both restored.
8. The swipe strip showed only the word Delete; restored the trash icon.

A regression test covers 2, 3, 5 and 1 (it fails on the old code because sign-out Cancel stops responding after `pagehide`).

## Verification

- `npm run check`: one run failed in `server/test/interruption.test.ts` ("uploads deletion safely cancels a half-open PATCH") while the harness and a static server were also running; `server/` is untouched since stage 78. After stopping them, two consecutive full runs passed: 32 server, 59 web, 11 acceptance tests, both typechecks and builds. Recorded as a timing-sensitive test under load, not a regression.
- Browser: T3's built-in preview could not start (the host's AppArmor blocks its sandbox). Used headless Chromium through a local Playwright install against the synthetic harness and the prototype, both on loopback. Screenshots kept outside Git under `$HOME/.cache/storagi/tmp/s51/`. Shelf at 1440, 1100 and 390 px, locked, offline and full-shelf states match the prototype's layout; no horizontal overflow at any width; the only console errors are the deliberate 401 and 503 responses.

## Findings and limitations

- Not verified: real Google sign-in, the deployed service, a physical phone or touchpad, Firefox-based browsers, dragging files in from the OS, multi-GB or WAN transfers.
- Known deviations accepted from stage 80: downloads have Cancel only (no Pause); the selection bar's Download always uses plain links; the `U` shortcut still opens the picker while offline.
- Both local servers were stopped after the checks.
