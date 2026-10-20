# 30: Independent live private endpoint/browser acceptance

- Status: planned.
- Owner: distinct delegated acceptance task, not coordinator self-review.
- Provider/model/effort: unverified pending actual task/runtime evidence.
- Coordinator thread: [implementation](t3-thread://v1/mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a).
- Started / last updated: 2026-10-20T19:14:00+08:00.
- Starting baseline: merged origin/main1b5cceca905aa1453b9551ee8224307f1a4af97a, new chore/private-rollout branch; production source unchanged.

## Scope and acceptance

After stage29 readiness, independently exercise the real private route: anonymous/forged direct file/tus/download/session denial, security and login-flow cookie attributes without logging values, invalid host/origin checks where safe, static dashboard/mock exclusion, responsive unauthenticated browser shell. Do not authenticate as the owner, fabricate a real session, read credentials/private sessions/data, modify app code, create/delete owner files or start/stop host services.

Task owns only a standalone optional live acceptance script, this record and ignored sanitized artifacts. Record exact commands, failures/retries, checks and limitations, actual native session metadata. Do not claim Google owner login or wrong-account verification from synthetic/anonymous tests. Coordinator maintains the index.

## Outcome

Pending readiness and delegation.
