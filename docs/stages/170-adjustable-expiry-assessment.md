# 170: Adjustable file expiry feasibility and blast radius

The owner's subsequent clarification below supersedes the original future-completion-only recommendation. This remains a feasibility assessment, not an implemented feature.

- Status: completed
- Started / last updated / completed: 2026-11-05, Asia/Kuala_Lumpur
- Coordinator thread: `0bf36650-3362-4e98-8a8b-635b986926a4`
- Agent/task/thread identifiers: coordinator assessment and a distinct read-only architectural research task, <t3-thread://v2/0b2da89c-6f65-4626-9110-1a266286a5ad/thread:delegated-task:command%3Amcp%3A107391dc-f9ab-4769-8a7b-44063a5ee5fa%3Adelegate-task%3Aa7a6ee4f-baac-4a8a-8bb4-fe025d7e9318>.
- Provider/model/effort: coordinator Codex, gpt-6.1-sol, high, as reported by the harness. Research agent Claude, `claude-opus-5-5`, high; coordinator independently parsed the agent's own session log `f6c9cd84-0d08-4bbe-8e8e-d86a119f6947.jsonl` and found those actual model and effort fields. Literal local log paths stay outside Git.
- Workspace/branch and starting commit: `t3/adjust-file-expiration-settings`, `c3692082df1b641e0a732b3a6c128a5a5f92490b`.
- Scope and acceptance criteria: assess adding an adjustable completed-file retention duration to Settings; trace authoritative deadlines, cleanup, transfers, quota, authentication and browser display; run real-code checks of the safety assumptions. No product implementation or live-service changes.

## Decisions

The coordinator traced the implementation and ran isolated synthetic checks. A distinct read-only research agent independently explained the architecture and checked proposed scope and risks. This was research, not a code-change review. The coordinator records its findings here. Future-completion-only policy is the provisional recommendation; an optional owner question asks whether existing files should also change. No answer had arrived when the assessment completed, so this is a recommendation, not an accepted product decision.

## Changes

Assessment record only. Application behavior is unchanged.

## Verification

This checkout initially had no installed server or web dependencies. `npm ci --prefix server --ignore-scripts=false --no-audit --no-fund` and `npm ci --prefix web --no-audit --no-fund` succeeded. Temporary test files and caches stayed within this repository. All HTTP listeners used isolated loopback ports and synthetic signed identities; no real files, OAuth credentials or production data were used.

The key safety fact reached executable proof: enforcement consumes each file's saved absolute `expiresAt`; it does not assume a universal thirty-day lifetime. A temporary script called the real upload, storage, restart, listing, download, preview-denial and cleanup code with synthetic two-day and sixty-day deadlines. All assertions passed:

```text
PASS: mixed 2-day and 60-day deadlines survive restart; repeated completion preserves them
PASS: partial upload expires at its independent 24-hour inactivity limit
PASS: countdown floors a positive remainder below 24 hours to 0 days
PASS: exact expiry blocks listing/download/preview; cleanup deletes only expired bytes and retains quota for the surviving copy
```

This proves existing deadline handling, not a configurable-settings implementation. The script changed only isolated synthetic database metadata. Its preview check proves expiry is rejected before preview generation; it does not test transcoding.

Existing targeted checks also passed:

```sh
server/node_modules/.bin/tsx --test server/test/lifecycle.test.ts server/test/download-lifecycle.test.ts server/test/cleanup.test.ts server/test/interruption.test.ts
# 13 passed, 0 failed
npm test --prefix web -- tests/formatting.test.ts tests/selection-sorting.test.ts tests/deferred-delete.test.ts
# 11 passed across 3 files, 0 failed
```

The server checks exercised active-download integrity and quota after unlink, lock-aware cleanup retries, upload interruptions and resume, default thirty-day retention, the separate partial deadline, and startup recovery. Production data and a running browser were not exercised. No full build or full suite was needed for this assessment because application files are unchanged.

## Findings and limitations

Feasible, with a contained small-to-medium implementation. Estimate approximately 5–7 runtime files plus tests, API contract and documentation, roughly 10–15 files overall. This is an estimate, not a completed diff or schedule.

- `server/src/storage.ts:125` assigns `uploadedAt` and `expiresAt = at + 30 * DAY` exactly once, guarded by `uploadedAt IS NULL`. Existing completed files need no deadline migration for a future-completion-only policy.
- Completion converges through `Storage.complete()`: normal uploads at `server/src/transfers.ts:97`, zero-byte creation at `server/src/transfers.ts:54`, and crash recovery at `server/src/app.ts:240`. The research report gave incorrect line numbers for the first two; the coordinator checked and corrected them here.
- Access rejects expired content at `server/src/app.ts:165`; listing filters it at `server/src/app.ts:365`. Cleanup uses a sixty-second timer and rechecks under the file lock at `server/src/app.ts:253`. The current mechanisms already handle mixed deadlines, as demonstrated above.
- Existing Settings preferences use browser-local storage at `web/src/preferences.ts:1`. A retention policy must instead persist on the server and use an owner-authenticated settings API under the existing session, same-origin and CSRF checks at `server/src/app.ts:326`. Returning the policy to clients must not imply every existing file has that duration.
- Add a Settings control in `web/src/shelf.html:269`; wire loading, saving and failure states in `web/src/dashboard.ts`. Its request helper at line 293 currently has no JSON request body support. Replace fixed duration copy at `web/src/shelf.html:181`, `web/src/transfers.ts:211`, and the public description at `web/index.html:9`. Update the API agreement, current behavior documentation and mocks. Preserve historical stage records and record the revised requirement as a subsequent decision in the design record.

Confirmed risks and constraints:

- Changing existing completed deadlines has a much larger consequence than changing the default for future completions. Shortening relative to original completion can immediately make old files unavailable; cleanup then permanently deletes them, normally on its next pass. The four-second manual-delete undo is a separate browser mechanism at `web/src/deferred-delete.ts:8` and does not protect expiry. How many existing files would be affected is unknown because production data was deliberately not read. If existing-file changes are requested, provide an explicit operation with an affected-file count and define whether time is measured from original completion or from the change.
- Longer retention increases storage occupancy. The existing quota enforcement continues to reject new uploads when full; it does not evict other unexpired files. The executable download tests verify quota remains charged for an expired copy still being streamed.
- Whole-day display at `web/src/formatting.ts:44` floors remaining time; `web/src/dashboard.ts:428` distinguishes actual expiry separately. Even an unexpired copy with one millisecond left shows zero days. Hour/minute choices would require suitable display units and tests. Whole-day choices keep this part small.
- Preserve the independent twenty-four-hour partial inactivity policy at `server/src/storage.ts:110` and `117`. Applying the completed-file setting to partials would change resumability and capacity reservations, expanding the blast radius.
- Reading policy at completion gives a file finishing after a change the new duration, even if its upload started earlier. Recovery must load persisted settings before completing a recovered upload and keep the conservative modification-time anchor. Snapshotting policy at upload creation instead would require additional per-file persisted metadata and more recovery tests.
- Stale tabs, simultaneous saves, invalid values and failed saves need defined UI behavior and bounded server validation. These are prospective risks, not observed bugs in a feature that does not yet exist.

Cleared for the recommended scope: no new transfer protocol, hosting change, OAuth integration or dependency is needed. Existing file deadlines, cleanup locking, quota accounting and download streaming can stay intact. A small new settings table can leave the existing files table unchanged. Rollback still requires care: old releases ignore the setting and use thirty days for newly completed uploads, even though existing saved deadlines remain honored.

The first temporary shell command was rejected by automatic command review because its cleanup used `rm -f`; no part of that command executed. The proof was then created through the patch tool, executed successfully and removed through the patch tool. There was no failed application assertion.

## Handoff

Recommend one server-wide, whole-day retention setting, defaulting to thirty days, applied only when a copy first completes. Existing files keep their saved deadline. The owner still needs to choose allowed durations and whether this scope matches their intent.

Before merging an implementation, verify default and nondefault policy, restart persistence, existing-deadline preservation, zero-byte files, crash recovery, partial inactivity, exact-deadline access and cleanup, auth/CSRF and malformed values, save failure/retry, and correct cross-device text. Run the repository's required full checks and independent code-change review then.

The research agent used the shared checkout and created no branch or worktree. It reported identical starting/ending HEAD and status. The coordinator independently confirmed HEAD remained `c3692082df1b641e0a732b3a6c128a5a5f92490b` and the tracked diff was empty. Only this stage record is retained as an untracked repository change after temporary proof cleanup. No commit, push, PR, deployment or live-service operation occurred.

## Reproducing the isolated proof

With package dependencies installed, save the following as `server/test/.expiry-assessment-proof.ts`, create `.assessment-tmp`, and run `TMPDIR="$PWD/.assessment-tmp" server/node_modules/.bin/tsx server/test/.expiry-assessment-proof.ts`. Remove the temporary script afterward. The fixture removes its own synthetic file storage.

```typescript
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './fixtures.js';
import { upload } from './uploads.js';
import { DAY } from '../src/storage.js';
import { daysLeft } from '../../web/src/formatting.js';

const f = await fixture(100);
try {
  const short = await upload(f, 'abc', 'short.txt');
  const long = await upload(f, 'def', 'long.txt');
  const at = f.now();
  assert.equal(f.app.storage.get(short)!.expiresAt, at + 30 * DAY);
  const created = await f.request('/api/uploads', {
    method: 'POST',
    headers: { ...f.headers, 'upload-length': '2', 'upload-metadata': 'filename cGFydGlhbA==' },
  });
  assert.equal(created.status, 201);
  const partialLocation = created.headers.get('location')!;
  const partial = partialLocation.split('/').at(-1)!;
  assert.equal(f.app.storage.get(partial)!.expiresAt, at + DAY);
  // Only synthetic metadata changes; all operations below call the unchanged app.
  f.app.storage.db.prepare('UPDATE files SET expiresAt=? WHERE id=?').run(at + 2 * DAY, short);
  f.app.storage.db.prepare('UPDATE files SET expiresAt=? WHERE id=?').run(at + 60 * DAY, long);
  await f.restart();
  assert.equal(f.app.storage.get(short)!.expiresAt, at + 2 * DAY);
  assert.equal(f.app.storage.get(long)!.expiresAt, at + 60 * DAY);
  f.app.storage.complete(long, at + DAY);
  assert.equal(f.app.storage.get(long)!.expiresAt, at + 60 * DAY);
  console.log('PASS: mixed 2-day and 60-day deadlines survive restart; repeated completion preserves them');
  f.setNow(at + DAY);
  assert.equal((await f.request(partialLocation, { method: 'HEAD', headers: f.headers })).status, 410);
  await f.app.cleanup();
  assert.equal(f.app.storage.get(partial), undefined);
  assert.ok(f.app.storage.get(short));
  assert.ok(f.app.storage.get(long));
  console.log('PASS: partial upload expires at its independent 24-hour inactivity limit');
  f.setNow(at + 2 * DAY - 1);
  let response = await f.request('/api/files/' + short + '/download', { headers: f.headers });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'abc');
  assert.equal(daysLeft({ expiresAt: at + 2 * DAY }, f.now()), 0);
  console.log('PASS: countdown floors a positive remainder below 24 hours to 0 days');
  f.setNow(at + 2 * DAY);
  for (const suffix of ['/download', '/preview']) {
    response = await f.request('/api/files/' + short + suffix, { headers: f.headers });
    assert.equal(response.status, 410);
    await response.text();
  }
  const listing = await (await f.request('/api/files', { headers: f.headers })).json();
  assert.deepEqual(listing.files.map((file: { id: string }) => file.id), [long]);
  assert.equal(listing.files[0].expiresAt, new Date(at + 60 * DAY).toISOString());
  await f.app.cleanup();
  assert.equal(f.app.storage.get(short), undefined);
  await assert.rejects(access(path.join(f.app.storage.filesDir, short)));
  assert.ok(f.app.storage.get(long));
  assert.equal(f.app.storage.usage().usedBytes, 3);
  await f.restart();
  response = await f.request('/api/files/' + long + '/download', { headers: f.headers });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'def');
  console.log('PASS: exact expiry blocks listing/download/preview; cleanup deletes only expired bytes and retains quota for the surviving copy');
} finally {
  await f.close();
}
```

## Owner clarification: existing files and destructive confirmation

Recorded 2026-11-05, Asia/Kuala_Lumpur. The owner explicitly chose to apply retention changes to existing files too, and requires a confirmation popup when the change would cause deletion, showing the total affected file count. This supersedes the earlier recommendation; it does not by itself turn the assessment into completed implementation.

Proposed behavior consistent with that instruction:

- Recalculate deadlines for existing live, completed copies from their original completion timestamp plus the selected duration. Changing the duration does not restart every file's clock from the save time. Preserve the separate twenty-four-hour inactivity rule for partials. Do not revive expired or already deleted copies.
- Before applying, have the server calculate the total completed copies whose deadlines would change and the subset that would expire immediately. The popup can show both counts, for example: "Update expiry for 18 files? 6 files have already reached the new limit and will be permanently deleted." Use explicit Cancel and "Apply and delete 6 files" actions. These numbers are illustrative, not observations of production storage.
- If no files would immediately expire, a normal save can proceed. The server must still recheck at apply time and require confirmation if the destructive set has changed.
- Cancel, dismissal or Escape must leave the saved setting and file deadlines unchanged. Do not start cleanup or send a mutation when merely selecting a proposed duration or opening the popup.
- Bind confirmation to the proposed duration and the server-calculated affected file set, not merely to a client boolean or a count. Two different file sets can have the same count. Revalidate against current server time and file state before committing. If the set changes because a file crosses its new expiry boundary, another device saves, or files arrive or leave, return a fresh proposal for acknowledgement.
- Persist the setting and all corresponding deadline updates atomically. Coordinate that mutation and its revalidation with existing file deletion locks or equivalent serialization. Reuse existing expiry cleanup after the committed change. Physical unlink failures must retain quota and follow current retry behavior; the popup should not promise instant space recovery while active readers hold bytes.

### Revised blast radius

Still feasible, but medium risk and a medium-sized change. The main application areas remain storage/API and Settings UI; the extra work is authoritative preview/confirmation, atomic existing-file updates, cleanup coordination and regression coverage. The original file estimate is only a rough starting point; the significant increase is behavioral risk and testing rather than the number of modules. No transfer protocol, hosting or OAuth redesign is needed.

The dangerous action now deliberately changes existing file availability and can permanently remove copies. A client-only popup is insufficient because state and time can change between preview and confirmation.

### Additional executable finding

The coordinator ran a temporary synthetic script against the actual fixture and `app.cleanup()`. It injected a deadline extension in a microtask immediately after cleanup's locked expiry recheck, while unlink was pending. The real cleanup then removed the metadata despite the new future deadline:

```text
CONFIRMED: extending expiresAt without the file lock can lose the file after cleanup has rechecked expiry
```

This is a prospective race for a new bulk-update implementation that bypasses the existing lock, not a claim that the current app has a settings bug. The confirmation protocol, atomic setting update, popup and concurrent-save behavior are unimplemented and unproven. A future implementation must demonstrate those properties with tests. The previous 24 passing targeted tests and mixed-deadline proof remain valid for the existing machinery.

New acceptance checks must include cancelled preview causing no changes, correct total and immediate-deletion counts, exact boundary times, stale or forged confirmation, the same count with different file IDs, zero affected files, another device saving, partial exclusion, no revival of expired files, restart persistence, atomic failures, and extending retention while cleanup has selected a row for deletion.

Reproduce the race by saving this script temporarily as `server/test/.retention-race-assessment.ts` and running it with `server/node_modules/.bin/tsx`, using an existing repository-local `TMPDIR`. The fixture deletes its own synthetic storage. The script was removed after execution, and application files and HEAD remain unchanged.

```typescript
import assert from 'node:assert/strict';
import { fixture } from './fixtures.js';
import { upload } from './uploads.js';
import { DAY } from '../src/storage.js';

const f = await fixture();
try {
  const id = await upload(f, 'synthetic');
  const storage = f.app.storage;
  storage.db.prepare('UPDATE files SET expiresAt=? WHERE id=?').run(f.now(), id);
  const originalGet = storage.get.bind(storage);
  let extended = false;
  let scheduled = false;
  storage.get = (requested) => {
    const row = originalGet(requested);
    if (requested === id && !scheduled && row && row.expiresAt <= f.now()) {
      scheduled = true;
      // Inject a concurrent metadata extension after cleanup's locked recheck.
      queueMicrotask(() => {
        storage.db.prepare('UPDATE files SET expiresAt=? WHERE id=?').run(f.now() + 60 * DAY, id);
        extended = true;
      });
    }
    return row;
  };
  await f.app.cleanup();
  assert.equal(extended, true);
  assert.equal(originalGet(id), undefined);
  console.log('CONFIRMED: extending expiresAt without the file lock can lose the file after cleanup has rechecked expiry');
} finally {
  await f.close();
}
```
