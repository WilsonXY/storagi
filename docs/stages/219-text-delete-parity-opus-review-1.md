# 219: Inbox-parity Text delete review 1 — Opus

- Status: failed; UI/UX 8.0; correctness 8.5, security 9.5, maintainability 8.5
- Completed: 2026-11-07 Asia/Kuala_Lumpur
- Coordinator: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c
- Reviewed: 79cdbea against 1f1b28b
- Task: 187e35a1-0a83-4892-ba5f-6fbd2d4d0b02
- Actual reviewer: Anthropic Claude Code / claude-opus-5-5 / high. Coordinator parsed 72 assistant records in reviewer-owned `$HOME/.claude/projects/<review-worktree>/6b10b8ad-a2f7-4a75-b466-bdb7b45cac0a.jsonl`, message.model and effort matching. Reviewer's broader model-record count was 97; these counts are not substituted for the parsed assistant subset. No fallback.

## Required findings and response

F1: existing selected note text silently blocks blank-area mouse swipes because non-selectable chrome does not clear the range and engaged() treats any selection as busy. Confirmed by reviewer's Chromium probe; coordinator accepts. Clear the stale range only on eligible Text mouse chrome before the busy guard, retaining actual content/control and touch selection safeguards. The browser's explicit range clearing had hidden this natural sequence; remove that shortcut.

F2: confirmed deletion now has four-second grace, and remove(id,true) unconditionally refocuses Copy/header when it commits. Typing in the composer during grace or delayed network response loses focus. Coordinator accepts. Determine restoration eligibility at completion from current body/deleted-card focus; never displace another focused control.

Phone shape, shared morph/countdown/spinner/timing and Inbox impact pass. Native mouse zones are a reasonable selection-preserving policy; document them plainly. No blocking security/data-loss issue or dependency/abstraction finding. UI score independent of backend/tests.

## Optional findings

F3: unconditional article tooltip advertises unavailable gestures, leaks into actual content hover and provides an unhelpful accessible article name. Remove it; retain scoped grab/text cursors. F5: shorter morph changes row height by 2px desktop/4px phone; reserve action-line height so neighbors do not jump. Both are included in the small correction. F4 fit-content pre could enlarge whitespace drag area but changes wrapping/RTL/focus geometry; retain explicit native content zone for this scope. Existing contrast strike colour, failed-delete focus, Undo restoring Copy rather than Delete are nonblocking observations; do not broaden correction into those paths.

## Audit and limits

Parent HEAD/status/all origin heads matched before snapshots after both completions. Both children stayed 79cdbea clean, and both actual worktrees/branches were removed after completion. Coordinator independently parsed own JSON model/effort evidence. No reviewer checkout writes/builds/installs/commits/push/posts/delegation. Chromium probes and scratch profiles outside checkouts were permitted; Opus's first inline probe hung and was terminated, second succeeded; its background read-only search was stopped. Physical hardware/native handles/software keyboards/AT remain unverified. Remote CI pending.
