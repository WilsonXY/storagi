# 29: Owner-approved private real-app startup

- Status: in progress.
- Owner/task: coordinator operational startup/integration.
- Provider/model/effort: Codex gpt-6.1-sol/high confirmed by injected runtime; no independent review claimed.
- Coordinator thread: [implementation](t3-thread://v1/mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a).
- Started / last updated: 2026-10-20T19:14:00+08:00.
- Starting baseline: merged origin/main1b5cceca905aa1453b9551ee8224307f1a4af97a, new chore/private-rollout branch; production source unchanged.

## Scope and decisions

The owner explicitly approved the staged private-check-then-Funnel proposal. Reuse the already reviewed application and stage26 private Google owner environment. Start one real process bound127.0.0.1:8787, add only currently unused private Tailscale HTTPS443, keep the synthetic preview5174 and all unrelated mappings. No system service installation, account creation, router/firewall/power changes or public Funnel activation at this stage.

Before mutation, retain private process/configuration snapshots outside Git and verify credentials/data modes. Check loopback with exact configured Host, then add the private TLS route and check unauthenticated denial. Credentials, client/owner identifiers, authorization flow URLs, cookie values and literal host paths must never enter this record or public artifacts.

## Verification and artifacts

Pending startup. Earlier enrollment succeeded against real Google, private production config validation passed, and source tests/reviews/CI are recorded in stages26–28. New live checks must be recorded separately. Initial read attempted nonexistent server/src/security.ts; security checks are in app.ts, read directly; no source mutation.

## Handoff and rollback

Independent stage30 receives a running private route, proposed endpoint metadata without credentials, and a bounded probe/browser scope. Owner browser login and other-account rejection remain required before stage31. Stop only the exact recorded real-app process and remove only the new HTTPS443 mapping if rollback is needed; retain data and other mappings. A detached trial process is not a persistent system service or reboot guarantee.
