import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fixture } from './fixtures.js';
import { upload } from './uploads.js';

// CI installs ffmpeg, so there a missing one fails the test instead of skipping it.
const skip =
  !process.env.CI &&
  spawnSync('ffmpeg', ['-version']).status !== 0 &&
  'ffmpeg is not installed, so previews cannot be made';
// Synthetic media from ffmpeg's own test pattern.
async function media(dir: string, name: string, args: string[]) {
  const file = path.join(dir, name);
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', ...args, file]);
  return readFile(file);
}

test('previews need a session, a finished upload of an image or video, and GET', async () => {
  const f = await fixture(1000);
  try {
    const text = await upload(f, 'hello', 'notes.txt'),
      image = await upload(f, 'not really', 'photo.png');
    assert.equal((await f.request(`/api/files/${image}/preview`)).status, 401);
    assert.equal(
      (await f.request(`/api/files/${text}/preview`, { headers: f.headers }))
        .status,
      404,
    );
    assert.equal(
      (
        await f.request(`/api/files/${image}/preview`, {
          method: 'HEAD',
          headers: f.headers,
        })
      ).status,
      405,
    );
    // Without ffmpeg on PATH the route fails cleanly, so the dashboard falls back to the original.
    const saved = process.env.PATH;
    process.env.PATH = '';
    try {
      assert.equal(
        (await f.request(`/api/files/${image}/preview`, { headers: f.headers }))
          .status,
        503,
      );
    } finally {
      process.env.PATH = saved;
    }
  } finally {
    await f.close();
  }
});

// One fixture and small sources keep CPU low, since other test files run alongside with tight timing.
test(
  'images become a small WebP, videos a short MP4, and other content fails cleanly',
  { skip },
  async () => {
    const f = await fixture(1e8);
    try {
      const png = await media(f.dir, 'src.png', [
          '-i',
          'testsrc2=size=1500x1000',
          '-frames:v',
          '1',
        ]),
        mp4 = await media(f.dir, 'src.mp4', [
          '-i',
          'testsrc2=size=640x360',
          '-t',
          '2',
          '-preset',
          'ultrafast',
          '-pix_fmt',
          'yuv420p',
        ]),
        // A real video in MPEG-TS, which ffmpeg would convert without the format whitelist.
        ts = await media(f.dir, 'other.ts', ['-i', 'testsrc2', '-t', '1']);
      const image = await f.request(
        `/api/files/${await upload(f, png, 'Photo.PNG')}/preview`,
        { headers: f.headers },
      );
      assert.equal(image.status, 200);
      assert.equal(image.headers.get('content-type'), 'image/webp');
      assert.equal(image.headers.get('cache-control'), 'no-store');
      assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
      const webp = Buffer.from(await image.arrayBuffer());
      assert.equal(webp.subarray(8, 12).toString(), 'WEBP');
      assert.ok(
        webp.length < png.length / 4,
        `${webp.length} of ${png.length}`,
      );
      const video = await f.request(
        `/api/files/${await upload(f, mp4, 'clip.mp4')}/preview`,
        { headers: f.headers },
      );
      assert.equal(video.status, 200);
      assert.equal(video.headers.get('content-type'), 'video/mp4');
      const small = Buffer.from(await video.arrayBuffer());
      assert.equal(small.subarray(4, 8).toString(), 'ftyp');
      assert.equal(Number(video.headers.get('content-length')), small.length);
      assert.ok(
        small.length < mp4.length / 2,
        `${small.length} of ${mp4.length}`,
      );
      // The playlist points at the MPEG-TS video, so following it would succeed.
      const playlist = `#EXTM3U\n#EXT-X-TARGETDURATION:1\n#EXTINF:1,\n${path.join(f.dir, 'other.ts')}\n#EXT-X-ENDLIST\n`;
      for (const [data, name] of [
        ['not an image', 'fake.png'],
        [playlist, 'clip.mp4'],
        [ts, 'clip.mov'],
      ] as const) {
        const response = await f.request(
          `/api/files/${await upload(f, data, name)}/preview`,
          { headers: f.headers, signal: AbortSignal.timeout(10000) },
        );
        assert.equal(response.status, 422, name);
        assert.deepEqual(await response.json(), {
          error: 'No preview for this file',
        });
      }
    } finally {
      await f.close();
    }
  },
);

test('at most two previews transcode at once, and failed or cancelled ones free their slot', async () => {
  const f = await fixture(1000),
    saved = process.env.PATH;
  try {
    // A stand-in ffmpeg that takes a second and then fails with no output; exec keeps it one process, like ffmpeg.
    await writeFile(path.join(f.dir, 'ffmpeg'), '#!/bin/sh\nexec sleep 1\n');
    await chmod(path.join(f.dir, 'ffmpeg'), 0o755);
    process.env.PATH = `${f.dir}:${saved}`;
    const id = await upload(f, 'x', 'photo.png'),
      get = (signal?: AbortSignal) =>
        f
          .request(`/api/files/${id}/preview`, { headers: f.headers, signal })
          .then((r) => r.status);
    assert.deepEqual(
      (await Promise.all([get(), get(), get()])).sort(),
      [422, 422, 503],
    );
    assert.equal(await get(), 422);
    const abort = new AbortController(),
      cancelled = get(abort.signal).catch(() => 'aborted');
    await new Promise((r) => setTimeout(r, 200));
    abort.abort();
    assert.equal(await cancelled, 'aborted');
    // The server kills the cancelled ffmpeg on disconnect; give it a moment to see the close.
    await new Promise((r) => setTimeout(r, 200));
    assert.deepEqual(await Promise.all([get(), get()]), [422, 422]);
  } finally {
    process.env.PATH = saved;
    await f.close();
  }
});
