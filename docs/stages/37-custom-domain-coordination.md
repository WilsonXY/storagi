# 37: Custom-domain follow-up coordination

- Status: in progress; assessment/documentation only.
- Started / last updated: 2026-10-20T22:43:01+08:00.
- Coordinator thread: [implementation](t3-thread://v1/mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a).
- Owner/task: coordinator scope, integration, independent review and publication.
- Provider/model/effort: Codex gpt-6.1-sol/high confirmed by injected runtime; no independent reviewer claimed here.
- Baseline/branch: merged main39179ed8b3f44efd9fd0b0d9399411ba110b09ca, new docs/custom-domain-assessment; initial status clean.

## Scope and decisions

Owner asks about a custom subdomain on their existing Cloudflare-managed domain. Current live access remains the working Funnel HTTPS URL and owner verified browser access without a Tailscale client. If genuine custom-domain service requires a different front door or substantial risk/validation, document it for next iteration as requested. No DNS/redirect/proxy/account/credentials/app-origin/service/network changes are authorized or performed by this assessment. Actual owner target is private; public examples use storagi.example.com.

Distinct stage38 owns the feasibility brief and its record: primary sources, Funnel TLS/hostname limitations, Cloudflare alternatives under0additionalhosting and multi-GB ZIP/MP4 constraints, migration/rollback acceptance and any small redirect-only alternative clearly distinguished. Coordinator owns central index and publication; fresh read-only review follows committed findings. Keep docs concise and avoid reworking the agreed application.

## Verification and limitations

Read project/global profile, README/design/log; fresh gh confirms PR#3 merged and git fetch updates origin/main. Initial broad source reads/search output were truncated; reread merged SHA and opened named official pages directly. No conclusions rely on truncated output. Current Tailscale docs state Funnel only uses tailnet DNS names. More complete evidence belongs in38. No owner DNS/account/config or unrelated cloudflared files inspected.

## Handoff

Research and record before deciding further implementation; existing app stays live. Practical remaining work from the merged rollout is persistent startup/restart setup and representative WAN/device transfer verification, separate from custom-domain adoption. No installation or reboot test implied.
