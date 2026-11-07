# 171: Independent review of the adjustable expiry proposal

- Status: completed
- Started / last updated / completed: 2026-11-05, Asia/Kuala_Lumpur
- Coordinator thread: `0bf36650-3362-4e98-8a8b-635b986926a4`
- Agent/task/thread identifiers: <t3-thread://v2/0b2da89c-6f65-4626-9110-1a266286a5ad/thread:delegated-task:command%3Amcp%3A107391dc-f9ab-4769-8a7b-44063a5ee5fa%3Adelegate-task%3Aa2e7198d-755d-4ef0-84c9-678e3c07fcd2>.
- Provider/model/effort: Claude, `claude-opus-5-5`, high, exactly as requested. The coordinator independently parsed the reviewer's own session log `66aadc0d-24d1-4f0c-8120-63175a34f019.jsonl`, observing 28 `model` fields with that model and 28 `effort` fields with `high`. The reviewer observed 23 of each before its final response. No fallback ran. Literal local log paths stay outside Git.
- Workspace/branch and starting commit: coordinator `t3/adjust-file-expiration-settings`; reviewer `t3/review-adjustable-expiry-proposal`, starting and ending at assessment snapshot `4e5589346da1ab1ae0cf8c42f504642489649415`. Application base remains `c3692082df1b641e0a732b3a6c128a5a5f92490b`.
- Scope and acceptance criteria: review the current proposal in [stage 170](170-adjustable-expiry-assessment.md), especially its owner-clarification section, for over-engineering, gaps and a simpler safe implementation. Review the relevant current code. Return prioritized findings, a verdict and a minimal recommended design; do not implement the feature.

## Decisions

The coordinator committed the documentation snapshot first and delegated one fresh, read-only `review` task with worktree isolation, explicitly selecting the owner's requested model and effort. The coordinator recorded findings, checked repository invariance and removed the reviewer worktree and branch after completion. No implementation, PR, push or deployment is part of this task.

## Changes

Review verdict: **REVISE**. The core behavior is sound, but the proposal adds unnecessary machinery and has stale guidance. The findings below supersede the earlier implementation suggestions in stage 170. Application behavior is unchanged.

## Verification

The coordinator's snapshot commit passed the repository's staged Gitleaks check. The reviewer read the proposal and relevant implementation but did not rerun prior proofs. The coordinator checked its output against `server/src/storage.ts:125`, `server/src/app.ts:263`, and `server/src/transfers.ts:63`.

Before the review, the coordinator saved HEAD, clean porcelain status, all remote branch refs from `git ls-remote --heads origin`, and the worktree list. After the review and before making any further coordinator edits, HEAD, status and remote refs exactly matched. There was exactly one added worktree. The coordinator checked that it was clean and still at `4e5589346da1ab1ae0cf8c42f504642489649415`, then removed that reviewer worktree and its branch. The final worktree list exactly matched the baseline. The read-only review passed invariance checks.

Stage 170 records the earlier 24 passing targeted tests. No application changes justify a new full suite here. To validate R2 rather than accept it solely from prose, the coordinator ran a temporary script through the real fixture and cleanup. During the same asynchronous unlink window as the original reproduction, it applied a synchronous transaction restricted to live completed files. Exactly one live file was extended; the expired file was not revived and the partial was untouched:

```text
PASS: guarded synchronous update extends only the live completed file; cleanup removes the expired file without revival; partial is unchanged
```

This proves the guarded-update property under the current single-process execution model and ordinary forward-moving time. It does not test a new settings API or confirmation flow, which are not implemented. No special handling for a system clock moving backwards is proposed by this review.

## Findings and limitations

The reviewer treated the owner's requirements as authoritative and the coordinator's proposed mechanisms as open to challenge.

| Finding | Severity | Coordinator response |
| --- | --- | --- |
| R1: exact file-set binding and re-confirming every set change add unnecessary state, hashes or tokens. | High | **Accept and simplify.** Confirm a maximum deletion count for the currently selected duration. The server recalculates inside the save transaction; require a fresh acknowledgement only if the count exceeds what the user confirmed. Under the supported positive whole-day policy and current completion semantics, normal new uploads cannot immediately qualify for deletion. Different IDs with the same count do not violate the owner's count-based acknowledgement. |
| R2: the original race demonstration revives an already-expired file, which the proposal excludes. Extra lock coordination is not justified. | High | **Accept and correct the earlier claim.** Restrict updates to `uploadedAt IS NOT NULL AND expiresAt > now`. Count, guard, update and policy persistence stay in one synchronous transaction. A cleanup already deleting an expired row cannot have that row extended by this predicate. The coordinator reproduced this guarded behavior, as recorded above. |
| R3: a second count for all deadline changes adds noise. | Medium | **Accept.** Show the number of files that will be deleted. The earlier addition of an overall deadline-change count was the coordinator's interpretation, not an explicit owner requirement. |
| R4: the mixed-duration warning is stale after a successful bulk save; startup and rollback must never automatically rewrite old deadlines. | Medium | **Accept with context.** After a normal successful save, all live completed copies use the selected duration. Existing deadlines must remain stored and be rewritten only by the explicit save flow, never a startup migration. A rollback can still create mixed durations because an old release uses thirty days for new completions. |
| R5: deletion does not guarantee immediate recovered space. | Low | **Accept.** Say files "will be permanently deleted." Access stops at the committed deadline; normal cleanup unlinks bytes, and active readers can retain quota. Triggering cleanup after save is optional. |

Optional suggestions and disposition:

- **O1, return policy in the existing file listing:** accept as the simplest way to refresh authenticated UI copy, avoiding a separate settings-read request. The public HTML description still needs generic wording; the authenticated listing cannot itself update a pre-sign-in metadata promise.
- **O2, last-write-wins between devices:** accept. Every save still validates its destructive count. No policy revision token is required for this owner-only setting.
- **O3, a short positive whole-day option list:** reasonable implementation default, but the exact values remain undecided. Validate duration and confirmation count server-side; the latter must be a nonnegative safe integer. Do not add arbitrary sub-day settings while retaining the whole-day countdown.
- **O4, lower the assessment to small-to-medium:** accept as a rough implementation size/risk description for the simplified design. Permanent deletion remains the behavior that needs meaningful tests.

The reviewer also corrected near-by line references: the CSRF check is `server/src/app.ts:334`, cleanup's locked expiry check is `server/src/app.ts:263`, and initial partial expiry is `server/src/storage.ts:113`. None changes the architectural result.

## Handoff

The minimal recommended design is now:

1. Persist one server-wide retention duration, default thirty days. New completions, zero-byte files and recovered completions use the committed policy. Preserve the original completion timestamp anchor.
2. Accept a save with `{retentionDays, confirmDeletes?}` under existing owner authorization, same-origin and CSRF checks. Default confirmed count to zero.
3. In one synchronous immediate transaction with one sampled `now`, count live completed copies for which `uploadedAt + duration <= now`. If that count exceeds the acknowledged count, return a conflict carrying the current count and change nothing. Otherwise update only live completed copies and persist the policy atomically. Avoid updating an in-memory policy cache before transaction success; reading the committed setting in completion is a simple option.
4. On conflict, open a popup such as "Change to 7 days? 6 files are older than 7 days and will be permanently deleted." Cancel or Escape sends no confirmation. Confirmation resubmits for the displayed duration with that count. If the server reports a larger count, update the popup and require a fresh click. Clear acknowledgement when the selected duration changes. A smaller current count may proceed because it is within what the owner accepted.
5. Use existing expiry enforcement and cleanup. Exclude partial and already-expired copies. Do not recalculate existing deadlines on startup or rollback. Replace fixed duration text and refresh the policy through existing listing refreshes.

There is no proposal token, exact-ID snapshot, additional lock layer, or extra popup count. No feature has been implemented.

Minimum meaningful validation for implementation: default and nondefault persistence; new, zero-byte and recovered completion; lengthening without revival; shortening/conflict with no partial writes; confirmation and exact-time boundary; a count increase while the popup is open; unchanged partial inactivity; guarded update during cleanup's unlink; auth, CSRF and input validation; Cancel/Escape and server count display. Also verify confirmation resets when the selected duration changes, rollback preserves saved deadlines, and a failed transaction cannot leave the completion policy cache ahead of the database. No second proposal review was requested or run after these documentation corrections; the original independent verdict remains REVISE.

## Reproducing the coordinator check

Save the following temporarily as `server/test/.guarded-retention-assessment.ts`, then execute with the server package's `tsx` and a repository-local `TMPDIR`. Dependencies and fixture behavior are as recorded in stage 170. The temporary script was removed after the check.

```typescript
import assert from 'node:assert/strict';
import { fixture } from './fixtures.js';
import { upload } from './uploads.js';
import { DAY } from '../src/storage.js';

const f = await fixture();
try {
  const expiring = await upload(f, 'old');
  const live = await upload(f, 'live');
  const partialResponse = await f.request('/api/uploads', {
    method: 'POST',
    headers: { ...f.headers, 'upload-length': '2', 'upload-metadata': 'filename cGFydGlhbA==' },
  });
  assert.equal(partialResponse.status, 201);
  const partial = partialResponse.headers.get('location')!.split('/').at(-1)!;
  const storage = f.app.storage;
  const partialDeadline = storage.get(partial)!.expiresAt;
  storage.db.prepare('UPDATE files SET expiresAt=? WHERE id=?').run(f.now(), expiring);
  const originalGet = storage.get.bind(storage);
  let scheduled = false;
  let changed = -1;
  storage.get = (requested) => {
    const row = originalGet(requested);
    if (requested === expiring && !scheduled && row && row.expiresAt <= f.now()) {
      scheduled = true;
      queueMicrotask(() => {
        const now = f.now();
        changed = storage.db.transaction(() => storage.db.prepare(
          'UPDATE files SET expiresAt=uploadedAt+? WHERE uploadedAt IS NOT NULL AND expiresAt>?',
        ).run(60 * DAY, now).changes).immediate();
      });
    }
    return row;
  };
  await f.app.cleanup();
  assert.equal(scheduled, true);
  assert.equal(changed, 1);
  assert.equal(originalGet(expiring), undefined);
  assert.equal(originalGet(live)!.expiresAt, originalGet(live)!.uploadedAt! + 60 * DAY);
  assert.equal(originalGet(partial)!.expiresAt, partialDeadline);
  console.log('PASS: guarded synchronous update extends only the live completed file; cleanup removes the expired file without revival; partial is unchanged');
} finally {
  await f.close();
}
```
