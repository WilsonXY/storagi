# 39: Persistent user service preparation

- Status: planned.
- Started / last updated: 2026-10-20T22:51:47+08:00.
- Coordinator thread: [implementation](t3-thread://v1/mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a).
- Owner: distinct implementation task; coordinator owns live activation/index/commits.
- Actual model/effort: unverified until own native evidence.
- Scope: deploy/storagi-user.service, docs/user-service.md and this record only. Existing system template/app/dependencies unchanged.

## Design and acceptance

User manager is already running with linger enabled; no administrator access required or global linger change. Use a standard user service with explicit private environment, stable current symlink to a versioned runtime release, Restart=on-failure, bounded restart delay, UMask0077 and compatible NoNewPrivileges. Native unit behavior replaces custom supervisor/installer logic. Keep existing DATA_DIR/owner configuration; no file, SQLite or session migration, and no Funnel/DNS change. Actual code lives separately from data and mutable developer build; release is an exact copy of already-validated runtime artifacts/dependencies.

Coordinator prepares a candidate at the documented portable user path before switching. Agent must not start/stop/enable/install a live service or access credentials/data. Validate unit natively and document preflight/release layout, clean handoff, recovery/rollback, journal privacy, existing linger versus unverified cold boot, network-discovery startup retries and user-context isolation limits. No implementation-mirroring test suite for a small native unit. Record actual commands/results/failures and own native runtime evidence; stable freeze for40.

## Outcome

Pending.
