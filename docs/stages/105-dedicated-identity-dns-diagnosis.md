# 105: Dedicated identity public DNS diagnosis

- Status: read-only diagnosis complete; public DNS still absent, no demonstrated local prerequisite or configuration fix. Ordinary browser-only access through the experiment remains blocked.
- Date: 2026-10-24 +08:00.
- Coordinator: T3 thread `f68c7bfe-052b-47c5-8f82-e2df7d42e7d4`.
- Owner clarified the requirement remains ordinary browser access with Tailscale off on the receiving device. The original working Funnel route stays in place; private-only access is not an equivalent replacement.

## Ownership, scope and acceptance

- Distinct diagnosis agent owns this record and its own ignored evidence under `artifacts/dedicated-identity-test/diagnosis/`. Coordinator owns the implementation-log index and decisions.
- Read stages103/104 and the private experiment process/baseline evidence. Reproduce the public DNS failure, compare the experiment's local Serve/Hostinfo/Funnel announcement with the enrolled node/control-plane state using installed read-only CLI or local API and current primary sources as needed.
- Distinguish a demonstrable local announcement/configuration defect from upstream publication/replication uncertainty. Read sensitive local outputs into memory/private artifacts only, return whitelisted boolean summaries; never publish keys, raw preference Persist data, owner identities, hostnames, enrollment links or personal home paths.
- No state mutations, daemon restarts, policy changes, node rename, new identity, reset, software upgrade, production source/configuration/data access, sudo, message to others or nested delegation. Report a concrete proposed fix only if evidence supports it; otherwise prepare an unsent portable support summary and identify the external prerequisite.
- Acceptance: explain which announcement/control-plane facts are observable, which remain unknown, preserve baseline main Serve/identity/resolver and old anonymous access. A successful direct relay request is not ordinary public DNS success. Do not run an indefinite polling loop.

## Latest coordinator check

- At00:21:28 +08, experiment still Running and main Serve still exactly original; Google public A/AAAA still had no address answers. The read-only recheck is in ignored `coordinator-browser-only-requirement-recheck.json`. Original test results remain in103/104; no normal public-link success is claimed.
- Diagnosis agent: distinct `/root/dedicated_dns_diagnosis`, Codex `gpt-6.1-sol` / high according to injected runtime. This is runtime attribution, not independently parsed session-log evidence.

## Reproduction and differential checks

At00:25:10 +08, approximately23.6 minutes after first Funnel enablement, one bounded authoritative/recursive comparison reproduced the exact blocker. A direct recursion-disabled authoritative query returned authoritative NOERROR with zero A and zero AAAA records for the experimental hostname. Google recursive DNS also returned NOERROR without either address type. The original hostname returned two A and two AAAA records from both paths. This is NODATA, not an observed NXDOMAIN or a timeout. The earlier stages' two-authority comparison is not reclassified as a new check here.

Read-only local checks passed for both daemons: Running, fresh netmap (`Cached:false`), `SelfNode.MachineAuthorized:true`, Funnel and HTTPS capabilities,443 in allowed Funnel ports, the assigned hostname among control-provided certificate domains, and saved443 `AllowFunnel:true`. The experimental node remained a distinct identity in the same tailnet. These prove registration, relevant capabilities and local requested configuration, not successful public DNS publication.

Production checks passed: main Serve dictionary and identity equal the original baseline, resolver-file hash unchanged, `storagi.service` active, original normal HTTPS dashboard200 and anonymous `/api/session`401. No file/shelf contents were requested. Whitelisted evidence is private at ignored `artifacts/dedicated-identity-test/diagnosis/read-only-reproduction.json` (directory0700, file0600).

## Announcement evidence and its limits

- Existing ignored experiment logs `artifacts/dedicated-identity-test/daemon/daemon.log` and `artifacts/dedicated-identity-test/daemon/daemon.restart.log` record `Hostinfo.IngressEnabled changed to true` at00:01:34 on initial Funnel enablement and00:04:17 after the experimental daemon restart, respectively. This directly observes the live daemon generating the appropriate ingress flag. This stage did not restart anything.
- In the installed-version [Serve source](https://github.com/tailscale/tailscale/blob/v1.102.3/ipn/ipnlocal/serve.go), `maybeUpdateHostinfoFunnelLocked` derives `IngressEnabled` from enabled Funnel configuration. Its comments explain that this active flag tells control DNS records are needed; `WireIngress` may correctly be false while ingress is active. Requiring both flags true would be incorrect.
- The [backend source](https://github.com/tailscale/tailscale/blob/v1.102.3/ipn/ipnlocal/local.go) schedules a Hostinfo update when that flag changes and passes Hostinfo to the control client. This source trace plus the actual log is evidence of the intended local announcement path, not packet capture or a server-side acknowledgement of this particular field.
- `tailscale debug hostinfo` is unsuitable for confirming the daemon announcement: the [CLI implementation](https://github.com/tailscale/tailscale/blob/v1.102.3/cmd/tailscale/cli/debug.go) constructs fresh host information in the CLI process. Also, returned SelfNode Hostinfo omits `IngressEnabled` and `WireIngress` for **both** the known-working original and experimental node, so that omission cannot demonstrate an experimental defect.
- No inspected read-only API/log exposes an authoritative acknowledgement that control accepted the experimental node's ingress flag and completed DNS publication. Fresh netmaps show continuing coordination, and the already-proven public relay forwarding shows the data path works when addressed deliberately; neither proves DNS registration.

## Hypotheses and outcome

1. **Local Funnel not enabled or node lacks permission:** contradicted by explicit443 public flag, capabilities, live ingress-change logs and earlier verified relay forwarding.
2. **Wrong enrollment, hostname or certificate-domain assignment:** contradicted by distinct same-tailnet identity, matching control-provided certificate domain and prior valid-TLS response.
3. **Only client DNS cache/IPv6 choice is wrong:** contradicted by authoritative NODATA for both address families while the original name resolves.
4. **Ingress update was not accepted, or upstream DNS publication did not complete:** remains plausible and unresolved; no server-side acknowledgement/publication state was available. The exact upstream component and root cause are unproven.

No evidence-backed local fix was found. Do not represent renaming, resetting, toggling Funnel, upgrading, changing policy or hardcoding a relay IP as demonstrated fixes. Known upstream issues [21156](https://github.com/tailscale/tailscale/issues/21156) and [20892](https://github.com/tailscale/tailscale/issues/20892) concern intermittent authoritative failures; their NXDOMAIN observations do not establish this persistent-NODATA case's cause. [Documented propagation guidance](https://tailscale.com/docs/features/tailscale-funnel#dns-propagation) allows up to10 minutes; the observed window exceeded that, without proving permanence.

The practical acceptance gate remains an ordinary public lookup followed by verified HTTPS from a receiving device with Tailscale off. Private Tailscale connectivity is not a substitute. Keep production at its working origin. If public records remain absent at a later owner-selected check, the evidence supports asking Tailscale to inspect ingress registration/public DNS publication. No external contact was authorized or attempted. Further local diagnosis is unlikely to prove upstream state without additional administrative/server-side evidence.

## Unsent portable support summary

> A fresh second Tailscale1.102.3 userspace daemon on Linux, enrolled in the same tailnet as an existing working Funnel node, cannot resolve through public DNS. State/socket are separate; only native synthetic text is served on HTTPS443. Both nodes are Running, authorized and have Funnel/HTTPS/443 capabilities; both have their assigned hostname in control-provided certificate domains and saved443 AllowFunnel=true. The experimental daemon logs IngressEnabled=true at2026-10-23 16:01:34 UTC and after restart at16:04:17 UTC. At16:25:10 UTC, direct authoritative recursion-disabled queries and Google recursive DNS return NOERROR/NODATA for the new name's A and AAAA, while the original name returns two records of each type. Previous checks found the same result across two authoritative servers. Verified TLS and the correct native marker succeed when connecting to a public Funnel relay with the experimental hostname explicitly pinned; normal public DNS remains absent. Please check whether the new node's ingress advertisement was accepted and whether its public DNS publication completed. No relay-IP pin is intended for deployment. Exact node/name identifiers can be supplied privately by the owner if requested.

This summary is prepared only; it has not been sent or posted. Public repository records intentionally omit literal hostname, enrollment URLs, node keys, owner identity and personal home paths.

## Failures, preservation and handoff

- Initial read used guessed stage103/104 filenames and failed; actual filenames were discovered and read. One speculative upstream source-file URL returned404; no diagnostic conclusion depends on it.
- Raw netmap/preferences were processed in memory and only whitelisted observations were returned; no raw preference Persist data or control credentials were published to Git. Existing daemon logs were read without altering logging settings or uploading a bug report.
- This stage made no runtime/configuration, Serve, policy, routes, DNS, OAuth, source-code, service or host-security changes. No sudo, nested delegation, external message, indefinite polling, commit, push, PR or deployment occurred. Only this record and private ignored diagnosis evidence were written. The existing temporary marker/daemon remained as previously retained by the coordinator.
- Passed: local ingress generation, enrollment/capability/configuration comparison and preservation checks. Failed: ordinary experimental public A/AAAA resolution during this bounded observation. Unverified: server-side ingress acceptance/publication cause, off-tailnet browser success, new-origin Google login/transfers, permanent startup and speed. Settings isolation already passed in103/104 and is not invalidated by this unresolved public DNS gate.
