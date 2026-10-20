# Verification evidence and remaining acceptance

The [stage index](implementation-log.md) records ownership, failed attempts, findings and every handoff. Stages 04/05 retain the original baseline evidence; stages 08/09/11 record the review fixes and refreshed proof. Independent review round 2 passed (stage 10); its low cleanup-timeout finding was fixed with a focused regression in stage 12. Final fresh review 13 passed and confirmed the fix.

## Repeat routine checks

Use Node 22.22+ and npm. Set TMPDIR under home on this host, then run from the repository root:

```sh
mkdir -p "$HOME/.cache/storagi/tmp"
export TMPDIR="$HOME/.cache/storagi/tmp"
npm run setup
npm run check
```

The check runs service/dashboard tests, independent HTTP acceptance and review regressions, both TypeScript checks and builds sequentially. No separate lint is configured. Current stage16 reports: server 31/31, web 19/19, independent API 6/6, independent review-fix HTTP 5/5; coordinator repeated the final combined command successfully (61 reported tests, exit 0); current log/commands are in stage16; stage04 preserves the earlier55-test evidence.

The independent HTTP suites use isolated storage and a signed synthetic OIDC provider with the actual verifier. They cover anonymous/forged endpoint sweeps, owner restriction, cryptographic/CSRF/Host/Origin boundaries, flooding/tampering/replay/expiry, quota, half-open takeover, restart integrity, ranges/validators, Unicode and deletion/expiry with open descriptors still counted in quota. They add no production authentication bypass.

## Browser proof

T3 preview was attempted first and returned the explicit AppArmor sandbox unsupported error. No host security settings were changed. The fallback used the already installed Chrome 151.0.7922.34 through external Playwright. See scripts for executable/module overrides. All preview listeners were loopback-only and stopped afterwards.

Mocked proof: start `npm run test:preview --prefix web`, then `node scripts/acceptance-browser.mjs`. Production never imports this mock configuration. Stage11 result: **8/8 passed**, including 1440/728/390 layouts, search/duplicate names, download/delete confirmation,24 MiB upload/pause/resume/hash, cancellation/reselect, quota/errors/session lock, and HEAD 401/403 preserving the exact fingerprint/reservation and resuming the same 8 MiB offset without another POST after sign-in/reselect. Stop the mock service when finished.

Actual-service proof: build first, then run `server/node_modules/.bin/tsx --test scripts/acceptance-service-browser.test.ts`. Stage11 and refreshed stage16 results: **1/1 passed** each against actual built dashboard/tus/SQLite/filesystem, using signed synthetic owner identity and test-context cookie injection from real Auth. It checked upload/download hashes, mobile deletion, real revoked-session 401, actual hostile-Origin 403 response relayed via Playwright, same upload ID/offset with no extra POST, and 404/410 creating fresh copies. The403 relay is explicitly a test boundary: Chromium did not preserve a direct Origin override; the script asserts the service's actual 403 before relaying it. No fabricated 403 or production bypass route. All test processes/temp stores were closed/removed.

Stage11 tested production JS `index-DzQRuOKC.js`, CSS `index-CJGitPfX.css`; stage 11's runtime-source.json records source/build hashes and verified agent model/effort metadata. Final ignored artifacts are under `artifacts/acceptance-stage11/{mock,actual-service}`. Stage05 originals remain preserved. Screenshots are local evidence, not uploaded GitHub attachments. Fixture names/sizes are synthetic and do not prove real-device or Google setup.

## Local multi-GB streaming proof

Optional manual command: `server/node_modules/.bin/tsx --test scripts/acceptance-large-file.ts`. Keep TMPDIR under home; this uses roughly 2 GiB of isolated disk and is excluded from routine CI. Final stage 11 result: **1/1 passed**, 2,147,483,649 bytes uploaded and streamed back with matching SHA-256, close/recreate at exactly 1,073,741,824 bytes, then DELETE/zero usage and verified temporary-directory removal. It generated 8 MiB chunks with no source file or second download copy.

Final payload plus cleanup: 129.193 seconds; full TAP: 130.265 seconds. Peak combined service/client transfer process RSS: 227,856,384 bytes (217.3 MiB). Hash `bfae55ebd5bd69babf603f500511d356e9dc259f9a48e9ee5b2501723eba334e`. Exact logs/counts/hashes/source fingerprints/cleanup evidence are under `artifacts/acceptance-stage11/large-file/` and documented in stage 11. These are generated local bytes, not real ZIP/MP4/WAN/Android tests.

## Unverified real-world behavior

Real Google client registration/owner binding and sign-in, another real Google account, production HTTPS proxy/cookie behavior, Funnel/private Tailscale connectivity and WAN throughput, representative ZIP/MP4 files, physical Windows/Fedora/Android interruption/background behavior, browser download recovery, power/lid behavior and live service startup remain unverified. Nothing has been deployed or publicly exposed. Synthetic identity and phone-sized desktop screenshots do not establish those properties.

Subsequent product changes: stage12 isolates cleanup-row failures; stage15 closes SQLite even when active cleanup rejects and keeps uploads usable after failed sign-out. Each has an observed RED→GREEN regression. Stage16 repeated the61-check combined run and actual-service/browser against current built JS index-CaM_JQ4K.js. Mock browser11/11 (10 scenarios+parent) includes failed500/network signout followed by upload/hash without reload and successful signout stopping active+queued work while preserving partials. Current artifacts are artifacts/acceptance-stage16/{mock,actual-service}; original stage11 proof remains preserved. Generated2GiB proof was not repeated for these small failure-path changes.

Review history: original Claude rounds06/10/13 and owner-requested Codex gpt-6-astra/high rerun14 have runtime proof and read-only invariance records. L2/L3 are now implemented and verified in15/16; fresh independent fallback review17 PASS accepts both and finds no blocking code/security defect. Actual gpt-6-astra/high confirmed from own session; invariance passed, worktree/branch removed. Low documentation status/reference correction applied. No real Google/HTTPS/network/deployment claims.
