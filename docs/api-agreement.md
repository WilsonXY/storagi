# Initial implementation agreement

One Node 22+ process, TypeScript; maintained `openid-client` for Google OIDC and `@tus/server` + `@tus/file-store` for resumable disk transfers. Plain TypeScript browser dashboard with `tus-js-client` and Vite. SQLite persistence preferred; no separate database service. Packages under `server/` and `web/`, each owns its package manifest/lockfile; coordinator owns root commands. Service agent may adjust internals, but records reasons. This is a single process service: do not run multiple writers.

Same-origin endpoints (all JSON errors `{error: string}`):

- GET `/api/session`: 200 `{authenticated: true, csrfToken: string, name: string|null, picture: string|null}` or 401. `name` and `picture` come from the owner's last Google login (`profile` scope) and are only sent to an owner session; `picture` is only ever a `https://lh3.googleusercontent.com/` URL.
- GET `/auth/login`, GET `/auth/callback`, POST `/auth/logout` (CSRF token).
- GET `/api/files?q=...`: `{files: [{id, name, size, uploadedAt, expiresAt}], usedBytes, reservedBytes, budgetBytes}`. ISO timestamps; completed Inbox files only, newest first. UUID suffix displayed in UI to distinguish repeated names.
- GET `/api/files/:id/download`: protected attachment; byte ranges supported.
- DELETE `/api/files/:id`: deletes completed/partial file, CSRF header required.
- `/api/uploads` and `/api/uploads/:id`: standard tus creation/PATCH/HEAD/DELETE; cookie session on EVERY request. Known nonnegative Upload-Length required; reject deferred lengths and concatenation for simple atomic reservation. Metadata filename (base64 encoded by tus client). Creation Location same origin. Mutations require `X-CSRF-Token`; no cross-origin access.

Header `X-CSRF-Token` for every mutating API including tus POST/PATCH/DELETE. Login-only public shell is allowed; unauthenticated file endpoints never return file data. No production test-auth route, no default credentials or first-visitor owner enrollment.

200 GiB budget includes entire declared size of partial uploads reserved atomically before creation, completed content and filesystem free-space headroom. Store outside public web directory. Retention begins at completed upload time, expires in 30 days. Partial uploads expire after 24h inactivity; document exact policy and reject access at expiry. Cleanup at startup and periodically; safe against upload/delete/cleanup races. Restart recovery and error rollback must preserve quota correctness. Graceful termination; production HTTPS origin configuration, secure cookies, fixed callback URI; loopback HTTP for local tests only.

Service uses `web/dist` for built dashboard. `createApp`/service factory supports isolated synthetic test state without exposing a production authentication bypass. Web tests can mock endpoints in test-only harness; label screenshots accordingly. UI includes Google login, picker/drop, queue with progress/pause/resume/cancel and reselect instructions after restart, Inbox search, storage/retention copy, download and confirmed deletion, useful error/status states, accessible responsive controls.
