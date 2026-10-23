# Storagi

A personal, self-hosted temporary file shelf for transferring artifacts between devices over LAN and the internet.

**Status:** implemented, verified and independently reviewed, including a 2 GiB+1 local restart/hash check. An owner-approved service is enabled with Google owner authorization and Tailscale Funnel; automatic crash recovery was verified. It ran as an owner user service; [stage67](docs/stages/67-system-account.md) moves it to a sandboxed system account through an owner-run migration. The owner confirmed Google owner login, rejection of another account and Inbox access with Tailscale disconnected on the browsing device; public relay checks passed. The owner reports the first real-device file test works and accepts boot autostart as working from the reviewed configuration, waiving a physical reboot test. Power/lid behavior is already configured and working by owner report. Exact WAN throughput/hash/resume measurements were not supplied. See the [rollout record](docs/stages/31-funnel-rollout.md) for evidence and limitations.

The first version implements:

- A custom, extensible web dashboard for Windows, Fedora KDE, and Android browsers.
- Deliberate uploads, a shared Inbox, newest-first browsing, filename search, downloads, and file management.
- Multi-GB ZIP and MP4 transfers using an existing resumable upload component.
- Automatic deletion of server copies 30 days after upload, with originals retained on their source devices.
- A 200 GiB storage budget that refuses further uploads when full and preserves separate files with repeated filenames.
- Google login restricted to the owner's account, enforced by the server for all file operations.
- Tailscale Funnel as the browser-only access candidate, falling back to private Tailscale access if Funnel has blockers.
- Hosting on the existing machine with a $0 additional hosting/service budget.

Read [the complete design, decisions, research, and feasibility record](docs/design-and-feasibility.md) before making implementation changes. It distinguishes agreed requirements from proposals and unverified assumptions.

Implementation agents must follow [AGENTS.md](AGENTS.md) and maintain [the implementation log and stage records](docs/implementation-log.md).

## Build and check

Use Node 22.22+ and npm. On this host, keep temporary artifacts under the home directory:

```sh
mkdir -p "$HOME/.cache/storagi/tmp"
export TMPDIR="$HOME/.cache/storagi/tmp"
npm run setup
npm run check
```

The check runs package tests, independent HTTP acceptance, deploy-script tests, TypeScript checks and production builds. The app reuses openid-client for Google OIDC and the tus Node server/client for disk-backed resumable transfers; SQLite keeps metadata, sessions and quota reservations. One process owns the data directory.

See [setup and deployment preparation](docs/setup.md), [repeatable verification and its limits](docs/verification.md), and the [implementation stage index](docs/implementation-log.md). Storagi runs as a [sandboxed system service under a dedicated `storagi` account](docs/system-service.md), deployed from owner-created tags with `scripts/deploy.sh` and the root helper `storagi-promote`, by hand or by the [auto-deploy timer](docs/auto-deploy.md) once a tag's CI passes; that guide also has the owner-run migration from the earlier user service (superseded, history in stages39–66). The owner-approved private startup and subsequent Funnel activation are recorded in stages29–31; unrelated host services, mappings and power settings were preserved.

Production startup requires explicit Google OAuth credentials, the owner's verified permanent Google subject, an HTTPS origin and a private persistent data directory. It fails closed without these; there is no password fallback, open registration or first-visitor ownership.

A true custom app domain is deferred; see the [feasibility assessment](docs/custom-domain-feasibility.md). Storagi's Funnel address now belongs to [its own Tailscale node](docs/tailscale-node.md), so other apps' Serve changes on the host can't replace it.
