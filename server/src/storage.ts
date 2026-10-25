import Database from 'better-sqlite3';
import { mkdirSync, statfsSync, statSync } from 'node:fs';
import path from 'node:path';
export const DAY = 86400000;
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type FileRow = {
  id: string;
  name: string;
  size: number;
  uploadedAt: number | null;
  expiresAt: number;
  lastActivity: number;
};
export class Storage {
  readonly db: Database.Database;
  readonly filesDir: string;
  private downloads = new Map<
    string,
    { size: number; readers: number; retired: boolean }
  >();
  constructor(
    readonly directory: string,
    readonly budgetBytes: number,
    readonly diskReserveBytes: number,
    readonly now: () => number = Date.now,
    readonly freeBytes: () => number = () => {
      const fs = statfsSync(directory);
      return fs.bavail * fs.bsize;
    },
  ) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    this.filesDir = path.join(directory, 'objects');
    mkdirSync(this.filesDir, { recursive: true, mode: 0o700 });
    this.db = new Database(path.join(directory, 'storagi.sqlite'));
    this.db.pragma('locking_mode = EXCLUSIVE');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = FULL');
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY,name TEXT NOT NULL,size INTEGER NOT NULL CHECK(size>=0),uploadedAt INTEGER,expiresAt INTEGER NOT NULL,lastActivity INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS tus (id TEXT PRIMARY KEY,value TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY,csrf TEXT NOT NULL,expiresAt INTEGER NOT NULL,sub TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS secrets (name TEXT PRIMARY KEY,value BLOB NOT NULL);
   CREATE TABLE IF NOT EXISTS flow_replays (hash TEXT PRIMARY KEY,expiresAt INTEGER NOT NULL);
   DROP TABLE IF EXISTS flows;`);
  }
  pin(id: string): () => void {
    const row = this.get(id);
    if (!row) throw new HttpError(404, 'Not found');
    const active = this.downloads.get(id) ?? {
      size: row.size,
      readers: 0,
      retired: false,
    };
    active.readers++;
    this.downloads.set(id, active);
    return () => {
      if (--active.readers === 0) this.downloads.delete(id);
    };
  }
  get(id: string): FileRow | undefined {
    return this.db.prepare('SELECT * FROM files WHERE id=?').get(id) as
      FileRow | undefined;
  }
  rows(): FileRow[] {
    return this.db.prepare('SELECT * FROM files').all() as FileRow[];
  }
  usage() {
    const row = this.db
      .prepare(
        'SELECT COALESCE(SUM(CASE WHEN uploadedAt IS NOT NULL THEN size ELSE 0 END),0) usedBytes,COALESCE(SUM(CASE WHEN uploadedAt IS NULL THEN size ELSE 0 END),0) reservedBytes FROM files',
      )
      .get() as { usedBytes: number; reservedBytes: number };
    const retired = [...this.downloads.values()]
      .filter((file) => file.retired)
      .reduce((total, file) => total + file.size, 0);
    return {
      ...row,
      usedBytes: row.usedBytes + retired,
      budgetBytes: this.budgetBytes,
    };
  }
  reserve(id: string, name: string, size: number): void {
    this.db
      .transaction(() => {
        const usage = this.usage();
        if (!Number.isSafeInteger(size) || size < 0)
          throw new HttpError(400, 'Known nonnegative Upload-Length required');
        if (size > this.budgetBytes - usage.usedBytes - usage.reservedBytes)
          throw new HttpError(507, 'Storage budget is full');
        let remaining = 0;
        for (const row of this.rows().filter((r) => r.uploadedAt === null)) {
          let written = 0;
          try {
            written = statSync(path.join(this.filesDir, row.id)).size;
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          }
          remaining += Math.max(0, row.size - written);
        }
        if (size + remaining + this.diskReserveBytes > this.freeBytes())
          throw new HttpError(507, 'Insufficient disk headroom');
        const now = this.now();
        this.db
          .prepare('INSERT INTO files VALUES (?,?,?,NULL,?,?)')
          .run(id, name, size, now + DAY, now);
      })
      .immediate();
  }
  touch(id: string): void {
    const now = this.now();
    this.db
      .prepare(
        'UPDATE files SET lastActivity=?,expiresAt=? WHERE id=? AND uploadedAt IS NULL',
      )
      .run(now, now + DAY, id);
  }
  complete(id: string, at = this.now()): void {
    this.db
      .prepare(
        'UPDATE files SET uploadedAt=?,expiresAt=?,lastActivity=? WHERE id=? AND uploadedAt IS NULL',
      )
      .run(at, at + 30 * DAY, at, id);
  }
  forget(id: string): void {
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM tus WHERE id=?').run(id);
      this.db.prepare('DELETE FROM files WHERE id=?').run(id);
    })();
    const active = this.downloads.get(id);
    if (active) active.retired = true;
  }
  close(): void {
    this.db.close();
  }
}
