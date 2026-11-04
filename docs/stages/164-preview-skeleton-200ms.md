# 164: Hover preview placeholder at 0.2 s

- Status: completed; review in stage165
- Started / last updated: 2026-11-04 (Asia/Kuala_Lumpur)
- Coordinator thread: Claude Code session `746afffd-42c4-4b30-8aef-92a7181bdd34`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from this session's runtime metadata)
- Workspace/branch and starting commit: `t3/hover-preview-skeleton` (PR #37), `dde885b`
- Scope and acceptance criteria: after trying stage162, the owner asked: "make it 200ms instead, 700ms feels too slow". Run `npm run check`, check formatting and try it in the real app.

## Decisions

- 0.2 s comes before the existing 0.3 s pause that starts the download, so the placeholder can no longer wait for "this file's load is still running". It now shows at 0.2 s unless that file's preview is already loaded (the 20-entry image and text cache), which still shows straight away at 0.3 s with no placeholder.
- The 0.3 s download pause is unchanged, so sweeping the mouse across the list still does not start a download per row; resting 0.2–0.3 s on a row now shows a placeholder without downloading anything.
- A preview that loads quickly (for example a small text file on the home network) now shows the placeholder briefly before its content. Videos are not cached, so returning to one shows the placeholder again until it loads.

## Changes

- `web/src/dashboard.ts`: the placeholder timer is 200 ms and checks `previews.has(id)` instead of a running load.
- `web/tests/dashboard.test.ts`: the first preview test checks nothing at 199 ms, the placeholder at 200 ms (before the download starts), the image replacing it, and a cached image showing at 300 ms with nothing before; two video tests now expect the placeholder, rather than an empty hidden box, while a video is still loading.

## Verification

- RED→GREEN: the 200 ms check failed with the stage162 code and passes after the change. With the 6 s cap reverted to `cancelLoad()`, the cap test still fails, so it still guards the placeholder being removed. Dashboard 55/55 PASS.
- `npm run format:check` PASS; `npm run check` exit 0 (33 server, 109 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds).
- Chromium 1243 and Firefox 1555 on the mock preview (loopback port 5163), downloads held 2.5 s (`skeleton-164.mjs`): nothing at 150 ms; timed in the page, the placeholder at 207 ms (Chromium) and 200 ms (Firefox), the image at about 2.9 s; leaving after 0.15 s showed nothing; returning to the loaded image showed it at 307–350 ms with no placeholder. A paced 26 s Chromium recording was made.
- Private scripts, logs, screenshots and the recording are outside Git in `"$HOME/.cache/storagi/repro"`, `"$HOME/.cache/storagi/tmp"` and `"$HOME/.cache/storagi/proof-skeleton-200"`.

## Findings and limitations

- Not tried on the owner's own devices.

## Handoff

Stage165 reviews this change.
