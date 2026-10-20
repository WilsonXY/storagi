# 42: Owner-assisted WAN and device transfer acceptance

- Status: owner Inbox and general first file test PASS by owner report; detailed measurements unreported.
- Coordinator thread: [implementation](t3-thread://v1/mcp:1bc322fe-14cf-422e-bfb6-6c55dbc5041a).
- Owner/task: coordinator prepares protocol; owner uses producing/receiving browser devices. Provider/model for any later distinct acceptance task unverified until runtime evidence.

## Acceptance

Use only deliberately selected representative ZIP/MP4 artifacts, retaining originals. After maintenance/crash tests finish, owner uploads over intended remote network, interrupts/reselects, confirms resumed original object and downloads elsewhere, checks byte count/SHA256 and timing. No owner payload, filenames, Google/session values or private network details enter public records. Explicitly attribute owner-observed data versus agent-generated local2GiB proof. Android/background/network combinations and cold reboot remain unverified until actually exercised.

## Outcome

Owner explicitly answered “Inbox loads” in the existing browser session after service handoff and recovery. This is owner-observed session/Inbox continuity, separate from agent anonymous probes. Owner chooses a Linux laptop with Zen browser and phone Chrome, using existing HTML/image files and an MP4 approximately1GB or smaller, retaining originals. Physical phone OS, exact byte size and remote network configuration are not inferred. No filenames/content or account values collected.

[Transfer checklist](../wan-transfer-check.md) gives small-file cross-device smoke, unchanged MP4 pause/reload/reselect in the same browser, phone download/playback and laptop original/download SHA256 comparison. Record approximate size/time/network type, observed resume point/errors and hash-match only, not private paths/payloads. A sub1GB real transfer is useful first WAN proof but not the multi-GB requirement; earlier generatedlocal2GiB proof remains separate. Hashing laptop source/download does not establish a phone byte-for-byte hash or mobile upload/background recovery. Owner subsequently reports “tested, seems working all good.” Record this as qualitative success of the first live file-test exercise using the proposed devices/files, not independent per-step proof. Exact file types/bytes, network/Tailscale state, resume observation, timings and SHA256 result were not separately supplied. Do not infer a specific hash match, multi-GB WAN proof or phone background/download recovery.

The owner asks whether that exercise included PR#4. Coordinator confirmed the active/enabled service remains running with NRestarts1 and the installed unit matches the PR unit byte-for-byte. The live service setup from PR#4 was already deployed before the owner test; merging records it in main rather than activating it again. Normal file use exercises that deployment; the separate16.033second automatic recovery proof belongs41, and no real host reboot was performed.
