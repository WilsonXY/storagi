# Local build and owner setup

These instructions cover a new installation. The approved Funnel access is recorded in the [rollout record](stages/31-funnel-rollout.md); the service runs under a dedicated system account, described with its deploys and migration in the [system-service guide](system-service.md). The earlier user service (stage41) is superseded. Development and tests bind loopback. Production expects an HTTPS origin in front of its loopback listener.

## Build and verify

Use Node 22.22 or newer on Node 22 (matching the verified host) and npm. The root development tools and both application packages have committed lockfiles. From the repository root:

```sh
mkdir -p "$HOME/.cache/storagi/tmp"
export TMPDIR="$HOME/.cache/storagi/tmp"
npm run setup
npm run format:check
npm run check
```

The root check runs behavior/security and independent HTTP acceptance tests, deploy-script tests, TypeScript checks and both builds sequentially. There is no separate lint configuration. Tests use temporary synthetic objects and a signed test OIDC provider; they never require owner files or real Google credentials. Browser mock checks are separate and are not proof of real Google login.

See [formatting and staged secret checks](../README.md#formatting-and-secret-checks) for the pinned formatter, verified Gitleaks installation and checks to run before committing. CI also scans full Git history.

## Required Google configuration

Create a Google OAuth web client in an owner-controlled Google project. Use only the `openid` identity scope. Register exactly `<PUBLIC_ORIGIN>/auth/callback` for the chosen final HTTPS origin. Google's test-user list is not Storagi authorization. The owner must explicitly configure their permanent Google `sub`; no visitor can enroll themselves through the application.

The checked-in server environment example documents required values. Store the completed environment outside Git, readable only by the service owner; never put credentials in issues, stage records, screenshots or a PR. Required values are `PUBLIC_ORIGIN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OWNER_GOOGLE_SUB` and absolute `DATA_DIR`. Default budget is 214748364800 bytes (200 GiB), with 1 GiB additional filesystem headroom and loopback port 8787. DATA_DIR must be persistent storage outside the public web directory and outside `/tmp`.

For controlled owner binding, register the additional loopback callback `http://127.0.0.1:8989/callback` on the same web client. After building, run the standalone local command from `server/` with GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET supplied through the private process environment:

```sh
node dist/src/enroll.js
```

Open its printed Google URL on this machine, select the intended owner account and copy the verified subject into the private environment as OWNER_GOOGLE_SUB. The CLI checks the signed Google identity with state, nonce and PKCE, listens only on loopback, times out after ten minutes, and never changes application ownership/configuration automatically. It does not log tokens. The actual Google registration/flow still needs owner verification.

### Enrollment from another computer over SSH

Keep the CLI on the host and open the Google URL in your own computer's browser. In a separate local terminal, forward its registered callback to the host:

```sh
ssh -N -o ExitOnForwardFailure=yes \
  -L 127.0.0.1:8989:127.0.0.1:8989 user@storagi-host
```

Replace the SSH destination with your normal one and leave that terminal running. The `-N` terminal has no remote shell: run the enrollment CLI in a separate SSH session. Complete Google sign-in within the CLI's ten-minute timeout, then close the forward with Ctrl+C. Never paste credentials, callback codes or enrollment output into public records. Enrollment verifies an identity; explicitly configure the intended owner's verified subject before starting the app.

To run the built app with the private environment loaded, use `npm start` from the repository root. It binds `127.0.0.1:8787` by default; all production login/file cookies require the configured HTTPS origin. `DATA_DIR` and the public dashboard build directory must be separate. Do not substitute dummy identity credentials or disable authentication to obtain a live preview.

## Service configuration

[`deploy/storagi.service`](../deploy/storagi.service) is the system service: a dedicated `storagi` account and group, root-owned read-only releases under `/opt/storagi` with `current` pointing to one, credentials at `/etc/storagi/environment` (root, mode 0600; the system manager reads it before switching to `User=storagi`) and private writable data at `/var/lib/storagi` (`storagi:storagi`, mode 0700, `DATA_DIR=/var/lib/storagi`). The unit's sandbox makes everything else read-only and hides home folders, so code, dependencies and data must be at these system locations; systemd directives use literal absolute paths. Only one process may write the data directory. Installation, deploys and the migration from the earlier user service are in the [system-service guide](system-service.md).

The service does not source shell profiles or automatically read a developer `.env` file. The Google flow-cookie encryption key is generated once and persisted privately in the same SQLite store; no additional key environment variable is needed. Keep the entire data directory private. Deleting/expiring a file removes it from the Inbox immediately; if an accepted download still has it open, its bytes remain counted until the last descriptor closes or its idle timeout fires. This prevents extra uploads from exceeding the budget while deleted data is still on disk.

## Network and deployment acceptance still required

Give Storagi [its own Tailscale node](tailscale-node.md) rather than a mapping on the host's shared Serve settings. Tailscale Funnel is the candidate; private Tailscale is the accepted fallback for any Funnel blocker. Neither network path replaces the application login. Google registration must match the actual origin. Do not activate exposure until the local application and its configuration have been reviewed and deployment approved.

Before relying on it, exercise the real Google owner login and a different account; verify every direct file endpoint is denied to anonymous/other users. Transfer representative multi-GB ZIP/MP4 objects with hashes, interrupt and reselect on Windows/Fedora/Android, measure throughput from intended networks, test restart recovery and confirm host awake behavior. Synthetic tests and a responsive desktop browser do not establish those real-device/network properties.
