# First real-device transfer check

Use the current Storagi URL on the Linux laptop/Zen and phone/Chrome. Keep originals. Test from the intended remote network with Tailscale disconnected on the browsing devices only; leave the Storagi host unchanged. Note Wi-Fi/mobile-data type and approximate elapsed times without sharing private network details. Use ordinary browser windows with site storage enabled, not private mode.

1. On the laptop, upload a small HTML file and image. On the phone, sign in, find both and download them; confirm the image opens. An HTML download need not render inside Storagi. Upload a different small image from the phone and download/open it on the laptop to check both directions.
2. Start the unchanged MP4 from Zen. At roughly10–30%, note progress, click **Pause**, reload the page, then select the exact same original MP4 in Zen. Do not click Cancel, clear site storage or switch browsers. It should recover near the last completed8MiB chunk rather than retransferring the entire file. Note any apparent reset/error and whether one completed copy appears.
3. Let the upload finish. Download it in phone Chrome and confirm completion, expected size and playback near the beginning, middle and end. This checks practical use, not a byte-for-byte phone hash. Keep Chrome foreground during this first check; background suspension is a separate test.
4. Also download the video back to the laptop into a different location. Compare originals and that downloaded copy locally:

   ```sh
   sha256sum -- "/path/to/original.mp4" "/path/to/downloaded.mp4"
   ```

   Replace both portable example paths. The two hashes must match. Report only match/no-match, not raw terminal output with filenames. This verifies the laptop download, not the phone's hash.
5. Report approximate video size, upload/download times, devices/browser versions if available, network type, whether reselect resumed, phone playback and laptop hash result. Keep test server copies until results are recorded; deleting them later in the dashboard must leave source originals intact.

After this passes, a separate unexpected network interruption/recovery and phone upload/background test can follow. Pause/reload alone does not prove those behaviors. A file under1GB is a first real-world check, not evidence of a multi-GB WAN transfer. Boot autostart is accepted as working by the owner with a physical reboot test waived; no further reboot check is planned.
