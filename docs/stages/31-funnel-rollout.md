# 31: Conditional Funnel rollout

- Status: planned, not activated.
- Owner/task: coordinator conditional public activation/integration.
- Provider/model/effort: coordinator Codex gpt-6.1-sol/high from injected runtime; no separate agent claimed.
- Coordinator thread: [implementation](t3-thread://v1/mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a).
- Started / last updated: 2026-10-20T19:14:00+08:00.
- Starting baseline: merged origin/main1b5cceca905aa1453b9551ee8224307f1a4af97a, new chore/private-rollout branch; production source unchanged.

## Authorization and prerequisites

The owner's “approve” authorizes Funnel only after private real Google login and access-denial checks pass. This is the agreed browser-only network candidate, with private Tailscale fallback for any blocker. Stage29 private startup, stage30 live checks and real owner/separate-account results must be documented before activation. No automatic switch based merely on enrollment or synthetic code tests.

## Planned scope

Use only the new Storagi HTTPS443 route to the real loopback8787 app. Preserve other private mappings, especially synthetic preview5174. Retain private before/after configuration snapshots and verify only Storagi's public flag/route changes. Test externally without a Tailscale-connected client where actually available; distinguish configuration success from proven independent-network access and throughput. Do not expose static credential/config/data directories.

## Rollback and limitations

If any Funnel or access-security blocker occurs, disable only Storagi's public flag and restore its private route. Never reset Serve/Funnel globally. No persistent service/reboot, real-device background transfers, multi-GB WAN throughput or host power changes are implied. Nothing activated by this plan.
