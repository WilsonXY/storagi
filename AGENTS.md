# Storagi agent instructions

Follow the owner's global profile at `$HOME/.codex/AGENTS.md`.

Read [README.md](README.md), the [design record](docs/design-and-feasibility.md), and the [implementation log](docs/implementation-log.md) before working.

## Project workflow

- Use distinct delegated agents for meaningful stages; plan ownership in the implementation log before delegating.
- Follow the log's recording rules and stage template, including coordination, reviews and failures. The coordinator maintains the index and writes read-only review records. Delegate prompts must name the stage record, scope and acceptance checks.

## Boundaries

- Work within this repository; preserve sibling projects, unrelated host services, private files, network mappings and power settings.
- Bind development servers to loopback. Deployment or exposure, including Funnel, requires explicit owner approval.
- Keep Google owner authorization fail-closed. Record missing real OAuth setup instead of inventing credentials or weakening authentication.
- Public files, PR text and proof must use repository-relative paths, quoted `$HOME` paths or portable examples. Never publish personal home paths, host usernames, credentials or private contents; keep literal local evidence outside Git.
