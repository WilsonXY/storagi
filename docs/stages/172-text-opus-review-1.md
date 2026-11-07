# 172: Text handoff Opus review, iteration 1

- Status: completed; FAIL, further implementation required
- Started / completed: 2026-11-05 Asia/Kuala_Lumpur
- Coordinator thread: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c
- Agent/task: Opus review iteration 1, task suffix `34c1603a-8c59-4974-9e6b-848b318212e6`
- Provider/model/effort: Claude / `claude-opus-5-5` / high; coordinator confirmed `.message.model` and top-level `.effort` in the reviewer's own `$HOME/.claude/projects/<review-worktree>/18606403-6af1-41cb-a45f-745dd278b4d4.jsonl` (52 assistant entries). API request records also show `params.output_config.effort: high`.
- Workspace/branch and starting/ending commit: isolated `t3/text-handoff-review`, `f1aaeab`, clean before/after
- Scope and acceptance criteria: [stage 170](170-text-handoff.md); independent read-only full-feature review and scores

## Verification and results

Read diff/callers/tests and all three layout screenshots. Dependencies absent in review checkout; reviewer did not run tests. No blocking security/logic finding. Scores: product **7**, UX/accessibility **7**, reliability **8**, security/privacy **8**, tests **8**, simplicity **8**; overall **7**. Target not met.

## Findings and responses

1. Medium: Inbox shows no waiting-text count until entering Text and OAuth loses the text bookmark. **Fix:** add count to existing file listing; preserve shelf preference across login/reload.
2. Medium: phone pickup actions below composer/fold; send refocus opens keyboard; Copy looks like plain text. **Fix:** prioritize received items on phones when present, compact heading, visible Copy/Open controls, no coarse-pointer refocus.
3. Medium: unchanged polls repeat all text bodies (up to 6.4 MiB). **Fix:** conditional ETag refreshes based on immutable live IDs; no browser-persisted content cache.
4. Low: already-removed delete reports file/Inbox error. **Fix:** text-specific error and treat 404/410 as delete success.
5. Low: public test/screenshots reuse the owner's example browsing URL. **Fix:** replace with a synthetic example.com link and regenerate proof. Earlier commit retains the user-supplied example; final PR is scrubbed by rewriting the feature commits before publication.
6. Low: Send's decorative arrow becomes part of its accessible name after sending. **Fix:** update only a label span.
7. Low: status text rewritten on each poll. **Fix:** write only when changed.
8. Low: Escape doesn't cancel deletion; shortcut dispatches synthetic submit. **Fix:** close confirmation on Escape; use requestSubmit.
9. Low: missing regression coverage and browser check absent from CI. **Fix:** add navigation/pending-send/count/preference/conditional-refresh/full-capacity/delete/cleanup/keyboard coverage and run the optional browser harness in CI with an explicitly installed browser.
10. Suggestions: simplify 404/410 backend distinction and navigation helpers. **Decline:** HTTP expiry semantics match existing file behavior; one shared tab function already controls shelf changes. Concrete navigation bugs are fixed directly without another abstraction.

## Handoff

Coordinator verified parent HEAD/status and all remote branch heads unchanged, and the reviewer worktree clean at its starting commit. Removed only this review worktree and branch. Next iteration addresses findings and is reviewed by fresh Opus and Sol tasks.
