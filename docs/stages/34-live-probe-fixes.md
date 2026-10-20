# 34: Optional live probe redaction and resource bounds

- Status: planned.
- Started / last updated: 2026-10-20T19:29:32+08:00.
- Coordinator thread: [implementation](t3-thread://v1/mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a).
- Owner: distinct delegated implementation agent; coordinator owns index.
- Model/effort: unverified pending own native runtime proof.
- Scope: scripts/acceptance-deployment.mjs, one meaningful offline regression file and this record only; no app/service/network changes.

## Acceptance

Reproduce both stage33 findings before edits. Sanitize initialization/output errors with fixed categories and nonzero exit; prevent raw path/origin/error values reaching logs. Bound each response in bytes and absolute wall time as well as inactivity, with safe destroy/timer cleanup. Keep standard-library implementation minimal. Exercise offline missing/invalid metadata, output failure, oversize and continuous slow response, plus ordinary response success. No live owner data, identity, sessions or private credentials. Record actual RED/GREEN, failures and native runtime proof, then stable handoff for fresh35 review.

## Outcome

Pending; real app and existing private route are unaffected.
