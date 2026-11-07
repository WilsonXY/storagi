# 178: Independent styled-retention UI review

- Status: completed — FAIL pending focus fix
- Started / last updated / completed: 2026-11-07, Asia/Kuala_Lumpur
- Coordinator thread: adjustable-file-retention design feedback; plan in stage 177
- Reviewer thread: <t3-thread://v2/0b2da89c-6f65-4626-9110-1a266286a5ad/thread:delegated-task:command%3Amcp%3Aa18c289f-80d4-49fe-8607-6812be0f1539%3Adelegate-task%3A9fad1845-d976-4367-aacd-16270e6d89d1>
- Provider/model/effort: Claude `claude-opus-5-5`, high. Coordinator independently parsed session `a4fa33a1-6125-45c4-9261-ce5ab76770e0.jsonl`: 52 actual model fields and 52 effort fields matched. No fallback. Literal session paths remain outside Git.
- Workspace/branch and starting/ending commit: isolated `t3/retention-settings-design-review`, `42c7418e052d95bd80019e6825eb1564e9205d41`
- Scope and acceptance: read-only review of `cda2d81..42c7418`, including scoped menu semantics, keyboard/focus, matching controls/dialog typography and four labelled desktop/phone screenshots. Do not edit, install, commit, push, post, start listeners or delegate. Coordinator writes this record.

## Decisions and result

Requested the owner's Opus 5.5/high reviewer through `delegate_task` with review role and committed worktree isolation. Reviewer inspected source and all four screenshots. **FAIL** for a plausible cross-browser focus-dismissal bug; the visual design, remaining logic/security, semantics and scope passed. No runtime browser was run by the reviewer.

## Findings

1. **Blocking, accept and fix:** `focusout` with `relatedTarget=null` hides the menu before a button click can select. Reviewer identified Safari/WebKit's non-focusing pointer behavior as a likely trigger, but did not reproduce it. WebKit is not installed here. Null focus destination is not evidence of leaving this picker; retain outside-pointer, Tab and known-outside-focus dismissal, and ignore null destinations. Add a regression before changing the guard.
2. **Nonblocking, keep:** hover/selected/focus share the existing active surface. Selected tick and existing koi focus outline distinguish them without a new palette.
3. **Nonblocking, keep:** disabled trigger has no separate opacity/cursor style, matching existing app buttons; spinner and native disabled state remain.
4. **Nonblocking:** redundant menu minimum width can be removed while adjusting its bounds. Keep the defensive confirmation close/reset path when draft duration changes; it preserves deterministic acknowledgement reset even under programmatic changes.
5. **Observation:** no typeahead is acceptable for six choices; closed-trigger Escape retains the previous dashboard behavior.

## Verification and cleanup

Coordinator HEAD, clean porcelain status and all remote head refs exactly matched before/after review. Review checkout independently remained at 42c7418 with empty status. Coordinator checked the reviewer session log, then removed its worktree and branch. No other checkout/service was changed. Static/screenshot review is not independent runtime acceptance.

After review, a coordinator short-viewport check repeated with popup animation settled found that the last option could clip at 740×360. The earlier immediate-animation probe was insufficient. This separate integration finding will be fixed with scoped above/below placement using the existing popup positioning concept, without introducing a general positioning framework. Stage177 records the regression and final results. A fresh review round uses stage 179; this original FAIL is preserved.

## Handoff

Coordinator fixes focus and short-viewport placement, reruns affected web/browser checks, commits, and obtains fresh stage 179 review before updating PR #40. No merge or production deployment.
