# 162: Compressed hover previews

- Status: completed (implementation agent cut off by a usage limit before its record; coordinator verified and recorded it)
- Started / last updated: 2026-11-04 (Asia/Kuala_Lumpur)
- Coordinator thread: this T3 thread; coordinator Claude Opus 5.5 (`claude-opus-5-5`, from the session's runtime metadata)
- Agent/task/thread identifiers: Claude Code `general-purpose` subagent `ac3f3e2d0d71c5280`
- Provider/model/effort: Anthropic `claude-opus-5-5`, confirmed by the API error that ended the run ("model sent to the API: claude-opus-5-5"); effort unverified (the session default)
- Workspace/branch and starting commit: `t3/compressed-previews`, `efdea33`
- Scope and acceptance criteria: the owner reported that the hover preview takes a long time to load, because it downloads the original file, and asked for a lower-quality preview. Acceptance:
  - A new `GET /api/files/:id/preview` returns a small re-encoded copy made by the host's `ffmpeg`: images as WebP fitting 640×640, videos as the first 3 s, muted, H.264 fragmented MP4 fitting 480×480. Same authentication, file checks and pinning as `/download`.
  - `ffmpeg` runs without a shell, with `-protocol_whitelist file` and a demuxer `-format_whitelist`, so a stored playlist file cannot make it read other files. It is killed when the client disconnects or after a time limit.
  - The dashboard loads image and video previews from the new route and falls back to the original download if the preview fails. Text previews keep the 4 KiB range read.
  - Server and dashboard tests cover the route and the client change; `npm run format:check` and `npm run check` pass.

## Plan

1. Stage 162 (this record): one delegated implementation agent makes the server route, client change, tests and docs.
2. Stage 163: an independent read-only review per the owner's reviewer routing; the coordinator writes its record.

The coordinator's prototype on this host (Ubuntu 26.04, ffmpeg 8.0.1, with `libwebp` and `libx264`): a 1920×1080 10 s H.264 file of 7.6 MB became a 124 KB preview in 0.6 s; a 3000×2000 PNG became a 7 KB WebP in 0.4 s. PNG, JPEG, GIF, WebP, BMP, ICO, AVIF, WebM and MOV inputs all converted under the whitelist `png_pipe,jpeg_pipe,webp_pipe,gif,bmp_pipe,ico,mov,mp4,m4a,3gp,3g2,mj2,matroska,webm`, and an HLS playlist was refused.

## Decisions

- The server re-encodes on each request rather than caching previews on disk, so no new files need expiry or deletion. The dashboard already keeps the 20 newest image previews in memory; videos are re-encoded on each hover (about 0.6 s for a 1080p source).
- `ffmpeg` reads the stored file through an inherited descriptor (`/proc/self/fd/3`), so a file deleted during a preview still reads, like a download in progress. The pin keeps its quota charged until `ffmpeg` exits.
- The work runs outside the per-file lock, in the same `send` closure pattern as `/download`.
- Output is buffered (8 MiB cap) and sent with `Content-Length`; `ffmpeg` gets SIGKILL on client disconnect, on the cap or after 20 s.
- A missing `ffmpeg` answers 503 and a file it cannot convert 422. The dashboard then loads the original once, so previews still work without `ffmpeg`.
- HEAD on `/preview` is 405, since a HEAD would need the full transcode.
- The media tests skip with a reason when `ffmpeg` is absent, except on CI. At the owner's request (2026-11-05), CI installs `ffmpeg` before `npm run check`, so the real-media test runs on every PR.

## Changes

- `server/src/app.ts`: the `/preview` route and the `preview()` helper.
- `web/src/dashboard.ts`: image and video previews load `/preview`, then `/download` once on error.
- `server/test/preview.test.ts` (new), `server/test/app.test.ts`, `server/test/uploads.ts` (accepts a `Buffer`): auth, 404 for other kinds, 405 for HEAD, 503 without `ffmpeg`, WebP and MP4 output smaller than the source, and 422 for a fake PNG, an HLS playlist named `.mp4` that points at a real video, and an MPEG-TS video outside the whitelist.
- `web/tests/dashboard.test.ts`: preview URLs, and the fallback to `/download` for images and videos.
- `README.md`: one feature line naming the `ffmpeg` requirement and the fallback.

- Merged `main` at `66dfbe8` (the hover preview placeholder, stages 162-165 `preview-skeleton`). The image preview test now expects `/preview` alongside the placeholder, and the fallback test expects the placeholder to stay while the original loads. The inner `retry` helper was renamed `fallback`, since it shadowed the dashboard's offline `retry`.
- Merged `main` at `14439a4` (long press previews on phones, PR #38); only the preview comment conflicted. Long press previews use the same loader, so they get the small copy too.
- `.github/workflows/check.yml`: an `Install ffmpeg` step before `npm run check`.

## Verification

- `npx prettier --check "{server,web,scripts}/**/*.{ts,js,mjs,css,html}"`: clean.
- `npm run check`: exit 0. Server 35/35 (both preview tests ran, none skipped), web 110/110, acceptance 11/11, deploy 154/154, both typechecks and builds.
- The agent's last note said it was chasing a possible intermittent failure and had not reproduced it in 13 runs. The coordinator then ran the server suite four more times: 35/35 each time.
- An `ffmpeg` run under the service's `SystemCallFilter=@system-service`, `ProtectProc=invisible`, `ProcSubset=pid` and `NoNewPrivileges` in a user-level `systemd-run` unit exited successfully. A user manager cannot apply every option in `deploy/storagi.service` (`PrivateDevices` failed with status 218), so the full system sandbox is unverified until a release runs it; the dashboard fallback covers a failure there.

## Findings and limitations

- No intermittent failure reproduced in the coordinator's runs.
- Not measured over the WAN or in a real browser.
- Animated GIF and WebP previews show their first frame only.

## Handoff

Stage 163 reviews the committed branch read-only.
