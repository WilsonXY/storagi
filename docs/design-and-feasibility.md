# Storagi: agreed design and feasibility record

Recorded: 2026-10-19, following a grilling interview and the owner's confirmation of the shared understanding (Q16: “yes lgtm”).

This document records the discussion before implementation. It is a decision record, not a claim that the system has been built, exposed, or tested. Host exploration was read-only; writing these documents is the first authorized project change.

## 1. Problem and intended outcome

The owner produces artifacts on one device and later needs them on another device, sometimes outside the home and on a different network. Deciding how to transfer each artifact and remembering where to find it creates friction.

Storagi provides one consistent destination: deliberately upload an artifact, then open the same bookmarked dashboard on another device to find and download it.

The pivotal scope clarification was that **Storagi is temporary transfer storage**. It is not intended to become the owner's permanent archive or the only home for important data. The machine that creates and uploads an artifact retains its original copy.

## 2. Agreed requirements

### Ownership and budget

- The service is strictly for the owner. Other users, collaboration, and public file sharing are outside the initial scope.
- Use the existing machine as the storage and application host.
- There is a **$0 additional hosting/service budget**. Paid VPS hosting was explicitly declined.
- The owner is willing to leave the host powered, awake, connected, and at home while away.
- Temporary host/network outages are acceptable. Uploading and retrieving server copies require the host to be available.

### Dashboard and devices

- Build and own a **custom web dashboard** that can be extended or modified as requirements evolve.
- Support desktop and phone browsers, specifically on **Windows, Fedora KDE, and Android**.
- Choose files explicitly through the dashboard, including a file picker and drag-and-drop where supported.
- Begin with one shared **Inbox**, newest uploads first, and filename search.
- Provide downloads and basic file management. The precise management controls and visual design remain implementation-planning details.
- Support multi-GB files, including MP4 videos and ZIP archives containing folders.
- Reuse existing resumable transfer software. Reliable resumable transfers are part of the confirmed Q16 brief; the exact library/server has not been selected.
- Preserve separate uploads with the same filename. Do not silently overwrite an existing artifact. Distinct display filenames were agreed; the naming convention remains to be designed.

### Retention and capacity

- Automatically delete each server copy **30 days after upload**.
- Leave originals on their source devices untouched.
- Start with a **200 GiB total storage budget** for Storagi.
- Refuse further uploads when full until files expire or the owner deletes some. Do not make room by unexpectedly deleting unexpired artifacts.
- The original idea considered 30 or 60 days. The owner selected 30 days for the initial version. A 60-day setting is not an initial requirement.

### Authentication and authorization

- Use **Google-only login**, restricted to the owner's account. The owner accepted this in Q15 after rejecting a separate Storagi password as the initial recommendation.
- There is no separate local-password login in the agreed initial design.
- The application must verify identity and enforce authorization on the server for every file operation: listing, searching, upload initiation, upload chunks/resumption, downloading, and file management.
- Authenticate only with basic identity permissions. Google Drive/Gmail integration is not required.
- Google login establishes identity; Storagi must separately restrict access to its owner.
- Use Google's permanent account identifier (`sub`) as the bound identity. Configure ownership through a controlled setup process; do not grant ownership to an arbitrary first visitor.
- Use a maintained authentication implementation and validate Google's signed response, intended audience, issuer, expiry, and the flow's request-integrity protections.
- Protect application sessions appropriately and enforce authorization even when someone knows a direct file URL.
- A passkey or 2-Step Verification protecting the owner's Google account was recommended. This was guidance, not an observed account setting or a promise that Storagi forces a fresh Google MFA challenge on every login.
- Google OAuth client creation, exact HTTPS callback/origin registration, and owner-account binding have not been performed.

### Remote access

- **First candidate: Tailscale Funnel**, allowing normal HTTPS browser access without a connected Tailscale app on the receiving device.
- Tailscale still runs on the host for Funnel. This is distinct from requiring a client VPN connection on each receiving device.
- If Funnel has blockers, use **normal private Tailscale access**. The owner explicitly accepts this compromise; access from every restrictive network is not a hard requirement.
- Funnel makes the application endpoint reachable publicly. Files must remain protected by Storagi's owner-only authentication and authorization.
- Neither Funnel's URL nor permission to create a Funnel authenticates the person opening Storagi.
- Private Tailscale fallback does not automatically remove the application login requirement. New Google sign-ins require access to Google.

## 3. Host assessment: observed facts

These are snapshots from the read-only exploration on 2026-10-19, not ongoing guarantees.

- Native **Ubuntu 26.04**; `systemd-detect-virt` reported `none`.
- **Intel i5-6200U**, four logical CPUs.
- About **7.2 GiB RAM**, with approximately 4.9 GiB available at inspection.
- About **802 GiB free** on persistent ext4/LVM storage. The device reports rotational storage; `/home` shares that storage.
- `/tmp` is RAM-backed and is not an appropriate place for durable artifacts or large temporary upload data.
- Approximately **39 days uptime** at inspection.
- Docker was installed, active, and enabled at boot. Node 22 and Python 3 were available.
- Samba was already active. Share contents and private files were not inspected.
- Other web services and private HTTPS mappings already exist. Port 80 was occupied; future deployment must account for existing listeners.
- Battery-equipped hardware, on mains power at inspection.
- The effective logind setting was **`HandleLidSwitch=suspend`**, with no observed lid-switch inhibitor. Actual lid-close behavior was not tested. Idle action was `ignore`.
- The Storagi directory was empty before documentation.
- A documentation-time workspace check found that Git currently resolves to an uncommitted parent repository containing unrelated project directories. Storagi does not yet have its own repository. No repository was initialized and nothing was staged or committed; repository setup/isolation remains implementation-planning work.

### Existing Tailscale setup

- Tailscale **1.102.3** was running and online, without reported health warnings.
- Four peers were known; one other peer was online during the initial check. Intended-device access was not tested.
- MagicDNS and existing HTTPS configuration were present.
- Existing private Tailscale Serve mappings were active.
- Node capabilities advertised HTTPS and Funnel support, with Funnel ports 443, 8443, and 10000.
- **Funnel was disabled.** No Funnel was activated or existing Serve mapping changed.
- The prerequisites appear substantially present, but this is not proof that a new Funnel application will work or perform adequately.

### Direct internet hosting and Cloudflare observations

- The Ethernet interface had a globally routable IPv6 address and an IPv6 default route.
- IPv4 was private behind a gateway. No public IPv4 address was directly assigned to the host.
- Inbound IPv6 reachability, router/firewall policy, remote-client IPv6 availability, IPv4 port forwarding, and CGNAT status were not established.
- `cloudflared` **2026.10.1** was installed; two processes were running.
- An existing configuration declared a tunnel and public hostname. Hostnames, credentials, and tokens were not disclosed.
- Tunnel health, Access protection, permission to reuse the hostname, and startup supervision were not verified.

## 4. Feasibility assessment

The observed CPU, RAM, and free disk space support proceeding with a personal file dashboard. This is an engineering assessment, not a performance benchmark.

The largest practical uncertainties are connectivity from the owner's remote networks, transfer speed, the host staying awake, and correct application-level authorization. Storage capacity is not determined by retention days alone: it depends on how much is uploaded during that period.

For example, averaging 10 GiB of new uploads per day retains roughly 300 GiB over 30 days, before overhead. Under the agreed 200 GiB budget, the service would reach its capacity limit sooner and reject additional uploads. The budget does not guarantee 30 days of unlimited intake. Forty 5 GiB artifacts total 200 GiB before metadata and temporary-transfer overhead.

Multi-GB files are feasible, but WAN upload/download speed and Funnel's fixed bandwidth limits have not been measured. Android browser behavior during interruptions or backgrounding also requires validation. Resumability must not be represented as guaranteed unattended background transfer.

## 5. Reuse research and resulting direction

### Copyparty

Copyparty was initially attractive because it already provides browser transfers, search, file management, resumable uploads, automatic upload expiration, and capacity controls.

Its documented `lifetime` upload rule can express 30 days, while volume size and free-space controls can constrain storage use. Some quota features require filesystem indexing.

Customization has distinct levels:

- Custom CSS/JavaScript, themes, head content, and hiding controls are supported.
- A substantial redesign through injected DOM manipulation would couple Storagi to its existing interface. That maintenance concern is an assessment, not a stated project guarantee.
- A separate frontend can use its documented HTTP API for listings, search, ordinary uploads, downloads, and file operations.
- Ordinary PUT/multipart upload endpoints do not automatically supply the resumability of its custom **Up2k** protocol.
- Up2k has developer notes covering client hashing, enforced chunk sizes, handshakes, and missing-chunk retries. It should not be treated as a supported drop-in frontend SDK with a proven compatibility guarantee. The project documents historical protocol/API breaking changes.

The owner inspected the existing UI and disliked it. The accepted direction is therefore a custom Storagi dashboard. Copyparty has not been selected as the backend, and extensive restyling of its stock UI is not the agreed plan.

Sources: [project](https://github.com/9001/copyparty), [HTTP API and Up2k notes](https://github.com/9001/copyparty/blob/hovudstraum/docs/devnotes.md), [customization](https://github.com/9001/copyparty#themes), [upload rules](https://github.com/9001/copyparty#upload-rules), [expiration](https://github.com/9001/copyparty#self-destruct), [breaking changes](https://github.com/9001/copyparty#breaking-changes).

### Uppy and tusd

These were proposed as reusable components for the custom dashboard:

- Uppy has a tus-compatible browser upload component.
- tusd implements the open tus resumable upload protocol and supports local disk storage and authentication/validation hooks.
- This separates the transfer implementation from Storagi's interface.
- It leaves Storagi responsible for owner-only access, shelf metadata/listing/search, expiry, capacity accounting, and file-management behavior.

**Status: candidate architecture, not a final technology selection.** No specific frontend framework, application language, database, deployment layout, or library version has been agreed.

Sources: [Uppy tus integration](https://uppy.io/docs/tus/), [tusd documentation](https://tus.github.io/tusd/).

### FileBrowser Quantum and Nextcloud

FileBrowser Quantum was considered for its browser file management, search, previews, and documented developer API. Its API needs version-aware integration. Equivalent upload-file expiry and the exact resumable-upload behavior were not verified; share-link expiration is not proof of deleting stored files.

Nextcloud was considered when automatic folder synchronization was still an open possibility. The final workflow uses deliberate browser uploads into temporary storage. Nextcloud was not selected for the initial direction.

Sources: [FileBrowser Quantum](https://github.com/gtsteffaniak/filebrowser), [API reference](https://filebrowserquantum.com/en/docs/reference/api/), [Nextcloud synchronization](https://docs.nextcloud.com/server/stable/user_manual/en/files/desktop_mobile_sync.html).

## 6. Access alternatives considered

### Cloudflare Tunnel with Access

Cloudflare Access can restrict a self-hosted application to an exact authenticated identity. This is a viable authentication arrangement when configured correctly; a Tunnel alone does not create an owner-only policy.

However, public-hostname routes have relevant large-file constraints. Free/Pro request bodies have a documented 100 MB maximum; compatible chunked uploads can address the per-request limit. Separately, Cloudflare documents service restrictions around serving videos and other large files through public-hostname routes. Chunking does not establish that the overall workload complies with those restrictions, and Access protection does not convert the route into private-network routing.

For Storagi's multi-GB ZIP/MP4 workload, the recommendation shifted away from this path. It was not rejected as inherently unsafe.

Sources: [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/), [upload limits](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/4xx-client-error/error-413/), [Tunnel routing and large files](https://developers.cloudflare.com/cloudflare-one/faq/cloudflare-tunnels-faq/).

### Paid public HTTPS relay / Pangolin

A public gateway could provide authenticated browser access and forward requests through a tunnel to this host while files remain here. Pangolin was researched as an existing implementation of that arrangement. A self-hosted public gateway typically needs a public server and domain, with bandwidth and maintenance obligations.

The owner explicitly declined recurring VPS cost, so this is not the selected path. No provider or hosting plan was purchased or chosen.

Sources: [Pangolin architecture](https://docs.pangolin.net/about/how-pangolin-works), [self-hosting requirements](https://docs.pangolin.net/self-host/quick-install).

### Direct home HTTPS

Direct HTTPS hosting may work if incoming connections, DNS, and the relevant router/firewall rules are available. The host's public IPv6 makes this plausible, but end-to-end reachability was not established. It is not a prerequisite for the chosen Funnel/Tailscale approach.

Source: [Caddy HTTPS requirements](https://caddyserver.com/docs/quick-starts/https).

### Tailscale Funnel and private access

Funnel is available on all plans, including the free personal plan, and exposes a local web application through a public HTTPS URL. Receiving devices do not need a Tailscale client connection. The service is documented as beta and subject to non-configurable bandwidth limits.

A network blocking a Tailscale VPN connection may still allow the ordinary HTTPS Funnel URL, but this is an inference that needs testing. No promise was made that all restrictive networks permit it.

The owner selected Funnel as the browser-only candidate and explicitly accepted private Tailscale as fallback if any Funnel blocker occurs.

Sources: [Funnel and limitations](https://tailscale.com/docs/features/tailscale-funnel), [Funnel examples](https://tailscale.com/docs/reference/examples/funnel), [private Serve access](https://tailscale.com/docs/features/tailscale-serve).

## 7. Google login findings

Basic Google sign-in fits the $0 service budget and requires a Google Cloud project/OAuth client setup. A paid application-hosting service is not part of this proposal.

Google documents an OAuth verification exception for personal-use applications. The exact client registration and hostname acceptance have not been exercised here. Login-only identity permissions should be kept distinct from sensitive Google API scopes.

Storagi must enforce its own owner allowlist. In particular, Google's current app-state documentation says basic identity scopes can allow users outside a Testing application's test-user allowlist to authenticate. A test-user list must not be mistaken for Storagi authorization.

Authentication, session security, and file authorization remain application responsibilities. A Google sign-in button alone does not protect a file service.

Sources: [free project and sign-in setup](https://codelabs.developers.google.com/codelabs/sign-in-with-google-button), [OAuth setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), [identity validation and account identifiers](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [OAuth app states](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview), [personal-use verification exception](https://support.google.com/cloud/answer/13464323?hl=en), [Google account passkeys](https://support.google.com/accounts/answer/13548313).

## 8. Validation required before relying on Storagi

These are future acceptance checks, not completed tests:

1. Register and exercise Google login on the actual HTTPS origins used for Storagi.
2. Demonstrate that an unauthenticated request and a different Google account cannot list, upload, resume, download, or manage artifacts, including by calling file endpoints directly.
3. Check Funnel access from a network where normal Tailscale is blocked, then measure a representative multi-GB transfer. Use private Tailscale if Funnel proves unsuitable.
4. Upload and download representative large ZIP/MP4 files and verify integrity. Exercise interrupted/resumed uploads on desktop and Android.
5. Verify expiry using a shortened test interval and upload timestamps, not a file's old modification time. Resolve cleanup behavior around active transfers and downtime.
6. Verify 200 GiB capacity enforcement, including incomplete and simultaneous uploads, without corrupting files or exceeding the host's available storage.
7. Verify that same-named uploads remain separately accessible.
8. Check startup/restart behavior and the host's actual awake/lid behavior without disrupting existing services.

## 9. Details intentionally left for implementation planning

The scope interview established the intended product. The following engineering details have not been silently selected:

- Final transfer server/client, web stack, storage layout, and deployment method.
- Dashboard appearance, exact management controls, and filename disambiguation format.
- Owner enrollment/binding procedure, session lifetime, revocation, and recovery process if Google access is lost.
- Which exact upload timestamp begins retention, cleanup cadence, and handling an expiration during an active download.
- Expiration and disk accounting for partial uploads, concurrent quota reservations, and a host free-space reserve.
- Practical single-file limits and upload concurrency within the total budget.
- How resumability behaves after a browser restart or Android background suspension.
- How to expose Storagi alongside the host's existing Serve mappings without changing their behavior.

No arbitrary future dashboard requirement is guaranteed to be inexpensive. Owning the frontend preserves the ability to change it; it does not remove integration or maintenance work.

## 10. Current stopping point

The owner confirmed the shared understanding, then requested that everything be documented before proceeding.

Completed: read-only host exploration, primary-source research, the design interview, scope confirmation, and this written record.

Not performed: application implementation, dependency installation, runtime configuration, Google OAuth client creation, network exposure, Funnel activation, router/firewall changes, service deployment, or transfer benchmarking.

The next stage is a concrete implementation plan based on this record. This documentation request does not itself start implementation or authorize changing the live host's services.

### Subsequent implementation authorization

The owner then requested implementation in a **new thread** and required every stage performed by different agents to be documented. This later instruction authorizes implementation and supersedes the documentation-only stopping point above. The product requirements remain as agreed. [The implementation log](implementation-log.md) and [repository agent instructions](../AGENTS.md) govern stage ownership, evidence, and handoffs. Implementation is not being performed in the original design thread.
