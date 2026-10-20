# 37: Custom-domain follow-up coordination

- Status: integration/publication completed; PR#4 CI observation pending, owner transfer results in42.
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

## Integration and later owner direction

Stage38 completed its bounded two-file research handoff; coordinator independently confirmed native openai/gpt-6.1-sol/high from session metadata line1 and turn_context line8. No actual custom-origin change is selected or authorized by that assessment. Owner subsequently says “next we go” to proposed persistent startup/recovery and real WAN transfers. Branch renamed feat/storagi-autostart before publication; scopes39–42 planned in the index before delegating39. Stage39 prepared its unit/guide without host mutation and its actual gpt-6.1-sol/high session was independently checked. Coordinator41 separately prepares a versioned exact-copy runtime; fresh40 reviews committed service and research before activation. This broader operational follow-up does not authorize DNS/Cloudflare changes.

## Publication

Branch feat/storagi-autostart pushed normally, PR [#4](https://github.com/WilsonXY/storagi/pull/4) created against main and immediately linked to T3. Main remains39179ed, no merge/tag/default push/force update. Reviewed unit unchanged; source/runtime/credentials/data unchanged by publication. Full baseline61 checks/types/builds, native unit check, independent43 review and44 applied acceptance PASS, actual Astra/high confirmed in both own native logs, primary40 Claude API limit retained. Owner post-handoff Inbox PASS recorded42. Public-safe staged path scan111files zero matches and whitespace check passed. Current published bb08283 CI queued/in-progress on fresh gh read, not claimed green. Next docs-only log commit records publication then T3 watches its actual head; final CI result belongs PR#4 and closeout report. Browser screenshots not applicable to native service-only change; no changed UI or new pixel proof claimed.
