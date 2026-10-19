# Local build and owner setup

This application is not deployed. No Funnel endpoint, Serve mapping, router/firewall rule, or host power setting has been changed. Development and tests bind loopback. Production expects an HTTPS origin in front of its loopback listener.

## Build and verify

Use Node 22.22 or newer on Node 22 (matching the verified host) and npm. The two packages have committed lockfiles. From the repository root:

```sh
mkdir -p "$HOME/.cache/storagi/tmp"
export TMPDIR="$HOME/.cache/storagi/tmp"
npm run setup
npm run check
```

The root check runs behavior/security tests, TypeScript checks and both builds sequentially. There is no separate lint configuration. Tests use temporary synthetic objects and a signed test OIDC provider; they never require owner files or real Google credentials. Browser mock checks are separate and are not proof of real Google login.

## Required Google configuration

Create a Google OAuth web client in an owner-controlled Google project. Use only the `openid` identity scope. Register exactly `<PUBLIC_ORIGIN>/auth/callback` for the chosen final HTTPS origin. Google's test-user list is not Storagi authorization. The owner must explicitly configure their permanent Google `sub`; no visitor can enroll themselves through the application.

The checked-in server environment example documents required values. Store the completed environment outside Git, readable only by the service owner; never put credentials in issues, stage records, screenshots or a PR. Required values are `PUBLIC_ORIGIN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OWNER_GOOGLE_SUB` and absolute `DATA_DIR`. Default budget is 214748364800 bytes (200 GiB), with 1 GiB additional filesystem headroom and loopback port 8787. DATA_DIR must be persistent storage outside the public web directory and outside `/tmp`.

Owner-binding command and final startup instructions will be reconciled with the completed service before handoff.

## Prepared service configuration

`deploy/storagi.service` is a reviewable systemd template for this machine; it has not been installed, enabled or started. It uses the existing owner account, an external environment file, restrictive filesystem permissions and a dedicated writable data directory. Confirm the Node executable path and replace paths when installing elsewhere. Only one service process may write the data directory. Build first; the server serves the built dashboard from `web/dist`.

The proposed environment path is `$HOME/.config/storagi/environment`; the writable data path is `$HOME/.local/share/storagi`. Create these with owner-only access as part of an approved deployment. Set DATA_DIR to that writable path when using the supplied unit. The service does not source shell profiles or automatically read a developer `.env` file.

## Network and deployment acceptance still required

Choose an unused HTTPS mapping without changing existing mappings. Tailscale Funnel is the candidate; private Tailscale is the accepted fallback for any Funnel blocker. Neither network path replaces the application login. Google registration must match the actual origin. Do not activate exposure until the local application and its configuration have been reviewed and deployment approved.

Before relying on it, exercise the real Google owner login and a different account; verify every direct file endpoint is denied to anonymous/other users. Transfer representative multi-GB ZIP/MP4 objects with hashes, interrupt and reselect on Windows/Fedora/Android, measure throughput from intended networks, test restart recovery and confirm host awake behavior. Synthetic tests and a responsive desktop browser do not establish those real-device/network properties.
