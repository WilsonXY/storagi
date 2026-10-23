# 106: Deeper public DNS investigation

- Status: investigation/test complete; new public DNS and verified public HTTPS pass without configuration changes, and owner confirms receiving-device access with Tailscale off. No production migration.
- Date: 2026-10-24 +08:00.
- Coordinator: T3 thread `f68c7bfe-052b-47c5-8f82-e2df7d42e7d4`, injected Codex `gpt-6.1-sol` / high.
- Owner explicitly asked to investigate why the new public address is missing. Prior temporary experiment authorization persists; the existing production route/authentication/data must remain intact. No external message is authorized.

## Plan, ownership and acceptance

- Coordinator owns this record, stage index, current DNS/record/relay comparisons and any concrete reversible experiment warranted by causal evidence. Stage107 is a new distinct read-only agent, investigating source/control announcements, differences between the working and test daemon, and matching primary upstream reports. Its prompt must name107 and these acceptance boundaries.
- Avoid repeating already-settled stage105 checks as new conclusions. New angles: a matching persistent-NODATA upstream report; serialized ingress-update delivery or re-registration conditions; relevant user-space/logging/netcheck differences; public record-type and authoritative-server consistency.
- No default-daemon mutations, production origin changes, private shelf reads, upgrades, new credentials, node rename/reset, account policy changes, external support contact or indefinite waiting. A temporary experiment mutation can be considered only after a ranked falsifiable hypothesis and preserve/rollback checks, and only on its explicit socket/PID.
- Completion requires concrete evidence for any claimed cause/fix, a normal public DNS/TLS check if successful, or a precise boundary of what cannot be observed locally. No hardcoded relay IP as a deployment workaround.

## Initial new findings

- The experiment remains Running/online with a home relay and no health warnings at00:30:46 +08. Its original tests and local ingress-generation proof remain in103–105.
- Newly found [upstream21698](https://github.com/tailscale/tailscale/issues/21698) reports a close match: Linux1.102.3, successful certificate provisioning, enabled Funnel/capabilities but authoritative NODATA for both A/AAAA. This is a user report, not maintainer confirmation of this host's root cause. [21829](https://github.com/tailscale/tailscale/issues/21829) is another public-DNS case whose follow-ups need inspection. No reset/upgrade is established as a fix.
- Distinct task `/root/funnel_announcement_investigation` owns [107](107-funnel-announcement-investigation.md), injected runtime Codex `gpt-6.1-sol` / high (not independently parsed session-log proof). Completed read-only source and runtime comparison.

## Observed recovery and acceptance

1. Stage105 recorded authoritative/recursive A+AAAA NODATA at00:25:10 +08,23.6 minutes after the initial00:01:34 Funnel enablement.
2. A new bounded record-type comparison completed00:32:55.620 +08: both original and experimental names now returned two A and two AAAA records from the authoritative server. Both names returned normal NODATA for CNAME/HTTPS/TXT queries. The expected address records had appeared; this was not a hidden CNAME or IPv6-only case. Raw private observations are in ignored `artifacts/dedicated-identity-test/deeper-public/record-type-probes.private.json`.
3. At00:33:38.930 +08, Google and Cloudflare public DNS both independently returned two global A and two global AAAA addresses for the experimental name. Coordinator connected to **each of its two advertised public IPv4 addresses**, retaining the new hostname as SNI/Host and ordinary TLS certificate verification: both returned200 and the exact synthetic marker. These addresses came from the experimental hostname's public DNS, unlike earlier diagnostic pinning to the original hostname's relay. Evidence: ignored `deeper-public/new-dns-and-public-https.json`.
4. No runtime/configuration, policy, hostname, DNS, log-upload or software change was made in this investigation. The exact publication moment is bounded by the last negative and first positive probes; it was visible within roughly31.4 minutes and verified through recursive DNS/TLS within32.1 minutes, not an exactly measured32-minute server operation.
5. Coordinator final preservation checks all passed: main Serve and identity equal original baseline, resolver hash unchanged, Storagi active, original dashboard200/session401. The experimental listener contains only native text, no app proxy or filesystem handler. Evidence: ignored `deeper-public/final-preservation.json`.
6. Owner received an async request to open the harmless experimental address with Tailscale off on the receiving device and confirm its marker. The owner replied: `Yes, the test text loads`. This is owner-observed normal browser access with Tailscale off on that device, distinct from coordinator probes originating on a Tailscale-connected server. Device type, network type, exact time, throughput and an independent trace were not supplied.

## What this explains and what it does not

- The operational blocker was public DNS returning no usable address; the same endpoint was already reachable through its public relay. Its disappearance/reappearance is a DNS publication/availability issue, not evidence of an application authentication or file-transfer failure.
- Records appeared without a local intervention, so enabling local DNS acceptance, turning on log uploads, changing userspace networking/port mapping, upgrading, renaming or clearing tailnet policy was not needed in this experiment. Stage107 verified the same running process retained those original options and found no logged local restart/login/ingress transition near recovery. A peer disco-key event alone is not proof of a causal control reconnect.
- Stage107 traced full Hostinfo serialization and successful update generation handling: the source retains `IngressEnabled` and retries failed updates. Existing logs prove local flag generation but not a particular field-level remote acknowledgement; even HTTP200 would acknowledge a request, not completed DNS publication. We cannot determine which Tailscale server-side queue, registration or authoritative replication state delayed visibility from these local observations.
- [21698](https://github.com/tailscale/tailscale/issues/21698) and [21829](https://github.com/tailscale/tailscale/issues/21829) are close primary firsthand reports of missing public address records despite enabled Funnel and certificate success, including other platforms/versions. They support that this failure pattern is reported upstream; they do not prove this incident shares an exact root cause. [21114](https://github.com/tailscale/tailscale/issues/21114) includes a reported registration-loss/reconnect problem, which is a distinct failure mode and not established here.
- One21698 commenter reports clearing/restoring tailnet `nodeAttrs` as a workaround. We did not do this: it would affect shared Funnel permissions and is not a demonstrated fix for this node. An upgrade likewise is not an established cure given reports on later versions. No external report was sent.

## State and next step

- The test address now passes ordinary public DNS discovery and verified public relay HTTPS. It remains a synthetic marker only; production stays at the original origin with its data/auth unchanged. No real-file or new-origin Google login test has occurred.
- Temporary daemon, persistent test identity and native text page remain as intentionally retained in104. There is no permanent unit or watcher. With owner receiving-device/Tailscale-off confirmation now passed, a separate reviewed migration can prepare restricted persistent daemon ownership, stable state, boot startup, exact Google callback/origin, file integrity/resume acceptance and rollback. This investigation does not perform that migration.
- No application source change, commit, push, PR, deployment or service installation. Documentation whitespace/privacy/local links checked; app test suite unnecessary for read-only/CLI observations.

## Failures and limitations

- An independent web-fetch tool could not access the public test URL and returned `is not accessible via this tool`, with no HTTP status. This is a tool availability limitation, not a failing HTTP response or independent-device proof. It does not override the successful direct public DNS/TLS checks.
- Exact upstream cause, longer-term availability, WAN speed, device transfer/background behavior and real application migration remain unverified. The earlier negative results and transient handshake failures remain preserved in103–105 rather than overwritten by this recovery.
