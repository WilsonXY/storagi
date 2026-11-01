# 136: Re-review of the Prettier pre-commit hook fixes

- Status: completed; FAIL, one P2 fixed in stage134
- Started / completed: 2026-11-01 (Asia/Kuala_Lumpur)
- Coordinator thread: `0e80096f-63b6-4cae-b8f7-22bdc83ba2f8`; the coordinator wrote this record from the reviewer's report
- Agent/task/thread identifiers: T3 `delegate_task`, role review, isolated worktree; Codex session `01a19648-1001-77b3-82e7-614549a3c1e2`
- Provider/model/effort: Codex `gpt-6.1-sol`, reasoning effort high, confirmed in the reviewer's own session log
- Workspace/branch and starting commit: fresh worktree at `fe0ee0d` (stage135 fixes on `6a45e8d`)
- Scope and acceptance criteria: read-only check that both stage135 P2s are fixed and the rewrite regressed nothing; owner decisions out of scope as in stage135.

## Findings and responses

- P2 `.githooks/pre-commit`: `git --literal-pathspecs commit`, `--noglob-pathspecs` and `--glob-pathspecs` pass their mode to the hook through `GIT_*_PATHSPECS`, so the patterns no longer matched nested files and an unformatted `server/deep/probe.ts` was committed as is. `6a45e8d` did not have this problem. Fixed: the hook unsets `GIT_LITERAL_PATHSPECS`, `GIT_NOGLOB_PATHSPECS`, `GIT_GLOB_PATHSPECS` and `GIT_ICASE_PATHSPECS` first and keeps the explicit `git --literal-pathspecs add`.

## Verification

The reviewer reported: both stage135 P2s fixed (Unicode, quotes, tabs, newlines, backslashes, `probe[1].ts` isolation). The default selection matches the Prettier glob, nested and hidden files included. Ignores, spaces, renames, deletions, subdirectory and merge commits, partial staging and documentation-only commits: PASS. Missing Prettier exits 1; a syntax error refuses the commit with exit 123 (from `xargs`, not Prettier's 2). 900 staged files were formatted and re-staged across two `xargs` batches. `dash -n`, `sh -n`, `git diff --check`, `npm run format:check` and the intercepted `prepare` probes: PASS.

The coordinator verified the fix itself (stage134); there was no third review.

## Handoff

Read-only invariants checked by the coordinator afterwards: this worktree's HEAD `fe0ee0d` unchanged, its only change the coordinator's own in-progress fix, `core.hooksPath` unchanged, remote heads identical to before. The reviewer's worktree was still at `fe0ee0d` with a clean status; it and its branch were removed.
