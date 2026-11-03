# 147: Scroll the sidebar, inbox and transfers panel independently

- Status: completed; review in stage148
- Started / last updated: 2026-11-04 (Asia/Kuala_Lumpur)
- Coordinator thread: T3 worktree `t3-3f9ddb54`; Claude Code session `5ed95b08-2938-42bf-a984-5c855662f329`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`, from this session's runtime metadata)
- Workspace/branch and starting commit: `t3/3f9ddb54`, `95ae59b`
- Scope and acceptance criteria: the owner sent a desktop screenshot with the inbox and the transfers panel boxed and asked to "make this two section controlled by separate scrolling, which scrolling inbox doesnt scroll the transfer sidebar together. remove the scrollbar indicator/visual on both section". They then added the left sidebar: "this three, not only that two". Scrolling one column must not move the others, and none shows a scrollbar. Run `npm run check`, check formatting and try it in Chromium.

## Decisions

- The inbox keeps scrolling the page itself. The sidebar was already pinned to the viewport; it now scrolls inside itself. The transfers panel is pinned under the top bar at 1180px and wider (where it sits beside the inbox) and scrolls inside itself. Keeping the page as the inbox's scroller leaves every `window` scroll hook as it was: hiding the hover preview on scroll, scroll to top, touch edge scrolling while selecting, and the sticky top bar and offline banner.
- `overscroll-behavior: contain` on the sidebar and transfers panel, so scrolling either past its end (or over it when it has nothing to scroll) does not scroll the inbox.
- `scrollbar-width: none` hides the scrollbars of the page, the sidebar and the transfers panel; scrolling still works by wheel, touch, keyboard and trackpad. It applies at every width, so the page has no scrollbar on narrow screens either.
- Below 1180px, transfers are a tab under the inbox and the page still scrolls them; nothing else changes there.

## Changes

- `web/src/style.css`: `.side` gets `overflow-y: auto` and `overscroll-behavior: contain`; `html`, `.side` and `.details` get `scrollbar-width: none`; at 1180px and wider `.details` is `position: sticky` at `top: var(--top)`, `height: calc(100vh - var(--top))`, `overflow-y: auto`, `overscroll-behavior: contain`.

## Verification

Private logs and scripts are in `"$HOME/.cache/storagi/tmp"` and `"$HOME/.cache/storagi/repro"` (`scroll-147*.mjs`, screenshots in `scroll-147/`), outside Git.

- Headless Chromium 1243 against the mock preview (`tests/vite.mock.config.ts`, loopback port 5191, synthetic data), 1600px wide, with a 900px filler added to the transfers panel so it overflows. At 560px and 420px tall: wheeling over the inbox scrolled the page (0 → 379 / 519) and left the panel at scroll 0 and pinned at the top bar (y = 52); wheeling over the panel scrolled only the panel (to 300, then its end) and the page stayed put. At 300px tall the sidebar overflows (19px): wheeling over it scrolled only the sidebar. With the filler removed, wheeling over the short panel left the page where it was. The page, sidebar and panel all report `scrollbar-width: none` and no scrollbar gutter.
- At 1000px and 390px wide the page still scrolls (0 → 400), the transfers panel stays `position: static`, `overflow: visible`, and there is no scrollbar gutter.
- `npm run format:check` PASS. `npm run check` at load average 9–11 from other sessions on the host: 33 server and 101 web tests PASS; HTTP acceptance failed three runs in a row on server timing tests, the last two only on `half-open PATCH yields promptly to resume, deletion and expiry cleanup…` (`expired half-open PATCH blocked cleanup`), which earlier records also saw fail under load. Acceptance exercises only the server, which is unchanged from `95ae59b`. Deploy 154/154, both typechecks and both builds PASS (`check-147.log` to `check-147-4.log`). CI runs the full `check`.

## Findings and limitations

Not checked on Safari, Firefox or physical devices. `scrollbar-width` needs Chrome 121+, Firefox 64+ or Safari 18.2+; older browsers still show scrollbars. In the mock preview the 30px "SYNTHETIC PREVIEW" banner sits above the app, so until the page scrolls by 30px the bottom 30px of the sidebar and transfers panel are below the window; the real app has no banner.

## Handoff

The coordinator commits, runs the stage148 review and opens the PR. No merge, tag or deployment.
