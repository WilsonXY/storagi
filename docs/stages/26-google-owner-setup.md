# 26: Real Google owner enrollment preparation

- Status: completed; real Google identity verified and private configuration prepared; not deployed.
- Started: 2026-10-20 18:47 +08:00; completed/last updated: 2026-10-20T18:56:09+08:00.
- Coordinator thread: [implementation](t3-thread://v1/mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a).
- Agent/task: coordinator operational setup; no new implementation agent or code review claimed.
- Provider/model/effort: Codex gpt-6.1-sol/high, confirmed by injected runtime and current T3 thread configuration; no separate reviewer.
- Workspace/branch and starting commit: repository root, chore/google-owner-setup, merged origin/main cf83f6caaafe53388281479492e84eb8d1cd216c.
- Scope: privately validate owner-supplied OAuth JSON; reuse the existing signed-identity enrollment CLI over loopback; record actual outcome and dependencies. No application change or deployment.

## Decisions

The owner created the client after checking both callback URLs. The credentials were on another device; the owner used SSH to paste them into a mode0600 private JSON file outside Git. An open cat command was awaiting EOF, not hung; the coordinator confirmed valid JSON and explained Ctrl+D. No secret was requested through chat or written to public evidence.

The owner uses Linux/macOS for SSH. A local SSH port-forward is required so the browser's registered loopback callback reaches the host. Reuse server/dist/src/enroll.js with credentials supplied only through the child process environment; retain its output privately. Enrollment verifies an identity and does not automatically configure application ownership.

## Changes

- This record, the implementation index and remote enrollment guidance in docs/setup.md; initial documentation commits8a8a9d4 and1b79775.
- Private configuration directory created mode0700; owner-created credential file validated as owned regular mode0600 JSON. Values omitted.
- No source, dependencies, service units or existing network mappings changed.

## Verification

- Read project instructions, design, implementation log, setup instructions and enrollment/auth/config source.
- git status --porcelain=v1: clean before this stage; git diff --quiet HEAD origin/main: exit0.
- git show origin/main: cf83f6c, merge of PR#1; new setup branch starts there.
- Private Python checks: valid Web client ID/secret fields, both expected callback entries, file mode0600. Client values never printed.
- Compiled enrollment/auth and built dashboard present; temporary bind to 127.0.0.1:8989 succeeded and closed. This is not a persistent listener.
- Existing loopback/private HTTPS synthetic preview returned200 with the synthetic banner during prerequisite checks. No production authentication claim.

- Existing compiled enrollment CLI started with real credentials only in its private child environment. Google discovery and authorization URL generation succeeded; no token exchange or identity success claimed. Output and process metadata are private mode0600 cache files, excluded from Git. Listener is127.0.0.1:8989 with the existing ten-minute flow timeout. The owner receives SSH-forward and private-output-display instructions.

- Follow-up sanitized check: signed subject present exactly once, no failure marker, process exited and127.0.0.1:8989 no longer listening. This is real Google verification, distinct from earlier signed synthetic acceptance.
- Owner environment prepared outside Git using the verified subject and supplied Web client. Mode0600 files, mode0700 data directory; 200GiB budget,1GiB headroom, planned loopback8787. No identity/client values copied into public records.
- node --env-file with the private environment imported the compiled loadConfig: PASS; values omitted and no app listener created. Sanitized metadata only in $HOME/.cache/storagi/stage26-readiness.json.
- Existing system-level service template is unchanged and inactive. Its /opt and /etc example paths do not load this private home-directory environment automatically; installation needs a separate approved deployment step.
- The owner initially pasted sed into ssh -N; explained that the tunnel has no remote shell and supplied a separate SSH command. Existing loopback enrollment finished within its timeout; no retry or relaxed authentication needed.

## Findings and limitations

Real Google enrollment/token exchange and controlled local owner configuration succeeded. Production HTTPS login, cross-account denial, activation of the planned HTTPS origin, multi-device and network checks remain pending. The owner's browser must use the SSH forward from the same computer. No Google passwords/MFA, private tokens, identity subject or client identifiers belong in this record. No app service or Funnel is activated.

## Handoff

Fresh stage27 review receives the committed documentation and sanitized readiness metadata. Publish only public-safe setup records after review; do not publish credentials, subject, flow URL or private logs. Before starting/exposing the real app, obtain the separate approval required by AGENTS.md and verify the selected HTTPS route is still unused. Existing private synthetic preview stays available. The owner may now close the enrollment SSH-forward window with Ctrl+C.
