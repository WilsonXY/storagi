# 15: Failure-path bug fixes

- Status: planned.
- Started/updated: 2026-10-19T15:45:14.027783+00:00.
- Coordinator thread: `mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a`.
- Owner: distinct delegated task pending.
- Model/effort: coordinator runtime gpt-6.1-sol/high; delegated actual session proof pending where applicable.
- Starting branch/commit: feat/storagi `4039e298d61172a34cad0628b3e5fefb0892def9` before planning commit.

## Scope and decisions

Distinct agent owns server/src/app.ts, relevant server tests, web/src/dashboard.ts, relevant web tests, this record only. L2 close SQLite even when active cleanup rejects, preserve rejection. L3 failed logout must leave transfer selection/pumping usable; successful logout or401/403 must still stop and protect transfers. RED→GREEN meaningful real-flow regressions and sequential package checks. No commits or host changes.

Owner authorized fixes with “go” after stage14 review; implementation and review are separate tasks, simple remedies preferred. Stage14's original findings remain preserved.

## Changes and verification

None yet. Record exact edits, RED/GREEN, actual commands/results and local evidence at handoff. TMPDIR under home, loopback only, no credentials or private content in docs.

## Findings and limitations

Known L2/L3 currently unfixed. PR publication previously403 and current API push=false. Google OAuth, intended-device/network and deployment remain separate unverified setup.

## Handoff

Pending task completion and central-index reconciliation; do not claim deployment, real Google or PR/CI proof.
