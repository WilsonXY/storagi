# 137: Show the file type in its own column

- Status: completed; stage138 review pending
- Started / last updated: 2026-11-03 (Asia/Kuala_Lumpur)
- Coordinator thread: `4196e13a-ee30-4f39-b1ff-391f6ff80243`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from this session's runtime metadata)
- Workspace/branch and starting commit: `t3/4d018846`, `e7b9d45`
- Scope and acceptance criteria: the owner sent a screenshot with the Name/Size/Expires header and the extensions in the filenames (`.jpg`, `.docx`, `.zip`) boxed, and asked to "make the file format becomes a separate column for showing its file type". The Inbox gets a Type column; the name column shows the name without its extension. Run `npm run check`, check formatting and look at the result in Chromium on desktop and phone widths.

## Decisions

- The type is the filename extension, lowercased, in monospace like Size and Expires. There is no MIME sniffing: the server stores no content type, and the extension is what the owner boxed.
- An extension is the text after the last dot, if it is 1–10 letters or digits and something comes before the dot. So `.env`, `notes.` and `Plan v2.final draft` have no type and keep their whole name; `backup.tar.gz` shows `backup.tar` and `gz`. A name like `Scan 2026.10.30` reads as type `30`; that is accepted.
- Type is sortable like the other columns (A to Z, then Z to A). Files without a type sort first; ties stay newest first.
- The full filename is unchanged everywhere else: the name's tooltip, search, downloads, accessible labels and the duplicate `copy` marker.
- On a phone the type leads the size and expiry line under the name, and the header's spacer moves from Size to Type.

## Changes

- `web/src/formatting.ts`: `splitName()` replaces `ext()`, which only fed a hidden 4-character label in the checkbox cell.
- `web/src/sorting.ts`: new `type` sort key.
- `web/src/dashboard.ts`, `web/src/shelf.html`: the Type header button and cell, the name without its extension, and the type in the phone meta line.
- `web/src/style.css`: a 56px Type column between Name and Size; the dead `.lead .ext` rules are removed; phone sort buttons go from 8px to 6px side padding so the header fits a 320px screen.
- Tests: `splitName` cases, type sort order, and the hostile-filename row test now checks the base name, the full name in the tooltip and the `zip` type cell.

## Verification

Private logs and scripts are in `"$HOME/.cache/storagi/tmp"` and `"$HOME/.cache/storagi/repro"` (`type-col.mjs`, `type-col-360.mjs`, screenshots in `type-col/`), outside Git.

- RED→GREEN: the three new or changed tests failed on `e7b9d45` (`splitName` missing, type sort unknown, name still had `.zip`), then passed with the change.
- Headless Chromium 1243 against the mock preview (`tests/vite.mock.config.ts`, loopback port 5191, synthetic data) at 1600 × 900 and 390 × 844: rows read `studio-walkthrough | mp4`, `project-assets | zip` and so on; clicking Type sorts `mp4,pdf,zip,zip,zip` and labels the button "Type, sorted A to Z".
- Phone header with a sort active: at 360px it fits (`scrollWidth` 328 = `clientWidth` 328). At 320px it overflowed by 16px with 8px padding (304 > 288); with 6px padding it fits (288 = 288).
- `npm run format:check` PASS. `npm run check`: first run failed one server test (`files deletion safely cancels a half-open PATCH`, a fetch timeout after 16 s; no server code changed), rerun exit 0: 33 server, 95 web, 11 HTTP acceptance and the deploy tests, both typechecks and builds (`check-type.log`, `check-type-2.log`).

## Findings and limitations

Not checked on physical Windows, Fedora or Android devices. The design explorations in `design/` still show the old three columns; they are a record, not the app.

## Handoff

The coordinator commits, runs the stage138 review and opens the PR. No merge, tag or deployment.
