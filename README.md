# Storagi

Storagi is a personal, self-hosted file shelf for moving files between devices. Upload a file from one device, then open the same bookmarked dashboard on another device, on the home network or anywhere else, and download it.

It is temporary transfer storage, not an archive. Each server copy is deleted 30 days after upload, and the original stays on the device it came from.

## Features

- A custom web dashboard for desktop and phone browsers, built for Windows, Fedora KDE and Android.
- Uploads only happen when you choose files, through the file picker or drag and drop.
- One shared Inbox, newest first, with filename search, sorting, downloads and file management.
- Resumable multi-GB uploads (ZIP, MP4 and anything else) over the tus protocol.
- A 200 GiB storage budget. When it is full, uploads are refused; nothing unexpired is deleted to make room.
- Repeated filenames are kept as separate files, never overwritten.
- Sign-in with Google, restricted to the owner's account. The server checks it on every file operation, including direct file URLs. There is no password login, open registration or first-visitor ownership.
- Hosted on an existing home machine with $0 of extra hosting or service cost, reachable from any browser through Tailscale Funnel.

## Status

Storagi is in use. It runs as a sandboxed system service under a dedicated `storagi` account and is served through Tailscale Funnel from its own Tailscale node. New `v*` release tags are deployed automatically once their CI passes.

What has been checked:

- Automated tests, independent HTTP acceptance and independent code reviews, recorded per stage in the [implementation log](docs/implementation-log.md).
- A local 2 GiB + 1 byte upload, restart and SHA-256 check.
- The owner confirmed Google sign-in, rejection of another Google account, and Inbox access from a browsing device with Tailscale disconnected. Public relay checks passed.
- The owner's first real file transfer between devices worked.
- Automatic crash recovery was verified under the earlier user service, and the system unit keeps the same restart settings. The owner accepted boot autostart from the reviewed configuration and waived a reboot test.

Not yet measured: real WAN throughput, hashes and resume behaviour for large files, and interruptions on physical Windows, Fedora and Android devices. See the [rollout record](docs/stages/31-funnel-rollout.md), the [host rollout](docs/stages/74-host-rollout.md) and [verification](docs/verification.md) for evidence and limits.

## How it works

| Part      | Built with                                                                                      |
| --------- | ----------------------------------------------------------------------------------------------- |
| Server    | Node 22 and TypeScript; `openid-client` for Google sign-in, `@tus/server` for resumable uploads |
| Storage   | Files on disk; SQLite (`better-sqlite3`) for metadata, sessions and quota reservations          |
| Dashboard | Plain TypeScript, Vite and `tus-js-client`                                                      |
| Hosting   | A systemd service on loopback port 8787, published over HTTPS by Tailscale Funnel               |

One server process owns the data directory. The design, the alternatives considered and why they were rejected are in the [design and feasibility record](docs/design-and-feasibility.md).

## Repository layout

| Path       | Contents                                                    |
| ---------- | ----------------------------------------------------------- |
| `server/`  | The service: authentication, uploads, storage and expiry    |
| `web/`     | The dashboard                                               |
| `scripts/` | Acceptance tests, deploy and auto-deploy scripts            |
| `deploy/`  | systemd units and the sudoers rule used on the host         |
| `docs/`    | Setup, operation, verification, design record and stage log |
| `design/`  | Visual design explorations for the dashboard                |

## Development

### Build and check

You need Node 22.22 or newer (on Node 22) and npm. On this host, keep temporary files under the home directory, because `/tmp` is small:

```sh
mkdir -p "$HOME/.cache/storagi/tmp"
export TMPDIR="$HOME/.cache/storagi/tmp"
npm run setup
npm run format:check
npm run check
```

`npm run setup` installs the root development tools and both packages from their lockfiles. `npm run check` runs the package tests, the independent HTTP acceptance tests, the deploy-script tests, both TypeScript checks and both production builds. Tests use synthetic files and a signed test identity provider; they never need real files or Google credentials.

To run the built app, see [setup](docs/setup.md). It needs real Google OAuth credentials, the owner's verified Google account ID (`sub`), an HTTPS origin and a private, persistent data directory, and it refuses to start without them.

### Formatting and secret checks

`npm run format` formats the handwritten TypeScript, tests, CSS, HTML and JavaScript scripts in `server/`, `web/` and `scripts/`; `npm run format:check` checks the same files without changing them. Both use the local Prettier **3.9.10**, which CI also installs. Encoded brand data, icons, fonts, build output and evidence are excluded in `.prettierignore`, and prose and the design explorations are not formatted. Prettier cannot wrap every untagged HTML template, so verify the DOM and interactions separately after changing one by hand.

Secret scanning uses Gitleaks **8.30.1**. Install the official binary once. This Linux x64 example matches CI and verifies the archive against the SHA-256 from the [official release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1):

```sh
mkdir -p "$HOME/.cache/storagi/gitleaks-8.30.1"
(
  set -eu
  cd "$HOME/.cache/storagi/gitleaks-8.30.1"
  curl --fail --silent --show-error --location --retry 3 \
    https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz \
    --output gitleaks_8.30.1_linux_x64.tar.gz
  echo '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb  gitleaks_8.30.1_linux_x64.tar.gz' | sha256sum --check
  tar -xzf gitleaks_8.30.1_linux_x64.tar.gz gitleaks
)
export PATH="$HOME/.cache/storagi/gitleaks-8.30.1:$PATH"
gitleaks version # 8.30.1
```

On other platforms, download the matching archive from the same release and verify its checksum. Then, from the repository root, before each commit:

```sh
git add <files>
npm run secrets:check
git commit
```

- `npm run secrets:check` scans staged changes only, so stage new files and run it again after any edit. You can call it from your own pre-commit hook; none is installed for you.
- `npm run secrets:history` scans all Git history you have. CI fetches full history and runs it on pull requests and `main`, alongside the formatting and correctness checks. In a shallow clone it only covers what was downloaded.
- Both use Gitleaks' default rules and redact their output. No licence token, baseline or allowlist is needed.
- Never commit a secret report. Investigate findings privately, rotate any credential that was really exposed, and add only narrow, evidenced false-positive exceptions. Gitleaks honours inline `gitleaks:allow` comments, `.gitleaks.toml` and `.gitleaksignore`, so any change that adds one needs explicit review.
- When updating Gitleaks, change the local version, the CI version and the checksum together.

Tool references: [Prettier installation and CI](https://prettier.io/docs/install), [Gitleaks usage](https://github.com/gitleaks/gitleaks/tree/v8.30.1#usage).

## Deployment

Storagi runs as `storagi.service`, a sandboxed system service under a dedicated `storagi` account. Releases are built from owner-created `v*` tags with `scripts/deploy.sh` and switched in by the root helper `storagi-promote`, either by hand or by the auto-deploy timer once the tag's CI passes. The earlier user service is superseded; its history is in stages 39–66.

| Guide                                              | Covers                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Setup](docs/setup.md)                             | Google OAuth client, owner enrollment, environment and service settings          |
| [System service](docs/system-service.md)           | Layout, sandbox, manual deploys and the migration from the user service          |
| [Auto-deploy](docs/auto-deploy.md)                 | The tag-driven deploy timer, its threat model, install and releases              |
| [Tailscale node](docs/tailscale-node.md)           | Serving Storagi from its own node, so other apps' Serve changes can't replace it |
| [Custom domain](docs/custom-domain-feasibility.md) | Why a custom app domain is deferred                                              |

Exposure was approved by the owner; the private start-up and Funnel activation are recorded in stages 29–31. Unrelated host services, network mappings and power settings were left untouched.

## Working on Storagi

Read the [design and feasibility record](docs/design-and-feasibility.md) before changing behaviour; it separates agreed requirements from proposals and unverified assumptions. Agents must follow [AGENTS.md](AGENTS.md) and record their work in the [implementation log and stage records](docs/implementation-log.md).

## License

[MIT](LICENSE)
