# 102: Independent Tunnel limits research

- Status: completed; read-only research, no implementation review claimed.
- Date: 2026-10-23 +08:00.
- Scope and acceptance: see coordinator [stage101](101-tunnel-investigation.md).
- Agent must not edit, commit, push, publish, change service/network configuration or inspect private credentials. Coordinator records its returned findings here.
- Task identity: `node:delegated-task:command%3Amcp%3Ada95b76c-1ba7-440d-938d-fffae219a67c%3Adelegate-task%3Astoragi-102-tunnel-limits-research-v1`; T3 reported provider `codex`, model `gpt-6.1-sol`, completed with no pending children.
- Agent's own injected runtime reported `gpt-6.1-sol`, high effort. Session-log proof was not collected; this is runtime-reported research metadata, not independently verified reviewer model/effort proof.

## Returned findings and coordinator checks

- Independent primary-source browsing found no numeric Cloudflare per-tunnel throughput cap/guarantee in reviewed sources and no numeric ceiling in Funnel's published non-configurable bandwidth-limit statement. No measured faster/slower verdict is supported.
- Confirmed Storagi's 8 MiB tus chunks fit Free/Pro's default 100 MB request limit. Confirmed 512 MB cache-object limit is not a universal download ceiling, and no-store responses do not promise cache acceleration.
- Distinguished proxy read-gap timeouts from total file duration and Tunnel origin connection settings; identified Storagi's own 30-second download inactivity timeout.
- Confirmed the current Tunnel FAQ explicitly applies video/large-file paid-service requirements to public-hostname routes and exempts private routes. Login/Access/no-cache were not established as exemptions. Recommends keeping Funnel under the present budget and browser-only requirement.
- Required paired external upload/download trials, known hashes, real multi-GB files, tus resume, Range, stalls/slow links, owner authorization and rollback before a migration verdict.
- Coordinator independently opened the cited Funnel limitations, Cloudflare FAQ, Application Services terms, request/cache/connection limits and sizing pages and inspected the relevant app code. Agrees with those distinctions. Full links and bounded test specification are in [101](101-tunnel-investigation.md).

## Outcome, failures and limits

- Completed without reported tool failures, writes, commits, publishing or runtime changes. Parent workspace status shows only coordinator's three documentation files changed; no source diff.
- No actual Cloudflare/Funnel benchmark, account entitlement check, ISP diagnosis or past-collision attribution. Child's decimal MB/s assumption is explicitly conditional; coordinator additionally records that the new frontend uses MiB/s.
