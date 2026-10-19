# Verification evidence and remaining acceptance

The stage index in [implementation-log.md](implementation-log.md) owns the complete handoff history. This page explains how to repeat the checks without real owner data.

## Package checks

From the repository root, `npm run setup` installs committed lockfiles and `npm run check` runs the service and dashboard tests, independent HTTP acceptance, TypeScript checks and production builds. On this host set `TMPDIR` to `$HOME/.cache/storagi/tmp` first. There is no separate lint configuration. Coordinator combined check passed: 16 service tests,10 dashboard tests,6 independent API checks, both typechecks/builds. Exact results are recorded in stage04 and the handoff.

## Independent HTTP acceptance

`TMPDIR="$HOME/.cache/storagi/tmp" server/node_modules/.bin/tsx --test scripts/acceptance-api.test.ts` exercises the actual service with isolated temporary storage and a signed synthetic OIDC provider. It does not expose a test-authentication route. Final results are recorded in stage 05; preparing a script is not a passing result.

## Browser proof

T3 preview was attempted first and returned the explicit AppArmor sandbox unsupported error. No host security setting was changed. The acceptance agent used the existing local Chrome via external Playwright as an authorized fallback.

Start the test-only loopback mock service with `npm run test:preview --prefix web`, then run `node scripts/acceptance-browser.mjs`. Read the script for external Playwright/Chrome prerequisites and environment overrides. Shut the mock service down after checking. Production never imports the mock service configuration.

The initial pass overlapped final UI changes and was superseded. After stage03 final stable handoff, the 2026-10-19 browser rerun reported 6 pass/0 fail with Chrome 151.0.7922.34. The real dashboard talked to a separate synthetic service, with a visible MOCKED banner. It checked login shell, 1440/728/390 layouts without horizontal overflow, search/duplicates/download/delete confirmation, a 24 MiB upload/pause/resume/download SHA-256 match, reload/reselect with a nonzero HEAD offset, cancellation releasing the reservation, quota/expired-partial errors, retry and session lock. Evidence JSON reported no page errors. The coordinator visually inspected desktop and 390px screenshots.

Ignored current local evidence lives under `artifacts/acceptance-stage05/final/`, including `MOCKED-evidence.json` and named PNGs; the first run remains preserved in the parent directory. These are not uploaded GitHub attachments. The screen fixtures' large file labels do not represent large transfers; only the explicitly measured synthetic bytes were transferred.

## Actual-service browser smoke

After the final dashboard build, `server/node_modules/.bin/tsx --test scripts/acceptance-service-browser.test.ts` passed 1/0 in approximately 21.8 seconds. Chrome used an isolated signed synthetic owner session with the actual built dashboard and actual tus/file/list/download/delete service on a random loopback port. No mock API or authentication bypass route was added.

It uploaded 10 MiB in two PATCHes, verified the downloaded SHA-256, confirmed/deleted the copy at 390px, and checked usage/reservations returned to zero. Requests carried the session and mutation CSRF headers. The test browser, isolated service and temporary store were closed/removed. Current ignored evidence is under `artifacts/acceptance-stage05/actual-service/`; the coordinator inspected its JSON. A failed optional test-only OIDC helper preflight was removed and retained in the stage record; production code was unchanged.

This is an integrated local application check with synthetic identity. It does not prove real Google registration, public HTTPS proxy behavior or intended-device networks.

## Local multi-GB streaming acceptance

Optional manual command: `server/node_modules/.bin/tsx --test scripts/acceptance-large-file.ts`. Keep TMPDIR under home; this uses approximately 2 GiB of isolated disk storage and is intentionally excluded from routine CI. On 2026-10-19 it passed 1/0: **2,147,483,649 bytes** uploaded and streamed back with matching SHA-256, restart/resume at exactly 1,073,741,824 bytes, then DELETE/zero usage and verified temporary-directory removal. It generated chunks without a source file and did not save a second download copy.

Payload plus cleanup took 166.507 seconds on loopback; peak RSS of the combined service/client transfer process was 236,224,512 bytes (225.3 MiB). Hash: `bfae55ebd5bd69babf603f500511d356e9dc259f9a48e9ee5b2501723eba334e`. Evidence is under `artifacts/acceptance-stage05/large-file/`; stage05 records exact command, output and limitations. These are generated local bytes, not real ZIP/MP4/WAN/Android tests.

## Unverified real-world behavior

Real Google registration/owner binding and sign-in, another real Google account, production HTTPS proxy/cookie behavior, Funnel/private Tailscale connectivity and throughput, representative multi-GB ZIP/MP4 hashes, physical Windows/Fedora/Android interruption/background behavior, power/lid behavior and live service startup remain unverified. Nothing has been deployed or publicly exposed. Tests cannot establish those properties.
