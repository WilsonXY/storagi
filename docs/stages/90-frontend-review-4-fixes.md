# 90: Fix review rounds 88 and 89

- Status: completed
- Date: 2026-10-23 +08:00
- Owner: coordinator (Claude Code in T3 Code, thread `90da6e4a-818a-4e67-bc98-98f1606e3cd0`)
- Starting commit: `78dd79c`
- Scope: 88 N1–N4 and 89 A1, A4, A5

## Changes

- **N1/A1:** a bulk batch leaves the mergeable set the moment its DELETEs start, so a later bulk delete never folds it in.
- **N2:** a replaced toast is made `inert` and its button disabled while it fades.
- **N3:** a bulk delete with nothing new returns before touching earlier batches.
- **N4:** rows counting down inline are left out of select-all, Ctrl/Cmd-A, shift ranges and drags, and their checkbox does nothing.
- **A4:** a list body that cannot be read (dropped connection, captive-portal page) and a download stream that drops both put the page offline; disk errors still stay on the transfer row.
- **A5:** the download path follows `showSaveFilePicker` alone; phones have no picker, so they still use plain links. The old "phone downloads remain browser links" test, which asserted the width check, now asserts that a narrow window with a picker uses it.

## Verification

- Six new or changed dashboard tests failed on `78dd79c` and pass after.
- `npm run check`: 32 server, 79 web, 11 acceptance tests, both typechecks and builds pass.
