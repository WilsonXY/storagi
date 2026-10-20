# 34: Optional live probe redaction and resource bounds

- Status: implementation completed; stable handoff for fresh stage35 review.
- Planned: 2026-10-20T19:29:32+08:00; native implementation started: 2026-10-20T19:29:33+08:00; last updated: 2026-10-20T19:36:21+08:00.
- Coordinator thread: [implementation](t3-thread://v1/mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a).
- Owner: distinct delegated stage34 implementation agent; coordinator owns index, commits, review and publication.
- Actual provider/model/effort: OpenAI Codex gpt-6.1-sol/high, confirmed from this agent's own native turn_context line8.
- Native session: 01a15912-e677-7c93-ae1b-a1c11a3cda50. The coordinator retains the T3 task identifier; no separate delegated task was started here.
- Workspace/branch: repository root, shared chore/private-rollout; starting HEAD bb30197527244a7f8e5e8bedd415427e71561678, initially clean. No branch or commit created.
- Scope: scripts/acceptance-deployment.mjs, one meaningful offline regression file and this record only; no app/service/network changes.

## Acceptance

Reproduce both stage33 findings before edits. Sanitize initialization/output errors with fixed categories and nonzero exit; prevent raw path/origin/error values reaching logs. Bound each response in bytes and absolute wall time as well as inactivity, with safe destroy/timer cleanup. Keep standard-library implementation minimal. Exercise offline missing/invalid metadata, output failure, oversize and continuous slow response, plus ordinary response success. No live owner data, identity, sessions or private credentials. Record actual RED/GREEN, failures and native runtime proof, then stable handoff for fresh35 review.

## Decisions and changes

Applied full-cycle and Ponytail FULL to implementation mechanics, with TDD and systematic debugging for the two actual stage33 P2 findings. The assigned scope overrides full-cycle's commit, independent-review, PR and root-check steps: these remain coordinator work. No dependencies, production testing switches, exported test hooks or application changes.

- `scripts/acceptance-deployment.mjs`: wrap initialization and final proof output in sanitized top-level handling. Metadata read/parse/URL/flag failures report only `metadata`; directory/proof-write failures report only `output`; exercised request/assertion failures report only `probe`. Every failure sets exit code1. Raw errors and private input values are never formatted for output. Successful proof fields and successful console summary remain unchanged.
- The shared native requester now has an absolute15000ms deadline in addition to its existing15000ms inactivity timeout. It retains at most2MiB of response chunks, destroying the request when the cap is exceeded or the deadline expires. A promise `finally` clears the deadline on success, request error, response error and synchronous rejection. This modest cap is for dashboard/built assets; the optional probe does not download owner files.
- `scripts/acceptance-deployment.test.mjs`: one standard-library offline regression file evaluates the unchanged runnable source using VM module imports. Filesystem, homedir, process and console are isolated in memory. Both HTTP/HTTPS calls are redirected exclusively to owned ephemeral127.0.0.1 HTTP fixtures, using native Node requests. No real readiness file, owner origin or live app is read/contacted. Each fixture closes connections/listener in test cleanup, clears its stream interval, and asserts the listener is closed.

## Root causes and RED/GREEN evidence

The existing catch began after metadata parsing, URL construction and directory creation; the final asynchronous proof write could also reject beyond that catch. The test harness catches module-evaluation rejections instead of printing their private errors. Before the first production edit, all seven metadata/output cases failed with the explicit assertion `raw initialization/output exception escaped` (`true !== false`). This reproduced missing metadata, malformed JSON, invalid URL, non-HTTPS origin, inactive private route, mkdir failure and final proof-write failure. After enclosing these operations and emitting fixed categories, all passed and their private canary was absent from captured output/proof.

The original requester appended every chunk and relied on socket inactivity. Before changing request handling, bounded native fixtures reproduced both resource defects: a4MiB response was accepted, and a response delivering a byte every5ms reached its natural80-byte end rather than being canceled. Each regression failed with `bounded request must fail before accepting body`, actual99 recorded requests versus expected0. The first stream was fully consumed; subsequent small fixture responses let the original probe continue to a later status failure. These RED runs were genuine behavior failures, not fixture or syntax errors.

After adding the shared deadline/cap, both requests fail before accepting a body into proof. The fixtures observe connection closure before their natural response end; the oversize case sends no more than2MiB plus256KiB allowed TCP data in flight. The continuous case receives multiple bytes then is canceled before80 bytes. To keep the offline check short, only the VM's absolute timer is compressed to100ms for that test; native socket inactivity remains15000ms. Thus arriving data cannot satisfy the regression by merely reaching an inactivity timeout. The test also verifies the script arms a positive deadline no greater than15000ms.

Normal completion exercises the entire script against an artificial response fixture:213 requests/15 named checks and unchanged successful summary/proof fields. This is offline regression evidence, not another live-app acceptance claim. Request reset, truncated response containing a private canary, oversize, deadline and normal completion all leave zero tracked deadline timers; raw values never reach captured logs or proof. The test harness itself clears any leftover timers after measuring them, so a regression cannot leave owned timers running.

## Actual verification commands and outcomes

```sh
node --experimental-vm-modules --test scripts/acceptance-deployment.test.mjs
node --check scripts/acceptance-deployment.mjs
node --check scripts/acceptance-deployment.test.mjs
git diff --check
git status --short
git branch --show-current
git rev-parse HEAD
```

The same focused test command was run sequentially through these iterations:

1. RED initialization/output: exit1; seven failing leaf cases, eight failing TAP tests including their parent.
2. GREEN sanitized handling: exit0; eight TAP tests passed.
3. RED resource bounds: exit1; twelve TAP tests, ten passed and two failed as described above. Normal213-request/15-check completion and the request-error case already passed.
4. GREEN deadline/cap: exit0; all twelve passed.
5. Strengthened fixture-destruction observations and partial-response error coverage: exit0; fourteen TAP tests passed, zero failures/cancellations/skips, about1.1s. Both script syntax checks and whitespace check passed; HEAD/branch unchanged.

Node prints its expected `ExperimentalWarning: VM Modules is an experimental feature and might change at any time` for the test runner's VM API. This warning comes from the offline harness, not the probe. No failing harness attempts, operational retries or hidden application failures occurred; the recorded RED failures are the intended reproductions. No root build/test command or live probe was run. A final scan of the three owned files found zero literal home-directory paths; public evidence uses repository-relative or quoted portable paths.

Native proof was obtained by reading only `turn_context` records from the file selected by this session's `CODEX_THREAD_ID`, printing only model/effort and line number. Portable evidence path: `"$HOME/.codex/sessions/2026/10/20/rollout-2026-10-20T19-29-33-01a15912-e677-7c93-ae1b-a1c11a3cda50.jsonl"`, line8: `model=gpt-6.1-sol`, `effort=high`. Requested settings and the injected runtime were not substituted for native evidence.

## Findings, limitations and handoff

Both stage33 P2 findings are resolved by the exercised offline checks; fresh independent stage35 review is still required. Reverting these optional-script/test changes is reversible and affects only manually invoked deployment acceptance. The2MiB/15s bounds can intentionally fail the probe on larger assets or slow endpoints; they do not alter serving or file transfer behavior.

Stage30's prior live213-request/15-check evidence remains historical. Coordinator must rerun the stable script against the private endpoint after integration/review as appropriate. Real owner production Google login and Storagi denial of another signed Google account remain pending; Funnel remains off according to the existing stage records. No new operational status is claimed, and these fixes do not waive those prerequisites.

Owned files only: the optional probe, its one offline regression file, and this stage record. No index/root docs, app/server/web/deployment sources, manifests, private Google configuration/environment, database, sessions, enrollment logs, owner files, host/network mappings or power settings were read or changed. No commits, branches, pushes, posts or delegation. No browser was started. All owned fixture listeners, connections and timers are closed; no owned process remains running. Edits stop at final handoff for coordinator integration and fresh stage35 review.

## Coordinator integration and final live verification

- Task: node:delegated-task:command%3Amcp%3A3e6c78fc-c05c-4c21-8927-674b0c47336c%3Adelegate-task%3Astoragi-stage34-live-probe-fixes-v1.
- Coordinator independently parsed native turn_context line8 and confirmed gpt-6.1-sol/high; reviewed owned diff and prior findings.
- Preserved old live proof in ignored artifacts/acceptance-stage34/http-proof-before-fixes.json, then ran node scripts/acceptance-deployment.mjs: PASS213requests/15checks; saved final proof to http-proof-after-fixes.json beside it. No session values or hostname in proof.
- Reran node --experimental-vm-modules --test scripts/acceptance-deployment.test.mjs:14pass/0fail,981ms; VM experimental warning only. Both syntax checks, whitespace and tracked privacy scan PASS. App/server/web/package/deploy diff from merged main remains empty.
- No UI-flow change, so stage30 browser screenshots remain applicable; owner real production login and signed other-account denial are still distinct pending checks. Stage35 independently reviews committed fixes before publication.
