# 76: Independent review of stages 74-75, round 1

- Status: completed; **FAIL**, two P3, no P1 or P2. Both fixed in stage75.
- Date: 2026-10-23, Asia/Kuala_Lumpur.
- Coordinator: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844) (record written by it from the reviewer's report and its own checks; the reviewer was read-only).
- Reviewer: fresh Codex task through T3 `delegate_task` (role review, worktree isolation). Model and effort **confirmed `gpt-6.1-sol`, reasoning effort `high`** from the reviewer's own Codex session log. Native session `01a16487-ec28-7311-a771-d2a36c6ce7f9`.
- Baseline: `8ea906e`, reviewed as `23cb2da..8ea906e`.

## Findings

- **P3, unbounded embed title.** The semver filter accepts arbitrarily long tags; a 240-digit major version gives a 281-character manual-recovery title, which Discord rejects (titles are capped at 256), so the alert is lost. Fix: jq truncates the title to 256 characters; a new test fails at 281 before and passes after.
- **P3, stale end-to-end guide.** It reused `v1.0.2`, already live (stage74), and expected the old one-line message. Fix: the section is now "Releasing a version" with a placeholder `vX.Y.Z` above the live and recorded tags, publishing the release on GitHub, and the green embed as the expected message.

The reviewer's checks: `npm run setup`; poller tests 50/50; under `LC_ALL=C` the emoji titles, `${what^}`, UTF-8 JSON and integer colours are correct; an injected jq failure is logged and keeps exits 0/1/2/3/130; tests pin exactly one embed and its fields; alert timing, state, non-retry and credential secrecy unchanged; no privacy violations; stage74 supports the guide's sudo correction.

## Invariance and cleanup (coordinator)

- This checkout: `8ea906e` with a clean `git status --short` before and after.
- `git ls-remote --heads origin`: identical before and after.
- Reviewer worktree `t3-0284bd63` (branch `t3/review-autodeploy-discord-embeds`): at `8ea906e`, clean `git status --short`. Removed with `git worktree remove --force` and `git branch -D`.

## Handoff

Round 2 (stage77) reviews the fixes.
