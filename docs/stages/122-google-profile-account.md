# 122: Show the owner's Google name and photo in the sidebar

- Status: completed; independent stage123 review PASS, its suggestions fixed
- Started / last updated: 2026-10-30 (Asia/Kuala_Lumpur)
- Coordinator thread: T3 worktree `t3-6b130295`
- Agent/task/thread identifiers: none; the coordinator made this small change itself, without delegating
- Provider/model/effort: coordinator Claude Opus 5.5 (`claude-opus-5-5`)
- Workspace/branch and starting commit: `feat/google-profile-account`, `c171d26`
- Scope and acceptance criteria: the owner asked for the sidebar's fixed "Owner" label and "O" avatar to show their real Google name and photo. Run `npm run check`, check formatting and look at the sidebar in the mock preview on desktop and phone.

## Decisions

- Google only puts `name` and `picture` in the ID token when the `profile` scope is asked for, so login now requests `openid profile`. The owner check still uses only the verified `sub`. Enrollment (`enroll.ts`) still asks for `openid` alone, since it only needs the `sub`.
- The name and photo URL are saved per `sub` in a new `profile` table at each owner login (`CREATE TABLE IF NOT EXISTS`, so existing databases need no migration) and returned by `/api/session`, which only answers an owner session. Sessions from before this change show "Owner" until the next login.
- The browser loads the photo straight from Google; the CSP's `img-src` now allows `https://lh3.googleusercontent.com`, and the server keeps only a `picture` on that host. `Referrer-Policy: no-referrer` already stops the page address reaching Google. Proxying the photo through Storagi was skipped as more code for no gain to a single owner who is signed in to Google anyway.
- The avatar shows the name's first letter until the photo has loaded, then swaps it in, so a photo that fails to load leaves the letter, not a broken image. A long name is cut with an ellipsis.

## Changes

- `server/src/auth.ts`: `profile` scope; `verifyIdentity` returns `{ sub, name, picture }`; the login transaction saves the profile; `Auth.profile()` reads it.
- `server/src/storage.ts`: `profile` table. `server/src/app.ts`: `/api/session` adds `name` and `picture`; CSP `img-src` adds Google's photo host. `server/src/enroll.ts`: reads `sub` from the new return value.
- `web/src/shelf.html`, `web/src/dashboard.ts`, `web/src/style.css`: render the name, the initial and the photo.
- Tests: `server/test/helpers.ts` signs `name`/`picture` into the synthetic ID token; `server/test/auth.test.ts` checks the scope and that `/api/session` returns them; `web/tests/dashboard.test.ts` checks the name, the initial and the swap on load. `web/tests/vite.mock.config.ts` returns a synthetic name and an inline SVG photo.
- Docs: `docs/setup.md` (scopes), `docs/api-agreement.md` (`/api/session` shape).

## Verification

Private logs and screenshots are in `"$HOME/.cache/storagi/tmp"` and `"$HOME/.cache/storagi/proof-122"`, outside Git.

- `npm run format:check` PASS. `npm run check` exit 0: 33 server, 90 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds.
- Gitleaks was not installed when `b5f0ef8` was committed, so `secrets:check` did not run; Gitleaks 8.30.1 was then installed with its checksum verified and `gitleaks git` over `c171d26..b5f0ef8` found no leaks. The follow-up commit passed `secrets:check`.
- Mock preview (loopback 5174, synthetic data) in headless Chromium at 1280×900 and 390×844 (phone menu opened): the sidebar shows "Synthetic Owner" and the 28 px round photo; at desktop width the name is cut with an ellipsis. The preview was stopped afterwards.

## Findings and limitations

Not tried with a real Google login: the real photo URL, the Google consent screen with `profile`, and the CSP against Google's host are unverified until the owner signs in on a deployed build.

## Handoff

Commits: `b5f0ef8`, then a follow-up with stage123's fixes. The coordinator opens the PR and watches CI. No merge, tag or deployment.
