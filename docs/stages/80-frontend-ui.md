# 80: Frontend port UI

- Status: implementation completed; coordinator integration and independent review pending
- Started: 2026-10-23 +08:00
- Last updated: 2026-10-23 01:47 +08:00
- Coordinator thread: Claude Code (Claude Opus 5.5) in T3 Code, thread `90da6e4a-818a-4e67-bc98-98f1606e3cd0`
- Agent/task identifiers: coordinator retains the delegated-task identifiers
- Provider/model/effort: OpenAI Codex harness, gpt-6.1-sol, high, explicitly identified by this implementation session's injected T3 runtime metadata; coordinator session-log confirmation is separate.
- Workspace/branch and starting commit: assigned worktree, `t3/replace-dashboard-ui`, `7f5402564b114ea84972a3a1464b934d28d42ec4`.
- Scope and acceptance criteria: replace the dashboard with the approved [final design](../../design/explorations/HANDOFF.md), against the service API and existing tus queue, using stage 79 modules; no server/design/index changes, push, PR, deployment or host-service operation.

## Owner decision (2026-10-23)

Downloads are hybrid: single desktop downloads use `showSaveFilePicker` when available, followed by a fetch stream into its writable, with progress/speed/ETA and Cancel. Phones and browsers without the picker use ordinary download links. Selection downloads always use ordinary links.

## Decisions

- Port the prototype's DOM and stylesheet. Keep the two static markup fragments in `shelf.html` and `locked.html`, imported as raw strings; these are markup, with no component system, routing, framework, runtime dependency or simulated service. The locked tree replaces the authenticated DOM completely, retaining only made-up decoy rows.
- Reuse every stage 79 module: formatting, transfer metrics, auto-refresh/offline retry, selection, sorting/day groups, deferred deletion, preferences, pond/mark and tokens. Preserve the existing tus transport, queue, resumable fingerprint handling, safe URL guard and CSRF behavior.
- Keep transfer rendering separate from tus transport so uploads and real streamed downloads share the `.tr` rows, rates, ETA and thirty-second history. Keep buttons mounted during progress, feed unchanged progress every second, and reset each upload estimator when it starts/resumes. Completed/cancelled rows begin leaving after four seconds and are removed on the following one-second tick.
- Use server budget, used bytes and reserved bytes. Keep the full-shelf notice neutral and separate from the red offline banner. A tus 507 means insufficient space and retains the quota-specific row recovery; it is not treated as a disconnected host.
- Downloads have Cancel only, as explicitly requested; no download Pause, Range resume, service worker or directory picker. Ordinary downloads are handled by the browser and cannot expose status/progress or session errors to this page. Browsers may ask to permit multiple selection downloads.
- Keep all state local to the page. Cleanup aborts active streams/uploads without terminating saved tus partials, destroys animations/timers/listeners, and cancels uncommitted deletes when the view is left. Failed logout keeps the same shelf and picker mounted.
- This is the assigned implementation stage. Further delegation, independent read-only review, stage-index maintenance, integration, publication and deployment remain with the coordinator, as in stage 79.

## Changes

- Replaced `web/index.html`, `dashboard.ts` and `style.css`; imported tokens from `main.ts`. Added `shelf.html`, `locked.html`, `gestures.ts`, `transfer-view.ts` and `ui.ts`. Removed unused prototype toolbar CSS from tokens. The head has the SVG/ICO/16/32/48 PNG/touch icons, black theme color and Storagi title.
- Implemented loading/error retry, locked/expired session, grouped shelf, empty koi, offline retry, search/shortcuts, persistent sorting/clear, tri-state/shift/range selection, bulk actions, inline delete/Undo/countdown, pointer/touch/wheel gestures, sidebar/sheet/tabs, pinned speed summary, settings and sign-out confirmation.
- Added real API/CSRF calls and AutoRefresh (60 seconds, visibility rules, upload creation/completion refresh); retained old rows during refresh. Offline uses OfflineRetry's ten-second retry, red banner/status/title, still grey pond and dimmed list.
- Restyled tus rows with blocks, amount/percent/speed/ETA, outcome/removal and exact error recovery messages. Added accessible transfer status text, short resume instructions and full-capacity notice. Streamed downloads open the picker synchronously inside the click handler and count actual bytes into the shared transfer panel.
- Removed the extra tokens build input while keeping `assetsInlineLimit: 0`. Extended the font build test to require exactly one CSS and one JS output.
- Preserved every harness control; added only `/__test/offline` and fixture `Content-Length`, plus a CSS class for the existing synthetic banner. Offline takes precedence over all `/api/*` handlers, including the armed resume-auth control. Updated the web guide.
- Rewrote dashboard acceptance, adapted only selectors in the two preserved suites, and added transfer-view coverage for focus, stalled speed decay, shared chart history and automatic departure.
- Source line counts (excluding stage 79 TS modules): `main.ts` 4, `dashboard.ts` 250, `transfers.ts` 113, `gestures.ts` 75, `transfer-view.ts` 97, `ui.ts` 35: **574 TS lines**. Static fragments add 175 HTML lines; `style.css` is 410 lines. This is below the size ceiling; the TS is about 47 kB, comparable to the prototype app plus original tus queue. No remaining size overrun.

## Verification

- `npm run setup`: completed because dependencies were missing; package manifests/lockfiles unchanged. Temporary build/test data used the prescribed quoted `$HOME/.cache/storagi/tmp` location.
- `npm run check`: first complete run PASS (32 server + 57 web + 11 independent HTTP acceptance tests, typechecks and builds). **Final run after transfer-view coverage and visual cleanup: PASS, exit 0; 32 server + 58 web (12 files) + 11 independent HTTP acceptance = 101 tests, zero failures/skips, both typechecks and both builds passed.** Logs are ignored `.stage80-check.log` and `.stage80-check-final.log`; these local logs are not public proof artifacts.
- Focused final app suites: **33 tests passed** (18 dashboard, 5 tus queue, 9 installed-client resume/session, 1 transfer view). Existing transfer/session assertions all remain; no skips/deletions/expectation weakening.
- `git diff --check` and final staged whitespace check: PASS. The first staged check found trailing blank lines in the two new HTML fragments; removed before final handoff. `rg -n 'style=|#content|file-row|delete-dialog|\\.proto' web/src web/index.html`: no matches. No `server/`, `design/` or stage-index edits.
- Production emits one CSS entry, one JS entry and all three external WOFF2 files. The build test checks exact font presence/references, `@font-face`, no data-font URLs, and single CSS/JS outputs.
- T3 preview status/open attempted first. Browser opening returned: “This host blocks the sandbox T3's browser runs in (AppArmor on Ubuntu 23.10+).” No host setup/permission changes were made. Used the already-installed Playwright Chromium headless shell with `--no-sandbox` as the supported fallback after this explicit unavailability.
- Loopback harness browser checks at **1440×1000, 1100×1000 and 390×1000**: five grouped fixture rows, expected desktop panel / narrow tabs / phone menu and search layouts, no horizontal overflow (document width exactly viewport width), readable duplicate labels and no page errors. First rows at approximately y431/y483/y550 including the synthetic banner. Visually inspected desktop and phone screenshots against the supplied references.
- Browser interactions passed: sort survives refresh/clear; `/` search and Esc; select-all/bulk Undo; inline confirm/Undo; red offline title/banner and Retry recovery; settings/motion switch; 24 MiB synthetic upload pause/resume to completion; full-shelf notice; sign-out clears private DOM. Additional run passed reversible mouse drag (three selected, then back to two), horizontal wheel swipe/Undo, phone sheet Settings/Inbox navigation, simulated 400 ms touch hold, actual phone browser fixture download, desktop picker-backed real fetch stream (picker/writable mocked, response real harness), six-second bulk commit to empty shelf/dotted koi, and session expiry on refresh.
- Screenshots/scripts/raw browser logs remain outside Git in ignored `artifacts/stage80/`: `shelf-{1440,1100,390}.png`, `offline.png`, `settings.png`, `transfer.png`, `locked.png`, `empty.png`, `browser.log`, `interactions.log` and `interactions-final.log`. The synthetic banner remains visible. Browser processes and the loopback harness are stopped before handoff.

### Changed test assertions

The preserved suites changed **selectors only**, with all expected values, call counts, options, request sequences, fingerprints, storage snapshots, offsets, quota and abort assertions unchanged:

1. `transfers.test.ts`, “halts every upload…”: the private-list absence assertion queries `#groups` instead of `#files` (one source assertion).
2. `session-resume.test.ts`, HEAD 401/403: the private-list absence assertion queries `#groups` instead of `#files` (one source assertion, two executions).
3. `session-resume.test.ts`, failed logout network/500: the exact two completed status strings are queried through `.tr-status` instead of `.transfer-status` (one source assertion, two executions; both exact strings unchanged).
4. `session-resume.test.ts`, logout 204/401/403: the private-list absence assertion queries `#groups` instead of `#files` (one source assertion, three executions).
5. The two logout action selectors in `session-resume.test.ts` change `#logout` to the popup's `#signout-confirm`; these are actions, not assertion changes. Dashboard acceptance separately proves that the popup opens first and sends nothing until confirmed.
6. `font-build.test.ts`: renamed the test to describe the single entry, and added two assertions requiring exactly one CSS and one JS asset. Existing font/CSP assertions remain unchanged.

`dashboard.test.ts` was explicitly authorized for replacement. The previous five tests' old DOM assumptions (`data-file-id`, `data-delete`, modal dialog, no images anywhere, immediate delete and old empty/search wording) are replaced by these eighteen complete assertion groups; the current test file is the executable detail:

| Test | Assertions |
| --- | --- |
| Locked | Static decoy exists; Google link; no private groups/name; only session fetched. |
| Group/sort/search | Newest IDs; two day headings; exact duplicate suffix; ascending size IDs; no headings while sorted; same order after refresh; clear restores newest; no search rows and useful message; Esc restores two rows. |
| Inline delete | Confirm exists; no early call; no DELETE before 6000 ms; DELETE with cookies/CSRF at deadline; undone copy has no DELETE after grace. |
| Selection/bulk Undo | Partial selection makes header indeterminate; select-all checked/count two; bulk hides rows; Undo restores two; only initial session/list calls after grace. |
| Offline | Visible banner, offline title, retained two rows and red pill; successful Retry hides banner and restores title. |
| Expiry | Refresh 401 removes groups and private name; card explains reselecting interrupted files. |
| Capacity | Equality including reservations shows full notice; meter description includes reservations. |
| Logout | Popup visible; no early request; POST carries CSRF; groups removed; successful logout does not show expiry message. |
| Stream download | Picker called synchronously with suggested filename; default link prevented; one write/close; saved outcome row. |
| Link download | Correct href/download attribute; default action remains allowed; browser-handling toast. |
| Hostile/expired | Hostile name is text; no injected image; no download for expired row; Expired label. |
| Initial failure | Loading error describes host/session check and has Try again. |
| Direct/shift checks | Direct checkbox stays checked after native click; shift selects both rows. |
| Bulk commit | No early request; both DELETEs carry CSRF after grace. |
| Retry/cleanup | Network failure sets title; ten-second retry recovers; expiry cancels pending delete. |
| Download cancel | Exactly one action (Cancel); fetch signal aborted; writable aborted; cancelled outcome. |
| Phone fallback | Picker not called at 390 px; ordinary link default preserved. |
| Settings/navigation | Settings visible; both preferences stored; phone sheet opens; Transfers tab set; `/` focuses search. |

New `transfer-view.test.ts` asserts preserved pause-button focus, speed decay on unchanged bytes, empty metrics history for the next transfer while shared chart remains visible, leaving animation after four seconds, then removal. It replaces no existing assertion.

## Findings and limitations

- Initial locked-state acceptance failed against the old UI as expected, then passed with the port. Later regression checks caught direct checkbox default-action rollback and keyboard events targeted at Window lacking `matches`; fixed with a post-default in-place checkbox sync and an Element guard. Typecheck also caught untyped search `.value` access and a test stub's extra argument; corrected before final check.
- Required departures from simulation: real clock/local dates and server quota/metadata; actual tus/fetch byte counts; no simulated upload/download speeds; browser fallback downloads; Cancel-only streamed downloads; browsers may require multiple-download permission. No extra product options were added.
- The resume note, full-capacity banner, expiry recovery line and upload-error text are deliberate real-service additions required by the handoff/audit. Screen replacement destroys private rows rather than retaining a hidden authenticated shelf after expiry.
- The page cannot observe authentication/network failures of an ordinary browser-managed download; those remain with the browser. Stream cancellation can leave a partial local target file, depending on the browser's writable implementation.
- No real Google login, deployed service, WAN throughput, multi-GB transfer, physical phone/touchpad, OS file-drop or Firefox browser was exercised. Picker/writable interaction was synthetic, while its request/stream came from the real harness. Touch and wheel were simulated. This is not deployment/owner-account proof.
- Independent review is not claimed. The coordinator retains the review routing/model-proof/invariance and integration responsibilities. No push, GitHub post, PR, deployment, network mapping or unrelated host-service action occurred.

## Handoff

Coordinator receives a clean committed implementation branch plus this record; retain the baseline `7f54025` and review the complete UI diff. Reconcile the stage index and add the independent review record separately. Actual-service/Google/device verification and explicit deployment approval remain outside this implementation stage.
