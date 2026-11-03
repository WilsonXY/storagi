# 137: Hover preview of image, video and text files

- Status: in progress; stage138 review FAIL (three P2s and a P3) and stage139 re-review FAIL (two P2s and two P3s), all fixed here; video and text previews added after the owner asked, stage140 reviews them
- Started / last updated: 2026-11-03 (Asia/Kuala_Lumpur)
- Coordinator thread: `c17dcc70-b4f0-4873-ad26-d35daf1b4f1f`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from this session's runtime metadata)
- Workspace/branch and starting commit: `t3/5656c415`, `e7b9d45`
- Scope and acceptance criteria: the owner sent a screenshot of the Inbox list and asked that resting on a file shows a preview of it when the format is easy to preview (images), shows nothing for other formats, and that a setting turns previews on and off.
- Scope extension (same PR, owner's request after reviewing the options): videos show "a few seconds clip … not the entire video", and text files show their first lines. The owner declined SVG ("no needed") and left PDF, Office, ZIP and HEIC out.

## Decisions

- Images only: PNG, JPEG, GIF, WebP, AVIF, BMP and ICO, which every supported browser decodes in an `<img>`. SVG is left out because the download response is `application/octet-stream`, and browsers sniff raster formats but not SVG. Video, PDF and documents get no preview; they would mean large downloads or a server-side renderer.
- No server change. The preview loads the existing authenticated download URL in an `<img>`. Browsers sniff image content for `<img>` regardless of the declared type, and `nosniff` only applies to scripts and styles, so `octet-stream`, `nosniff` and `Content-Disposition: attachment` all stay as they are. Checked in Chromium and Firefox (see Verification).
- Mouse only (`pointerType === 'mouse'`), with no button pressed: touch has no hover, and a drag-select should not open previews.
- A 300 ms pause before loading, so sweeping the mouse down the list does not start a download per row. The box appears only once the image has loaded.
- Downloads are `no-store`, so the 20 most recently loaded images are kept in memory and reused, instead of being downloaded again on every hover (`ponytail:` comment in `dashboard.ts` names the ceiling).
- One download at a time. Coming back to an image still loading reuses the load; wanting a different image, including one already loaded, cancels it. A failed load is retried once the mouse leaves the row and comes back.
- Default on, stored as `storagi.previews` in `localStorage` like the other two settings.

- Videos (MP4, M4V, WebM, MOV): a muted, inline `<video>` from the same download URL, looping its first 3 seconds. The browser fetches only the byte ranges it needs, which the server already supports. Videos are not cached: hiding one stops it and drops its source, so its download ends.
- Text (TXT, MD, LOG, CSV, TSV, JSON, XML, YAML, TOML, INI, config files and common source files): a `fetch` with `Range: bytes=0-4095`, reading at most 4 KiB even if a server ignores the range, shown with `textContent` in a `<pre>` (never as HTML), first 16 lines. Text snippets share the 20-entry cache with images.
- The setting is now called "File previews"; its `storagi.previews` key is unchanged.

## Changes

- `web/src/preferences.ts`: `previewPref()` / `setPreviewPref()`.
- `web/src/shelf.html`: an "Image previews" switch in Settings and the fixed `#hover-preview` box.
- `web/src/dashboard.ts`: `pointermove` on `#groups` places the box beside the cursor (flipped near the right and bottom edges) and loads the image after the pause; leaving the list, pressing a pointer, a wheel swipe, scrolling or switching views hides it. Rows being deleted and expired rows get no preview.
- Stage138 fixes (`dashboard.ts`): `previewable()` (listed and rendered, image, not deleting or expired, setting on) is checked on every render and before a finished load is shown, so a refresh, search or delete that removes the row hides its preview; one tracked load at a time; Escape closes the preview until the mouse moves to another row; the cache keeps 20 images.
- Video and text (`dashboard.ts`, `shelf.html`, `style.css`): `previewKind()` picks image, video or text by extension; each kind has its own loader behind the same one-load-at-a-time `loading.cancel()`; `reveal()` shows a preview and plays a video. The text box has no height cap, because the 16-line limit already sizes it.
- Stage139 fixes (`dashboard.ts`): `onerror` clears a failed load and dismisses that row, so it retries on return; `renderInbox()` hides the preview when rows or day labels moved; a different file's load is cancelled before showing a cached image; a second Escape keeps the dismissal.
- `web/src/style.css`: the preview box, at most 320 × 240 px.
- Tests: a fourth `dashboard.test.ts` test covers video (muted, loop back to 0 after 3 s, hiding drops the source) and text (the 4 KiB range header, plain text only, 16 lines, cached on return). A third `dashboard.test.ts` test covers the stage139 fixes (retry after an error, rows moving, a refresh that changes nothing, cancelling for a cached image, a second Escape). A second test covers the stage138 fixes (load reuse and cancellation, Escape, wheel, refresh removing the hovered file, a late load for a removed file, opening Settings). The first covers the pause, mouse-only, non-image rows, show-on-load, hide on leave, reuse without a second image, and the switch turning previews off; `preferences.test.ts` covers the default and saved value.

## Verification

Private logs and scripts are outside Git in `"$HOME/.cache/storagi/tmp"` and `"$HOME/.cache/storagi/repro"` (`hover-preview.mjs`, synthetic PNG fixtures). Proof screenshots are in `"$HOME/.cache/storagi/proof-preview"`.

- RED→GREEN: both new tests failed before the change (no image loaded, no `previewPref`) and pass after it. The stage138 test failed on `8521479` (a second `Image` for the same file) and passes after the fixes. Under heavy host load (load average about 17) Vitest workers timed out starting, so the web files were run one at a time with `--pool=threads --maxWorkers=1`: 52 dashboard and 3 preference tests PASS.
- Stage139 fixes: the third test failed on `5ead6f9` at its first check (no retry after an error) and passes after the fixes; its later checks were not run against `5ead6f9` separately, but stage139's own probes reproduced those findings. Dashboard 53/53 PASS, then `npm run format:check` PASS and `npm run check` exit 0 (33 server, 98 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds; `check-preview-3.log`). The Chromium and Firefox script and the Chromium recording were re-run on this code with the same results; the proof files were replaced.
- Video and text: the fourth test failed before the change (no video element created) and passes after it; dashboard 54/54 PASS; web typecheck PASS; `npm run format:check` PASS and `npm run check` exit 0 (33 server, 99 web, 11 HTTP acceptance and 154 deploy tests, typechecks and builds; `check-preview-4.log`). Before writing code, a probe confirmed that Chromium 1243 and Firefox 1555 both play WebM (VP9) and MP4 (H.264) served as `application/octet-stream` with `nosniff` and `attachment` (`video-probe.mjs`). The browser script, extended with a 12 s WebM, a 12 s MP4 and a Markdown file, passed in both browsers: videos played muted, and 2.5 s after the first check their position was back under 2 s (looped); the text file showed 16 lines; images, PDF, Escape and the switch behaved as before. A first run showed no preview on the first image: the script's wait had matched the mock's own `studio-walkthrough.mp4`, so it hovered before the last upload landed, and that row's insertion hid the preview as designed (`first-hover-probe.mjs` confirmed: with a 3 s wait it shows). The script was fixed and re-run.
- After the stage138 fixes: `npm run format:check` PASS and `npm run check` exit 0 (33 server, 97 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds; `check-preview-2.log`).
- After the stage138 fixes the same browser script, with an Escape step added, gave the same results in Chromium and Firefox, and Escape closed the preview. A paced 38 s Chromium recording is in `"$HOME/.cache/storagi/proof-preview/video"`.
- Headless Chromium 1243 and Firefox 1555 (Playwright) against `test:preview` on loopback port 5187, which has no Tailscale Serve mapping. The download responses were rewritten to the real server's headers (`application/octet-stream`, `nosniff`, `no-store`). Two synthetic PNGs uploaded through the picker previewed at their natural sizes (640 × 400, 300 × 900); the PDF row showed nothing; returning to the first image showed it again with only two downloads in total; turning the switch off showed "Saved · previews off" and no preview on hover. Results were the same in both browsers.
- `npm run format:check` PASS. `npm run check`: 33 server and 96 web tests passed; one HTTP acceptance test ("half-open PATCH yields promptly…", server upload timing, not touched by this web-only change) failed once while the preview server and browsers were also running (`check-preview.log`), then passed 11/11 on two separate re-runs (`acc-preview-1.log`, `acc-preview-2.log`). The remaining steps, 154 deploy tests, both typechecks and both builds, then passed (`check-preview-rest.log`).

## Findings and limitations

- Video byte usage was not measured: the synthetic test server ignores `Range` and sends whole files, and how far ahead a browser buffers beyond the 3 s loop is up to the browser. Against the real server, which supports ranges, the browser should fetch the start of the file (and the index at the end for MP4 files without fast start) plus whatever it buffers ahead.
- Videos in codecs the browser cannot play (for example HEVC MOV files from phones in Firefox) fail like a broken image: no preview, retried when the mouse comes back to the row.
- Previews download the full image. A large photo over the WAN link takes as long to appear as it takes to download (about 6 s for 9 MiB at the 1.6 MB/s reported in stage101). Server-side thumbnails would fix this but need an image library on the server.
- Up to 20 loaded images stay in memory until the page is closed. There is no size limit on what is previewed, so a very large image still downloads in full.
- On a phone there is no hover, so no preview.

## Handoff

Stage138 reviewed the first version and stage139 the stage138 fixes. Stage140 reviews the video and text previews together with the stage139 fixes.
