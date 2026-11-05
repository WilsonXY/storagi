# 163: Compressed previews review

- Status: completed; FAIL with one P2, fixed by the coordinator
- Started / last updated: 2026-11-04 (Asia/Kuala_Lumpur)
- Coordinator thread: this T3 thread; coordinator Claude Opus 5.5 (`claude-opus-5-5`)
- Agent/task/thread identifiers: T3 `delegate_task` review child "Review stage 163: compressed previews", Codex session `01a1a598-ff9c-76d0-ba3d-0ee8a630a2bd`
- Provider/model/effort: Codex `gpt-6.1-sol`, reasoning effort high, confirmed from the reviewer's own Codex session log (`"model":"gpt-6.1-sol"`, `"reasoning_effort":"high"`)
- Workspace/branch and starting commit: a fresh T3 review worktree at `f8f3ac4` (stage 162's commit on `t3/compressed-previews`)
- Scope and acceptance criteria: read-only review of `efdea33..f8f3ac4` for correctness, races, security, sandbox compatibility, client fallback, test adequacy and record accuracy.

## Findings and limitations

- P2, `server/src/app.ts`: every preview request started its own `ffmpeg`, with no global limit. The 20 s timeout and 8 MiB output cap bound each process, but not total CPU or decoded-frame memory, and the systemd unit sets no CPU or memory limits. The reviewer reproduced eight simultaneous children with an `ffmpeg` stub.
  - Fix: at most two transcodes at once; a third request gets 503 before `ffmpeg` starts, and the dashboard falls back to the original. The slot frees on exit, failure, kill or spawn error. Two rather than one, so a cancelled hover whose `ffmpeg` is still being killed does not refuse the next row.
- The reviewer's probes on a scratch copy otherwise passed: deleting a file mid-transcode, client disconnect, a 12 MiB output and a stalled child (killed at about 20 s) all released the pin and quota. It found no auth bypass or argument injection, and the whitelist refused the playlist and MPEG-TS inputs.
- The committed tests do not cover deletion, disconnect, timeout or oversized output deterministically; the reviewer's probes did. Left as is.
- Not verified by the reviewer: the full systemd sandbox, real-browser media behaviour, WAN performance, and the cause of the intermittent failure stage 162's agent suspected. The reviewer's `npm run check` on the reviewed commit passed, with the same counts as stage 162.

## Changes

- `server/src/app.ts`: the global two-transcode cap in `preview()`.
- `server/test/preview.test.ts`: a stand-in `ffmpeg` (`exec sleep 1`, no output) shows that three concurrent requests give 422, 422 and 503, a later one runs after failures, and a cancelled request frees its slot.

## Verification

- `npx tsx --test test/preview.test.ts` (in `server/`): 3/3, three runs in a row. A first version of the stub, a shell script that ran `sleep` as a child, kept stdout open after the kill and failed the cancel check; `exec` makes it one process, like `ffmpeg`.
- `npm run format:check` and `npm run check` after the fix: exit 0. Server 36/36, web 110/110, acceptance 11/11, deploy 154/154, both typechecks and builds.

## Handoff

Repository invariance after the review: this checkout's `HEAD` stayed `f8f3ac4` with a clean status, and `git ls-remote --heads origin` matched the snapshot taken before the review. The reviewer's worktree was still at `f8f3ac4` with a clean status; it and its branch `t3/review-stage-163-preview` were removed. The fix was not re-reviewed.
