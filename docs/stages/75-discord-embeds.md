# 75: Discord alerts as embeds

- Status: completed on branch; review in stage76.
- Date: 2026-10-23, Asia/Kuala_Lumpur.
- Coordinator thread: [deployment safety](t3-thread://v1/6b27b52f-7f18-4dd5-8543-2af3e102c844), Anthropic Claude Opus 5.5. Small change, not delegated.
- Scope: `scripts/storagi-autodeploy` alert format, its tests in `scripts/autodeploy.test.ts`, and the Discord lines in [docs/auto-deploy.md](../auto-deploy.md).

## Change

After the first timer deploy (stage74) the owner asked for a check mark and an embed block like another bot's. Each alert is now one Discord embed, built with `jq` instead of `printf` into a JSON string: a coloured bar (green deployed, orange rolled back, red not deployed, CI failed or manual recovery), an emoji title with the tag that links to the tag on GitHub, and a description with the short commit and, for failures, the outcome, exit code and `journalctl` pointer. When, how often and whether an alert is sent are unchanged, as are the webhook handling (credential file, URL check, curl config on a pipe) and the failed-post logging. The poller updates itself from `main`, so nothing needs reinstalling.

## Verification

`server/node_modules/.bin/tsx --test scripts/autodeploy.test.ts`: 50/50. The alert assertions now parse each post and require exactly one embed with the expected title, description, link and colour; they fail against the old one-line `content` format. `bash -n` passes; shellcheck is not installed on this host. The real Discord rendering is checked by the owner with a test post before the next tag.
