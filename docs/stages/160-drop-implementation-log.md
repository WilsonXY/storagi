# 160: Replace the implementation log with self-contained stage records

- Status: completed; independent review in stage161
- Started / last updated: 2026-11-04 (Asia/Kuala_Lumpur)
- Coordinator thread: this T3 thread; the coordinator made this documentation change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from this session's runtime metadata)
- Workspace/branch and starting commit: `t3/drop-implementation-log`, `75c5811`
- Scope and acceptance criteria: the owner reported that `docs/implementation-log.md` conflicted on every set of concurrent branches and asked whether it was needed. Remove it while keeping the owner's 2026-10-19 requirement that every stage is documented.

## Decisions

- The conflicts came from the stage index table: every branch appended rows at the same spot, and Prettier re-padded the whole table whenever a cell grew wider. The per-stage files already carry the detail, so the index duplicated `ls docs/stages`.
- The recording rules and template move to `docs/stages/README.md`, without the "add an index row" rule. The old log stays readable with `git show 75c5811:docs/implementation-log.md`.
- Duplicate stage numbers from parallel branches are allowed; the name suffix keeps file names distinct.

## Changes

- Deleted `docs/implementation-log.md`; added `docs/stages/README.md`.
- `AGENTS.md`, `README.md`, `docs/verification.md`, `docs/design-and-feasibility.md`, `docs/pr-draft.md` and `design/explorations/HANDOFF.md` point to the stage records instead.
- Older stage records that mention the log are left as history.

## Verification

- `grep` finds no remaining reference to the log outside `docs/stages/`, except the `git show` pointer.
- Prettier check passes on every changed Markdown file except `design/explorations/HANDOFF.md`, which was already unformatted on `main` and is left as it was.
- No application code changed, so no tests were run.

## Handoff

The coordinator opens the PR; no merge, tag or deployment.
