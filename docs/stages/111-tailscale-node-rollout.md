# 111: Move to Storagi's own Tailscale node

- Status: completed. Storagi's public address is now `storagi.<tailnet>.ts.net`, served by its own node; the host node's old mapping is gone.
- Date: 2026-10-24 +08:00
- Coordinator: Claude Code in T3 Code, Anthropic Claude Opus 5.5, thread `f68c7bfe-052b-47c5-8f82-e2df7d42e7d4`. The owner ran every root step of [docs/tailscale-node.md](../tailscale-node.md) at the host, from a checkout of `main` at `5fb6a99` (PR #17). The coordinator ran no sudo; it ran the read-only checks below afterwards.
- Live release unchanged: v1.0.3. No tag or deploy was needed: deploys never install units or edit `/etc/storagi`.

## Timeline

- 01:28:14: `tailscaled-storagi.service` started (enabled at boot).
- 01:31:26: first Funnel event on the new node.
- 01:39:26: `storagi.service` restarted with the new `PUBLIC_ORIGIN`; `NRestarts` 0 since. Public DNS was therefore up within about 8 minutes of Funnel, against about 32 minutes in the stage 104 experiment.

## Coordinator checks (read-only)

- New node `Running` as `storagi.<tailnet>.ts.net`, key expiry disabled, running as its `DynamicUser` account. Funnel: `/` proxies `http://127.0.0.1:8787`.
- Public DNS (1.1.1.1) returns two addresses; the public new address returns 200 over verified HTTPS.
- On loopback, the app answers the new host with `/` 200 and anonymous `/api/session` 401, and rejects the old host with 400 on both.
- Host node: 15 Serve listeners (16 before), nothing on `:443`, no Funnel; the old address no longer answers. Only that mapping was removed.
- `storagi-test` is no longer in the tailnet.
- As the owner, without sudo, `tailscale --socket=… set --hostname=storagi` on the new node returned `Access denied: checkprefs access denied`: the owner's own processes cannot change Storagi's node, which was the point of the change.
- The node's log shows failed TLS handshakes offering obsolete protocol versions and ciphers through Funnel: internet scanners finding the new public name. One `tstun` interface-stats error is expected in userspace mode.

## Owner-confirmed

- `/etc/storagi/environment.before-node` deleted; the old redirect URI removed from the Google OAuth client.
- Phone test with Tailscale off: sign-in, upload, download and delete at the new address passed. The owner reported the test as done without a speed figure, so download speed through the new node is not recorded.

## Not verified

- A measured download speed through the new node versus the old 1.6-1.7 MB/s average.
- `systemd-analyze security` score of the installed unit (dropped from the guide in review 109).
