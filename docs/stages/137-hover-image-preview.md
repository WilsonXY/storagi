# 137: Hover preview of image files

- Status: in progress
- Started / last updated: 2026-11-03 (Asia/Kuala_Lumpur)
- Coordinator thread: `c17dcc70-b4f0-4873-ad26-d35daf1b4f1f`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from this session's runtime metadata)
- Workspace/branch and starting commit: `t3/5656c415`, `e7b9d45`
- Scope and acceptance criteria: the owner sent a screenshot of the Inbox list and asked that resting on a file shows a preview of it when the format is easy to preview (images), shows nothing for other formats, and that a setting turns previews on and off.

## Decisions

- Images only: PNG, JPEG, GIF, WebP, AVIF, BMP and ICO, which every supported browser decodes in an `<img>`. SVG is left out because the download response is `application/octet-stream`, and browsers sniff raster formats but not SVG. Video, PDF and documents get no preview; they would mean large downloads or a server-side renderer.
- No server change. The preview loads the existing authenticated download URL in an `<img>`. Browsers sniff image content for `<img>` regardless of the declared type, and `nosniff` only applies to scripts and styles, so `octet-stream`, `nosniff` and `Content-Disposition: attachment` all stay as they are. Checked in Chromium and Firefox (see Verification).
- Mouse only (`pointerType === 'mouse'`), with no button pressed: touch has no hover, and a drag-select should not open previews.
- A 300 ms pause before loading, so sweeping the mouse down the list does not start a download per row. The box appears only once the image has loaded.
- Downloads are `no-store`, so a loaded image is kept in memory for the session and reused, instead of being downloaded again on every hover (`ponytail:` comment in `dashboard.ts` names the ceiling).
- Default on, stored as `storagi.previews` in `localStorage` like the other two settings.

## Changes

- `web/src/preferences.ts`: `previewPref()` / `setPreviewPref()`.
- `web/src/shelf.html`: an "Image previews" switch in Settings and the fixed `#hover-preview` box.
- `web/src/dashboard.ts`: `pointermove` on `#groups` places the box beside the cursor (flipped near the right and bottom edges) and loads the image after the pause; leaving the list, pressing a pointer or scrolling hides it. Rows being deleted and expired rows get no preview.
- `web/src/style.css`: the preview box, at most 320 × 240 px.
- Tests: `dashboard.test.ts` covers the pause, mouse-only, non-image rows, show-on-load, hide on leave, reuse without a second image, and the switch turning previews off; `preferences.test.ts` covers the default and saved value.

## Verification

Private logs and scripts are outside Git in `"$HOME/.cache/storagi/tmp"` and `"$HOME/.cache/storagi/repro"` (`hover-preview.mjs`, synthetic PNG fixtures). Proof screenshots are in `"$HOME/.cache/storagi/proof-preview"`.

- RED→GREEN: both new tests failed before the change (no image loaded, no `previewPref`) and pass after it.
- Headless Chromium 1243 and Firefox 1555 (Playwright) against `test:preview` on loopback port 5187, which has no Tailscale Serve mapping. The download responses were rewritten to the real server's headers (`application/octet-stream`, `nosniff`, `no-store`). Two synthetic PNGs uploaded through the picker previewed at their natural sizes (640 × 400, 300 × 900); the PDF row showed nothing; returning to the first image showed it again with only two downloads in total; turning the switch off showed "Saved · previews off" and no preview on hover. Results were the same in both browsers.
- `npm run format:check` PASS. `npm run check`: 33 server and 96 web tests passed; one HTTP acceptance test ("half-open PATCH yields promptly…", server upload timing, not touched by this web-only change) failed once while the preview server and browsers were also running (`check-preview.log`), then passed 11/11 on two separate re-runs (`acc-preview-1.log`, `acc-preview-2.log`). The remaining steps, 154 deploy tests, both typechecks and both builds, then passed (`check-preview-rest.log`).

## Findings and limitations

- Previews download the full image. A large photo over the WAN link takes as long to appear as it takes to download (about 6 s for 9 MiB at the 1.6 MB/s reported in stage101). Server-side thumbnails would fix this but need an image library on the server.
- Loaded images stay in memory until the page is closed.
- On a phone there is no hover, so no preview.

## Handoff

Independent review is stage138.
