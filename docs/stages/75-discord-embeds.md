# 75: Discord alerts as embeds

- Status: completed on branch; review round 1 (stage76) found two P3, fixed below; round 2 (stage77) PASS.
- Date: 2026-10-23, Asia/Kuala_Lumpur.
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844), Anthropic Claude Opus 5.5. Small change, not delegated.
- Scope: `scripts/storagi-autodeploy` alert format, its tests in `scripts/autodeploy.test.ts`, and the Discord lines in [docs/auto-deploy.md](../auto-deploy.md).

## Change

After the first timer deploy (stage74) the owner asked for a check mark and an embed block like another bot's. Each alert is now one Discord embed, built with `jq` instead of `printf` into a JSON string: a coloured bar (green deployed, orange rolled back, red not deployed, CI failed or manual recovery), an emoji title with the tag that links to the tag on GitHub, and a description with the short commit and, for failures, the outcome, exit code and `journalctl` pointer. When, how often and whether an alert is sent are unchanged, as are the webhook handling (credential file, URL check, curl config on a pipe) and the failed-post logging. The poller updates itself from `main`, so nothing needs reinstalling.

## Verification

`server/node_modules/.bin/tsx --test scripts/autodeploy.test.ts`: 50/50. The alert assertions now parse each post and require exactly one embed with the expected title, description, link and colour; they fail against the old one-line `content` format. `bash -n` passes; shellcheck is not installed on this host. The real Discord rendering is checked by the owner with a test post before the next tag.

## Review fixes (stage76 round 1)

- **Title length.** jq truncates the embed title to 256 characters, Discord's limit. RED→GREEN: a new test with a 240-digit major version and exit 3 got a 281-character title before and exactly 256 after, still starting with the emoji and the tag.
- **Guide.** The end-to-end section is now "Releasing a version": a placeholder `vX.Y.Z` above the live and recorded tags, the release published on GitHub, and the green embed as the expected Discord message.
- After the fixes: poller tests 51/51; `bash -n` passes.
