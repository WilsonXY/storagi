# Storagi

A personal, self-hosted temporary file shelf for transferring artifacts between devices over LAN and the internet.

**Status:** design agreed; implementation authorized in a new thread. Every implementation stage and agent handoff must be documented.

The agreed first version provides:

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
