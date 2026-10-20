# 30: Independent live private endpoint/browser acceptance

- Status: completed, PASS for exercised anonymous HTTP and browser scopes; real-account checks remain pending with owner.
- Owner: distinct writable acceptance task, not coordinator self-review or a source-code review.
- Provider/model/effort: OpenAI Codex gpt-6.1-sol/high, confirmed from this agent's own native turn_context line8; evidence below.
- Coordinator thread: [implementation](t3-thread://v1/mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a).
- Planned: 2026-10-20T19:14:00+08:00; native acceptance session started: 2026-10-20T19:15:54+08:00; completed: 2026-10-20T19:22:42+08:00.
- Workspace/branch: repository root, shared chore/private-rollout. Merged source baseline1b5cceca905aa1453b9551ee8224307f1a4af97a; first observed checkout HEADa1108914e8ad775aaad7d98cb2dd6179b000751a (stage29 readiness documentation). Production source unchanged.
- Native session:01a15906-67cc-7db0-b0d9-5185a2f2e251. Assigned task: stage30 writable acceptance; T3 task identifier is retained by the coordinator and is not present in native turn_context.

## Scope and acceptance

After stage29 readiness, independently exercise the real private route: anonymous/forged direct file/tus/download/session denial, security and login-flow cookie attributes without logging values, invalid host/origin checks where safe, static dashboard/mock exclusion, responsive unauthenticated browser shell. Do not authenticate as the owner, fabricate a real session, read credentials/private sessions/data, modify app code, create/delete owner files or start/stop host services.

Task owns only a standalone optional live acceptance script, this record and ignored sanitized artifacts. Record exact commands, failures/retries, checks and limitations, actual native session metadata. Do not claim Google owner login or wrong-account verification from synthetic/anonymous tests. Coordinator maintains the index.

## Decisions and changes

The owner approved private validation before conditional Funnel. Use only the sanitized stage29 metadata for the private HTTPS origin; validate TLS certificates normally. Anonymous HTTP checks and a fresh browser context cannot substitute for real Google owner login or Storagi rejection of another signed Google account. The login-start response was inspected in memory without following its Google redirect. No completed OAuth callback, synthetic identity, session insertion or authenticated operation was performed.

Used full-cycle and Ponytail for the optional script, with the explicit delegated scope overriding commit/PR/build steps. Added only `scripts/acceptance-deployment.mjs`, this record and ignored `artifacts/acceptance-stage30/`. The script uses Node standard HTTP/HTTPS, assertions and filesystem APIs; it reads sanitized readiness metadata, sends anonymous requests and emits method/path/status plus boolean checks. URL queries, private hostname, response bodies, header values, cookies, authorization URLs and client identifiers are excluded from proof. Error output is bounded to a failed result rather than raw response details. No production code, manifests, dependency installation or source build was needed.

## Verification

Read project/global instructions, README, complete design record, implementation index, stages26–31, `server/src/app.ts`, `server/src/static.ts`, `server/src/auth.ts`, dashboard source/style, built HTML and existing acceptance examples. `git status --short` initially returned no changes; branch was chore/private-rollout. An exploratory read of nonexistent `scripts/acceptance-http.mjs` returned exit1; located the existing `scripts/acceptance-api.test.ts` instead. No tests were inferred from that failed read.

Actual repeatable commands:

```sh
node --check scripts/acceptance-deployment.mjs
node scripts/acceptance-deployment.mjs
node artifacts/acceptance-stage30/browser-check.mjs
git diff --check
git check-ignore artifacts/acceptance-stage30/browser-proof.json
```

HTTP script passed three sequential runs,213 requests and15 named metadata/static checks each, in addition to per-request status/header assertions. Repeats followed simplification of the native requester and correction of proof to record the URL's actual normalized pathname. No root checks or competing builds ran. Latest sanitized evidence: `artifacts/acceptance-stage30/http-proof.json`.

- **PASS anonymous and forged-session denial:** each of seven protected paths, across GET, HEAD, POST, PATCH, DELETE, OPTIONS and PUT, returned401 both without a cookie and with a forged43-character session cookie:98 requests. Paths were session, file list, file object, direct download, tus collection, tus object and logout. Object paths used a fixed valid UUID without reading or selecting any owner object. No request carried a valid session, upload data, completed OAuth code or CSRF token.
- **PASS hostile Origin and cross-site rejection:** the same49 method/path combinations each returned403 for a hostile Origin and independently for cross-site fetch metadata:98 requests. No permissive CORS success or authentication bypass was exercised.
- **PASS exact hostile Host:** native HTTP directly to127.0.0.1:8787 supplied an exact hostile Host on dashboard, login-start and file-list requests; all returned400. This avoids Fetch's Host override behavior and does not alter DNS or mappings.
- **PASS malformed callback:** bare callback and access-denied callback without a flow both returned401, cleared the flow cookie and set no session cookie. No invented authorization code or successful OAuth exchange was sent.
- **PASS security headers:** all213 responses matched no-store, nosniff, no-referrer and the source's exact restrictive CSP, including self-only scripts/styles/connect, no base URI, no framing and self-only form actions. HTTPS used normal certificate validation.
- **PASS production static shell:** root GET/HEAD200, built JS/CSS/favicon200 with correct content types, no synthetic-preview/mock marker. Six disallowed static/source/config/data or normalized traversal requests returned404; no private payload was read. Proof records normalized paths, not URL queries.
- **PASS Google login-start metadata:**302 to Google's HTTPS authorization endpoint, only openid scope, authorization-code mode, S256 PKCE with state/nonce, callback origin exactly matching the private HTTPS origin and `/auth/callback`. One host flow cookie had Secure, HttpOnly, SameSite=Lax, root Path,600-second lifetime and no Domain. All actual URL/cookie/client values stayed in memory and the hostname is redacted from artifacts.

### Browser attempts and fallback

Called T3 `preview_status` first: available=false. Then `preview_open` with a new incognito tab returned this explicit unsupported error:

> Preview automation open failed: This host blocks the sandbox T3's browser runs in (AppArmor on Ubuntu 23.10+). Run `sudo env "PATH=$PATH" t3 browser setup` on the host once to allow it, then try again.

Did not run that suggested host command or change AppArmor. Used the owner-authorized existing external `playwright-core` module at `"$HOME/.cache/storagi/browser-harness/node_modules/playwright-core/index.mjs"` and Chrome at `"$HOME/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome"`, headless with the established no-sandbox launch flag and a fresh unsaved anonymous context. No second app server, saved browser login, Google click/password/MFA or host-service action.

Systematic debugging was applied to the harness failure. First browser run failed before any viewport completed; its initial catch omitted diagnostics. Preserved `browser-attempt1-failed.json` rather than calling it a pass. Added sanitized phase/error diagnostics and retried: `TimeoutError`, `page.goto: Timeout 30000ms exceeded`, waiting until networkidle on the redacted private origin. Preserved `browser-attempt2-failed.json`. Both attempts had observed dashboard/assets200 and anonymous session401. No app failure was inferred merely from these timeouts.

Changed only harness readiness to DOMContentLoaded plus the actual visible login link and session401. The third run passed all three viewports:1440×1000,728×1024 and390×844; Chrome reports151.0.7922.34. Each showed the owner's-only Google link, no authenticated picker, no synthetic banner and no horizontal overflow. Screenshots were visually inspected and contain only the anonymous app shell with no browser chrome, private hostname or owner data. Runtime page errors0, unexpected console errors0, failed requests0, external requests0; three expected401 resource console messages are counted separately. Response events for `/api/session` remained without requestfinished events in the harness before browser close, consistent with the networkidle timeout; the cause of those unfinished events was not established. All owned browser instances closed in finally; no browser or command is left running.

Browser artifacts: `browser-check.mjs`, `browser-proof.json`, `browser-attempt1-failed.json`, `browser-attempt2-failed.json`, `login-1440.png`, `login-728.png`, `login-390.png`, all under ignored `artifacts/acceptance-stage30/`. They contain no real credentials or logged-in UI. No trace/HAR, browser profile or real session was saved.

### Runtime and privacy evidence

Parsed only session_meta/turn_context from this agent's own native session. Evidence file: `"$HOME/.codex/sessions/2026/10/20/rollout-2026-10-20T19-15-54-01a15906-67cc-7db0-b0d9-5185a2f2e251.jsonl"`, line8: model=gpt-6.1-sol, effort=high; session_meta identifies T3 Code/OpenAI and the native session above. Selected fields only are in ignored `runtime-proof.json`. Requested target settings alone are not used as proof.

Artifact/document privacy checks scanned8 text files for the actual metadata hostname/origin and literal home path without printing them:0 matches. Recursive JSON proof checks found0 forbidden header/cookie/authorization/client/code/session-value fields. Screenshot inspection covers the raster proof. `git diff --check` and script syntax check pass; artifacts are ignored. Final owned-file diff contains only this record and the optional script; coordinator-owned files/index were not edited.

## Findings and limitations

No failing security condition was found in the exercised scope. HTTP acceptance **PASS**; anonymous responsive browser shell **PASS with the recorded readiness-wait limitation**. T3 automation **UNAVAILABLE**; authorized external browser fallback **PASS**. This is independent live acceptance, not a new independent source-code review; optional script/document review and publication belong to the coordinator.

**NOT VERIFIED:** real owner production OAuth login, Storagi's server-side rejection of another successfully authenticated Google account, owner file operations, real device/network behavior, multi-GB WAN transfers, public reachability, persistence/reboot or current host mapping state. Metadata reports Funnel off and mappings preserved, but this task did not inspect raw Serve/Funnel configuration or change it. No raw configuration, credentials, enrollment logs, database, stored sessions or private payloads were accessed.

## Handoff

Owned edits are stable and frozen for coordinator review/integration. No commit, branch, push, GitHub post or index change was made. Existing app/trial/mock services, host mappings, power settings and owner data were left untouched; only owned browser instances were closed. Standalone probes can be rerun using the sanitized metadata without credentials.

Before stage31, coordinator must separately record the owner's real private login and separate-account results, including Storagi denial rather than only Google's test-user restriction. These anonymous results do not authorize bypassing those prerequisites. Funnel activation, publication and any mapping changes remain outside this acceptance task.

## Coordinator integration

- Task: node:delegated-task:command%3Amcp%3A3e6c78fc-c05c-4c21-8927-674b0c47336c%3Adelegate-task%3Astoragi-stage30-private-live-acceptance-v1.
- Coordinator independently parsed native turn_context line8: gpt-6.1-sol/high confirmed. Read sanitized HTTP evidence: passed,213 requests/15 named checks; visually inspected login-390.png with no identity or private hostname shown.
- node --check, git diff --check and tracked privacy scan passed; application/packages/deployment-template diff from merged main is empty. New optional live script is manually invoked, outside routine CI and needs the coordinator's sanitized local readiness metadata.
- Final publication and independent source review are coordinator work; stage30 performed no commit or PR.
