# 210: Keep scrolling drafts clear of footer controls

- Status: completed; fresh review pending
- Started:2026-11-07 Asia/Kuala_Lumpur
- Coordinator/task:e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c; coordinator fixes small review defect
- Provider/model/effort: Codex gpt-6.1-sol high(runtime)
- Branch/start:t3/text-copy-paste-transfer,4395397
- Acceptance: resolve both reviews' footer overlap while preserving full native textarea hit box, deleted helper copy,16px notes and all previous behavior. Fresh reviews211–212, UI-only>=9 and no blocker.

## Approach

Use transparent non-scrolling native textarea borders for its insets instead of scrolling padding. Include border-box overhead in auto-grow before the240px cap. The card remains one native textarea including its blank/footer area, with Send independently interactive. Prove actual native scrolling viewport ends above both controls and rendered footer pixels do not change as draft scrolls top/middle/end, enabled60KiB and disabled65KiB on phone/desktop. Retain existing click/tap hit tests and add a border-aware growth/shrink regression.

## Implementation and proof

The strengthened actual-browser check first failed on the old native viewport extending below the controls, independently of the old padding assertion. A new unit regression first failed to add86px native box overhead while growing an intermediate draft. Both pass after the fix.

The textarea now uses transparent fixed borders for top/right/bottom/left editing insets, with zero scrolling padding. Its bounding/hit box still occupies the whole form; blank native-border areas remain editable on click/tap. These invisible insets also keep text away from the card edges and keep native scrollbars above the footer. Auto-grow adds offsetHeight-clientHeight to scrollHeight before the240px cap, preserving intermediate growth and shrink behavior.

Focused Text suite29/29 and web types/build passed. Expanded actual-service two-context browser1/1 passed in59.9seconds. It measures the actual native scrolling viewport above both Send and count, captures top/middle/end for enabled60KiB and disabled65KiB on phone/desktop, and compares the rendered footer PNG pixels across scroll positions. All pixels stay identical within each state. Existing native full-form hit testing, mouse/touch typing, counter click-through, Send,16px notes, copy/swipe/Undo/keyboard/koi/auth/expiry flows remain green. Eight added scroll-state screenshots (six phone, two desktop) join the31 refreshed images; representative enabled-top and disabled-middle/end phone images were inspected directly.

Ignored logs: artifacts/full-surface-2-grow-{red,green}.log, full-surface-2-footer-red.log, full-surface-2-browser.log. Complete final integration/format/secret outcomes follow before review dispatch. No backend, dependencies, host services or preview changes.

## Full-check interruption

The default parallel full-check attempt passed server44, then the web runner failed with5s/20s timeouts across unrelated suites and worker-start response timeouts. No value assertions failed. Read-only host inspection showed4 CPUs with load averages around10–12; no leftover Vitest process remained after the failed command exited. The changed Text suite29 and actual browser proof had passed immediately before this run.

Ranked causes: shared-host resource contention (supported by broad startup/timeouts/load), orphaned test workers (ruled out by process check), or a code regression (requires a reproducible functional failure). Rerun the complete web suite with one worker, then the remaining project checks, without modifying test timeouts/configuration or host services. Record the outcome below; do not claim the first default run passed.

## Final integration outcome

Without code or timeout changes, all 14 web suites / 149 tests passed with one worker (38.05 seconds), supporting shared-host contention as the cause of the default parallel attempt. Remaining checks passed: HTTP 11, deployment 154, both type checks and both builds. Server 44 had already passed in the default attempt. Formatting and whitespace checks passed. The actual-browser 1/1 proof remains the final source's rendered scroll-state evidence. The shell lacked Gitleaks on PATH, so the first staged invocation could not run. A checksum-verified local copy of the same pinned Gitleaks 8.30.1 used by CI scanned both feature commits since 41f5bf1 after commit: no leaks. Evidence is saved in full-surface-2-secrets.log; no global installation or PATH change was made. Remote CI must still run the default workflow before handback; the local default attempt is not represented as passing.

Ignored evidence: artifacts/full-surface-2-check.log (failed parallel attempt), full-surface-2-web-serial.log, full-surface-2-http.log, full-surface-2-deploy.log, full-surface-2-types.log, full-surface-2-build.log, full-surface-2-format.log, full-surface-2-secrets.log. No host service or test configuration changes were needed.
