# 08: Backend review fixes

- Status: completed — stable implementation handoff; independent acceptance/review pending
- Started: 2026-10-19 UTC; completed / last updated: 2026-10-19T13:50:46Z
- Coordinator thread: `mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a`
- Agent/task/thread: backend implementation task `storagi-stage08-backend-review-fixes`; native Codex session `01a15462-252a-75f3-953a-a7347bc64558` confirmed from `CODEX_THREAD_ID`; T3 task/thread identifiers not exposed in this child context.
- Provider/model/effort: Codex `gpt-6.1-sol`, high, confirmed by injected T3 runtime metadata (session log not independently inspected).
- Workspace/branch: `$HOME/projects/storagi`, `feat/storagi`, starting committed `e8248f5`. No commits or branch changes permitted in this stage.
- Scope and acceptance: own only `server/**` and this record; resolve stage06 B1/B2/N1/N2/N4/N5 with failing regressions before fixes; investigate adapter simplification while retaining broken-socket safety. Coordinator owns commits/integration/fresh review/PR; no delegation or host/service changes.

## Decisions

Preserve agreed product/security boundaries; regressions before fixes; separate packages for independent work. Reviewer stage10 remains read-only with coordinator-owned record.

Source investigation: the app promise lock surrounds tus dispatch and the entire download pipeline. This blocks tus MemoryLocker takeover before a competing HEAD reaches it. Installed tus 2.4.6 exposes `MemoryLocker.newLock`, `lock(signal, requestRelease)`, `unlock`; PATCH invokes `context.cancel()` when another holder requests release and drains for 3 seconds. Completion callbacks run after the tus write lock is released, so safe unification also requires completion/fsync to settle inside the datastore operation, before unlocking. Downloads now open an immutable descriptor while locked and stream outside it; Linux unlink semantics preserve an already-open inode.

Flow investigation: every anonymous begin prunes/writes SQLite and evicts oldest flows at 100. Replacement uses a short, encrypted and authenticated browser cookie with a persistent native-crypto server key; only successful owner callbacks consume bounded replay storage. Signed Google identity verification stays unchanged. Flow implementation now passes focused tests. AES-256-GCM keeps PKCE verifier confidential as well as authenticating state/nonce/verifier/expiry. Key persisted once in private DATA_DIR SQLite, no new environment prerequisite. Strict bounded canonical cookie parsing, 10min lifetime, AAD binds origin/owner. Anonymous begin does zero database writes; invalid/nonowner callbacks do not persist. Only successful signed owner callbacks atomically consume replay ledger+create session, limit1000 live entries with429 at capacity, no eviction; expired entries pruned. Old flow table removed at startup. API contract unchanged.

Coordinator identified Linux unlink/open-inode budget risk. Implemented in-memory per-id pins and retired-size accounting: metadata/path disappears immediately, but usedBytes includes deleted/expired open inodes once until the last descriptor closes. Reservation admission includes retired bytes. Restart has no inherited descriptors, so no retired state needs persistence.

## Changes

- B1 fixed: check/open under shared lock; stream outside; 30s socket idle timeout; Linux active-inode preservation; pinned retired-byte quota counts once until last descriptor closes. Slow-client variants test DELETE and expiry, unrelated cleanup, ranges and SHA-256; shortened real socket timer verifies finally closes/reclaims on timeout.
- B2 fixed: encrypted/authenticated stateless pending-flow cookie, persisted safe key, zero writes per anonymous begin; strict state/nonce/PKCE/expiry/browser binding; bounded successful-only replay ledger. Public factory/auth method signatures unchanged.
- N1 fixed: removed outer app promise-lock bottleneck; reuse maintained tus MemoryLocker for uploads and app delete/open/cleanup, post-acquisition session/expiry validation. Fsync/reconciliation in datastore write before unlock; zero-byte create completed before unlock. Both delete routes can cancel half-open writes safely.
- N2 fixed: immutable strong UUID ETag, stable Last-Modified and exact strong If-Range semantics.
- N4 fixed: authenticated login navigation returns home without flow/session rotation.
- N5 fixed: reject bidi U+202A–202E/U+2066–2069 while retaining ordinary Unicode.
- Adapter simplification deliberately declined after reading installed tus/srvx source and stage02's reproduced deadlock: `sendNodeResponse`'s bodyless response path waits for `res.end(callback)` even on an already-destroyed socket. The guarded adapter also normalizes early protocol-validation errors to agreed JSON. Retain direct pinned srvx dependency for the NodeRequest bridge; no new dependency. Broken-socket regression remains green.
- Per-chunk disk checks retained: reservations do not account for unrelated host disk consumers during a long upload.
- Server README updated with lifecycle, cookies, locking, validators and quota behavior.

Assigned only `server/**` and this record. Coordinator owns integration/index/review/commits/PR.

## Verification

Actual RED/GREEN (all commands prefixed `TMPDIR=$HOME/.cache/storagi/tmp`):

- `server/node_modules/.bin/tsx --test --test-name-pattern='authenticated login navigation' server/test/auth.test.ts`: RED 0/1 (redirected to Google instead of `/`); after session guard GREEN 1/1.
- `server/node_modules/.bin/tsx --test --test-name-pattern='filenames reject' server/test/transfer.test.ts`: RED 0/1 (U+202A accepted with 201). Added control rejection; GREEN 1/1 after serialized test slot released.
- `server/node_modules/.bin/tsx --test --test-name-pattern='immutable download validators' server/test/transfer.test.ts`: RED 0/1, missing ETag; GREEN 1/1, strong immutable ETag/Last-Modified stable after restart, matching If-Range 206, weak/mismatch/date mismatch full200.
- `server/node_modules/.bin/tsx --test --test-name-pattern='anonymous login flood' server/test/auth.test.ts`: RED 0/1, pending owner flow evicted after120 begins. Then `server/node_modules/.bin/tsx --test server/test/auth.test.ts`: GREEN 3/3; strengthened suite GREEN4/4, including restart, tamper/strict encoding, cookie/state browser swap, expiry, replay and concurrent callbacks. Synthetic issuer permits reused codes; successful replay ledger is actually tested.
- `server/node_modules/.bin/tsx --test server/test/download-lifecycle.test.ts`: RED 0/1, parallel range timed out behind paused8MiB download. Descriptor-outside-lock fix then RED0/1, physical bytes incorrectly released from application quota (0 vs8388608). Added per-id descriptor pins and retired-size accounting; GREEN1/1, expiry removes path and independent expired file while active stream hash matches and quota remains until descriptor closes. Explicit DELETE variant also GREEN; `download-lifecycle.test.ts`2/2.
- `server/node_modules/.bin/tsx --test --test-name-pattern='HEAD promptly' server/test/interruption.test.ts`: RED0/1, HEAD timed out at6s while PATCH remained half-open. Shared maintained MemoryLocker plus in-lock durable completion: interruption suite GREEN3/3 (broken socket/restart/hash, cleanup refreshed-retention race, half-open takeover/resume). Added both API-file and tus-delete half-open regressions; first expanded run output was partial because command exceeded tool yield, so no result claimed from that run; final logged suite below confirms both added tests.
- `server/node_modules/.bin/tsx --test server/test/download-lifecycle.test.ts server/test/storage.test.ts server/test/auth.test.ts`: GREEN12/12, including the1000-entry successful replay limit, last-of-multiple-pins quota release and accelerated real download idle timeout (asserts production30s, test timer100ms).
- Frontend briefly owned serialized test slot; backend paused all test/build starts, then resumed only after explicit coordinator release. No large/browser/2GiB checks run here.

Final checks ran sequentially against the complete server diff:

- `npm --prefix server test`: **29 passed, 0 failed**,22.47s; exit0. Log `$HOME/.cache/storagi/stage08-server-test.log`.
- `npm --prefix server run typecheck`: **passed**, exit0. Log `$HOME/.cache/storagi/stage08-server-typecheck.log`.
- `npm --prefix server run build`: **passed**, exit0. Log `$HOME/.cache/storagi/stage08-server-build.log`.
- `git diff --check -- server docs/stages/08-backend-review-fixes.md`: passed.
- No server test/type/build processes left active at handoff. Loopback fixture listeners and temporary artifacts are closed/removed by tests. No dependency manifests/lockfiles changed.

## Findings and limitations

All assigned findings have implementation/regression dispositions above. Acceptance stage11 and fresh independent review stage10 must assess the integrated committed result before coordinator closes stage06. No claim of real Google registration/account login, browser download recovery, WAN/Funnel, Android suspension, deployment or2GiB validation in this stage. The response adapter and per-chunk disk check remain deliberately retained for their observed safety requirements. Flow migration invalidates only pending legacy login flows; existing owner sessions persist. At1,000 successful live callbacks, login fails closed with429 until expiry/pruning frees space. Retired bytes can keep usedBytes above the visible file sum until accepted downloads close/timeout; this is intentional physical-budget accounting. No external setup or deployment changes.

## Handoff

Stable; stop edits here. Coordinator receives all uncommitted server changes and this record. Changed files: `server/src/{app,auth,storage,transfers}.ts`, `server/test/{auth,interruption,storage,transfer}.test.ts`, new `server/test/download-lifecycle.test.ts`, `server/README.md`. No commits made by this agent; coordinator advanced shared HEAD during this stage to `b873b5ff844d99409d4bdb3ec40af019337c140d` on unchanged `feat/storagi`.

Auth/factory contracts unchanged: `createApp(config,options)` and return object unchanged; `auth.begin()` returns `{url,token}`; `auth.callback(token,URL)` returns `{token,csrf}`. Flow token is opaque AES-GCM ciphertext, canonical base64url<=1024chars;10min expiry. Persistent key lives in `secrets(name='flow-key',value BLOB)`, replay ledger in `flow_replays(hash,expiresAt)`; no environment additions. Successful-only replay limit1,000, reject429 at capacity with no eviction; malformed/expired/swapped flow and reused success reject; invalid/nonowner callbacks do no writes. Protected API/CSRF/Host/Origin boundaries and signed Google owner checks retained.

Changed flows for acceptance: paused full/ranged download with parallel range, DELETE and expiry cleanup; immutable validators/If-Range; retired-file quota and idle timeout; half-open PATCH HEAD takeover and both delete routes; preserved broken-socket/restart and refreshed-cleanup race; anonymous flow flooding, sealed-flow restart/tampering/binding/concurrent replay; authenticated login navigation; bidi filename rejection/ordinary Unicode acceptance. Coordinator should perform planned independent/browser/large acceptance, update central index, commit and fresh review before PR workflow. No active backend commands or runtime service left for acceptance to conflict with.

Coordinator reconciliation: task `node:delegated-task:command%3Amcp%3A84bfb7a9-ff9d-4f5a-9ea2-fc37786fe042%3Adelegate-task%3Astoragi-stage08-backend-review-fixes`; matching `thread:delegated-task:` child. T3 task_status confirms completed codex/gpt-6.1-sol; stable source for acceptance11.
