# 02: File service

> Public-path normalization (stage 20): paths and command displays are normalized public references, not original literal invocations. Recorded results, identity metadata and hashes are unchanged; original evidence remains private locally.

- Status: completed implementation; handed to coordinator for integration/review/PR
- Started: 2026-10-19 UTC (exact initial timestamp not captured); last updated / completed: 2026-10-19 13:22 UTC
- Coordinator thread: `mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a`
- Agent/task: implementation sub-agent `/root`, stage 02; coordinator reconciliation: task `node:delegated-task:command%3Amcp%3A84bfb7a9-ff9d-4f5a-9ea2-fc37786fe042%3Adelegate-task%3Astoragi-stage02-service-v1`; child thread `thread:delegated-task:command%3Amcp%3A84bfb7a9-ff9d-4f5a-9ea2-fc37786fe042%3Adelegate-task%3Astoragi-stage02-service-v1`. T3 task_status confirmed completed provider codex/model gpt-6.1-sol. Native session `01a15443-aba4-76c1-8ce6-d091ca501b57` verified with `printenv CODEX_THREAD_ID`.
- Provider/model/effort: Codex `gpt-6.1-sol`, high; confirmed by injected T3 runtime **and own session log** `$HOME/.codex/sessions/2026/10/19/rollout-2026-10-19T21-04-43-01a15443-aba4-76c1-8ce6-d091ca501b57.jsonl` (`turn_context.model`, `turn_context.effort`). Requested settings were not used as proof.
- Workspace: `$HOME/projects/storagi`, shared `feat/storagi`; starting baseline `2f59b59d29aa13a465f9a57cb88c612a4b8f947a`. Coordinator changed shared HEAD during work; last observed `c82f9073e350039d13adfb00933ead345f761ba5`.
- Scope: `server/**` and this record only. No delegation, commits, branch changes, push, PR or host service changes by this agent. Coordinator owns integration/review/PR and stage index.
- Acceptance: agreed API, authentication/security, tus, atomic storage rules, persistence/restart, retention, streamed/ranged downloads; server npm test/typecheck/build.

## Decisions

- Applied full-cycle within the explicitly bounded implementation handoff, ponytail full and TDD. Coordinator performs independent review and GitHub workflow. Added systematic-debugging and long-running-command skills when the broken-socket test hung.
- Maintained `@tus/server` 2.4.6 + `@tus/file-store` 2.1.1 implement tus; no custom resumable protocol. Small FileStore subclass integrates persistent SQLite metadata and quota reservations, fsync, free-space checks and lifecycle. Other pinned runtime dependencies: openid-client 6.8.8, better-sqlite3 13.0.3, srvx 0.11.22. All manifest versions are exact, with package lockfile.
- One process, local SQLite WAL/FULL synchronous transactions and exclusive database locking. Entire declared content length is reserved atomically. Both completed and partial content count once against 200 GiB; an additional default 1 GiB free-space margin protects metadata/filesystem headroom. Remaining unwritten reservations are included in admission checks; streaming checks free disk space per incoming chunk.
- Per-file promise locks cover PATCH/HEAD/delete/download/cleanup; creation serialized for simple rollback. Cleanup every minute without overlap, startup reconciliation, unlink-before-quota-release. Accepted streams may finish after expiration, while later operations are denied immediately. Cleanup waits and rechecks refreshed expiry. Partial expiration: 24 hours since PATCH stream settles, including interrupted writes; HEAD does not extend retention. Completed expiration: 30 days after completion; recovery of a fully written partial uses mtime capped at current time.
- Google-only configured subject allowlist, openid-client **explicit signed ID-token verification** (`enableNonRepudiationChecks`), audience/issuer/expiry, PKCE/state/nonce and one-use 10-minute flow. Seven-day random server sessions store only token hashes, use host-only Secure/HttpOnly/SameSite=Lax cookies, rotate on successful login and revoke on CSRF-protected logout. Bounded flow table prevents abandoned-login growth. Tokens are not persisted or logged.
- All protected paths/methods authenticate, including unsupported/unknown API paths and tus OPTIONS/HEAD. Exact Origin and CSRF token required for mutation; cross-site Fetch Metadata rejected on protected operations. Google top-level login/callback navigations and public login shell are allowed cross-site; callback still validates the OIDC flow. Host must match configured public host; forwarded headers do not choose URLs. Tus Locations are relative.
- Production CLI calls fail-closed env validation requiring HTTPS. Factory-only synthetic configuration/clock/free-space/web-directory injection supports isolated tests; no production test-auth endpoint, environment bypass, password or first-visitor enrollment. Storage/public paths must be disjoint after resolving existing symlinks.
- At coordinator request added a standalone loopback enrollment CLI, fixed default callback `http://127.0.0.1:8989/callback`, reusing signed OIDC verifier with state/nonce/PKCE. It prints a verified sub for explicit private-config copying; it never writes owner config, starts the app, or creates an app session.

Official API research actually consulted:

- https://github.com/panva/openid-client
- https://raw.githubusercontent.com/panva/openid-client/main/docs/functions/enableNonRepudiationChecks.md
- https://raw.githubusercontent.com/panva/openid-client/main/docs/functions/allowInsecureRequests.md
- https://raw.githubusercontent.com/tus/tus-node-server/main/packages/server/README.md
- https://raw.githubusercontent.com/tus/tus-node-server/main/packages/file-store/README.md
- https://developers.google.com/identity/openid-connect/openid-connect

Initial GitHub tus-directory fetches were restricted; raw upstream docs and installed declarations/source supplied current APIs.

## Changes

- `server/src/config.ts`: required HTTPS origin/owner/OAuth/data configuration; safe integer limits and defaults.
- `server/src/auth.ts`: Google discovery, signed OIDC verifier, persistent flows and revocable sessions.
- `server/src/storage.ts`, `transfers.ts`: SQLite persistence, quota, maintained tus disk implementation, file locking and durable completion.
- `server/src/app.ts`: same-origin protected API, lifecycle/recovery/cleanup, tus, streaming and single byte-range downloads, storage/public directory separation.
- `server/src/static.ts`: cwd-independent built dashboard shell/assets and exact favicon; generic root/private paths and symlink escapes denied.
- `server/src/main.ts`: production env validation, umask 0077, fixed loopback bind, graceful SIGINT/SIGTERM. Default port 8787; per-request timeout 15 minutes.
- `server/src/enroll.ts`: separate explicit local owner-sub discovery tool.
- `server/test/**`: actual RSA/JWKS synthetic OIDC, HTTP service, socket interruption, storage and lifecycle checks; portable `os.tmpdir()` fixtures respect TMPDIR and are cleaned up.
- `server/package.json`, `package-lock.json`, `tsconfig.json`, `.env.example`, `README.md`: pinned package, scripts/build and setup/lifecycle/test-injection documentation.
- No commits created by this agent; coordinator receives writable shared-checkout changes.

## Verification

Commands below actually ran with `TMPDIR="$HOME/.cache/storagi/tmp"` for npm/tsx work; this path is local invocation configuration, not hardcoded into tests. Node v22.22.1 / npm 9.2.0 confirmed.

RED → GREEN evidence:

1. `npm test --prefix server`: config scaffold failed `Missing expected exception`; implemented fail-closed validation → 1/1 passed. The earlier missing-module discovery run was not treated as meaningful behavioral RED.
2. Same command: quota scaffold admitted 3 reservations instead of 1 → transactional quota → 2/2 passed.
3. Same command: auth scaffold lacked `scope=openid` → real signed OIDC/session flow → 3/3 passed. Wrong sub, signature, expiry, audience, issuer, nonce, state and replay are rejected; PKCE challenge matches the transmitted verifier.
4. Same command: HTTP service absent → protected auth/API implementation → 4/4 passed. Added cross-site document-navigation callback regression: actual 403 instead of 302 → moved protected-operation origin/Fetch Metadata checks → green.
5. Same command: tus creation returned 404 instead of 201 → maintained tus + exact download/range/delete path → 5/5 passed.
6. Lifecycle slice initially failed malformed length 413 vs expected 400, missing zero-byte completion, stale test HTTP connection on restart, and full-write recovery `0 !== 3`. Strict safe-integer admission/completion hook, portable connection-close fixture, startup recovery and cleanup → 8/8 passed. Some related lifecycle cases were introduced together, rather than a perfect one-test-at-a-time loop; all failures above were observed before corresponding fixes.
7. `tsx --test test/static.test.ts` (via server binary from repo root): shell 404 vs 200 → static shell → green. Later exact favicon 404 vs 200 → explicit favicon allowance → green. Later storage symlink test reported missing rejection → realpath separation → both static/security tests green.
8. `tsx --test test/enroll.test.ts`: enrollment scaffold lacked callback → verified local identity flow → green. `tsx --test test/main.test.ts`: missing production entrypoint → fail-closed main → green.
9. `tsx --test test/interruption.test.ts`: real broken PATCH hung on subsequent HEAD; narrowed with temporary nonsecret markers to successful file write cleanup followed by **srvx response-end callback waiting on an already-destroyed 204 socket**, retaining outer file lock. Stopped hung runs, removed diagnostic markers, replaced tiny tus response delivery with guarded direct Node response. Regression green: actual `abc` on disk, HEAD offset 3, restart, resume `def`, download `abcdef`. Subsequent active-write cleanup race also passed.

Final server checks (sequential; coordinator notified to avoid competing root check):

- `TMPDIR=... npm test --prefix server`: **16 tests, 16 passed, 0 failed**, ~15.4 seconds. Includes 7 HTTP methods over protected/unknown paths, forged/missing auth behavior, origin/CSRF boundaries, OIDC cryptographic rejection cases, concurrent reservations, disk headroom, rejection of a second SQLite writer, failed-metadata rollback, duplicates, zero-byte files, ranges, retention/cleanup, restart, real socket interruption, cleanup-vs-write race, static traversal/symlink isolation and production startup validation.
- `TMPDIR=... npm run typecheck --prefix server`: passed (`tsc --noEmit`). An earlier test-header union TypeScript error was corrected before this final pass.
- `TMPDIR=... npm run build --prefix server`: passed (`tsc`), including `dist/src/main.js` and `dist/src/enroll.js`.
- `git diff --check -- server docs/stages/02-file-service.md`: passed.
- `npm install --prefix server`, then pinned manifest and `npm install --prefix server --package-lock-only`: passed; npm reported 0 vulnerabilities at installation. This is not an independent security audit.

Independent acceptance result was **reported by coordinator**, not executed by this agent: 6/0 API checks, including 84 anonymous/forged requests, native Host/origin/CSRF, wrong subject and cross-site callback, hash/range, restarted offset 3, quota/partial cleanup and 31-day expiry. Acceptance agent owns its evidence. Real-service browser smoke was still running at the coordinator's last update.

Artifacts: package lock, source/tests/README/env example and built ignored `server/dist`; synthetic data fixtures are removed. No intentional background server/test process remains from this stage.

## Findings and limitations

- Implementation completion is not deployment or real owner authentication. No Google credentials/registration/consent, real account subject, production HTTPS proxy, Funnel/network exposure, Android suspension, multi-GB throughput or power-cut durability was exercised. Public service activation still follows coordinator/owner workflow.
- Single writer/local SQLite filesystem is intentional. Creation is serialized; files can transfer concurrently. Database/filesystem corruption and an externally failing/full disk fail requests rather than weaken authorization; storage reservation remains until safe deletion/recovery.
- Tiny deterministic fixtures prove byte behavior/security and restart logic, not WAN speed or unattended browser transfers. Active accepted streams finish before locked expiry cleanup; later access is denied.
- Review and PR are deliberately coordinator responsibilities under this bounded delegation; this agent did not independently review its own work or claim review completion.

## Handoff

Factory: `createApp(config, {oidc?, now?, freeBytes?, webDir?})` in `server/src/app.ts` returns `{server, storage, auth, cleanup, close}`. Production main always validates HTTPS env and binds `127.0.0.1:PORT`. DATA_DIR is required absolute; built `web/dist` is module-relative, independent of cwd. `npm start` from server runs `node dist/src/main.js`; systemd's agreed ExecStart path remains valid. Root package commands may call server package scripts unchanged.

For owner binding: build, register exact local callback `http://127.0.0.1:8989/callback`, provide GOOGLE_CLIENT_ID/SECRET privately, run `node --env-file=.env dist/src/enroll.js` from server, open URL on that machine, explicitly copy printed verified sub into OWNER_GOOGLE_SUB. Application callback is separately `PUBLIC_ORIGIN/auth/callback`. No local HTTP application mode was added.

Coordinator: update stage index, run combined root validation/browser smoke, commit integration baseline, perform prescribed independent read-only review (special route applies: this diff was written by confirmed gpt-6.1-sol/high), address findings and handle PR/CI/setup/deployment approval. Server stage is stable for that work; no test/build command remains running.
