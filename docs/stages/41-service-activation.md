# 41: Persistent service activation and recovery acceptance

- Status: planned, gated on independent40 review.
- Started / last updated: 2026-10-20T22:51:47+08:00.
- Coordinator thread: [implementation](t3-thread://v1/mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a).
- Owner/task/model: coordinator Codex gpt-6.1-sol/high from injected runtime; no independent review claimed here.

## Authorization and scope

Owner says “next we go” to installation/autostart/crash-recovery and WAN testing. Existing user manager/linger allow bounded Storagi-only activation without sudo. Preserve all owner files, original DATA_DIR/credentials, current public origin and Funnel/private mappings. No reboot, power setting or unrelated service changes.

Before stopping trial, prepare versioned code/dependency release outside data, verify exact runtime hashes/native binding/config load/unit syntax, take private metadata/rollback records and obtain40 PASS. Activate only the approved Storagi user unit after graceful exact-PID shutdown confirms no second writer. Verify enabled/active state, correct loopback binding, Google authorization/anonymous denial and persistence metadata. Test automatic failure recovery only without active owner transfers; preserve all objects and sessions, do not inspect owner payloads. No actual whole-host reboot claimed.

## Rollback

Keep original trial runtime/environment and record exact processes/units/release pointers. If service fails, stop/disable only this new unit and restore original trial after port/store exclusivity verified. Never run two app processes on one DATA_DIR, move/delete owner data or reset Tailscale.

## Outcome

Pending.
