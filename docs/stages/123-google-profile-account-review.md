# 123: Independent review of the Google name and photo change

- Status: completed; PASS, both suggestions fixed by the coordinator
- Started / completed: 2026-10-30 (Asia/Kuala_Lumpur)
- Coordinator thread: T3 worktree `t3-6b130295` (Claude `claude-opus-5-5`)
- Reviewer: T3 `delegate_task`, role review, worktree isolation, Codex `gpt-6.1-sol`, reasoning effort high (owner routing for Claude-written changes). The reviewer's own Codex session log records `model: gpt-6.1-sol`, `model_provider: openai` and reasoning effort `high`.
- Reviewed range: `c171d26..b5f0ef8`

## Findings and responses

Verdict PASS, no blocking findings and no over-engineering. The reviewer ran `npm run setup`, `npm run check` (288 tests, typechecks and builds) and `npm run format:check`, all passing, plus its own edge probes.

1. Suggestion: the server tests only covered a valid owner profile. **Fixed:** `server/test/auth.test.ts` now checks that there is no profile before the first login, that rejected logins (another account, tampered, expired, wrong nonce, audience or issuer, wrong state) leave the saved profile unchanged, and that a login with no name and a photo URL off Google's host saves neither. `server/test/helpers.ts` lets a test set or omit `name` and `picture`.
2. Suggestion: the web test did not cover a hostile name or a photo that fails to load. **Fixed:** `web/tests/dashboard.test.ts` mounts with a name containing markup and checks it renders as text with no element created, and that an `error` on the photo leaves the initial.

## Verification after fixes

Private log `"$HOME/.cache/storagi/tmp/check-122b.log"`. `npm run format:check` PASS. `npm run check` exit 0: 33 server, 90 web, 11 HTTP acceptance and 154 deploy tests, both typechecks and builds.

## Handoff

Repository invariance: after the review, this checkout's HEAD (`b5f0ef8`), clean status and `git ls-remote --heads origin` matched the saved baseline. The reviewer's worktree was at `b5f0ef8` with a clean status and no untracked files when the coordinator removed it and its branch `t3/review-google-profile-display`. The coordinator publishes the PR and watches CI. No merge, tag, deployment or host changes.
