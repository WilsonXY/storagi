# 162: Placeholder while a hover preview loads

- Status: completed; review in stage163
- Started / last updated: 2026-11-04 (Asia/Kuala_Lumpur)
- Coordinator thread: Claude Code session `746afffd-42c4-4b30-8aef-92a7181bdd34`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from this session's runtime metadata)
- Workspace/branch and starting commit: `t3/aafa5dd6`, `efdea33`
- Scope and acceptance criteria: the owner said the hover preview only appears once it has loaded, and asked for "a preview skeleton or some sort of visual trigger" after the mouse has rested for a while, "after .7s of hovering as a starting point, lets see if this is suitable". Run `npm run check`, check formatting and try it in the real app.

## Decisions

- 0.7 s is counted from when the mouse comes to rest on the name, the same moment the 300 ms load pause starts. The placeholder only appears if that file's load is still running then; a preview that is cached or loads within 0.7 s shows directly, with no flash.
- The placeholder is the preview box with a 240 × 160 px block pulsing in it, reusing the onboarding `ob-pulse` keyframes. It has no reduced-motion override, following the owner's motion rule in `tokens.css`.
- The same placeholder serves images, videos and text; the real preview replaces it and the box is placed again at its real size.
- A video still loading at its 6 s cap now ends like a failed load (hidden, retried on return), so its placeholder does not stay on screen. Before this change nothing was showing at that point, so the visible behaviour is otherwise the same.

## Changes

- `web/src/dashboard.ts`: a `skeletonTimer` started with the preview pause and cleared by `hidePreview()`; the video cap calls `failed()` for a load still pending.
- `web/src/style.css`: `.hover-preview .preview-skeleton`.
- `web/tests/dashboard.test.ts`: the first preview test checks nothing shows at 699 ms and the placeholder at 700 ms, then the image replaces it; the 6 s cap test checks the box is hidden when a pending video is dropped.

## Verification

- RED→GREEN: the placeholder check failed before the change (box still hidden at 700 ms) and passes after it. With the cap still calling `cancelLoad()`, the new cap check fails (placeholder left showing); with `failed()` it passes. Dashboard 55/55 PASS.
- `npm run format:check` PASS; `npm run check` exit 0 (33 server, 109 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds).
- Chromium 1243 and Firefox 1555 on the mock preview (loopback port 5163, no Tailscale mapping), downloads served with the real server's headers and held 2.5 s (`skeleton-162.mjs`). Timed in the page from the first `pointermove`: the placeholder appeared at 702 ms (Chromium) and 710 ms (Firefox), the image replaced it at about 2.9 s. Leaving after 0.5 s showed nothing; a text file loading at once and a cached image both showed without the placeholder. A paced 33 s Chromium recording was made.
- Private scripts, logs, screenshots and the recording are outside Git in `"$HOME/.cache/storagi/repro"`, `"$HOME/.cache/storagi/tmp"` and `"$HOME/.cache/storagi/proof-skeleton"`.

## Findings and limitations

- 0.7 s is the owner's starting value, still to be judged in use. Over the real internet link most image previews take longer than that, so the placeholder will show often there.
- Not tried on the owner's own devices.

## Handoff

Stage163 reviews this change.
