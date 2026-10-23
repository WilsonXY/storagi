# 101: Tunnel throughput and route collision investigation

- Status: completed investigation; research only, no migration or benchmark.
- Date: 2026-10-23 +08:00.
- Coordinator: T3 thread `f68c7bfe-052b-47c5-8f82-e2df7d42e7d4`, runtime identifies Codex `gpt-6.1-sol`, high effort.
- Owner request: investigate replacing the shared Tailscale hostname with Cloudflare Tunnel; observed downloads average 1.6–1.7 MB/s and peak around 2.5 MB/s (byte units assumed, not confirmed).
- Scope: current primary-source limits, repository transfer behavior, bounded read-only status, recommendation and a reproducible comparison plan.
- Boundaries: no deployment, exposure, DNS/OAuth/service/Serve/Funnel changes, reading file contents from the live shelf, or benchmark that publishes an endpoint.

## Coordination

- Coordinator owns this record, the index and final synthesis.
- Stage102 is a distinct read-only research task: independently verify published throughput, upload/download limits, public-hostname large-file policy and private-route distinction. Its prompt named this record and required primary links, explicit uncertainty and no writes. Completed; it independently reached the same conclusion, recorded in [102](102-tunnel-limits-research.md).
- Acceptance: distinguish bytes from bits, body-size from speed, caching from download limits, documented claims from unmeasured WAN performance; identify whether replacing ingress addresses shared-route ownership; leave live service unchanged.

## Checks and findings

- Read README, design record, implementation log and previous custom-domain feasibility assessment before work.
- Application uploads use 8 MiB tus chunks; downloads stream from disk with byte ranges and no-store responses.
- Read-only live checks: Tailscale 1.102.3, cloudflared 2026.10.3, `storagi.service` active. Serve status has 16 HTTPS listeners, each with one root handler to a loopback proxy, and one enabled public Funnel listener. Historical stage31 assigns Storagi port443 to loopback8787. This supports the shared-configuration collision risk, but does not establish the cause or actor behind past overwrites. Hostnames and unrelated proxy targets were omitted from output and records.

## Decision and throughput evidence

Do not migrate Storagi's multi-GB ZIP/MP4 workload to a free Cloudflare public-hostname Tunnel on the strength of current research. No numeric speed disadvantage was established; its documented large-file policy is the stronger obstacle under the agreed $0 additional service budget. Retain the current route while choosing how to isolate ingress ownership.

- [Funnel limitations](https://tailscale.com/docs/features/tailscale-funnel#requirements-and-limitations) document non-configurable bandwidth limits without a numeric ceiling. The owner's 1.6–1.7 MB/s average and 2.5 MB/s peak cannot identify that ceiling or prove Funnel is the bottleneck.
- No numeric per-tunnel MB/s cap or minimum throughput guarantee was found in the reviewed [Cloudflare account limits](https://developers.cloudflare.com/cloudflare-one/account-limits/#cloudflare-tunnel), [Tunnel FAQ](https://developers.cloudflare.com/cloudflare-one/faq/cloudflare-tunnels-faq/) and [sizing guidance](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-availability/system-requirements/). Unknown is not unlimited; private-network sizing examples are not public-download benchmarks.
- Assuming decimal MB/s, the owner's observation corresponds to 12.8–13.6 Mbps average and 20 Mbps peak. If copied from the new frontend, its `web/src/formatting.ts` uses MiB/s: those numbers instead correspond to about 13.4–14.3 Mbps and 21.0 Mbps. The actual display/source was not confirmed. No upload baseline was supplied.
- Downloading from Storagi consumes the host's internet **upload** capacity; uploading to Storagi consumes the sending device's upload and host's download capacity. ISP bandwidth, congestion, network path and host load could explain the figures. A home uplink around the observed peak is one hypothesis, not an observed subscription limit.

## File compatibility and policy

- [Cloudflare's request-size guidance](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/4xx-client-error/error-413/) gives Free/Pro 100 MB per request, possibly reduced by zone settings. Storagi's 8 MiB tus PATCH requests fit the default. The whole file can exceed 100 MB because it uses separate requests; HTTP chunked transfer encoding alone is not an exemption.
- [512 MB cacheable size](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/#cacheable-size-limits) is not a universal maximum download size. Storagi sets `Cache-Control: no-store`, so a CDN cache speedup should not be assumed.
- [Connection limits](https://developers.cloudflare.com/fundamentals/reference/connection-limits/) and [524 guidance](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-524/) describe proxy read/write/idle timeouts. A read timeout is not a blanket maximum total duration for a continuously streaming download. Tunnel's [origin parameters](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/origin-parameters/) govern a different hop. Storagi itself has a 30-second download inactivity timeout (`server/src/app.ts`). Validate stalls and slow transfers on the actual route.
- Most decisively, the [Tunnel FAQ's large-file section](https://developers.cloudflare.com/cloudflare-one/faq/cloudflare-tunnels-faq/#large-file-and-streaming-traffic-through-tunnel) explicitly says public-hostname routes on Free/Pro/Business require a specific paid service for video and other large files. Its linked [Application Services terms](https://www.cloudflare.com/service-specific-terms-application-services/) permit delivery restrictions. No exemption for owner-only Google login, Access protection, or disabled caching was established. The FAQ does not define a numeric large-file threshold.
- The FAQ exempts private network routes from this restriction, accessed through Cloudflare One Client, Mesh or WAN. That does not establish a replacement for the current browser-only public link.

## Domain and collision options

- [Cloudflare public-hostname routes](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/) support a domain such as `storagi.example.com`, pointing at the loopback app. Use a dedicated tunnel identity/configuration and narrowly owned route to avoid recreating the shared-configuration problem. A new hostname alone cannot prevent an agent or process with configuration access from replacing it.
- An independent Tailscale node dedicated to Storagi is a candidate to separate it from the host's shared Serve state. Tailscale documents [multiple node identities on one machine](https://tailscale.com/docs/concepts/tailscale-identity) and [container hostname/state/Serve configuration](https://tailscale.com/docs/features/containers/docker/docker-params). Feasibility inference only: would require a separately reviewed rollout, persistent identity, permissions, local backend reachability, and new-origin OAuth checks. It retains a `.ts.net` name and Funnel limits; it is a collision remedy, not full Tailscale independence or a speed fix.
- A true custom domain without this public-proxy policy could use direct HTTPS to home, with Cloudflare DNS in DNS-only mode if desired. Current inbound reachability, CGNAT/port forwarding, IPv4 availability and remote-client IPv6 support were not established; it is not a ready deployment. Paid relays remain outside the existing budget.
- Native Funnel still requires a tailnet-domain name. A plain DNS alias does not provide custom-host TLS/routing. See [earlier feasibility](../custom-domain-feasibility.md) for application origin and rollback dependencies.

## Concrete comparison plan if the Cloudflare route becomes eligible

This is a test specification, not a request to expose a route or a claim that it ran.

1. Establish workload/plan eligibility and owner approval for a temporary hostname and exposure. Preserve existing mappings and production. Use the same deployed app version in an isolated pilot with its own loopback port, data directory and real owner-only Google configuration; never run two processes against the production data directory.
2. Register the pilot's exact Google callback and configure its `PUBLIC_ORIGIN`; retain all Host/Origin/CSRF and owner checks. Confirm anonymous and wrong-account denial and no-store downloads. Different-origin cookies and tus recovery records do not migrate automatically.
3. From one genuinely external device with Tailscale disconnected, alternate at least three upload and download runs per route using identical known-hash, incompressible test files. Start with 512 MiB, then validate representative 2+ GiB ZIP/MP4 transfers. Repeat on another external network or at another time to identify path sensitivity. Avoid simultaneous transfers that compete for the home uplink.
4. Record exact bytes, full-transfer elapsed time, sustained MB/s/MiB/s, first-byte latency, interruptions/retries, SHA-256, host load and whether the client used public Funnel rather than private Serve. Compare uploads and downloads separately; a brief peak is not the primary result. Measure host uplink separately to distinguish a home-line limit from relay performance. A same-host request is not a substitute for remote WAN evidence.
5. Verify tus pause/reselect/resume, byte Range/If-Range, transfers lasting over 125 seconds, and controlled stalls on disposable pilot files. Do not assume the frontend resumes interrupted downloads merely because the server supports Range.
6. Suggested decision gate, subject to owner preference: candidate median sustained speed at least 90% of paired Funnel baseline in both directions, no repeatable stalls/corruption/auth failures, and acceptable terms/cost. A 1.6–1.7 MB/s baseline implies roughly 1.44–1.53 MB/s for that provisional tolerance; remeasure the baseline in the same session. Remove only pilot resources after the experiment; verify production access and original route configuration.

## Validation and remaining uncertainty

- Coordinator and independent task agree on primary-source distinctions; documentation whitespace/local links and path privacy checked. Application tests were not run because source code was unchanged.
- No DNS, OAuth, service, Serve/Funnel, firewall, power or exposure changes; no live shelf content read. Research notes are local workspace edits; nothing committed, pushed or deployed.
- Real Cloudflare speeds, home bandwidth, numeric Funnel cap/sharing scope, exact previous collision causes, domain/account permission and Cloudflare workload entitlement remain unverified. Recommendation is policy/architecture based, not an A/B performance result.

## Failures and limits

- Initial lookup used two incorrect historical stage filenames and a nonexistent server entry filename; corrected using the stage index and source enumeration. No changes resulted.
- No end-to-end Cloudflare/Funnel comparison has been run; the owner's numbers are observational evidence, not proof of a relay cap.
