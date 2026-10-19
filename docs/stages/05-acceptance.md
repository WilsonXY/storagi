# 05: Acceptance

> Public-path normalization (stage 20): paths and command displays are normalized public references, not original literal invocations. Recorded results, identity metadata and hashes are unchanged; original evidence remains private locally.

- Status: completed
- Started: 2026-10-19 21:06 +08:00; completed / last updated: 2026-10-19 21:28 +08:00
- Coordinator thread: `mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a`
- Agent/task/thread: test sub-agent; task `node:delegated-task:command%3Amcp%3A84bfb7a9-ff9d-4f5a-9ea2-fc37786fe042%3Adelegate-task%3Astoragi-stage05-acceptance-v1`; native session `01a15445-ba0a-7660-b321-ecd5c9326d7d` (`CODEX_THREAD_ID`).
- Provider/model/effort: Codex `gpt-6.1-sol`, high reasoning effort, confirmed by injected T3 runtime information. Live catalog confirms inherited provider/model; catalog defaults are not treated as actual effort evidence.
- Workspace: shared `$HOME/projects/storagi`, `feat/storagi`; starting observed HEAD `53e58b87d520c8b4508351b3c95a900afd17d644`.
- Scope and acceptance: own `scripts/acceptance*` and this record; independent black-box authorization/file safety and browser flows per API agreement. No server/web/root edits, commits, branches, push, delegation, deployment, or host service changes. Coordinator owns integration, review, stage index and publication.

## Decisions

Use the service factory with isolated synthetic identity/storage when ready, without production auth bypasses. Run no competing package builds/tests while implementation agents work. Use existing Chrome through external `playwright-core` for browser proof after the required T3 attempt explicitly failed. Label test-only mocked API proof as MOCKED; no Google authentication claim.

## Changes

Added `scripts/acceptance-api.test.ts`, `scripts/acceptance-browser.mjs`, `scripts/acceptance-service-browser.test.ts` and optional/manual `scripts/acceptance-large-file.ts`. No production code/helpers added or changed. Browser assertions separately exercise mocked APIs and the actual built dashboard/service. External optional Playwright dependency installed only in authorized cache. Coordinator retains implementation/integration, commits, independent review and PR ownership; no commits made by this agent. Tested stable service `9e6f10d` and dashboard `c82f907` baselines.

## Verification

Actually run:

- Read owner/project AGENTS, README, design, implementation log, API agreement, full-cycle, ponytail full, and TDD skills.
- `preview_status({})`: `available:false`.
- `preview_open({url:"http://127.0.0.1:5174",reuseExistingTab:false})`: explicit unsupported host error: `This host blocks the sandbox T3's browser runs in (AppArmor on Ubuntu 23.10+).` No privileged setup or AppArmor changes performed.
- `TMPDIR="$HOME/.cache/storagi/tmp" npm install --prefix "$HOME/.cache/storagi/browser-harness" --no-audit --no-fund playwright-core`: passed, one external package installed in 3 seconds. Chrome executable exists at `$HOME/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome`.
- Chrome `--version` and external Playwright `chromium.launch({executablePath:…,args:["--no-sandbox"],headless:true})` smoke check: passed, Chrome `151.0.7922.34`; closed afterwards. No application test was run during implementation.

### MOCKED browser acceptance: passed

- Read `web/README.md` and `web/tests/vite.mock.config.ts` after the web readiness handoff. `ss -ltn 'sport = :5174'` showed no listener before starting our test server.
- `TMPDIR="$HOME/.cache/storagi/tmp" npm run test:preview --prefix web`: Vite `7.3.7`, loopback-only `127.0.0.1:5174`, strict port; owned execution session `91009`. No competing server started.
- `TMPDIR="$HOME/.cache/storagi/tmp" node scripts/acceptance-browser.mjs > artifacts-acceptance.log 2>&1`: exit 0; five scenarios plus parent (`6` tests passed, `0` failed), total approximately 15.2 seconds. Log moved to ignored `artifacts/acceptance-stage05/browser.log`.
- Login shell reveals no file rows; synthetic Google button unlocks the MOCKED service. All screenshots preserve the visible synthetic banner.
- 1440×1000, 728×900 and 390×844 viewports: asserted no horizontal overflow, choose-files control visible; manually inspected all three full-page Inbox screenshots using `view_image`.
- Mobile search/empty/clear; duplicate filenames have distinct displayed suffixes; fixture download clearly contains synthetic text; delete dialog cancel preserves copy, confirm removes exactly one copy.
- 24 MiB generated synthetic upload: pause/resume, complete, browser download has matching SHA-256. Reload/reselect of another same original resumes using a nonzero tus HEAD offset; cancel sends DELETE, mock partial count and reserved bytes both become zero.
- Simulated quota 507, unfinished-copy 410 and successful retry; session expiry locks Inbox. No uncaught page errors.
- Browser closed after the run. Test preview stopped with Ctrl-C (exit 130) at 21:15 +08:00; `ss -ltn 'sport = :5174'` confirms no listener remains. Shutdown log reported subsequent `src/transfers.ts` and `src/style.css` changes at 21:14:26, after proof finished; coordinator informed that final stable flow changes require a fresh proof run.
- Artifacts: `artifacts/acceptance-stage05/MOCKED-evidence.json`, `browser.log`, `MOCKED-login-desktop.png`, `MOCKED-inbox-{1440,728,390}.png`, `MOCKED-delete-confirm-390.png`, `MOCKED-paused-desktop.png`, `MOCKED-quota-error-desktop.png`, `MOCKED-session-expired-390.png`. Synthetic local upload/download fixtures are ignored alongside them. These are not representative multi-GB transfers or actual Google authentication.

### API acceptance: passed after harness alignment

The first run failed before requests because the prepared fixture's web directory was inside its data directory. Preserved `artifacts/acceptance-stage05/api-first-harness-error.log` (0 pass, 1 setup failure). A second run with disjoint sibling paths reached HTTP but returned 400: this Node fetch ignores an overridden Host header. A minimal native HTTP echo probe confirmed requested `Host: shelf.example` arrived as actual `127.0.0.1:port`. Preserved `api-second-host-fixture-error.log` (0 pass, 6 fail; fixture mismatch, not application findings). Applied systematic-debugging to trace this boundary; no production changes. Aligned the fixture to the server's actual random loopback origin and stable port across restarts, `dir/data` versus `dir/no-web`, and used native HTTP specifically for the hostile Host test. Assertions were retained.

Final command: `TMPDIR="$HOME/.cache/storagi/tmp" server/node_modules/.bin/tsx --test scripts/acceptance-api.test.ts > artifacts/acceptance-stage05/api.log 2>&1`. Exit 0, five scenarios plus parent (`6` pass / `0` fail), approximately 3.9 seconds:

- Synthetic signed wrong-sub callback rejected with 403/no session; signed owner callback with `Sec-Fetch-Site: cross-site`, `Sec-Fetch-Mode: navigate`, `Sec-Fetch-Dest: document` accepted. Session cookie has Secure/HttpOnly/SameSite=Lax.
- Partial three-byte prefix survives application close/recreate, HEAD offset 3, remaining PATCH completes; downloaded SHA-256 and byte range match synthetic content.
- 84 anonymous/forged requests across six known routes and seven methods all return 401/no-store; correct authenticated ids used. Mutations with missing CSRF, hostile Origin or cross-site fetch return 403; native HTTP hostile Host returns 400.
- Three simultaneous 20-byte HTTP reservations under a reduced 32-byte test budget produce exactly one 201/two 507, preserving completed bytes; same-name partial gets a distinct id. Partial inaccessible exactly at 24h inactivity; cleanup releases its full reservation.
- Expired session cannot download; after a 31-day clock advance and restart, fresh signed owner session sees no expired completed files and usage/reservations zero.

Production behavior is owned by another implementation agent; these independent acceptance assertions add no production helpers or claimed feature implementation TDD cycle. Test factory and synthetic signed transport only; no real Google account/credentials.

### Final stable MOCKED browser rerun: passed

After the coordinator's final web stability handoff, reran the complete browser script against final `index-BXI1SmFE.js` / `index-CJGitPfX.css` source/build handoff. Started the documented mock preview only after confirming 5174 free (session `62290`). Command: `TMPDIR="$HOME/.cache/storagi/tmp" STORAGI_ARTIFACT_DIR=artifacts/acceptance-stage05/final node scripts/acceptance-browser.mjs > artifacts/acceptance-stage05/final/browser.log 2>&1`. Exit 0, `6` pass / `0` fail, approximately 9.7 seconds. Final screenshots and JSON are in `artifacts/acceptance-stage05/final/`; initial run artifacts/history retained above. Reinspected final Inbox screenshots at all three widths using `view_image`; no UI findings. Browser closed; mock preview stopped with Ctrl-C (exit 130); 5174 confirmed free. No HMR changes reported on this final run.

### Actual-service browser smoke: passed

Added `scripts/acceptance-service-browser.test.ts` at the coordinator's later request. It serves the real built dashboard with actual isolated service/tus/SQLite/filesystem, while existing Auth begin/callback verifies a synthetic signed owner identity. Direct test factory config uses random HTTP loopback origin; production `loadConfig` is untouched and still requires HTTPS. No bypass route, credentials or Google network.

- Initial optional `openid-client.allowInsecureRequests` dynamic-module call failed before browser/service setup with `Cannot read properties of undefined (reading 'get')`; preserved `artifacts/acceptance-stage05/actual-service/first-module-instance-error.log` (1 preflight failure). The dynamically loaded function did not recognize the existing helper's configuration private state. Removed this unnecessary call; the unchanged signed helper already supports the tested callback transport. No production/auth policy changes.
- `TMPDIR="$HOME/.cache/storagi/tmp" server/node_modules/.bin/tsx --test scripts/acceptance-service-browser.test.ts > artifacts/acceptance-stage05/actual-service/browser.log 2>&1`: exit 0, `1` pass / `0` fail, approximately 21.8 seconds.
- Chrome `151.0.7922.34` sent the Secure/HttpOnly/SameSite=Lax `__Host-storagi-session` cookie on loopback and received session 200. Built `index-BXI1SmFE.js`/`index-CJGitPfX.css` loaded without mock middleware.
- 10 MiB synthetic byte buffer uploaded by real tus POST 201 + two PATCH 204, actual Inbox entry, browser attachment download SHA-256 match, mobile confirmed deletion, used/reserved bytes zero. Every observed mutation carried CSRF; no uncaught page errors.
- `artifacts/acceptance-stage05/actual-service/evidence.json` contains sanitized method/path/status/CSRF-presence evidence and build HTML (no token/cookie values); `SYNTHETIC-IDENTITY-real-service-{1440,390}.png` inspected with `view_image`. Synthetic content hash: `4c01e685150fbfcf8c64efb625362fb199cf51400e64c46eb614ea8d2f6d29f2`.
- Browser and isolated server closed, temporary data removed; `ss` confirms its random 44099 listener gone and mock port 5174 free.

### Optional local multi-GB acceptance: passed

The coordinator explicitly expanded stage 05 to a generated `2 GiB + 1 byte` actual-service streaming proof, outside routine CI. Prepared `scripts/acceptance-large-file.ts`: one reusable 8 MiB buffer, byte pattern based on chunk index, actual 4 GiB budget/1 GiB disk reserve, signed owner identity, real tus/SQLite/disk, HEAD/restart at 1 GiB on same random loopback port, remaining upload, streaming download hash/count, deletion/zero usage/temp cleanup. No source file or second download file. Progress, peak process RSS and elapsed time go to ignored evidence/log artifacts.

`df -B1 "$HOME/projects/storagi" "$HOME/.cache/storagi/tmp"` at 21:21 +08:00 showed `850120663040` available bytes on persistent home storage; `free -m` showed ~4837 MiB available RAM. After explicit coordinator go, recheck showed `850078289920` bytes available. Coordinator reports final server/root tests complete and all other heavy commands idle; committed service baseline `9e6f10d`, dashboard `c82f907`.

Actual command: `TMPDIR="$HOME/.cache/storagi/tmp" server/node_modules/.bin/tsx --test scripts/acceptance-large-file.ts > artifacts/acceptance-stage05/large-file/run.log 2>&1` (execution session `21231`, transfer process PID `872230`). Ten-minute test deadline aborts HTTP requests. Exit 0, `1` pass / `0` fail; no retries or implementation changes needed. `run.log` retains 256 MiB progress checkpoints; `evidence.json` retains exact count/hash/RSS/free-space/cleanup results.

- Uploaded **2,147,483,649 bytes** (2 GiB + 1), crossing the signed 32-bit size/offset boundary; 8 MiB generated chunks and a final one-byte chunk. Only the service's file was stored, no source file or second download file.
- At 50.38 seconds, 1 GiB uploaded; HEAD and actual disk size verified. At 50.67 seconds, service restarted on the same random loopback port and HEAD resumed at exactly **1,073,741,824 bytes**, preserving full quota reservation and signed session.
- Completed upload at 105.651 seconds; actual stored file and Inbox size exactly 2,147,483,649 bytes. Streamed download (no full buffer) counted the same bytes and matched the generated SHA-256: `bfae55ebd5bd69babf603f500511d356e9dc259f9a48e9ee5b2501723eba334e`.
- DELETE returned 204; used/reserved bytes both zero; stored object absent; service closed and isolated temporary directory removed (asserted ENOENT). All owned large-test processes exited. No host services/settings changed.
- Payload transfer plus cleanup: **166.507 seconds**; full TAP run: **175.664 seconds**. Peak RSS of the process containing transfer client and service: **236,224,512 bytes (225.3 MiB)**, measured with `process.resourceUsage().maxRSS`; launcher processes are excluded. Free filesystem bytes before: `850078240768`; after cleanup: `850055057408`. The small overall free-space difference includes concurrent unrelated filesystem changes; no equality claim is made. The test explicitly verified its own object and directory removal.
- This proves generated local multi-GB transfer/resume/integrity on the actual service, SQLite and filesystem. It does not prove Google account registration, real ZIP/MP4 validation, WAN/Funnel throughput, Android/browser background behavior or power/lid behavior.

## Findings and limitations

No application findings in the exercised flows. Early harness setup/loader failures and the T3 AppArmor limitation are retained above, with corrected passing runs clearly separated.

Actual local generated multi-GB bytes were verified; real Google/OAuth registration/account binding, representative ZIP/MP4 files, Windows/Fedora/Android device execution, Android background suspension, WAN/Funnel/private Tailscale performance, HTTPS deployment and host power/lid behavior remain unverified. Responsive phone-sized Chrome screenshots are not Android-device proof. No credentials, network exposure, deployment or host service changes performed.

## Handoff

Coordinator receives four rerunnable acceptance scripts, this completed record, and ignored proof artifacts under `artifacts/acceptance-stage05/` (original mock run), `final/` (final stable mocked run), `actual-service/` and `large-file/`. Latest results: API 6/0, final MOCKED browser 6/0, actual-service browser 1/0, local generated multi-GB 1/0. No test command or server started by this agent remains running; mock port 5174 and observed actual-service port 44099 were confirmed free. Coordinator owns root verification/index, independent read-only review, commit/PR/publication and any follow-up after review changes. Index completion requested after this record became current.
