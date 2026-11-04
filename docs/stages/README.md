# Stage records

On 2026-10-19 the owner asked for every implementation stage done by a different agent to be documented. Each stage and each independent review round gets its own file here. There is no shared index: parallel branches add separate files, so they never conflict.

The old `docs/implementation-log.md` (stage index and coordinator notes up to stage 159) was removed on 2026-11-04 because every concurrent branch conflicted on it. Read it with `git show 75c5811:docs/implementation-log.md`.

## Rules

- The coordinator plans the stages and assigns a distinct agent/task to each meaningful delegated stage, recording the plan in the first stage record of that piece of work. Keep stages bounded; don't split trivial work just to add agents.
- Name the file `NNN-short-name.md` with the next free number. If a parallel branch takes the same number, keep both; the names still differ.
- Each writable stage agent writes its own record; the coordinator records integration work. For a read-only review, the coordinator writes the record from the reviewer's report and evidence it checked itself.
- Record outcomes at completion or handoff, including failures, blocked work, cancellations, retries and findings that need another round. A later review round gets a new file; never overwrite an earlier one.
- Say what was checked, what passed or failed, and what remains unverified. Link evidence where useful.
- Requested model/effort settings are not proof. Confirm them from the agent's own session evidence, or label them unverified.
- No secrets or raw private data. Short explanations and relevant command results are enough.

## Template

```markdown
# NNN: Stage title

- Status: planned / in progress / completed / blocked / failed / cancelled
- Started / last updated / completed: dates with timezone
- Coordinator thread:
- Agent/task/thread identifiers:
- Provider/model/effort: actual values and evidence, or explicitly unverified
- Workspace/branch and starting commit:
- Scope and acceptance criteria:

## Decisions

Concise decisions and their reasons; link scope changes to the owner's instruction.

## Changes

Files/components and resulting behavior; ending commits or commit range.

## Verification

Commands actually run, results, and evidence paths. Separate checks that could
not be exercised. No credentials.

## Findings and limitations

Failures, review findings, responses, unresolved concerns and blockers.

## Handoff

What the next stage receives and what remains. For a review, include the
coordinator's repository invariance checks and worktree cleanup.
```
