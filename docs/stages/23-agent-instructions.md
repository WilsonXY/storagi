# 23: Trim project agent instructions

- Status: edit completed and independently reviewed; PR publication/CI follows. Started: 2026-10-20T02:07:36.863685+00:00.
- Coordinator: /root, T3 mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a; injected runtime Codex gpt-6.1-sol/high.
- Baseline: feat/storagi,2e4409715aa13af79aa5d009148c30ff5f32e242, clean; PR#1 open with passing baseline CI.
- Scope: shorten AGENTS.md; required index/stage records only. Owner explicitly requests deleting repeated/nonproject details.
- Decision: reference global profile and existing recording rules; remove duplicated skills/reviewer mechanics, resolved repository setup and old authorization narrative. Retain project docs, delegation/stage ownership, host/exposure/auth and public-privacy boundaries.
- Verification before edit: AGENTS.md44 lines/650 words; owner profile/README/design/log read. Parent-instruction lookup found none. An initial broad filename search completed without writes; subsequent reads were limited to known parent paths. No app/test/build/server command run.
- Planned checks: link targets, reduced size, diff/whitespace, public-path scan and fresh review24; ordinary push/CI. No runtime changes or new tests for prose.
- Handoff: review24 after committed diff. No deployment, credential or history rewrite action.

Actual edit: AGENTS.md17 lines/163 words (from44/650); three project links resolve, git diff --check exit0, tracked privacy scan83 files/zero matches before staging new records. Application files unchanged. No local tests/builds repeated for this prose edit; CI will run on the pushed commit.

Independent review25 PASS with actual gpt-6-astra/high confirmed from own native log; Claude24 API rate-limit attempt retained. Parent/remote/child invariance passed, both owned review worktrees/branches cleaned. AGENTS remains17 lines/163 words,75% fewer words; no app files changed. Final docs-only ordinary push to PR#1 and native CI watch follow; latest CI recorded in live PR without another instruction edit.
