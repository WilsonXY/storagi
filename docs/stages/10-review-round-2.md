# 10: Independent review round 2

- Status: completed — PASS at b692897; low cleanup finding L1 assigned to stage12 and final fresh review13.
- Date: 2026-10-19 UTC.
- Coordinator thread: `mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a`.
- Task: `node:delegated-task:command%3Amcp%3A84bfb7a9-ff9d-4f5a-9ea2-fc37786fe042%3Adelegate-task%3Astoragi-review-round2-claude-high`.
- Child: matching `thread:delegated-task:` identifier.
- Reviewer: Claude/Anthropic `claude-opus-5-5`, effort high, confirmed independently from its session log, no fallback.
- Session: `78ad2e96-7007-4f53-a2d3-ed5e607cc833`; proof `$HOME/.claude/projects/<redacted-home>--t3-worktrees-storagi-t3-9062e74d/78ad2e96-7007-4f53-a2d3-ed5e607cc833.jsonl`. Coordinator parsed25 model/high metadata occurrences each after final output; requested options alone were not proof.
- Baseline: b69289710479dbe6e903ba3db0644c12f9343525 against origin/main0d168b1. Fresh isolated worktree, review only; coordinator writes this record.

## Verdict and prior findings

PASS: no blocking security or logic defects. Reviewer inspected code and installed tus/openid-client/client source; did not rerun tests or write files. All seven round1 findings B1/B2/N1-N5 judged fixed. Reviewer explicitly accepted retaining the guarded response adapter (observed destroyed-socket deadlock) and per-chunk disk-space checks (other host processes can consume space). Round1 FAIL remains preserved in stage06; no objections hidden.

Confirmed details include descriptor-outside-lock with retired quota held once until last close; sealed bounded origin/owner flow cookie with state/nonce/PKCE, successful-only atomic replay transaction; shared tus takeover with completion inside datastore lock and revalidation after acquiring; immutable ETag/Last-Modified/If-Range; supported tus response hook before URL removal; authorized login shortcut; bidi control rejection.

## New non-blocking findings and dispositions

- S1 low simplification: drop replay ledger because Google codes are single use. **Decline preference**: retain explicit local terminal-success replay enforcement and concurrency checks, bounded to verified owner completions. It has no anonymous growth/writes and no new service dependency. Provider one-use remains independently enforced.
- S2 low simplification: use process-memory flow key. **Decline preference**: the single private persisted key preserves pending login continuity on restart alongside existing persistent sessions; no extra environment/setup secret is introduced. Current behavior is tested and limited.
- S3 low simplification: drop retired-file pins and rely on statfs. **Does not hold as a replacement for the agreed budget**: statfs enforces remaining host space, not Storagi's200GiB cap on a host with much more free space. Deleted but open data must count until released; scaled24MiB test proves new16MiB is rejected while old16MiB remains. The temporary difference between Inbox sum and usedBytes is documented. Reviewer accepted implementation as written.
- L1 low real edge case: one lock timeout aborts the cleanup pass, leaving later expired rows until next minute. **Fix** in fresh stage12: continue independent rows, retain failed reservation and report the failure after attempting others; preserve retry next pass. Focused injected lock-failure regression first. This optional reviewer finding is a concrete bug even though round2 passed.

## Invariance and cleanup

Coordinator snapshots `$HOME/.cache/storagi/review-round2-{before,after}.json`: parent HEAD b692897, empty porcelain status including untracked files, and exact remote heads (main0d168b1 only) all MATCHED. Child starting/ending HEAD b692897 and clean porcelain status independently checked. T3 generated branch renamed to t3/storagi-review-round-2 during orchestration; reviewer log contains no modifying/branch command. No source changes accepted from reviewer.

After verification, `git worktree remove --force $HOME/.t3/worktrees/storagi/t3-9062e74d` and `git branch -D t3/storagi-review-round-2` both passed.

## Handoff

Fresh stage12 fixes only the cleanup loop/error reporting with a regression. Coordinator reruns relevant/combined checks; unchanged browser/upload/auth/download code does not warrant repeating the heavy proof. Fresh read-only round13 is the third and final review round under the skill limit, supplied all prior findings/responses. Final07 handles owner setup, publication and nondeployment status.
