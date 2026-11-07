# 235: Independent review of shared Inbox/Text retention

- Status: completed, PASS with non-blocking suggestions dispositioned
- Date: 2026-11-07, Asia/Kuala_Lumpur
- Coordinator: top-level adjustable-retention follow-up, runtime Codex GPT-6.1 Sol/high; stage 232
- Reviewer: distinct T3 `delegate_task`, role `review`, isolation `worktree`; task suffix `e2d83fe1-e21a-4bc0-95b3-2fb9d9090796`
- Actual provider/model/effort: Claude Code, `claude-opus-5-5`, `high`. No fallback needed. Coordinator independently parsed the reviewer's own session `ad83c966-c6b2-4af3-8849-3953da587755` under quoted `$HOME/.claude/projects/`; 76 `model` fields and 76 `effort` fields confirm those values.
- Committed snapshot: `e915b55ee54912a37e231bf962b67535b1170b45`, against merged-main baseline `2dee502`; incoming accepted Text main `08dfbcf`
- Reviewer checkout: quoted `$HOME/.t3/worktrees/storagi/t3-4e4039a0`, branch `t3/review-shared-text-retention`
- Scope: shared policy/atomic count/deadlines, no revival/rollback, Text ETag and card refresh, Settings-from-Text refresh, paste metadata fallback, guards, merge/design preservation and meaningful tests.

## Verdict and checked behavior

**PASS.** No blocking security or logic errors. The reviewer traced the one immediate transaction and single sampled time, combined parameterized count and original-time deadline updates, insufficient-acknowledgement early return, rollback, live-only eligibility and unchanged partial inactivity. New Text and file completion read committed policy; existing startup deadlines remain authoritative. Deadline-aware Text ETags refresh same-ID content metadata; card/content nodes, focus and selection stay intact. Settings uses the visible view for refresh and labels. Paste confirmation prefers latest listing, then session, then default30. Auth/CSRF/origin/body/input checks remain intact.

The reviewer independently exported the committed snapshot outside the checkout into home-cache temporary space and reused installed dependencies: Settings/Text server tests **17/17**, affected web tests **75/75**, both TypeScript checks passed on Node22.22.1. The temporary export was removed. It inspected the coordinator's synthetic browser result and Settings screenshot; it did not rerun full repository/browser/format/secret checks or watch the video. Coordinator's complete checks used Node22.23.4. No CSS/dependency/lockfile changes or over-engineering were found.

## Findings and dispositions

1. **Low, count-only acknowledgement caveat — decline identity snapshots.** Equal counts can represent different items if one disappears while another crosses the boundary. This is the owner's already accepted count-based design (stage171), not a new defect. Preserve the existing acknowledgement API and last-write-wins; do not introduce signed tokens or ID snapshots.
2. **Low, date-formatting performance suggestion — decline unmeasured optimization.** Both dates are formatted per rendered card to share initial creation and refreshed metadata. The shelf is bounded at100 items; no measured responsiveness problem was found. Moving formatting into the update-only branch also requires changing the existing initial-card template. Keep the simple shared path for this scoped integration.
3. **Documentation nit — fix spacing** in stage233's runtime sentence. **Preserve the historical fixed30 requirement** in the original design section: the subsequent adjustable and shared Inbox/Text decisions explicitly supersede it. Rewriting historical requirements would hide the decision trail.
4. **Test suggestion — fix.** Add two focused cases, one file-only shelf and one Text-only shelf. In each, a second item crosses the exact boundary while confirmation is open: acknowledgement1 receives409/count2 with both tables/policy unchanged, then acknowledgement2 commits. This supplements mixed4-to6 server coverage and the browser's mixed3-to4 case. No application change was needed.
5. **Over-engineering — none.** One existing setting, a small shared deadline helper, combined SELECT and additional UPDATE; existing Settings design reused.

The coordinator applies these bounded documentation/test changes directly, without an unnecessary delegated re-review. App source is unchanged after the passing review; rendered browser proof remains current.

## Read-only invariance and cleanup

Before delegation and after completion, coordinator HEAD was `e915b55`, `git status --porcelain` was empty and every `git ls-remote --heads origin` line matched byte-for-byte. Ignored before/after audit files remain under `artifacts/shared-adjustable-integration/`. The reviewer independently reported the same invariant clean checkout at start/end and unchanged remote heads. Coordinator checked its worktree HEAD and clean status before removing it with `git worktree remove --force`, then deleted only branch `t3/review-shared-text-retention`. No review branch was pushed. No repo writes, GitHub posts or further delegation occurred.

## Handoff and limitations

Coordinator's post-review Settings/Text run passed **19/19** on Node22.23.4, including both added isolated-count cases. Final formatting/staged-secret checks, PR40 push/update, the authorized synthetic preview refresh and required CI follow. No real OAuth/data, physical device/WebKit coverage, production deployment, PR merge or tags were exercised. Earlier records remain historical; this is the independent review for the shared Inbox/Text follow-up.
