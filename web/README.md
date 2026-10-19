# Storagi dashboard

Plain TypeScript, Vite and tus-js-client. Node 22+.

```sh
npm ci
npm test
npm run typecheck
npm run build
```

The service serves `dist/` on its own origin. Production fetches `/api/session` before loading files. All service requests use same-origin cookies; tus mutations and file deletion/logout carry the session CSRF token. There are no production mock/auth settings.

Uploads run one file at a time with 8 MiB chunks. Paused files yield their slot to queued files. tus saves unfinished URL fingerprints in browser storage; after closing/reloading, choose the same original file in the same browser to resume. Completed fingerprints are removed so a later identical upload is a separate copy. Clearing site storage, private browsing, or selecting a modified file can prevent recovery. Keep the tab open; mobile background execution is not guaranteed. Server partials expire after 24 hours of inactivity. Cancel asks the server to terminate the partial and release its reservation; if offline, retry cancel or allow the partial to expire.

An expired session stops the entire queue and shows sign-in. Resume HEAD 401/403 responses preserve the saved tus URL: sign in and reselect the same original file to continue at the server's offset without creating another reservation. A missing/expired partial (HEAD 404/410) follows tus's normal fresh-upload path. `tests/session-resume.test.ts` runs the installed tus-js-client 4.3.1 browser client, file reader and WebStorage with a synthetic HTTP transport to check these flows and fresh-session CSRF use.

## Synthetic browser acceptance harness

```sh
TMPDIR=$HOME/.cache/storagi/tmp npm run test:preview
```

Loopback-only `http://127.0.0.1:5174`, strict port. The dashboard is real; service/authentication/files are synthetic and labelled in the page banner. Do not treat this as real Google/service/deployment proof. The separate `tests/vite.mock.config.ts` is never loaded by production build. No production authentication bypass exists. Do not leave this test server running when finished.

The harness starts authenticated with sample Inbox metadata, including duplicate filenames. Fixture downloads contain labelled synthetic text, **not** the represented large files. Newly uploaded synthetic files (up to 64 MiB) are kept in memory and download their actual bytes. PATCH responses wait 600 ms so pause/resume can be exercised. Synthetic state is erased on process exit.

Browser `fetch` controls (test server only):

- `POST /__test/reset`: reset authenticated session, sample files, budget, failures and partials.
- `GET /__test/state`: inspect synthetic budget/reservations, partial IDs/sizes/offsets and the latest 100 upload requests (method/path/offset), without file contents or credentials.
- `POST /__test/session`, JSON `{ "authenticated": false }`: simulate session expiry. Refresh the page or attempt a transfer to observe the lock screen. Synthetic Google login immediately unlocks this harness.
- `POST /__test/quota`, JSON `{ "budgetBytes": 1 }`: simulate exhausted budget. Click Refresh to show the full-shelf notice; uploads return 507.
- `POST /__test/failure`, JSON `{ "status": 410 }`: inject upload failure (except DELETE); use 0 to clear. Supports checking expired partial/session/storage/network-server error messages.
- `POST /__test/resume-auth`, JSON `{ "status": 401 }` (or 403): expire the session on the next upload HEAD, returning that status once while retaining the partial. Synthetic Google login preserves partials; reset clears them. For resume proof: upload/pause after a chunk, record state and browser tus storage, arm this control, reload/reselect, check login and unchanged reservation/fingerprint, sign in/reselect, then verify HEAD/PATCH use the original ID/offset with no extra POST. Repeat for 403. Use synthetic files up to 64 MiB.

Synthetic files/artifacts only. Acceptance screenshots should retain the synthetic banner. Useful viewport checks: 390×844, 728×900, 1440×1000. Interactions: search a missing name and clear it; compare duplicate suffixes; open/cancel/confirm delete; download; upload a 24 MiB synthetic file, pause/resume, cancel; reselect after reload; expire the mock session; exhaust quota. Coordinator owns actual integrated service checks and review/PR.
