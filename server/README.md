# Storagi service

Node 22.22+; one process owns a dedicated persistent `DATA_DIR`. Dependencies are pinned and SQLite runs locally; no database service is required.

```sh
npm ci
npm test
npm run typecheck
npm run build
node --env-file=.env dist/src/main.js
```

Copy `.env.example` to a private environment file and fill every required field. `PUBLIC_ORIGIN` must be an exact HTTPS origin without a trailing slash/path. Set `OWNER_GOOGLE_SUB` explicitly before startup. No default credentials or owner auto-enrollment exist. `DATA_DIR` must be an absolute dedicated private directory disjoint from the built web directory; its parent must be writable by the service user. Never point it at existing personal files. Back up or remove this directory only while the service is stopped.

`npm start` runs `dist/src/main.js`; environment must already be exported (systemd EnvironmentFile or Node's `--env-file`). Bind is fixed to `127.0.0.1`, port 8787 by default. Built `../web/dist` is found relative to the package, regardless of cwd. Only the dashboard shell, `/favicon.svg`, and flat `/assets/*` are public; storage files never share that directory. This package does not expose or configure an HTTPS proxy or host services.

## Owner setup

Create a Google OAuth **Web application** client with only basic OpenID identity scope. Register exactly `https://YOUR-HOST/auth/callback` for the app. For the separate local enrollment tool, also register exactly `http://127.0.0.1:8989/callback`. With the client ID/secret provided through the environment, run after building:

```sh
node --env-file=.env dist/src/enroll.js
```

Open the printed authorization URL in a browser **on the same machine** as this command. Choose the owner's Google account. The CLI validates the signed ID token with the same verifier as the application, plus state, nonce and PKCE, and prints the verified `OWNER_GOOGLE_SUB`. Explicitly copy that value into the private environment file. The CLI never writes config, starts the application, creates an app session, or enrolls the first web visitor. It listens on loopback only and times out after ten minutes. Remove the local callback registration afterward if desired. Real registration, account verification and consent remain owner setup; synthetic tests do not prove them.

## Persistence and lifecycle

`storagi.sqlite` holds reservations, tus metadata, hashed session tokens, CSRF tokens and short-lived login flow data; `objects/<uuid>` holds only application uploads. Do not run multiple writers. SQLite exclusive locking rejects a second instance and WAL + FULL synchronous transactions persist quota decisions. Use a local filesystem with SQLite's supported locking semantics. Startup recovers known partial offsets from actual file sizes, reconciles full interrupted writes, removes missing/invalid records and untracked objects, and deletes expired copies. Deletion unlinks bytes before releasing quota; failed deletion keeps the reservation. Successful patches fsync data before publishing completion.

A partial reserves its **entire declared size** atomically. Used/reserved bytes count content once; filesystem/SQLite overhead is protected by the additional default 1 GiB free-space margin. Admission checks budget plus free space for all still-unwritten reservations. Each incoming stream chunk also checks filesystem headroom; external disk consumers can cause an in-progress transfer to fail, leaving a resumable partial and its reservation. Known safe integer lengths are required; deferred lengths/concatenation are intentionally disabled. Filenames are metadata only, limited to 255 UTF-8 bytes without separators/control characters. UUID paths preserve duplicates.

Completed copies expire 30 days after final received bytes complete. A crash after final write but before completion metadata is recovered using the file mtime, capped at current time. Unfinished transfers expire after 24 hours without a PATCH write; failed/interrupted writes refresh activity when their stream settles, while HEAD requests do not extend retention. Expired content is denied immediately on the next operation, regardless of whether physical cleanup has run. Cleanup runs at startup and every minute without overlap. An operation accepted before expiry may finish; file locks make delete/cleanup wait for its stream, then recheck the deadline. Request timeout is 15 minutes per request; clients should use bounded tus chunks. Browser background suspension and WAN throughput remain device/network validation work.

Sessions are server-side, random, hashed at rest, expire after seven days, and are revoked by CSRF-protected logout. Cookies are host-only Secure/HttpOnly/SameSite=Lax. Changing configured owner rejects old sessions; for emergency all-session revocation stop the service and delete session rows from its SQLite database, then restart. Google tokens are neither stored nor returned. Login flows last ten minutes, are one-use, and have a bounded table. Signed ID tokens use explicit openid-client non-repudiation checks. The public shell's Google navigation and callback are allowed cross-site; all protected API paths/methods require a session, reject cross-site Fetch Metadata/origins, and require an exact configured Origin plus CSRF header for mutations. Proxy Host must preserve the configured public host. Forwarded host/proto cannot select download/upload locations; tus returns relative Locations.

## Test injection

`createApp(config, {oidc, now, freeBytes, webDir})` returns `{server, storage, auth, cleanup, close}`. Tests use a local synthetic issuer transport with actual generated RSA signatures/JWKS and the real OIDC verifier. They manually carry Secure cookies to isolated HTTP loopback listeners. The factory accepts a synthetic HTTP Config object only in tests; production always calls `loadConfig(process.env)`, which requires HTTPS. There is no test-auth route, environment flag, default login, or production fallback. Test artifacts use `os.tmpdir()` (respects `TMPDIR`) and are removed. Tests exercise security, concurrent reservations, protocol validation, duplicate filenames, zero-byte files, ranged/download byte integrity, retention, real socket interruption and restart. Tiny fixtures do not prove multi-GB performance, power-loss filesystem durability, real Google registration, Android behavior or remote exposure.
