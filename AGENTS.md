# Storagi agent instructions

## Read before starting

Read the owner's machine-wide profile at `$HOME/.codex/AGENTS.md`, then:

1. `README.md`
2. `docs/design-and-feasibility.md`
3. `docs/implementation-log.md`

The agreed product scope is in the design record. Later explicit owner instructions take precedence. The owner has authorized implementation in a new thread and requires every stage performed by different agents to be documented.

## Implementation workflow

- Load `full-cycle` and `ponytail` at full intensity for coding tasks. Keep the implementation small without shortening verification, independent review, or the PR workflow.
- Use a coordinator and distinct delegated agents for meaningful implementation stages. Write the stage plan and ownership in the implementation log before delegating. Give agents bounded scopes and explicit handoffs; parallelize only independent work.
- Discover providers/models using T3's live capabilities. Follow the owner's reviewer routing and evidence requirements, including the special route when `gpt-6.1-sol` wrote the diff. Use a fresh read-only review context; in T3 use `delegate_task` with `role: "review"` and `isolation: "worktree"` when available.
- A new worktree receives committed files only. Commit the appropriate baseline before delegating isolated work. Do not silently lose these design and handoff documents.
- Every delegated task prompt must name its stage record, scope, acceptance checks, and documentation obligations.

## Required stage documentation

- The coordinator owns the index in `docs/implementation-log.md`.
- Give every delegated stage a record at `docs/stages/NN-short-name.md`. Assign different files to concurrent agents.
- Create a stage entry before work starts, then update it at handoff/completion. Failed, cancelled, blocked, and retried stages also remain recorded.
- Record the agent/task/thread identifiers, provider/model and effort where confirmed, scope, decisions and reasons, files/commits changed, actual verification commands and results, artifacts, limitations, and next handoff.
- Clearly distinguish planned checks from checks actually run, requested model settings from verified settings, and implementation completion from deployment or real-world validation.
- A read-only reviewer must not write a stage record, edit code, commit, push, or post to GitHub. The coordinator writes its returned findings and verified reviewer evidence into the review record and performs the owner's before/after repository checks and cleanup.
- The coordinator records integration work and the final validation/review/PR result. A stage is not handed off as complete until its record and index are current.
- Document concise engineering decisions and observable evidence. Do not record secrets, OAuth tokens/client secrets, session cookies, credentials, or private file contents.
- Use the template in `docs/implementation-log.md`; do not add a documentation framework or duplicate tool transcripts.

## Workspace and host boundaries

- Initial inspection found that Git resolves to an unrelated parent repository, with no commits. Establish a dedicated Storagi repository/baseline before coding; never stage sibling projects or modify the parent repository's history/configuration.
- The current implementation task permits normal reversible repository work. The earlier read-only constraint applied to feasibility exploration, not to the now-authorized implementation.
- Existing host services, Serve mappings, Cloudflare tunnels, and private files are outside the application implementation scope. Preserve them.
- Complete and verify the application before any final deployment/exposure approval required by the owner's workflow. Do not activate Funnel, change router/firewall or suspend settings, or treat the proposed deployment design as an already deployed service.
- Google OAuth registration and real owner authentication may require owner interaction. Build and verify all independent work first; record the exact remaining setup without inventing credentials or weakening authentication.
- `/tmp` is a small RAM disk. Use a task-specific temporary directory under the owner's home for large builds/downloads and keep test artifacts separate from real files.

## Public documentation privacy

Never publish actual personal home paths, host usernames or encoded home/worktree-directory names in tracked files, PR text or proof. Use repository-relative references, quoted `$HOME` shell paths, or clearly labelled portable system examples. Keep literal native evidence and host-specific configuration outside Git; public stage records retain verified identity/results with normalized locators. Audit current tracked content before publication and flag historical exposure separately; a new commit does not erase older commits.
