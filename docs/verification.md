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

The check runs service/dashboard tests, independent HTTP acceptance and review regressions, both TypeScript checks and builds sequentially. No separate lint is configured. Latest stage reports: server 30/30, web 14/14, independent API 6/6, independent review-fix HTTP 5/5; coordinator repeated the final combined command successfully (55 reported tests, exit 0); exact log/commands are in stage 04.

The independent HTTP suites use isolated storage and a signed synthetic OIDC provider with the actual verifier. They cover anonymous/forged endpoint sweeps, owner restriction, cryptographic/CSRF/Host/Origin boundaries, flooding/tampering/replay/expiry, quota, half-open takeover, restart integrity, ranges/validators, Unicode and deletion/expiry with open descriptors still counted in quota. They add no production authentication bypass.

## Browser proof

T3 preview was attempted first and returned the explicit AppArmor sandbox unsupported error. No host security settings were changed. The fallback used the already installed Chrome 151.0.7922.34 through external Playwright. See scripts for executable/module overrides. All preview listeners were loopback-only and stopped afterwards.

Mocked proof: start `npm run test:preview --prefix web`, then `node scripts/acceptance-browser.mjs`. Production never imports this mock configuration. Final stage 11 result: **8/8 passed**, including 1440/728/390 layouts, search/duplicate names, download/delete confirmation,24 MiB upload/pause/resume/hash, cancellation/reselect, quota/errors/session lock, and HEAD 401/403 preserving the exact fingerprint/reservation and resuming the same 8 MiB offset without another POST after sign-in/reselect. Stop the mock service when finished.

Actual-service proof: build first, then run `server/node_modules/.bin/tsx --test scripts/acceptance-service-browser.test.ts`. Stage11 result: **1/1 passed** against actual built dashboard/tus/SQLite/filesystem, using signed synthetic owner identity and test-context cookie injection from real Auth. It checked upload/download hashes, mobile deletion, real revoked-session 401, actual hostile-Origin 403 response relayed via Playwright, same upload ID/offset with no extra POST, and 404/410 creating fresh copies. The403 relay is explicitly a test boundary: Chromium did not preserve a direct Origin override; the script asserts the service's actual 403 before relaying it. No fabricated 403 or production bypass route. All test processes/temp stores were closed/removed.

Tested production JS `index-DzQRuOKC.js`, CSS `index-CJGitPfX.css`; stage 11's runtime-source.json records source/build hashes and verified agent model/effort metadata. Final ignored artifacts are under `artifacts/acceptance-stage11/{mock,actual-service}`. Stage05 originals remain preserved. Screenshots are local evidence, not uploaded GitHub attachments. Fixture names/sizes are synthetic and do not prove real-device or Google setup.

## Local multi-GB streaming proof

Optional manual command: `server/node_modules/.bin/tsx --test scripts/acceptance-large-file.ts`. Keep TMPDIR under home; this uses roughly 2 GiB of isolated disk and is excluded from routine CI. Final stage 11 result: **1/1 passed**, 2,147,483,649 bytes uploaded and streamed back with matching SHA-256, close/recreate at exactly 1,073,741,824 bytes, then DELETE/zero usage and verified temporary-directory removal. It generated 8 MiB chunks with no source file or second download copy.

Final payload plus cleanup: 129.193 seconds; full TAP: 130.265 seconds. Peak combined service/client transfer process RSS: 227,856,384 bytes (217.3 MiB). Hash `bfae55ebd5bd69babf603f500511d356e9dc259f9a48e9ee5b2501723eba334e`. Exact logs/counts/hashes/source fingerprints/cleanup evidence are under `artifacts/acceptance-stage11/large-file/` and documented in stage 11. These are generated local bytes, not real ZIP/MP4/WAN/Android tests.

## Unverified real-world behavior

Real Google client registration/owner binding and sign-in, another real Google account, production HTTPS proxy/cookie behavior, Funnel/private Tailscale connectivity and WAN throughput, representative ZIP/MP4 files, physical Windows/Fedora/Android interruption/background behavior, browser download recovery, power/lid behavior and live service startup remain unverified. Nothing has been deployed or publicly exposed. Synthetic identity and phone-sized desktop screenshots do not establish those properties.

The final production change after stage 11 is limited to isolating each cleanup row's failure, so a lock timeout does not skip later expired files. Stage 12 records the regression and final review 13 confirmed it. Upload/auth/download/storage and browser code are unchanged from refreshed browser/2GiB proof; the heavy proof was not repeated for this isolated cleanup change.

Final independent review: PASS at product commit e22757e; actual Claude claude-opus-5-5/high confirmed from reviewer session model/effort fields, no fallback. Full findings/dispositions, read-only invariance and cleanup evidence are in stages06/10/13. Known low edge L2 remains: cleanup rejection during shutdown may skip explicit SQLite close and log exit1; process exit still closes handles and committed WAL/FULL data remains durable. This is reported, not claimed fixed.
