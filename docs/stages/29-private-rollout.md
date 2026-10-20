# 29: Owner-approved private real-app startup

- Status: completed; private startup and owner-reported real browser owner/other-account checks passed.
- Owner/task: coordinator operational startup/integration.
- Provider/model/effort: Codex gpt-6.1-sol/high confirmed by injected runtime; no independent review claimed.
- Coordinator thread: [implementation](t3-thread://v1/mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a).
- Started / last updated: 2026-10-20T19:14:00+08:00.
- Starting baseline: merged origin/main1b5cceca905aa1453b9551ee8224307f1a4af97a, new chore/private-rollout branch; production source unchanged.

## Scope and decisions

The owner explicitly approved the staged private-check-then-Funnel proposal. Reuse the already reviewed application and stage26 private Google owner environment. Start one real process bound127.0.0.1:8787, add only currently unused private Tailscale HTTPS443, keep the synthetic preview5174 and all unrelated mappings. No system service installation, account creation, router/firewall/power changes or public Funnel activation at this stage.

Before mutation, retain private process/configuration snapshots outside Git and verify credentials/data modes. Check loopback with exact configured Host, then add the private TLS route and check unauthenticated denial. Credentials, client/owner identifiers, authorization flow URLs, cookie values and literal host paths must never enter this record or public artifacts.

## Verification and artifacts

Earlier enrollment succeeded against real Google, private production config validation passed, and source tests/reviews/CI are recorded in stages26–28. New live checks must be recorded separately. Initial read attempted nonexistent server/src/security.ts; security checks are in app.ts, read directly; no source mutation.

## Handoff and rollback

Independent stage30 receives a running private route, proposed endpoint metadata without credentials, and a bounded probe/browser scope. Owner browser login and other-account rejection remain required before stage31. Stop only the exact recorded real-app process and remove only the new HTTPS443 mapping if rollback is needed; retain data and other mappings. A detached trial process is not a persistent system service or reboot guarantee.

## Actual private startup

- Before snapshots: current Serve configuration and private process metadata stored mode0600 outside Git; credentials/environment mode0600 and existing private data mode0700 validated without printing values. Tailscale online, planned origin matches the host DNS name,443 mapping absent and loopback443/8787 free.
- Started the compiled reviewed application using Node --env-file with the private owner environment, detached from tool lifetime, umask0077. Runtime uses code from merged1b5ccec; no source diff. Child startup output retained privately in "$HOME/.cache/storagi/real-app-trial.log"; exact process PID retained privately for bounded shutdown.
- Native HTTP loopback readiness with configured Host: dashboard200, anonymous /api/files401. ss confirms only127.0.0.1:8787 app listener.
- Executed tailscale serve --bg --https=443 http://127.0.0.1:8787 after rechecking the full before configuration still matched. Command succeeded.
- Private HTTPS certificate validation enabled: /200, /api/session401, /api/files401. Real HTML excludes SYNTHETIC PREVIEW.
- After snapshot comparison removes only the new443 TCP/Web entry and any false443 Funnel flag: all prior mappings match exactly; Funnel remains disabled.
- Sanitized readiness metadata is private at "$HOME/.cache/storagi/stage29-sanitized-readiness.json". No credential, cookie, owner subject or hostname copied to public proof.
- The owner has been asked to perform real owner login and a separate incognito other-account attempt. Google-level test-user rejection cannot substitute for Storagi's server-side account denial.
- Last updated: 2026-10-20T19:15:54+08:00.

## Independent acceptance and publication handoff

Stage30 passed213 live anonymous HTTP requests/15 checks and1440/728/390 anonymous browser shells. Initial optional-probe review33 found two medium harness problems (error privacy and unbounded responses), fixed in34 with14 RED/GREEN regressions; final live213/15 rerun passed. Fresh35 actual Astra/high PASS confirms both findings resolved and no new issues; read-only evidence/cleanup passed. Source app and its already-running private process were unchanged throughout. Stage32 Claude rate limit and coordinator cleanup-guard retry are recorded separately. Public-safe probe/docs publication and CI follow; actual account tests still await the owner and Funnel remains off.

Publication: https://github.com/WilsonXY/storagi/pull/3 created/linked for the reviewed optional probe/regressions and operational records, with public-safe anonymous1440/390 screenshots hosted by GitHub. Ordinary feature push only; app source unchanged. Current PR CI pending actual observation; owner account checks and Funnel remain pending.

Subsequent owner report confirms the owner Inbox loads and Storagi rejects the other Google account after redirect. The original conditional approval was fulfilled and stage31 enabled only the owned443 Funnel flag; all prior routes preserved. Public relay9-check proof passed. App remains a detached runtime trial with private persistent data and no installed reboot-persistent service.
