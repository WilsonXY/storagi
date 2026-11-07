# 200: Share file and Text retention policy

- Status: in progress
- Started: 2026-11-07 Asia/Kuala_Lumpur
- Coordinator: e234a6d1-ef1f-41df-a303-c5d2ad3e4e8c
- Provider/model/effort: Codex gpt-6.1-sol high (runtime)
- Branch/start: t3/text-copy-paste-transfer, 55ddc75
- Authorization: owner accepted the proposal to reuse file retention policy/calculation for Text. Current completed-file policy is30days; remove separate24hour Text lifetime.

## Coordination and acceptance

Distinct backend implementation agent owns server source/tests and stage201; coordinator owns frontend labels, browser acceptance, docs, integration and independent review records. Use one server-owned completed-shelf retention constant/calculation for files and Text. Expose retentionDays through authenticated session metadata so file/Text UI and paste confirmation share policy rather than hardcoding separate values. No new user setting exists in this branch, so do not invent one. Keep partial-upload inactivity24h and sessions7days separate from completed content retention.

New Text follows completed files30days. Stored expiresAt deadlines remain authoritative, including existing Text; do not extend, resurrect or migrate prior content. Keep text/file data-specific deletion, shared SQLite and cleanup scheduler, owner auth/CSRF, capacity and transfer semantics. Verify exact boundary/restart/current deadlines, metadata-to-UI labels and readable long-retention labels. Full project checks and actual-service browser proof then fresh Opus5.5/Sol6.1 high reviews (UI>=9 and no blocking backend/logic finding). Refresh existing owner-authorized private preview after review/push; preserve production and other mappings.

## Additional owner steering

Owner supplied composer screenshots and explicitly requested removal of the inner white input frame while typing, using Inbox's file composer as the design reference. Coordinator will reuse the existing composer card/row/hint styles for Text and remove the editable textarea's focus outline/shadow, retaining its native caret and subtle active-card background. Clipboard recovery remains a distinct readonly selection control. This steering accompanies, rather than replaces, the shared-retention task.

Owner also supplied Inbox filename references and requested the same font for copied/received text. Coordinator will use Storagi's existing Leon Sans --font token for note/link bodies, composer and readonly copy recovery, retaining monospace only for small metadata consistent with Inbox. No new font/assets are introduced.
