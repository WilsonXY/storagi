# 134: Format staged files with Prettier on every commit

- Status: completed; stage135 review FAIL, both P2s fixed; stage136 re-review FAIL, its P2 fixed
- Started / last updated: 2026-11-01 (Asia/Kuala_Lumpur)
- Coordinator thread: `0e80096f-63b6-4cae-b8f7-22bdc83ba2f8`
- Agent/task/thread identifiers: none; the coordinator made this small tooling change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from this session's runtime metadata)
- Workspace/branch and starting commit: `t3/prettier-commit-hook`, `d78beee`
- Scope and acceptance criteria: the owner asked whether Prettier runs automatically (it did not; CI only checks) and approved a dependency-free pre-commit hook that formats staged files and re-stages them, accepting that a partly staged file is committed whole. The hook must cover the same files as `npm run format`, honour `.prettierignore`, install itself during `npm run setup`, and not break the deploy build, which runs `npm run setup` in a `git archive` copy with no `.git`.

## Decisions

- Committed `.githooks/pre-commit` plus `git config core.hooksPath .githooks` from the root `prepare` script, instead of husky and lint-staged: no new dependencies, and partial staging was accepted by the owner.
- `prepare` does nothing when there is no `.git` (directory or worktree file), so the deploy staging copy and any other non-checkout install are unaffected.
- The hook uses the local `node_modules/.bin/prettier`, never `npx`, so it cannot download a different version. With matching staged files and no local Prettier it stops the commit and says to run `npm run setup`; commits with no matching files never need Prettier.
- Gitleaks stays out of the hook, because committing would then require its separate binary.

## Changes

- `.githooks/pre-commit`: selects staged added, copied, modified and renamed files with Git pathspecs equal to `{server,web,scripts}/**/*.{ts,js,mjs,css,html}`, passes them NUL-separated to Prettier `--write` and then to `git --literal-pathspecs add`. After stage135 it no longer reads names from shell text: the first version silently skipped names Git quotes (`café.ts`, quotes, tabs), and its `git add` read `probe[1].ts` as a pattern that also staged `probe1.ts`. After stage136 it also clears inherited `GIT_*_PATHSPECS` modes, which `git --literal-pathspecs commit` and similar pass to hooks and which stopped the patterns matching.
- `package.json`: `prepare` script.
- `README.md`: the hook, its whole-file staging and `--no-verify` in the formatting section, `.githooks/` in the layout table, and the secrets note no longer says no hook is installed.

## Verification

Probes ran in a throwaway clone outside the repository, using this worktree's `node_modules`, then deleted:

- Unformatted staged `web/src/*.ts`: commit succeeded with the formatted content.
- Only `web/src/mark.ts` (in `.prettierignore`) staged: commit succeeded and the file was left unformatted.
- Only `README.md` staged: hook exited 0 without running Prettier.
- File name with a space (`web/src/a b.css`): formatted and committed.
- After the stage135 fixes: `café "q".ts` and a name containing a tab were formatted and committed; with only `probe[1].ts` staged and unstaged edits in `probe1.ts`, the commit held only `probe[1].ts` and `probe1.ts` stayed unstaged. Prettier given `probe[1].ts` formatted that file only. The earlier probes above were repeated and passed.
- After the stage136 fix: `git --literal-pathspecs commit`, `--noglob-pathspecs`, `--glob-pathspecs` and `--icase-pathspecs` each committed a nested `server/deep/*.ts` formatted; the bracket, `café.ts` and documentation-only probes passed again and `dash -n` PASS. This one-line fix was verified by the coordinator only, with no third review round.
- Staged TypeScript syntax error: Prettier reported it and the commit was refused.
- `node_modules` removed: commit refused with the setup message.
- Commit from the `web/` subdirectory: formatted correctly.
- `npm run prepare` in an untracked copy with no `.git`: exit 0, no Git change. In this worktree `npm run setup` set `core.hooksPath` to `.githooks`.
- `npm run format:check`: PASS.
- First `npm run check`: FAIL, one server test (`interruption.test.ts`, half-open PATCH deletion) had its DELETE request hit the test's 6-second timeout. Nothing in this change touches the server. A second run without changes: PASS, every server, web, acceptance and deploy test, both typechecks and both builds.

## Findings and limitations

`core.hooksPath` lives in the shared repository config, so once any checkout runs `npm run setup` every worktree of that clone uses its own `.githooks/`; a worktree on a branch without that directory runs no hooks. Any hooks a contributor kept in `.git/hooks` stop running. Only Linux was exercised.

## Handoff

Stage135 reviewed `6a45e8d` and stage136 reviewed `fe0ee0d`; the coordinator fixed and verified the stage136 finding. The coordinator opens the PR; no merge, tag or deployment.
