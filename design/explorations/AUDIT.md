# Current frontend audit

Audited 2026-10-21 from `web/src/` at `1fa9cd8`, running the repository's synthetic preview (`npm run test:preview`, loopback only) at 1440, 768 and 390 px, and measured with tasteskill's `inspect.mjs --app`.

## What exists

The whole frontend is one page, `web/src/dashboard.ts` (103 lines) plus `transfers.ts` (153) and `style.css` (1,153). It renders six states into `#content` with `innerHTML`:

| State | When | What it shows |
| --- | --- | --- |
| Opening | before `/api/session` answers | One line, "Opening your shelf…" |
| Signed out | `/api/session` → 401 | Eyebrow, a two-line serif headline ("Drop it here. Pick it up anywhere."), two lines of copy, an orange Google button |
| Shelf | signed in | Sidebar (one item: Inbox), a 45px serif title, a drop box beside a storage card, a Transfers section, the Inbox table |
| Locked | a request returns 401/403 | "Welcome back." and a Google button; transfers stop |
| Offline | session check throws | "A pause between devices." and Try again |
| Delete | trash on a row | A modal dialog: "Delete this server copy?" Keep / Delete |

Behaviour worth keeping: tus resumable uploads one at a time with pause/resume/cancel, resume across reloads by reselecting the file, CSRF on every mutation, session expiry that preserves partial uploads, duplicate filenames kept as separate copies, a storage meter that counts reserved bytes, the full-shelf notice, focus kept on transfer buttons during progress updates, `prefers-reduced-motion`.

## Measured problems

`inspect.mjs --app` on the current shelf: **6 FAIL, 2 WARN.**

- **The assistant palette.** Cream ground `#f7f6f2` with a terracotta button `#c44d23` — the inspector's `palette-claude` failure. It reads as a template, not as Storagi, and it is a light theme where the owner wants true dark.
- **Four typefaces** (Inter, system-ui, ui-monospace, Georgia) and **18 font sizes** from 7 to 55 px.
- **45 text blocks under 11 px.** Copy keys are 8 px, table headers 8 px, the footer 7 px on a phone. Expiry dates and copy keys are 3.7:1 contrast.
- **13 tiny tracked uppercase labels**: PERSONAL FILE SHELF, WORKSPACE, YOUR PRIVATE SPACE, SHELF SPACE, READY WHEN YOU ARE, YOUR FILES, JUST PASSING THROUGH…
- **A gradient drop zone and shadowed buttons.**
- **A landing-page title on a working screen**: "Room for the in-between." at 45 px.

## What the screenshots show

- **The Inbox — the job people come for — starts below the fold.** At 1440×900 the first file row sits at y≈880; on a phone it starts more than a full screen down, after the title, drop box, storage card and transfer notes. The fold is spent on a slogan, a drop box and a storage card.
- **Slogans instead of information.** "Room for the in-between", "A little handoff", "A shelf, not an archive", "One at a time. Room to breathe.", "Across devices. Within reach.", "Your files, just passing through." Seven taglines on one working screen; none of them tells you anything you act on.
- **A sidebar with one destination** and 140 px of empty space under it, filled with a note.
- **Transfers say almost nothing.** A row shows `Uploading · 1.2 GiB / 3.2 GiB` and a 4 px bar: no speed, no time left, no finish time, no download progress at all (downloads are plain links the browser handles).
- **The Inbox goes stale.** It refreshes only after your own upload or a manual Refresh; a file sent from the phone does not appear on the laptop until you press the button.
- **One file at a time.** No selection, so clearing ten copies is ten trash clicks and ten modal dialogs.
- **Delete is a modal** with no undo, for an action that is irreversible on the server.
- **Meaningless colour.** File-type chips rotate green / brown / blue by `nth-child(3n)`, so colour encodes row position, not type.
- **No identity.** An orange "s." square and a ® mark; nothing of the koi.

## What the redesign must carry over

Every behaviour in the "worth keeping" list above, the same endpoints (`/api/session`, `/api/files`, `/api/uploads` via tus, `/api/files/:id/download`, `DELETE /api/files/:id`, `/auth/login`, `/auth/logout`), the fail-closed owner sign-in, and the resume instructions (reselect the same file in the same browser; partials expire after 24 hours).
