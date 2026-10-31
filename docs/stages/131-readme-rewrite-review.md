# 131: Independent review of the README rewrite

- Status: completed; FAIL, four P3s, all fixed by the coordinator
- Started / completed: 2026-11-01 (Asia/Kuala_Lumpur)
- Coordinator thread: `2ecc44d3-f16b-4162-aef5-d20ec5ffd753` (Claude `claude-opus-5-5`)
- Reviewer (owner routing for Claude-written changes): Codex `gpt-6.1-sol`, reasoning effort high, run as a read-only T3 review task in a fresh worktree. Its own native session log records provider `openai` (line 1), model `gpt-6.1-sol` and effort `high` (line 10).
- Reviewed range: `9d2b1df..20dc3f7`

## Findings and responses

The reviewer checked the README against the package manifests, deploy units and scripts, the named guides, the design record and stages 31, 41, 67, 74, 78, 108 and 111. All 143 relative links in the changed files resolve, both incoming `#formatting-and-secret-checks` links work, every original shell block (including the Gitleaks checksum) is byte-identical, and no private data was found. Crash recovery is correctly attributed to the earlier user service.

1. P3: "Not yet measured: real WAN throughput" ignored the owner's stage101 download observations. **Fixed:** the README cites them as uncontrolled owner reports from before the node move.
2. P3: the owner's report that power and lid settings already work was dropped. **Fixed:** restored next to the boot autostart acceptance.
3. P3: private Tailscale as the accepted Funnel fallback was dropped. **Fixed:** restored in Features.
4. P3: stage130 named no durable coordinator thread and omitted effort evidence. **Fixed:** thread ID and T3's reported model and effort added.

The reviewer could not rerun Prettier (dependencies absent in its worktree) and ran no builds or live checks; stage130 covers formatting.

## Handoff

Repository invariance: after the review, this checkout's HEAD (`20dc3f7`), status and `git ls-remote --heads origin` matched the saved baseline. The reviewer's worktree was at `20dc3f7` and clean when the coordinator removed it and its T3 branch (`t3/review-readme-rewrite`). The coordinator opens the PR and watches CI. No merge, tag, deployment or host changes.
