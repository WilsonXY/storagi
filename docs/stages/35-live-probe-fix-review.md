# 35: Fresh optional probe fix review

- Status: in progress after stage34 stable handoff.
- Coordinator thread: [implementation](t3-thread://v1/mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a).
- Owner: fresh read-only fallback task; coordinator records outcome.
- Model/effort: unverified; requested fallback Codex gpt-6-astra/high under the current Claude API-limit evidence.

## Scope and prior findings

Original live-probe/rollout scope plus both stage33 P2 findings and stage34 responses/regressions. Production app unchanged. Confirm sanitized initialization/output failures, absolute request deadline and byte cap/destruction/timer cleanup; no private-data leaks or unjustified abstractions. Compare committed baseline, no edits/commits/pushes/posts, raw credentials/session access, owner authentication, live app probes or host changes. Native proof, before/after parent/remote/child invariance and exact owned-worktree cleanup required. This cannot replace real owner/other-account checks or authorize early Funnel.

## Outcome

Pending.

## Submitted responses and verification

Both stage33 P2 findings accepted: the whole script now catches metadata/initialization/output errors with fixed public categories and exit1; shared requester imposes15s absolute plus inactivity timeout and2MiB cap with destroy/finally timer cleanup. Stage34 records RED/GREEN and14 focused offline cases, including live-shaped normal213/15 completion, missing/invalid private metadata, output failure, oversize, ongoing bytes past deadline, request/reset/partial errors and zero remaining deadlines. Coordinator reran all14, both syntax checks, whitespace/privacy and final actual private213/15 probe: PASS. Existing app code/serving untouched. Current Claude rate limit is documented by stage32, so this fix re-review follows its configured Astra fallback without claiming a Claude verdict.
