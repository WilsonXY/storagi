# 49: Frontend port foundation

- Status: implementation completed; coordinator integration/review pending
- Started: 2026-10-23 +08:00
- Completed: 2026-10-23 01:27 +08:00
- Coordinator thread: Claude Code (Claude Opus 5.5) in T3 Code, thread `90da6e4a-818a-4e67-bc98-98f1606e3cd0`
- Agent/task identifiers: filled in by the coordinator after delegation
- Provider/model/effort: OpenAI Codex harness, gpt-6.1-sol, high; explicitly identified by the injected T3 runtime metadata in this implementation session. Coordinator session-log confirmation remains separate.
- Workspace/branch and starting commit: assigned worktree, `t3/frontend-foundation-modules`, `61a30e777a32fd0586a3a01e55f2700ead857961`.
- Scope and acceptance criteria: see the [handoff](../../design/explorations/HANDOFF.md). Bring the reusable prototype parts into `web/` as TypeScript (fonts, brand icons, tokens, `KoiPond`/`KoiMark`/`orbitLoader`, formatting, speed/ETA, auto-refresh timing, selection with drag ranges, sorting, delayed delete with undo, offline retry timing, preferences), with unit tests; extend `server/src/static.ts` for the owner's icons with tests. No UI rewrite (stage 50). `npm run check` passes.

## Decisions

- Port the approved drawing and interaction logic without redesigning it. `koi.ts` is 406 lines versus the 378-line reference; reusable logic totals 258 lines, including types, cleanup, real progress estimation and extracted offline retry. No dependencies, plugins, state stores or scheduler framework were introduced.
- Keep the existing dashboard, stylesheet, HTML, transfer implementation and harness unchanged. The new formatter follows the prototype's fixed fractional digits; the old `transfers.ts` formatter stays in place to preserve the current UI. Stage 50 can adopt the new formatter when rewriting transfers.
- Build `tokens.css` as a separate Vite input so production emits its fonts now without applying the new design to the current page. Disable asset inlining. Fonts and their OFL files remain together in source.
- Use browser-local calendar dates (including DST) and real timestamps. Retain the prototype's 0.7/0.3 EMA over one-second windows; interpolate bytes between sparse tus callbacks rather than simulate bandwidth. Keep thirty one-second history samples.
- Follow HANDOFF.md's explicit motion policy (`swim`/`static`, ignoring OS reduced motion), overriding the older wording in REFERENCES.md. Return listener unsubscribe functions, clear intervals/rAF, and disconnect observers on teardown.
- The coordinator already assigned this bounded implementation stage. No further stages or reviews were delegated by the implementer; the coordinator retains stage-index and independent-review ownership. Nothing was pushed or posted to GitHub.

## Changes

- Added `web/src/fonts/` with the three original woff2 files and both OFL licenses; copied the seven ICO/PNG icons into `web/public/`. The brand SVG already matched, so its bytes did not change.
- Added `tokens.css`, typed `koi.ts` and the unchanged baked bitmap in `mark.ts`. Splash rings, fish motion, touch interactions, static grain, mark sampling and orbit path remain from the prototype. The mark uses baked pixels rather than canvas readback; the original optional drawn-fish fallback still uses readback.
- Added `formatting.ts`, `transfer-metrics.ts`, `refresh.ts`, `selection.ts`, `sorting.ts`, `deferred-delete.ts` and `preferences.ts` with the APIs below. Optional toast and file-drop helpers were left for stage 50, where they can be ported alongside their DOM consumers.
- Extended only `server/src/static.ts` and its test for exact icon paths and `image/x-icon` MIME. Added eight frontend test files. Vite configuration emits fonts and makes tests run in America/New_York.

## Verification

- `npm run setup`: completed because dependencies were missing. Lockfiles unchanged. npm reported three existing web dependency audit advisories (one moderate, two critical); dependency upgrades are outside this port.
- New tests were first run against missing modules and failed, then passed after implementation. The new exact-icon test initially failed with 404 and then passed after the allowlist change.
- `npm run check`: PASS, exit 0. Server: 32 tests. Web: 44 tests across 11 files (25 new, 19 existing). Independent HTTP acceptance: 11 tests. Both TypeScript checks and production builds passed. Total: 87 tests, no failed/skipped tests. Ignored local output: `.stage49-check.log` (contains local paths, not committed).
- Web coverage includes EMA/warmup/queue ETA/history/resume baseline, visible/hidden refresh timing and no overlap, offline retry countdown/manual retry, undo/commit/failure, shift and reversible drag ranges, sorting/local day groups, preference events/storage denial, local midnight/DST formatting, koi teardown/touch/baked bitmap sampling, and production font emission.
- Production emitted `assets/JetBrainsMono-Regular-BQaDgvhP.woff2` (92.16 kB), `assets/JetBrainsMono-Medium-3S3k2nMz.woff2` (93.82 kB) and `assets/LeonSans-var-68PQtotx.woff2` (362.73 kB). The build test checks all three file URLs, `@font-face` output, and absence of data-font URLs.
- `git diff --cached --check`: the copied JetBrains Mono OFL contains its original trailing space on line 21; preserved byte-for-byte. The same check excluding that upstream license passed for all authored changes. Reference exploration files and the stage index were not edited. Copied fonts/licenses/icons/tokens/bitmap were compared byte-for-byte with their references.

## Findings and limitations

- A regression test caught synchronous fetcher throws leaving a completed promise cached in refresh/retry. Requests now begin in a promise microtask, and that regression passes. A second regression prevents that queued request from starting if the helper is destroyed first. An initial mechanical SVG numeric-attribute conversion failed typecheck and was corrected before the full check.
- Required deviations from simulation: real tus progress baselines, elapsed-time windows, browser-local dates, real current time, and callback-driven deletion. `AutoRefresh.last` retains the last successful refresh; failed attempts still reset the next attempt deadline. The visibility threshold measures time actually hidden, rather than the prototype's age of last refresh. These follow the handoff requirements.
- Cleanup is added to all new long-lived helpers. The orbit follows live preference changes, whereas the prototype captured its preference once. Async delete rejection is surfaced through `error`/`onError` rather than becoming an unhandled timer rejection.
- No real-browser visual parity, real phone/touchpad, real Google login, live service, WAN or multi-GB measurements were performed in this foundation stage. Koi canvas tests use a synthetic context; they prove behavior and no-readback routing, not rendered pixel parity. The current dashboard's existing 19 tests pass, but no manual browser claim is made.
- Independent read-only review remains with the coordinator. This implementation stage does not claim an independent review verdict or reviewer model proof.

## Handoff

Stage 50 starts from the implementation commit on this branch. Import `./tokens.css` when applying the design. Each new module is independent of the current page:

- `formatting.ts`: `bytes`, `rate`, `duration`, `clock`, `finishAt`, `localDay`, `relDay`, `daysLeft`, `ext`, `shortId`, `ago`; `DateValue` type. Prototype labels with local dates and a real injectable clock for finish time. `finishAt` returns an HH:MM label; `TransferMetrics.finishTime()` returns epoch milliseconds.
- `transfer-metrics.ts`: `TransferMetrics`; `ThroughputSample`, `QueueProgress` types. Call `progress(sent,total,timestamp?)` from tus; the first callback establishes the current/resume offset baseline. Seed `progress(0,total)` at a fresh upload's start if the initial interval should be measured. Exposes `speed`, `sent`, `total`, `history`, `eta()`, `queueEta(items)`, `finishTime(seconds?)`, `reset()`. Reset on pause/resume; if a stalled chart needs zero samples, feed unchanged progress with the current timestamp. History is thirty `{at,speed}` samples at one-second boundaries (no simulated downloads).
- `refresh.ts`: `AutoRefresh`, `OfflineRetry`; `Timing` type (`now`, interval timers). Both emit `change` and expose `busy`, `error`, `remaining`, `now()`, `destroy()`. AutoRefresh also exposes last-success `last` and runs every 60 seconds visibly. OfflineRetry exposes `active`, `start(error?)`, `stop()` and retries ten seconds after each failure. Share the AutoRefresh request path when combining them: the retry callback should `await refresh.now(); if (refresh.error) throw refresh.error`, since AutoRefresh records errors rather than rejecting. Destroy both at logout/page teardown.
- `selection.ts`: `Selection` emits `change`; `ids`, `anchor`, `toggle(id,order?,shift?)`, `set(ids)`, `clear()`, `allState(order)`, `toggleAll(order)`, `beginDrag(id,order)`, `dragTo(id)`, `endDrag()`. Tri-state is `none`/`some`/`all`; drag rows update in place in the consumer.
- `sorting.ts`: `nextSort`, `sortFiles`, `groupFiles`; `SortKey`, `Sort`, `SortableFile` types. Nonmutating natural/name, size and expiry sorting; newest-first ties; null sorting groups by local day. A sorted list is one group keyed by the empty string.
- `deferred-delete.ts`: `deferredDelete(remove, options?)` closes over the real API delete (including ids/CSRF in the consumer), waits six seconds, and returns `undo()`, `commit()`, `destroy()`, `remaining`, `error`. Options support countdown/success/undo/error callbacks and clock/timers. Destroy cancels the grace without deleting.
- `preferences.ts`: `motionPref`, `setMotionPref`, `reduced`, `onMotionChange`, `gesturePref`, `setGesturePref`, `onGestureChange`; `Motion`, `Gestures` types. Exact localStorage keys from the brief; setters dispatch window change events and subscribers return unsubscribe callbacks.
- `koi.ts`: `KoiPond`, `KoiMark`, `orbitLoader`, `orbitAt`; `PondOptions`, `MarkOptions` types. Prototype constructors/options; pond `still`, `paintStill()`, `resize()`, `start()`, `splash(x,y)`; mark `resize()`/`build()`, `still`, `start()`. Both add `stop()`/`destroy()`. The orbit returns the SVG element with `stop()` and `destroy()` attached.
- `mark.ts`: `MARK`, the original baked grayscale bitmap for the dotted mark.

No deploy, service restart, exposure, push, PR or stage-index change was performed. Coordinator supplies independent review and integration evidence separately.
