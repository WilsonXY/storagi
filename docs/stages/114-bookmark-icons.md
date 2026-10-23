# 114: Allow browsers to save public bookmark icons

- Status: completed; independent stage115 review PASS
- Started / last updated: 2026-10-24 (Asia/Kuala_Lumpur)
- Coordinator thread: `d807b8e5-7dd4-4689-804a-6518669f772b`
- Agent/task/thread identifiers: native implementation task `/root/bookmark_icon_fix`, session `01a16a3c-a787-7503-bb59-c520afc5b846`.
- Provider/model/effort: implementation OpenAI gpt-6.1-sol/high, confirmed in its own native session JSONL (`session_meta` line1 and `turn_context` line7); coordinator also gpt-6.1-sol/high. Owner explicitly requested Astra for the independent review.
- Workspace/branch and starting commit: `t3/bookmark-icon-missing`, `f2fa138`.
- Scope and acceptance criteria: let browsers persist the existing public brand icons; preserve `no-store` for private responses, shell, unrelated assets and failures. First reproduce the incorrect favicon header in an HTTP regression test, then implement the smallest fix. Run `npm run check`; independently review before publishing a PR. No deployment or host changes.

## Decisions

The owner reported a globe on the bookmark while the active tab showed the koi, then requested a fix. `server/src/app.ts` applies `Cache-Control: no-store` to every response; the public static handler never overrides it. Firefox's favicon loader refuses to persist selected non-ICO icons under that header. The correction belongs in successful public icon serving, after path validation. See [Mozilla's favicon loader](https://github.com/mozilla-firefox/firefox/blob/main/browser/modules/FaviconLoader.sys.mjs).

## Changes

`server/src/static.ts` reuses the existing exact eight-path brand-icon allowlist for a `Cache-Control: public, max-age=86400` override. The override happens only after realpath containment and regular-file validation, before the successful GET/HEAD response. Icon filenames are not fingerprinted, so the one-day freshness lifetime permits updates without an immutable-cache promise. Authentication and the default `no-store` policy remain in the existing app handler.

`server/test/static.test.ts` extends the existing exact-brand test to cover SVG, ICO and every PNG variant with cacheable GET/HEAD responses. One additional HTTP boundary test checks `no-store` on shell, JS/CSS/fonts/other images, missing/disallowed/nonregular/outside-root-symlink icons, rejected POST, anonymous and authenticated API responses, and protected full/range/HEAD downloads using existing synthetic login/upload fixtures. No dependencies or frontend files changed. Coordinator owns the stage index, integration, read-only review records and publication.

## Verification

Diagnosis: icon files and HTML declarations exist. A live HTTPS probe could not resolve the screenshot hostname from this session. T3 browser initialization failed with the host AppArmor prerequisite. Neither failure proves a live server response or bookmark result.

Implementation commands use `TMPDIR="$HOME/.cache/storagi/tmp"`; complete local logs are in `"$HOME/.cache/storagi/bookmark-icons"`, outside Git.

- `npm run setup`: PASS, existing server/web lockfiles installed with no lockfile changes; both audits reported zero vulnerabilities. npm reported the existing `whatwg-encoding` deprecation.
- `server/node_modules/.bin/tsx --test --test-name-pattern='cacheable GET and HEAD' server/test/static.test.ts`: expected RED before product change, actual `no-store` versus expected `public, max-age=86400`; `red.log` retained. Same command after the minimal fix: GREEN, 1/1 passed; `green.log` retained.
- `server/node_modules/.bin/tsx --test server/test/static.test.ts`: initial boundary test run had 3/4 pass; an unrelated attempted Host override through fetch returned missing-file 404 instead of intended host-error 400. The first `npm run check` also stopped at the same assertion, server32/33. Removed that unsupported harness probe without changing product host validation. Original `static.log` and `check-host-probe-failure.log` retain both failures.
- Final `npm run check`: PASS, exit0 after all test edits settled: server33, web88, independent HTTP acceptance11 and deployment154 checks passed (286 total); both TypeScript checks and both production builds passed. Final `check.log`/`check.exit` retained. This includes all four static HTTP tests and real authenticated full/range/HEAD file response checks.
- `git diff --check`: PASS. Implementation source/test changes are limited to the two scoped server files; stage114 is the implementation record. The coordinator's index/review record are separate owned edits.

## Findings and limitations

Coordinator independently inspected the complete source/test diff, the final build log and the implementation session's own model/effort metadata. After the full check completed, a separate loopback HTTP smoke copied `web/dist` into the existing synthetic fixture and exercised all eight real built icon files with GET and HEAD: 16 responses returned 200 and `public, max-age=86400`, with nonempty GET bodies and empty HEAD bodies. The shell and authenticated `/api/session` retained `no-store`. Fixture server and synthetic data were cleaned up. No production app or owner data was used.

Browser bookmark persistence is not exercised: the shared T3 preview cannot initialize because of the host AppArmor prerequisite, and HTTP checks establish response policy rather than Firefox/Zen bookmark database behavior. No live service was restarted or deployed. Public proof uses repository-relative paths and synthetic data. No credentials, network mappings, power settings or service configuration changed.

## Handoff

Coordinator committed the tested fix as `cb8f22f`, accepted stage115's owner-requested Astra/high PASS after independently checking its session metadata and repository invariants, and published [PR#19](https://github.com/WilsonXY/storagi/pull/19). T3 PR linking confirmed. The first remote Check read was pending; CI will be followed through T3 PR watching, with the final result reported on the PR/thread rather than inferred from local checks. Only completion documentation changed after review. Implementation agent did not commit, push, publish or deploy. No merge, release tag or live deployment performed.
