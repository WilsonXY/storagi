# 174: Text handoff, second implementation iteration

- Status: completed
- Started / last updated: 2026-11-05 Asia/Kuala_Lumpur
- Coordinator thread: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c
- Agent/task: coordinator integration and review fixes (no extra implementation delegate)
- Provider/model/effort: Codex `gpt-6.1-sol` high, runtime settings
- Workspace/branch and starting commit: `t3/text-copy-paste-transfer`, `f1aaeab` (local unpushed first iteration)
- Scope and acceptance criteria: address [Opus review](172-text-opus-review-1.md) and [Sol review](173-text-sol-review-1.md); reproduce both P2 bugs before fixing; improve the receiving-phone path; repeat both reviews on committed final code, every perspective and overall at least 8/10

## Decisions and changes

- Inbox receives a live `textCount` in its existing `/api/files` response; no extra body fetch, timer, endpoint or automatic clipboard access. Shelf preference stores only a `text` marker in localStorage (Inbox is the default) and catches blocked storage. A `#text` visit records the destination before authentication, preserving it through OAuth's return to `/`.
- Existing `tab` function now rerenders files after clearing shared search. A send completing outside Text updates the stored items but leaves the active search and focus untouched. Coarse-pointer sending avoids reopening the phone keyboard.
- Received items and their Copy/Open controls appear above the composer on narrow screens when texts exist. The intro becomes compact by hiding in that state. Copy/Open are visible controls with backgrounds/borders; scrolling text can receive keyboard focus.
- Conditional text refresh uses a weak ETag from the hash of ordered immutable live IDs. Unchanged requests return authenticated 304 with no text body. Sends, deletes and expiry change the token. No text content is persisted in browser storage. The UI retains the previous in-memory items across 304 and only updates status when it changes.
- Delete 404/410 is successful convergence with the other device; real failures remain visible and keep the item. Error messages refer to Text. Escape cancels an open delete confirmation. The send shortcut uses native `requestSubmit`; its label span preserves the decorative arrow's hidden semantics.
- All final fixtures/proof use `https://example.com/read/chapter-42/`, not the owner's supplied browsing example. Before publication, replace the unpushed first-iteration commit with the reviewed final implementation and records so private example contents do not enter public branch history.
- CI explicitly installs pinned Playwright 1.64.1 and its Chromium in runner temporary storage and runs the actual-service/two-context browser test after the standard checks. The repository gains no application dependency. The browser test asserts Copy is in the phone viewport without scrolling.

## Verification

- Red: both Sol navigation regressions failed against iteration 1: Inbox showed zero rows after search cleared, and delayed send replaced `archive` with an empty search. Count/login preference, Escape and conditional refresh regressions also failed. The API count/ETag check failed because `textCount` was missing.
- Green targeted UI: **74/74** tests in dashboard/Text suites, including the two P2 regressions, waiting count without text bodies, destination through login, keyboard tabs, coarse-pointer focus, capacity errors, remote-already-deleted, destroy cleanup and unchanged ETag/status behavior.
- Green targeted API: **5/5** text HTTP tests, including authenticated 304/no body, changed/expired/deleted invalidation, live count and anonymous denial.
- Both TypeScript checks passed after integration.
- Full project checks, fresh built-browser proof and final formatting are recorded below after completion.

## Findings and limitations

Tests remain synthetic owner-identity checks; physical devices and real Google OAuth are unverified. CSS prioritizes pickup on small screens; the composer stays available below the received items. SQLite row removal is not a secure-erase guarantee. Initial review runs and all findings remain recorded separately.

## Handoff

Next: fresh Opus 5.5 high and Sol 6.1 high worktree reviews with the previous findings, fixes and current screenshots. Then PR/CI; no merge, tag or deployment.

### Integration findings

- Full-suite testing found two upload-resume tests asserting browser storage remained unchanged. Persisting the default Inbox added an unnecessary preference key. The implementation now stores only a Text preference and removes that marker on Inbox selection; existing tus fingerprints remain unchanged.
- Tracing Sol's pending-action finding also exposed late clipboard denial focusing a hidden fallback after shelf navigation. Added a failing reproduction, then required Text to remain active before showing/focusing the fallback. This fixes the sibling path at the same asynchronous boundary.

### Final second-iteration checks

- `TMPDIR="$HOME/.cache/storagi/tmp" npm run check`: **passed** — 41 server, 129 web, 11 independent HTTP acceptance and 154 deploy tests; both TypeScript checks and production builds passed.
- Actual built service/browser acceptance: **1/1 passed**, 25.3 seconds in the test body. Copy is visibly inside the 390×844 receiving viewport before any action scrolls it. Screenshots at 390/728/1440 were regenerated with synthetic example.com text; coordinator inspected the phone proof directly.
- Full suite now includes the upload-resume storage regressions and late-clipboard navigation case. No production service, authorization or network mapping changed.
- Replaced the unpushed first implementation commit before publication. Historical first-round review SHAs above describe the reviewed local iteration; its example browsing URL is absent from the final source and publishable history.
- Implementation complete; final independent scores and read-only invariance evidence belong to separate next-round review records.
