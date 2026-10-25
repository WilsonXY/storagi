# 116: Gitleaks and Prettier development workflow

- Status: completed; reviewed in [117](117-dev-workflow-review.md)
- Started: 2026-10-25 (Asia/Kuala_Lumpur)
- Coordinator thread: `42d785a3-6c60-4ddc-8d8b-c6f10923031b`
- Owner: distinct delegated implementation task; coordinator integrates and publishes.
- Actual implementation runtime: Codex `gpt-6.1-sol`, high reasoning effort, identified by this task's injected runtime metadata (not inferred from requested settings).
- Starting branch/commit: `t3/fix-gitleaks-prettier-workflow`, `ac24b45`.
- Scope: resolve issue #16 and add repeatable Gitleaks checks locally and in CI. Preserve application behavior and approved design. Keep initial mechanical formatting in its own commit.
- Acceptance: pinned tools, documented local commands, PR checks, default secret rules retained, no broad false-positive suppressions; demonstrate dirty formatting and synthetic secrets are rejected, clean source passes, existing checks pass.

## Decisions

Issue #16 is the recorded Prettier request. Repository search found no Gitleaks integration or separate Gitleaks issue. Implementation will cover both as development checks, with no deployment, exposure or host-service work.

- Use exact local Prettier 3.9.10, a root lockfile and one `singleQuote` option matching existing source style. Format only handwritten application/acceptance source, with encoded mark, generated icons/fonts, build output and evidence excluded. No manual template restructuring.
- Use official Gitleaks 8.30.1 Linux x64 archive verified against its pinned release SHA-256, directly in CI and documented for local installation. No installer wrapper, action license token, custom secret rules, baseline or allowlists.
- Local `secrets:check` scans staged changes before committing; `secrets:history` scans all available history. CI fetches full history. These are separate from the unchanged correctness command.
- Update root setup, CI npm cache and Dependabot's npm directories for the new root package lock.

## Verification

Read AGENTS.md, README, design record, recording rules, issue #16 (body/comments) and Check workflow. The coordinator's index edit and planned stage116 file were present at handoff; the implementation task leaves the index to the coordinator.

Private logs and probes are under `"$HOME/.cache/storagi/stage116"`; temporary test data uses its `tmp/` directory. Node v22.22.1, npm 9.2.0. No raw reports or synthetic tokens are committed to Storagi.

- Initial `npm run check`: failed immediately (`tsx: not found`) because application dependencies were absent. Existing `npm run setup`: passed. Baseline rerun: PASS, 33 server + 88 web + 11 HTTP acceptance + 154 deploy tests (286 total), both typechecks and builds (`baseline-ready.log`).
- Initial `npm run format:check`: exit 1, rejected 64 existing unformatted source files (`format-red.log`).
- Verified downloaded Gitleaks archive with `sha256sum --check`: PASS; binary reports `8.30.1`. Initial default-rule full-history scan: PASS, 266 commits, no findings (`history.log`).
- Synthetic staged-token probe: `npm run secrets:check` exited 1 as required; fixture unstaged and removed (`secret-red.log`).
- Deleted synthetic-token history probe in an isolated cache repository: same history scan exited 1 as required, even though current tree no longer held the token (`history-probe-red.log`).
- Integrity negative probe: a corrupted archive copy failed the pinned SHA-256 check with exit 1 (`integrity-red.log`); the official archive passed before extraction.
- Prettier's initial `--debug-check`: exit 2, reporting first/second-pass chain wrapping differences in `scripts/acceptance-browser.mjs`, `scripts/acceptance-service-browser.test.ts` and `web/tests/dashboard.test.ts`. First formatting/check therefore still rejected those three files. A second mechanical pass reached a stable result: `format:check` and `--debug-check` both PASS (`format-green.log`, `format-debug-green.log`). No manual source adjustments.
- Intentional unformatted TypeScript probe in `web/src/`: root `format:check` rejected that file (exit 1); the pinned formatter fixed it and the root check passed (exit 0). Probe removed (`format-probe-{red,green}.log`).
- One-time comparison against the starting commit: DOM structure, attributes and normalized nonblank text unchanged in `web/index.html`, `web/src/shelf.html` and `web/src/locked.html`; parsed HTML literal values in web TypeScript unchanged (`html-template-inspection.log`). This does not claim pixel/browser verification.
- `git diff --check` and staged Gitleaks scan passed before the dedicated source-formatting commit `c48a698` (64 files, only `server/`, `web/`, `scripts/`; no tooling/docs mixed in).
- Revised `npm run setup`: PASS, installs root/server/web from all three lockfiles (`setup-final.log`).
- Final `npm run check`: PASS, same 286 tests (33 server, 88 web, 11 HTTP acceptance, 154 deploy), both typechecks and builds (`check-final.log`). Built CSS retains `index-DD9sEF_X.css`, matching baseline; font assets also retain their hashes. HTML/JS build hashes change after source formatting, as expected; no runtime behavior changes are intended.
- Final `npm run format:check`: PASS after lockfile-based setup (`format-final.log`). `npm run secrets:history`: PASS, 268 available commits before the tooling commit (`history-final.log`), then 269 including committed tooling/docs (`history-committed.log`), no findings. Default rules remained unchanged; no false-positive exceptions were needed.
- Tooling/documentation staged Gitleaks scan and `git diff --cached --check`: PASS (`tooling-staged-secrets-green.log`). This includes root configuration/lock, CI/Dependabot, README/setup/verification guides and this record; the coordinator's index edit is excluded.

## Remaining long HTML templates

Inspected the remaining long source lines after formatting. `web/src/dashboard.ts` retains HTML lines of 161, 200, 196, 365 and 645 characters (lines 349, 403, 407–409); `web/src/transfer-view.ts` retains 418, 229 and 255 characters (lines 43, 173, 179). These construct loading/refresh content, file rows and transfer rows/summaries. Prettier preserves untagged string contents; manually splitting/extracting templates would be a separate behavior-sensitive change requiring DOM/interaction proof. No restructuring is included here. Encoded `web/src/mark.ts` is excluded from readability counts.

## Limitations

Actual GitHub Actions execution and independent review are left to the coordinator; this task neither pushes nor opens a PR. Browser/pixel checks, real Google login, live transfers and production rollout were not repeated for this formatting/tooling change. DOM/literal comparison, the formatter's AST/stability check and existing interaction/security suites are the local evidence. Remaining untagged long templates are deliberately unchanged.

Gitleaks is installed separately using the documented version/checksum rather than through npm. Local staged scanning requires staging every intended change and rerunning after edits; no hook is installed automatically. CI's full-history scan covers committed changes before merge. The Linux x64 installation example matches the CI runner; other platforms need their matching official archive/checksum.

## Handoff

Implementation agent owns workflow/tool configuration, formatting, documentation and this record. Coordinator owns stage index, independent review record, final verification and publication. Review uses a fresh isolated checkout after commits. The formatting-only commit is `c48a698`; tooling, locks, workflow documentation and this record are a separate commit. The coordinator's index edit is left uncommitted by this task. No agents were spawned; no pushes, PRs, merges, tags, deployments, exposure or host-service changes were performed.
