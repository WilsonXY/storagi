# 135: Independent review of the Prettier pre-commit hook

- Status: completed; FAIL, two P2s fixed in stage134
- Started / completed: 2026-11-01 (Asia/Kuala_Lumpur)
- Coordinator thread: `0e80096f-63b6-4cae-b8f7-22bdc83ba2f8`; the coordinator wrote this record from the reviewer's report
- Agent/task/thread identifiers: T3 `delegate_task`, role review, isolated worktree; Codex session `01a19642-a849-7532-bbbd-166e80ee1c4b`
- Provider/model/effort: Codex `gpt-6.1-sol`, reasoning effort high, confirmed in the reviewer's own session log
- Workspace/branch and starting commit: fresh worktree at `6a45e8d` (parent `d78beee`)
- Scope and acceptance criteria: read-only review of the hook, the `prepare` script, the README and the stage134 record; owner decisions (auto-format, whole-file staging, no extra packages, no Gitleaks in the hook) were out of scope.

## Findings and responses

- P2 `.githooks/pre-commit`: names Git quotes in `--name-only` output (`café.ts`, quotes, backslashes, tabs, newlines) failed the extension filter, so they were committed unformatted without a warning. Fixed: Git pathspecs select the files and the names travel NUL-separated (`-z`, `xargs -0`).
- P2 `.githooks/pre-commit`: `git add` read names as pathspecs, so with only `probe[1].ts` staged it also staged unstaged edits in `probe1.ts`. Fixed: `git --literal-pathspecs add`.

## Verification

The reviewer reported: `sh -n` and `git diff --check` PASS; `npm ci --ignore-scripts` in a throwaway clone, then probes under the stage135 cache directory reproducing both findings; normal names, spaces, `.prettierignore`, renames, deletions, subdirectory and merge commits, a syntax error (exit 2), missing Prettier (exit 1) and documentation-only commits behaved as intended. `prepare` with intercepted Git ran the config command for a `.git` directory or file and skipped it without `.git`. `npm ci` in a real `git archive` extract and `npm run format:check` PASS.

The coordinator reproduced both findings' fixes in its own throwaway clone (stage134).

## Handoff

Read-only invariants checked by the coordinator afterwards: this worktree's HEAD `6a45e8d` and status unchanged by the reviewer, `core.hooksPath` unchanged, remote heads identical to before. The reviewer's worktree was still at `6a45e8d` with a clean status; it and its branch were removed. Stage136 reviewed the fixes.
