# 252: Browser test cleanup and same-frame alignment

- Status: completed
- Started / completed: 2026-11-08 02:22 / 02:33 Asia/Kuala_Lumpur
- Coordinator thread: shelf-test cleanup coordinator, branch `test/strengthen-shelf-tests`; [plan 250](250-test-cleanup-plan.md).
- Agent/task: bounded implementation child, T3 task suffix `24a30157-689e-4a4d-bd00-c9692c4cf13b`; own session `01a1b73f-ae63-7063-99f7-f408752c5943`.
- Provider/model/effort: actual Codex `gpt-6.1-sol`, `high`, verified from this child's own `turn_context` in `$HOME/.codex/sessions/2026/11/08/rollout-2026-11-08T02-22-46-01a1b73f-ae63-7063-99f7-f408752c5943.jsonl`. Sanitized local extract: `artifacts/stage-252/own-session-evidence.json` (ignored).
- Workspace/branch and starting commit: `test/strengthen-shelf-tests`, `b44bb6d17beb896146b8f01a987bb69a990a9289`.
- Scope: only `scripts/acceptance-text-browser.test.ts`, `scripts/acceptance-retention-browser.test.ts`, `scripts/acceptance-transfer-panel.mjs`, and this record. Preserve partial prior edits. No child agents, commits, pushes, PRs, source scheduler edits or source mutations.
- Acceptance: atomic meaningful Choose-files geometry; manual Refresh attributable to the button at both poll cadences; narrow red/green browser proofs; only demonstrated duplicate removal; changed acceptance with pinned Chromium against isolated actual synthetic services on loopback; stop owned processes.

## Decisions and coordination

The earlier Opus implementation child stopped at its usage limit. Its partial alignment and Refresh instrumentation edits were preserved and completed under the owner's Sol/high override. Unit/server cleanup belongs to stage 251; the coordinator owns full `npm run check`, independent review and Git operations.

The companion shared-refresh branch adds frozen browser clocks, explicit cross-device Refresh calls and cadence/visibility/offline checks. Our Refresh measurement depends only on a real browser click's capture/target/bubble dispatch and uses no timeout, sleep or poll-clock advancement. The companion coordinator received the completed broad-browser results and the narrow-run schedule directly. No source was mutated while another process built it; counterexamples use disposable browser injection only.

## Changes and retained coverage

- Text: read both composer and Choose rects in one synchronous `evaluate`, while the actual Transfers grid may be moving. Preserve the 20 px right-gap limit, require CSS visibility and nonzero opacity, positive width and height for both boxes, and contain all four button edges within the composer. Negative right overflow cannot satisfy this predicate.
- Text: count actual `/api/texts` GET invocations and record the count difference between document capture and window bubble for the real Refresh click. A periodic timer cannot interleave this event dispatch. A bounded retry of real Playwright clicks permits an existing read to finish when Refresh joins it. Remove the partial edit's synthetic click, 20-microtask loop and `setTimeout(50)` retry. The subsequent rendered-note assertion remains.
- Retention: remove only the repeated three reduced-motion opacity inequalities and the repeated sample transform/width/height loop (eight lines). `deepEqual(reduced.samples, pulse.samples)` already carries these bounds from the fully checked normal-motion samples. Keep the reduced background-image assertion: background image is outside `samples`, so sample equality does **not** imply it. Also keep reduced count/duration, color, disabled state, screenshots and real recording/replay.
- Transfer: remove only the loose Settings right-edge checks at 1440 and 390 px, already covered more strictly by retention's exact header-padding test. Keep the 1000 px edge bound because retention omits that distinct intermediate layout. Preserve actual Settings open/close behavior at all three widths; update the evidence description accordingly.
- Security, expiry, lifecycle, race, ETag, distinct geometry, browser parity, responsive widths, accessibility, touch/mouse/keyboard, file upload/download and reduced-motion behavior remain. Obsolete-selector unit duplicates remain stage 251's scope.

## Verification

All browser commands use:

```sh
export TMPDIR="$HOME/.cache/storagi/tmp"
export PLAYWRIGHT_MODULE="$HOME/.cache/storagi/pw-1641/node_modules/playwright-core/index.mjs"
export CHROME_EXECUTABLE="$HOME/.cache/storagi/pw-1641/browsers/chromium-1248/chrome-linux64/chrome"
```

Installed `playwright-core/package.json` confirms **1.64.1**. Each actual-service run uses signed test identities and disposable data. Local evidence is ignored and must not be published wholesale because raw tool errors can contain machine paths.

- `npm run build --prefix web`: PASS, actual production dashboard built before service/browser runs.
- `server/node_modules/.bin/tsx --test scripts/acceptance-text-browser.test.ts scripts/acceptance-retention-browser.test.ts`: PASS, 2/2; Text 122.56 s, retention 57.58 s, aggregate 130.54 s. Log: `artifacts/stage-252/browser-acceptance.log`. Acceptance screenshots/results stay in their normal ignored artifact directories.
- Focused formatting of the three owned scripts: PASS.
- `node_modules/.bin/prettier --check scripts/acceptance-text-browser.test.ts scripts/acceptance-retention-browser.test.ts scripts/acceptance-transfer-panel.mjs`: PASS. `git diff --check`: PASS.
- `server/node_modules/.bin/tsx --test artifacts/stage-252/transfer-actual.test.ts`: PASS, 1/1, 29.77 s total. This 72-line local adapter starts the **actual** service, seeds one empty file, signs the test owner through the existing identity helper, and runs the owned transfer-panel script directly with a local Playwright wrapper that supplies that signed session cookie. Service authorization remains intact. Chromium reports `156.0.8078.4`; responsive widths 1440/1180/1000/728/390, transitions, Settings toggle, resize state, upload/download auto-opening and reduced motion passed. Evidence: `artifacts/stage-252/transfer-actual-service.log` and `artifacts/stage-252/transfer-actual-service/result.json`.

### Narrow Refresh red/green

The independent, ignored `artifacts/stage-252/refresh-seam.test.ts` is 143 lines: actual service/auth setup plus the exact owned fetch instrumentation and click assertion, without replaying the long acceptance baseline. A final text comparison confirmed the copied instrumentation and real-click loop exactly match the owned script. `NOOP_REFRESH=1` replaces only the application's registered button callback in the disposable browser, preserving real click propagation and the actual polling code. `POLL_MS=60000` changes only the disposable page's 5000 ms interval registration. `FROZEN=1` installs and pauses Playwright clocks before navigation.

With the common environment above, these commands were actually run:

```sh
server/node_modules/.bin/tsx --test artifacts/stage-252/refresh-seam.test.ts
POLL_MS=60000 server/node_modules/.bin/tsx --test artifacts/stage-252/refresh-seam.test.ts
NOOP_REFRESH=1 server/node_modules/.bin/tsx --test artifacts/stage-252/refresh-seam.test.ts
NOOP_REFRESH=1 POLL_MS=60000 server/node_modules/.bin/tsx --test artifacts/stage-252/refresh-seam.test.ts
FROZEN=1 server/node_modules/.bin/tsx --test artifacts/stage-252/refresh-seam.test.ts
FROZEN=1 POLL_MS=60000 server/node_modules/.bin/tsx --test artifacts/stage-252/refresh-seam.test.ts
FROZEN=1 NOOP_REFRESH=1 POLL_MS=60000 server/node_modules/.bin/tsx --test artifacts/stage-252/refresh-seam.test.ts
```

Results: all four unmutated cases PASS, `refreshRead:true`, total GET count 2 (initial load plus manual). All three no-op cases fail exactly `manual Refresh itself starts a fresh Text read`, exit 1, `refreshRead:false`, total count 1 at measurement. In the 5 s no-op case, the old eventual-row check subsequently **passes through the real periodic poll**, proving why that original check was insufficient. Frozen-clock cases complete without advancing any app poll clock. Logs are `artifacts/stage-252/refresh-{green,red}-{5s,60s}.log` and `refresh-frozen-{green,red}-{5s,60s}.log` for the cases listed; no frozen 5 s red run was needed.

### Moving layout and geometry counterexamples

`artifacts/stage-252/align-loop.test.ts` uses the actual service and upload auto-open, then repeatedly toggles the real Transfers panel. Its synchronous geometry callback exactly matches the owned acceptance callback (checked by text comparison). It uses no settling sleep; the proof deliberately samples movement.

```sh
ITER=12 server/node_modules/.bin/tsx --test artifacts/stage-252/align-loop.test.ts
ITER=6 MISALIGN=1 server/node_modules/.bin/tsx --test artifacts/stage-252/align-loop.test.ts
```

- Green: PASS, 75 samples, 68 during the actual grid animation; same-frame gap always **12 px**, zero failures. The previous two-call measurement ranges from -20.9375 to 74.359375 px and falsely fails 19 times.
- True regression: disposable `margin-right:40px!important` produces a **52 px** same-frame gap; all 35 samples (31 during animation) are rejected. The counterexample proof exits 0 because it asserts every measurement rejects the mutation.
- Overflow: disposable `margin-right:-40px!important` produces **-28 px**, with containment false, and is rejected. This closes the former negative-gap false-pass path.
- Logs: `artifacts/stage-252/alignment-green.log`, `alignment-margin-red.log`. The earlier Opus scratch files/logs were preserved; the resumed runs use the completed predicate.

### Cleanup and release

All service/browser scripts close browsers and actual service instances in `finally` and remove their disposable data directories. Final process inspection matched executable/argument names and this repository's working directory: **zero owned synthetic/browser processes**. Every started command session completed; no server was left running, no host setting or mapping changed. All independent copied proof scripts, wrappers and logs remain under ignored `artifacts/stage-252/`.

After this inspection, the companion coordinator was explicitly sent **HEAVY WINDOW RELEASED NOW** for its `npm check` then browser window. This child starts no further heavy jobs. The shelf-test coordinator must wait for that window to end before its own integration run.

## Failures and limitations

- T3 `preview_status` reported no available browser; `preview_open` first rejected `about:blank` as an invalid preview URL, then a valid loopback URL failed with the host's AppArmor sandbox block. Used the allowed local pinned Playwright fallback; changed no host settings. Final `preview_status` confirms no tab was opened.
- Initial disposable negative-overflow injection used `transform`; its immediate measurement still read the original 12 px gap because the style transitions had not taken effect. This was a proof-injection failure, not a failure of the same-frame predicate: that run recorded 16 samples, 15 during grid motion, with atomic gap 12 throughout and six false failures in the old two-call measurement. The failed log remains at `artifacts/stage-252/alignment-overflow-injection-failed.log`; the immediate negative-margin rerun passed.
- Real Google OAuth, production, external exposure and physical devices are outside this stage. Cadence compatibility probes adjust only the disposable page's interval registration, not the source scheduler; the companion stage owns verification of its actual scheduler implementation.

## Handoff

The three owned scripts and this completed record are ready for integration. HEAD remains `b44bb6d17beb896146b8f01a987bb69a990a9289`; this child created no commit or PR. Prior partial work and sibling unit edits are preserved. Coordinator owns full `npm run check`, independent review, commits and the PR; its heavy run waits for the companion window to finish. Model/effort evidence, narrow copied artifacts and all exact results above are available locally. No synthetic process remains.
