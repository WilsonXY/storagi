import { FileStore } from '@tus/file-store';
import { Upload, MemoryLocker } from '@tus/server';
import { Readable } from 'node:stream';
import { open, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Storage, HttpError } from './storage.js';

export class Transfers extends FileStore {
  constructor(readonly storage: Storage) {
    super({
      directory: storage.filesDir,
      configstore: {
        async get(id: string) {
          const row = storage.db
            .prepare('SELECT value FROM tus WHERE id=?')
            .get(id) as { value: string } | undefined;
          return row ? JSON.parse(row.value) : undefined;
        },
        async set(id: string, value: unknown) {
          storage.db
            .prepare(
              'INSERT INTO tus VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value',
            )
            .run(id, JSON.stringify(value));
        },
        async delete(id: string) {
          storage.db.prepare('DELETE FROM tus WHERE id=?').run(id);
        },
        async list() {
          return storage.rows().map((r) => r.id);
        },
      },
    });
    // Our policy is inactivity-based, not file-store's creation-date expiry.
    this.extensions = ['creation', 'creation-with-upload', 'termination'];
  }
  async create(file: Upload): Promise<Upload> {
    const name = file.metadata?.filename;
    if (
      typeof name !== 'string' ||
      !name.trim() ||
      Buffer.byteLength(name) > 255 ||
      /[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069/\\]/.test(name)
    )
      throw new HttpError(
        400,
        'A plain filename of at most 255 bytes is required',
      );
    if (file.size === undefined)
      throw new HttpError(400, 'Known Upload-Length required');
    this.storage.reserve(file.id, name, file.size);
    try {
      const created = await super.create(file);
      if (file.size === 0) this.storage.complete(file.id);
      return created;
    } catch (error) {
      await this.remove(file.id);
      throw error;
    }
  }
  async remove(id: string): Promise<void> {
    // Disk deletion precedes quota release. A failed unlink retains its reservation.
    await rm(path.join(this.directory, id), { force: true });
    this.storage.forget(id);
  }
  async write(readable: Readable, id: string, offset: number): Promise<number> {
    const storage = this.storage;
    const guarded = Readable.from(
      (async function* () {
        for await (const chunk of readable) {
          if (storage.freeBytes() < storage.diskReserveBytes + chunk.length)
            throw new HttpError(507, 'Insufficient disk headroom');
          yield chunk;
        }
      })(),
    );
    try {
      return await super.write(guarded, id, offset);
    } finally {
      storage.touch(id);
      // Persist completed data before metadata can advertise it as downloadable.
      const file = await open(path.join(this.directory, id), 'r');
      try {
        await file.sync();
      } finally {
        await file.close();
      }
      await this.reconcile(id);
    }
  }
  async reconcile(id: string): Promise<void> {
    const row = this.storage.get(id);
    if (!row) return;
    const info = await stat(path.join(this.directory, id));
    if (info.size > row.size)
      throw new Error('Stored file exceeds reserved size');
    if (info.size === row.size) this.storage.complete(id);
  }
}
// One process shares tus's maintained lock and its cancellation/takeover semantics.
export class FileLocks extends MemoryLocker {
  async with<T>(id: string, work: () => Promise<T>): Promise<T> {
    const lock = this.newLock(id);
    await lock.lock(new AbortController().signal, () => {});
    try {
      return await work();
    } finally {
      await lock.unlock();
    }
  }
}
