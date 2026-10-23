# Storagi frontend overhaul: implementation handoff

The owner approved the design on 2026-10-21 and approved the day-2 additions (sorting, row gestures, pond waves, the select-all fix) on 2026-10-22. This brief tells the next agent how to build it into the real app. The design record is [stage 78](../../docs/stages/78-frontend-design-exploration.md); this work is the next stage.

## Read first

- [`AGENTS.md`](../../AGENTS.md): stage records, owner-only Google sign-in that fails closed, loopback dev servers, portable paths. **Deploying or exposing anything needs the owner's explicit approval**, even though this work is meant to end in a deployment.
- [`README.md`](../../README.md), [`docs/implementation-log.md`](../../docs/implementation-log.md), [`web/README.md`](../../web/README.md).
- [`AUDIT.md`](AUDIT.md): what the old UI does and which behaviours must survive. [`REFERENCES.md`](REFERENCES.md): where each design idea came from, plus feasibility notes.

## The design

The reference implementation is **`design/explorations/final/`**, with shared parts in `design/explorations/shared/`. It is a static prototype on sample data with a simulated host. To view it:

```sh
cd design/explorations
npx http-server -a 127.0.0.1 -p 8765   # then open http://127.0.0.1:8765/final/
```

The bar at the bottom of the page switches between states: Locked, Loading, Shelf, Empty and Offline (`?state=` does the same). The screens are captured in `shots/final-*.webp`. Treat the prototype's look and behaviour as the spec. Do not copy its code wholesale: about half of it simulates the server.

| Prototype file | Reuse | Notes |
| --- | --- | --- |
| `shared/tokens.css` | Yes | Colour, type and component tokens (T3 Code's pure-black theme, one koi hue). |
| `shared/fonts/` | Yes | Leon Sans 2.0 and the **full** JetBrains Mono (both SIL OFL; keep the licence files). Load them as real files that Vite bundles into `/assets`. |
| `shared/brand/` | Yes | The owner's favicon set. `mark.js` holds the mark as a baked grayscale bitmap for the dotted koi. |
| `shared/koi.js` | Yes, ported to TS | `KoiPond` (ASCII pond; a click drops one ring that is gone in 1 s and startles the koi it reaches), `KoiMark` (dotted koi; touch drag; optional static band), `orbitLoader`. |
| `shared/storagi.js` | **Only partly** | Keep `bytes`, `rate`, `duration`, `fileDrop`, `Selection`, `deferredDelete`, `toast`, the motion and gesture preferences and the `Transfers` speed/ETA maths. Replace `createHost`, the sample files, `NOW`/`simNow`, the fixed UTC+8 `TZ` and the simulated link speeds with the real service, the real clock and the browser's own time zone. |
| `final/index.html`, `app.js`, `style.css` | As the spec | The layout and every interaction. Rewrite against `web/src/` (plain TypeScript + Vite + tus-js-client). |

## Map onto the real service

| Prototype | Real |
| --- | --- |
| Session check (orbit loader) | `GET /api/session` → `{ authenticated, csrfToken }`; 401 shows the locked screen. |
| Locked screen | Same as the prototype: the card over the koi pond, with a faint static **decoy** shelf behind it (`.locked-decoy`, the old Send / Pick up layout with made-up rows). The real app stays hidden until signed in, so no shelf data ever shows. "Continue with Google" → `/auth/login`. |
| Inbox list, counts, storage meter | `GET /api/files` → files plus `usedBytes`, `reservedBytes`, `budgetBytes`. Group rows by the day in the browser's local time zone. |
| Uploads | The existing tus queue in `web/src/transfers.ts`: one at a time, pause/resume/cancel, resume by choosing the same file again, CSRF on mutations. Add speed and ETA from `onProgress`. |
| Downloads with speed | **Open decision** (see `REFERENCES.md`). Plain links leave progress to the browser. In-page progress needs a `fetch` stream plus `showSaveFilePicker`, which only Chromium has; Firefox-based browsers (possibly the owner's "Zen" on Linux) fall back to a plain link. Ask the owner before choosing. |
| Delete with Undo | The client waits 6 s, then sends `DELETE /api/files/:id`. Leaving the page inside that window keeps the file. |
| Sign-out pop-up | `POST /auth/logout` with the CSRF token, then the locked screen. |
| Auto-refresh | Every 60 s while the tab is visible; refresh straight away when the tab returns after more than 10 s away, and after each finished upload. Keep the old list on screen while refreshing. Show "Updated HH:MM · next in Ns" (just HH:MM on phones). |
| Offline | When a request fails: the pinned red banner, a retry every 10 s with a countdown plus "Retry now", the red status pill, the pond grey and still, the list dimmed, and the tab title "Offline · Storagi". |
| Settings → Swimming koi | `localStorage['storagi.motion']` is `swim` (default) or `static`. Owner's choice: the OS reduced-motion setting is deliberately not consulted, and interface transitions always play. |
| Settings → Swipe gestures | `localStorage['storagi.gestures']` is `on` (default) or `off`; it turns both row gestures on or off. |
| Sorting | Client-side over the loaded list: Name (natural order, case-insensitive), Size, Expires; ascending first, then flipping on each click; ties fall back to newest first. Sorted, the list is one run without day headings; the header's × returns to newest first in day groups. Keep the sort across auto-refreshes. |
| Drag to select | Every row between the first and the one under the pointer takes the first row's new state; rows the drag leaves go back. Mouse and touchpad: from anywhere on a row. Touch: from the checkbox column (`touch-action: none`), or after a 0.4 s hold on the row (rows keep `touch-action: pan-y`; a non-passive `touchmove` stops the scroll once a gesture has started). Do not re-render the rows mid-drag; update their state in place. |
| Swipe to delete | Past about a third of the row's width, letting go deletes with the same 6 s Undo as the inline delete. Pointer drag for mouse and touch; a touchpad's two-finger sideways swipe arrives as `wheel` events with `deltaX` (call `preventDefault` so the browser does not go back). |
| Pond waves | Client-only: `KoiPond`'s `splashTarget`/`canSplash` options and `splash(x, y)`. |

## Constraints the prototype does not face

- **CSP** (`server/src/app.ts`): `default-src 'self'; style-src 'self'; img-src 'self' data:`. That means no outside hosts, no inline `style="…"` attributes in HTML strings, and no `data:` fonts. The one inline style in the prototype is the `animation-delay` on newly arrived rows (`final/app.js`, row template); set it through the CSSOM or a class instead. Setting `el.style.x` from script and `el.animate()` are fine.
- **Static allowlist** (`server/src/static.ts`): only `/`, `/index.html`, `/favicon.svg` and `/assets/*` are served. The owner's `.ico`, PNG and touch icons need that list (and its MIME table: `.ico` is missing) extended, with tests in `server/test/static.test.ts`.
- **Fonts:** Leon Sans has proportional digits and no `tnum`, so every changing number uses the mono. Keep the full JetBrains Mono; the subset Google Fonts serves lacks the block characters, and the charts break on Windows without them.
- **The dotted koi** samples the baked bitmap rather than reading a canvas back, because some browsers add noise to canvas readback for privacy. The pond's own buffer readback has worked on the owner's browser.
- **Phones:** the search and the speed line stay pinned under the top bar; the dotted koi uses `touch-action: none`; touch targets are 44 px or more.

## Done means

1. Every state and interaction the prototype has, on the real service, at 1440, 1100 and 390 px.
2. Everything listed as worth keeping in `AUDIT.md` still works: tus resume, CSRF, session expiry keeping partial uploads, separate copies of duplicate filenames, reserved bytes, the full-shelf notice.
3. `npm run check` passes at the repository root, with new tests for the speed/ETA maths, auto-refresh timing, delayed delete with undo, selection (including drag ranges), sorting and the offline retry.
4. The browser harness (`web/tests/vite.mock.config.ts`) is updated so the new UI can be exercised offline, on loopback only.
5. A stage record and implementation-log row exist, an independent review is done, and deployment happens only after the owner approves it.

## Not verified in the prototype

- The real file picker and dragging files in from the OS on real devices.
- Real Google sign-in and the real service.
- Touch and touchpad gestures, checked with simulated touches and wheel events only, not on a phone or a real touchpad. The touchpad direction assumes the usual setting where moving two fingers left gives a positive `deltaX`.
- The empty half of the progress bars is deliberately dim (about 1.5:1 contrast). The taste checker flags it, and the owner accepted it.
