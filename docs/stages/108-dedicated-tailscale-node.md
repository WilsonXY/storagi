# 108: Permanent Tailscale node for Storagi; experiment cleanup

- Status: completed in the repository; the move itself is owner-run and not yet done.
- Date: 2026-10-24 +08:00
- Owner: coordinator (Claude Code in T3 Code, Anthropic Claude Opus 5.5, thread `d16900b2-19ea-4c3c-9430-1ab5fec1472f`, continuing Codex thread `f68c7bfe-052b-47c5-8f82-e2df7d42e7d4`, which ran stages 101-107)
- Starting commit: `cebe0f4`

## Owner decisions

After the stage 103-107 experiment passed, the owner asked to make it permanent and to clean up the experiment. Asked about the details, the owner chose the address `storagi.<tailnet>.ts.net` on a fresh node (not reusing `storagi-test`), and to turn off the host node's old Funnel mapping once the new address works.

## Changes

- [`deploy/tailscaled-storagi.service`](../../deploy/tailscaled-storagi.service): a second `tailscaled` in userspace mode, as a `DynamicUser`, with its own state and socket, router port mapping off, and a small sandbox. Only root can change its settings, so the owner's processes (and the tools that kept replacing the host's mappings) cannot touch Storagi's Funnel mapping.
- [`docs/tailscale-node.md`](../tailscale-node.md): why, the limits, and the owner-run move: install, enrol, key expiry, Funnel, wait for DNS, Google redirect URI, switch `PUBLIC_ORIGIN`, phone and speed checks, rollback, then retire the old mapping.
- README and setup point to the guide. No app code changes: the origin is configuration.
- Stages 101-107 were written by this thread's earlier Codex coordinator and left uncommitted in its former worktree. They are committed here unchanged, except one blank line that split the log's stage table.

## Verification

- `systemd-analyze verify deploy/tailscaled-storagi.service` exits 0 (its only output is warnings about unrelated host units).
- The host blocks unprivileged user namespaces, so the user manager cannot apply `CapabilityBoundingSet=` or `PrivateDevices=` (it fails at the capabilities step); these take effect only under the system manager, at the owner's step 1. The settings that could break `tailscaled` itself, `SystemCallFilter=@system-service` and `RestrictAddressFamilies=… AF_NETLINK`, plus `NoNewPrivileges`, were applied in a transient user unit: it started, its socket answered and it reached `NeedsLogin`, with no seccomp or address-family errors. It logged that it could not enlarge its UDP buffers (no `CAP_NET_ADMIN`; Tailscale says this affects throughput only) and could not open the TPM. It never logged in; the unit was stopped and its temporary state removed.
- Not verified until the owner runs the guide: the system-manager sandbox, `DynamicUser` socket permissions (step 3 checks that the owner cannot change the node), Funnel proxying to loopback from a userspace node, Google sign-in at the new origin, and download speed.

## Experiment cleanup

- Verified that the recorded PID and arguments still identified the stage 104 daemon, ran `tailscale logout` on its own socket (exit 0), then stopped that process only. The host's Serve settings were byte-identical before and after, and the old address still returned 200. Only the host's `tailscaled` is still running.
- The tailnet still listed `storagi-test`, now offline, after logout. Removing it needs the admin console; the guide's step 2 asks the owner to do so.
- Deleted the ignored `artifacts/dedicated-identity-test/` (daemon state, private baselines and evidence cited by records 103-107). Those records' evidence paths no longer exist; the records themselves keep the results.
- Removed the former worktree and its branch `t3/compare-cloudflare-tunnel-speed` (at `cebe0f4`, on `origin/main`, no commits of its own) after checking the copied records were byte-identical.
