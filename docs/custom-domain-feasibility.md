# Custom-domain feasibility

Assessed 2026-10-20; research only. Example: `https://storagi.example.com`.

## Recommendation

A custom app subdomain is feasible in principle, but **defer adoption to the next iteration**: it needs an evaluated
HTTPS ingress, not just a DNS alias. Preserve the working Funnel link and $0 additional hosting/service budget. The
owner has confirmed owner login, wrong-account rejection and Inbox access with client Tailscale disconnected
([stage31](stages/31-funnel-rollout.md)). Subsequent [service work](stages/41-service-activation.md) enabled the user
service and verified automatic failure recovery; real WAN file transfers and a cold reboot remain untested. Nothing
is switched or installed by this domain assessment.

## What the subdomain would mean

- **Native Funnel:** current [Tailscale documentation][funnel] permits only names in the tailnet domain. A DNS-only
  CNAME does not supply a custom certificate or Funnel route. The browser still uses `storagi.example.com` for TLS SNI,
  certificate identity and HTTP Host. DNS resolution does not rename that HTTPS identity ([TLS identity][tls],
  [SNI][sni]). This is a protocol-based inference, not a probe of the owner's domain.
- **Cloudflare Tunnel publishing:** [official publishing][publish] supports a custom public hostname to a local app
  without a paid Access plan. This is a different ingress, not native custom-domain Funnel. A Tunnel does not replace
  Storagi's Google owner authorization. Account permissions, route availability and suitability for this workload are
  unverified; see the limits below.
- **Cloudflare-proxied CNAME / Worker fronting Funnel:** possible proxy designs require separate browser TLS and
  upstream Funnel TLS, correct upstream SNI, and Host/Origin/callback behavior compatible with the app. Turning on the
  proxy alone does not establish these. [Origin Rules][rules] list Host/SNI overrides as Enterprise-only; they are not
  an assumed free fix. A Worker is a distinct candidate: [its Request API][request] constrains Host/`resolveOverride`,
  and [its limits][workers] include free request/CPU/memory quotas. Neither a working SNI/Host arrangement nor a $0,
  policy-compatible file proxy was demonstrated. These workarounds are unevaluated, not categorically impossible.
- **HTTPS redirect bookmark:** a later, separately authorized [redirect rule][redirect] could send a dashboard visit to
  the existing Funnel URL. The address becomes that URL; app origin, Google callback and app code stay unchanged. The
  redirect needs working custom-host HTTPS/DNS setup, but does not proxy uploads/downloads; clients use Funnel after
  navigation. It is not a persistent custom app origin.

## Large-file constraints are separate questions

[413 guidance][upload] gives Free/Pro a 100 MB request-body ceiling, reducible by zone settings. Storagi's 8 MiB tus
PATCH chunks can fit that ceiling; a multi-GB file spans many requests. HTTP chunked encoding alone does not evade a
per-request cap. Chunk size proves neither interruption recovery nor acceptable MP4/CDN use. [Caching
documentation][cache] gives a 512 MB Free/Pro/Business cache-object limit; that is not a universal maximum download
size. [Workers][workers] explicitly has no enforced response-body size limit and supports streaming, subject to resource
limits and disconnects. [Proxy connection limits][connections] and [Tunnel origin parameters][parameters] govern
different hops; neither guarantees a slow multi-GB transfer. Startup/idle/read/write behavior needs validation on the
chosen route.

The current [Tunnel FAQ][faq] explicitly applies paid-service requirements for video/large files to **public hostname
routes**, distinguishing private routes. The [Application Services CDN terms][terms] (updated 2026-09-28) describe, for
Free/Pro/Business CDN use, required paid services for video/large-file delivery and possible CDN restriction for
disproportionate non-page content. This is a policy concern distinct from byte limits, not a legal finding that every
Cloudflare service bans ZIP/MP4. Disabling caching or adding Access is not established as an exemption. Worker-specific
entitlement/terms and the owner's plan/features/permissions remain unverified. Do not select a paid VPS/service or
promise this workload fits the $0 budget.

## Bounded migration work for a later iteration

The origin is configurable, so a large application rewrite is not established. Concrete dependencies:
`server/src/config.ts:5` validates `PUBLIC_ORIGIN`; `server/src/app.ts:74` checks exact Host, `:88`/`:91` enforce
Origin/CSRF, and `:15`/`:17` set Secure host-only `__Host-` cookies. `server/src/auth.ts:20`/`:29` bind flow encryption
to origin; `:36`/`:38` use PKCE and the origin callback. `web/src/transfers.ts:24`, `:64` and `:106` constrain
same-origin resumable URLs, 8 MiB chunks and prior-upload lookup. tus browser fingerprints include endpoint and use
origin-scoped localStorage; old recovery records/cookies do not migrate automatically. Server data can remain, but
old-origin resume must not be promised.

Before an approved switch: choose a $0-compatible ingress; register exactly `https://storagi.example.com/auth/callback`
([Google][google]); explicitly configure `PUBLIC_ORIGIN`; validate TLS, Host forwarding, fresh owner login,
PKCE/cookies, session renewal/logout, wrong-account and anonymous denial on every file endpoint. Verify new-origin
upload/reselect/resume, multi-GB ZIP/MP4 upload/download hashes, Range/If-Range, interruption/restart/slow-link timeouts
and noncached file responses. Preserve data, the current Funnel mapping/link and old Google callback for rollback; if
changing the app's single origin makes the old link fail Host checks, restore the old origin/runtime before declaring
rollback successful. Recheck login and file access on the restored link. No dual-origin support or architecture is
chosen.

[funnel]: https://tailscale.com/docs/features/tailscale-funnel#requirements-and-limitations
[tls]: https://www.rfc-editor.org/rfc/rfc9525.html#section-6.1
[sni]: https://www.rfc-editor.org/rfc/rfc6066.html#section-3
[publish]: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/
[rules]: https://developers.cloudflare.com/rules/origin-rules/#availability
[request]: https://developers.cloudflare.com/workers/runtime-apis/request/
[workers]: https://developers.cloudflare.com/workers/platform/limits/
[redirect]: https://developers.cloudflare.com/rules/url-forwarding/
[upload]: https://developers.cloudflare.com/support/troubleshooting/http-status-codes/4xx-client-error/error-413/
[cache]: https://developers.cloudflare.com/cache/concepts/default-cache-behavior/
[connections]: https://developers.cloudflare.com/fundamentals/reference/connection-limits/
[parameters]: https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/origin-parameters/
[faq]: https://developers.cloudflare.com/cloudflare-one/faq/cloudflare-tunnels-faq/#large-file-and-streaming-traffic-through-tunnel
[terms]: https://www.cloudflare.com/service-specific-terms-application-services/
[google]: https://developers.google.com/identity/openid-connect/openid-connect
