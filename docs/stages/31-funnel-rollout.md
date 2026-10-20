# 31: Conditional Funnel rollout

- Status: completed; Funnel active,9 public-relay checks passed and owner confirmed Inbox access with client Tailscale disconnected.
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

If any Funnel or access-security blocker occurs, disable only Storagi's public flag and restore its private route. Never reset Serve/Funnel globally. No persistent service/reboot, real-device background transfers, multi-GB WAN throughput or host power changes are implied. Activation and actual evidence are recorded below; this was initially a plan.

## Real-account prerequisite results

On 2026-10-20T19:43:44+08:00 the owner explicitly reported that the real owner account reaches the Inbox and that Storagi rejects a DIFFERENT Google account after redirect back. These are owner-observed real private-browser results, not a coordinator-captured session trace or synthetic proof. Earlier anonymous213/15 and browser checks passed; final probe review35 PASS confirms both optional harness findings fixed. This fulfills the staged approval's real-login/denial condition. No account identifiers are recorded.

Before mutation, coordinator rechecked the exact owned443 private route points only to loopback8787, real app alive, TLS dashboard200 and no enabled Funnel. Private before snapshot retained outside Git. Current PR#3 CI is still pending; no false green claim. Application code is unchanged from the previously verified/reviewed merged app; optional probe14 regressions and live213/15 have passed locally and independent35 review passed.

## Activation and verification

- Rechecked before snapshot exactly matched current private configuration, then executed tailscale funnel --bg --https=443 --yes http://127.0.0.1:8787 under the existing conditional approval. CLI exit0. No new authentication policy, host account, system service, firewall/router or power change.
- Private before/after snapshots prove TCP and Web route dictionaries unchanged. Removing only Storagi443's now-true AllowFunnel entry reproduces the complete previous configuration. All other mappings, including private synthetic preview5174, preserved. Result metadata retained privately in stage31-activation-result.json.
- Queried Google public DNS over HTTPS for the configured hostname, required a global IPv4 relay address and connected directly to it using TLS SNI plus certificate/hostname validation. This bypasses the source host's MagicDNS/private100.x route, while the source host itself remains Tailscale-connected. Actual addresses/hostname and raw response data are omitted from public evidence.
- Public relay9 checks PASS: root200/no mock banner; anonymous session/list/download/tus HEAD/PATCH/POST401; forged-cookie file list401; hostile-Origin file list403. All checked no-store and nosniff. Generated UUID probe only, no owner payload/session or completed OAuth flow.
- Sanitized proof: "$HOME/.cache/storagi/stage31-public-relay-proof.json"; source host still connected is explicitly recorded. This is public-relay-path proof, not an independent off-tailnet device or throughput measurement.
- Owner asked to disconnect Tailscale on the browsing device only, leave the host's Tailscale running and confirm owner Inbox access through Funnel. The owner subsequently confirmed success; see the completion entry below.
- Runtime remains the detached trial app from29, with private persistent DATA_DIR; no installed reboot-persistent app service or host sleep changes. Rollback converts only443 back to private Serve or removes that route and stops only the recorded trial process; other mappings and data retained.
- Last updated: 2026-10-20T19:46:08+08:00.

Closeout publication: independent36 review PASS with actual Astra/high native proof and read-only cleanup confirmed. A coordinator closeout record had an extra EOF blank line caught by whitespace validation; normalized before the final validation/push. Previous acd3f5f CI passed, newer pushed-head CI is observed separately. No application change or extra service/network action.

External-tool attempt: the web fetch tool could not retrieve the public origin and returned “is not accessible via this tool,” without an HTTP status or network diagnosis. This failed attempt is retained; it does not establish an application/Funnel failure or independent-device success. The9 direct public-relay checks remain passed. The later owner-reported successful browser check is recorded below.

## Owner off-tailnet browser completion

On 2026-10-20T21:25:06+08:00 the owner answered “Works with Tailscale disconnected” to the request to disconnect only the browsing device, leave the host Tailscale running and load the real owner Inbox at the Funnel origin. Record this as owner-observed client-disconnected browser success, not an agent-captured network trace. Together with owner-reported owner login/other-account denial and coordinator public-relay9 checks, this completes the approved staged private-to-Funnel rollout. No device/OS/network type, transfer throughput or authenticated file-operation result was reported.

README/current index now reflect that completed result. This is a coordinator factual handoff update after independent36 review, not an additional reviewer-observed device check; application/probe/service configuration unchanged. Reboot-persistent app service, real WAN/device file transfers and browser interruption/background behavior remain pending. Preserve the earlier external web-tool failure as history; the owner's success is separate evidence.
