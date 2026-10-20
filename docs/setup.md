# Local build and owner setup

These instructions cover a new installation. The current owner-approved runtime trial and network state are recorded in the [rollout record](stages/31-funnel-rollout.md); the system service template below remains inactive. Development and tests bind loopback. Production expects an HTTPS origin in front of its loopback listener.

## Build and verify

Use Node 22.22 or newer on Node 22 (matching the verified host) and npm. The two packages have committed lockfiles. From the repository root:

```sh
mkdir -p "$HOME/.cache/storagi/tmp"
export TMPDIR="$HOME/.cache/storagi/tmp"
npm run setup
npm run check
```

The root check runs behavior/security and independent HTTP acceptance tests, TypeScript checks and both builds sequentially. There is no separate lint configuration. Tests use temporary synthetic objects and a signed test OIDC provider; they never require owner files or real Google credentials. Browser mock checks are separate and are not proof of real Google login.

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

## Prepared service configuration

`deploy/storagi.service` is an inactive, portable system service template. It has not been installed, enabled or started. The example uses a dedicated `storagi` account and group, built code at `/opt/storagi` (including `server/dist` and `web/dist`), credentials at `/etc/storagi/environment`, and private writable data at `/var/lib/storagi`. These are example deployment locations, not observed host configuration. Only one process may write the data directory.

Before any approved installation, provision the account/group and these directories, build both packages, and confirm `/usr/bin/node` is Node 22.22+ (or adjust `ExecStart`). The service account needs read/traverse access to the built code and dependencies, but should not own or write them. Keep `/etc/storagi` and its environment file root-owned and restricted (for example directory mode `0700`, file mode `0600`); the system service manager loads that file before switching to `User=storagi`. Precreate `/var/lib/storagi` owned by `storagi:storagi` with mode `0700` and set `DATA_DIR=/var/lib/storagi` in the environment. The service needs write access to that existing data directory; it does not need write access to `/var/lib`. `ReadWritePaths` permits writes through the unit's read-only filesystem sandbox, but does not create the directory or grant Unix permissions. `ProtectHome=true` blocks home-directory access, so code, dependencies and data must be available at the example system locations. Systemd directives use literal absolute paths; they do not expand shell `$HOME` variables.

After adapting the template, run `systemd-analyze verify deploy/storagi.service`; syntax validation is separate from account/path permissions, real credentials and live startup acceptance. No account creation, service installation or start is performed by these instructions' implementation stage.

The service does not source shell profiles or automatically read a developer `.env` file. The Google flow-cookie encryption key is generated once and persisted privately in the same SQLite store; no additional key environment variable is needed. Keep the entire data directory private. Deleting/expiring a file removes it from the Inbox immediately; if an accepted download still has it open, its bytes remain counted until the last descriptor closes or its idle timeout fires. This prevents extra uploads from exceeding the budget while deleted data is still on disk.

## Network and deployment acceptance still required

Choose an unused HTTPS mapping without changing existing mappings. Tailscale Funnel is the candidate; private Tailscale is the accepted fallback for any Funnel blocker. Neither network path replaces the application login. Google registration must match the actual origin. Do not activate exposure until the local application and its configuration have been reviewed and deployment approved.

Before relying on it, exercise the real Google owner login and a different account; verify every direct file endpoint is denied to anonymous/other users. Transfer representative multi-GB ZIP/MP4 objects with hashes, interrupt and reselect on Windows/Fedora/Android, measure throughput from intended networks, test restart recovery and confirm host awake behavior. Synthetic tests and a responsive desktop browser do not establish those real-device/network properties.
