// scripts/deploy.sh and scripts/verify-release.sh against a temporary HOME, a fixture
// origin and PATH shims. Never touches the real runtime, systemd or network.
// Run: server/node_modules/.bin/tsx --test scripts/deploy.test.ts
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, symlinkSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..');
const base = mkdtempSync(path.join(tmpdir(), 'storagi-deploy-'));
const origin = `${base}/origin.git`;
const secret = 'synthetic-secret-never-printed';
const env0 = { PATH: process.env.PATH!, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid', npm_config_update_notifier: 'false', npm_config_fund: 'false', npm_config_audit: 'false', ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}) };
const pids = new Set<number>();
const which = (cmd: string) => spawnSync('bash', ['-c', `command -v ${cmd}`], { encoding: 'utf8' }).stdout.trim();
const realNpm = which('npm');
const oldUnit = `[Service]\nExecStart=${process.execPath} old\n`;
let configJs = '';

function sh(cwd: string, command: string, env: Record<string, string> = env0) {
  const r = spawnSync('bash', ['-ec', command], { cwd, env, encoding: 'utf8' });
  assert.equal(r.status, 0, `${command}\n${r.stdout}${r.stderr}`);
  return r.stdout.trim();
}
const write = (file: string, text: string, mode = 0o644) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, text, { mode }); };

// Tiny project: trivial setup/check producing the release layout, plus the real scripts and unit.
before(() => {
  const src = `${base}/src`;
  // The real compiled server/src/config.ts, so the deploy's config gate runs the app's own rules.
  sh(repo, `server/node_modules/.bin/tsc -p server --outDir '${base}/tsc'`);
  configJs = readFileSync(`${base}/tsc/src/config.js`, 'utf8');
  const pkg = (check: string) => write(`${src}/package.json`, JSON.stringify({ scripts: { setup: 'sh build.sh', check } }));
  pkg('exit 1');
  write(`${src}/build.sh`, [
    'mkdir -p server/dist/src server/node_modules/better-sqlite3 server/node_modules/.bin web/dist web/node_modules/vite',
    'echo "console.log(1)" > server/dist/src/main.js',
    'cp server/src/config.js server/dist/src/config.js',
    'echo "module.exports = class { prepare() { return { get: () => 1 }; } };" > server/node_modules/better-sqlite3/index.js',
    'ln -sfn ../better-sqlite3/index.js server/node_modules/.bin/fake',
    'echo "<!doctype html>" > web/dist/index.html',
    '[ ! -f "$STATE/external-link" ] || ln -s "$STATE/external-link" server/dist/src/main.js.map',
    'echo dev > web/node_modules/vite/index.js', ''].join('\n'));
  write(`${src}/server/package.json`, '{"name":"fixture-server","type":"module"}\n');
  write(`${src}/server/src/config.js`, configJs);
  write(`${src}/server/package-lock.json`, '{"lockfileVersion":3}\n');
  write(`${src}/scripts/deploy.sh`, readFileSync(`${repo}/scripts/deploy.sh`, 'utf8'), 0o755);
  write(`${src}/scripts/verify-release.sh`, readFileSync(`${repo}/scripts/verify-release.sh`, 'utf8'), 0o755);
  // Same unit, but the native check and NODE stamp use the node running these tests.
  write(`${src}/deploy/storagi-user.service`, readFileSync(`${repo}/deploy/storagi-user.service`, 'utf8').replaceAll('/usr/bin/node', process.execPath));
  sh(base, `git init -q --bare -b main origin.git && cd src && git init -q -b main && git remote add origin ${origin}
    git add -A && git commit -qm broken && git tag v0.0.1`);
  pkg('test -f server/dist/src/main.js');
  sh(src, `git commit -qam good && git tag v1.0.0
    echo note > notes.txt && git add notes.txt && git commit -qm newer && git tag v1.1.0
    git checkout -q -b side && echo side > side.txt && git add side.txt && git commit -qm side && git tag v9.9.9 && git checkout -q main
    git push -q origin main v0.0.1 v1.0.0 v1.1.0 v9.9.9`);
});
after(() => { for (const pid of pids) try { process.kill(pid); } catch {} spawnSync('chmod', ['-R', 'u+w', base]); rmSync(base, { recursive: true, force: true }); });

let count = 0;
function fixture(publicOrigin = 'https://example.invalid') {
  const dir = `${base}/case${++count}`, home = `${dir}/home`, state = `${dir}/state`, bin = `${dir}/bin`, clone = `${dir}/clone`;
  const root = `${home}/.local/lib/storagi`, unit = `${home}/.config/systemd/user/storagi-user.service`, data = `${dir}/data`;
  mkdirSync(state, { recursive: true });
  sh(dir, `git clone -q ${origin} clone`);
  // Hand-copied live release being adopted: no manifest or scripts, old unit without ExecStartPre.
  write(`${root}/releases/main-old-hand-copied/server/dist/src/main.js`, 'old\n');
  write(`${root}/releases/main-old-hand-copied/server/dist/src/config.js`, configJs);
  write(`${root}/releases/main-old-hand-copied/server/package.json`, '{"type":"module"}\n');
  symlinkSync('releases/main-old-hand-copied', `${root}/current`);
  write(unit, oldUnit, 0o600);
  // Double-quoted like the live file; systemd strips one pair of matching quotes.
  write(`${home}/.config/storagi/environment`, `PUBLIC_ORIGIN="${publicOrigin}"\nGOOGLE_CLIENT_ID="client.example.invalid"\nGOOGLE_CLIENT_SECRET="${secret}"\nOWNER_GOOGLE_SUB="1234567890"\nPORT="18787"\nDATA_DIR="${data}"\n`, 0o600);
  write(`${data}/storagi.sqlite`, 'db bytes\n', 0o600);
  write(`${data}/storagi.sqlite-wal`, 'wal bytes\n', 0o600);
  write(`${data}/objects/owner-file`, 'owner object\n', 0o600);
  // The fake service runs while its sleep is alive. kill -0 also succeeds for a killed sleep nobody has
  // reaped yet (a zombie): orphans are reaped at once under a desktop user manager but can linger on CI.
  const alive = `[ -f "$STATE/pid" ] && grep -qs '^[0-9]* (sleep) [^Z]' "/proc/$(cat "$STATE/pid")/stat"`;
  // Fake user manager: the "service" is a sleep whose cwd is current/server; start runs the unit's ExecStartPre.
  write(`${bin}/systemctl`, `#!/bin/sh
echo "$*" >> "$STATE/systemctl.log"; shift
running() { ${alive}; }
case "$1" in
  stop) [ -f "$STATE/stop-kills" ] && running && kill "$(cat "$STATE/pid")"
    [ -f "$STATE/stop-fails" ] && exit 1; running && kill "$(cat "$STATE/pid")"; rm -f "$STATE/pid" ;;
  start) running && exit 0
    if [ -f "$STATE/term-on-start" ]; then rm "$STATE/term-on-start"; kill -TERM "$(cat "$STATE/deploy-pid")"; fi
    if [ -f "$STATE/break-unit-backup" ]; then rm "$STATE/break-unit-backup"; chmod 000 "$HOME"/.local/lib/storagi/backups/*/storagi-user.service; fi
    [ -f "$STATE/start-fails" ] && exit 1
    pre=$(sed -n 's/^ExecStartPre=//p' "$HOME/.config/systemd/user/storagi-user.service" | sed "s|%h|$HOME|g")
    [ -z "$pre" ] || $pre >> "$STATE/prestart.log" 2>&1 || exit 1
    cd "$HOME/.local/lib/storagi/current/server" || exit 1
    /bin/sleep 600 </dev/null >/dev/null 2>&1 9>&- & echo $! > "$STATE/pid"; echo $! >> "$STATE/pids" ;;
  is-active) running && { echo active; exit 0; }; echo inactive; exit 3 ;;
  show) running && cat "$STATE/pid" || echo 0 ;;
esac
`, 0o755);
  // Fake app: 200 for / and 401 for /api/session while running, unless its cwd matches $STATE/bad.
  // Like server/src/app.ts it answers 400 unless Host is the PUBLIC_ORIGIN authority (WHATWG URL host).
  writeFileSync(`${state}/host`, new URL(publicOrigin).host);
  write(`${bin}/curl`, `#!/bin/sh
host=
for a; do case "$a" in "Host: "*) host=\${a#Host: } ;; esac; url=$a; done
${alive} || { echo 000; exit 7; }
[ "$host" = "$(cat "$STATE/host")" ] || { echo 400; exit 0; }
cwd=$(readlink -f "/proc/$(cat "$STATE/pid")/cwd")
if [ -f "$STATE/bad" ]; then case "$cwd" in *"$(cat "$STATE/bad")"*) echo 500; exit 0 ;; esac; fi
case "$url" in */api/session) echo 401 ;; */) echo 200 ;; *) echo 404 ;; esac
`, 0o755);
  // Fake sockets: listener while the service runs; established connections from $STATE/busy.
  // $STATE/ss-fails fails every call, $STATE/ss-listen-fails only listener queries, with no output.
  write(`${bin}/ss`, `#!/bin/sh
[ -f "$STATE/ss-fails" ] && exit 1
case "$*" in *-Htln*) [ -f "$STATE/ss-listen-fails" ] && exit 1 ;; esac
case "$*" in *established*) cat "$STATE/busy" 2>/dev/null ;; *) ${alive} && echo "LISTEN 0 511 127.0.0.1:18787 0.0.0.0:*" ;; esac; exit 0
`, 0o755);
  write(`${bin}/npm`, `#!/bin/sh
if [ "$1" = prune ]; then echo "$* in $PWD" >> "$STATE/npm.log"; [ -f "$STATE/busy-late" ] && mv "$STATE/busy-late" "$STATE/busy"; exit 0; fi
exec ${JSON.stringify(realNpm)} "$@"
`, 0o755);
  // Fake transient unit: a clean environment loaded from EnvironmentFile (shell quoting stands in
  // for systemd's, fine for these values), the command run in WorkingDirectory.
  // $STATE/config-hangs: a check that never finishes. systemd stops it at RuntimeMaxSec and
  // systemd-run exits 1; unbounded, it stands in for the hang by finishing normally.
  write(`${bin}/systemd-run`, `#!/bin/sh
echo "$*" >> "$STATE/systemd-run.log"
while [ $# -gt 0 ]; do case "$1" in
  -p) case "$2" in EnvironmentFile=*) file=\${2#*=} ;; WorkingDirectory=*) dir=\${2#*=} ;; RuntimeMaxSec=*) max=\${2#*=} ;; esac; shift 2 ;;
  --*) shift ;;
  *) break ;;
esac; done
[ -f "$STATE/config-hangs" ] && [ -n "$max" ] && exit 1
cd "$dir" && exec env -i sh -c 'set -a; . "$0"; exec "$@"' "$file" "$@"
`, 0o755);
  write(`${bin}/sleep`, '#!/bin/sh\nexit 0\n', 0o755);
  write(`${bin}/date`, '#!/bin/sh\n[ -f "$STATE/date" ] && exec cat "$STATE/date"\nexec /bin/date "$@"\n', 0o755);
  const env = { ...env0, HOME: home, STATE: state, PATH: `${bin}:${env0.PATH}` };
  sh(dir, 'systemctl --user start storagi-user.service', env);
  const finish = (r: { status: number | null; stdout: string; stderr: string }) => {
    for (const pid of readFileSync(`${state}/pids`, 'utf8').split('\n').filter(Boolean)) pids.add(Number(pid));
    const out = `${r.stdout}${r.stderr}`;
    assert.ok(!out.includes(secret), 'output must not contain environment secrets');
    return { status: r.status, out };
  };
  return {
    dir, home, state, clone, root, unit, data, env,
    run: (...args: string[]) => { const r = spawnSync(`${clone}/scripts/deploy.sh`, args, { env, encoding: 'utf8' }); if (r.error) throw r.error; return finish(r); },
    runAsync: (...args: string[]) => new Promise<{ status: number | null; out: string }>(resolve => {
      const child = spawn(`${clone}/scripts/deploy.sh`, args, { env });
      writeFileSync(`${state}/deploy-pid`, String(child.pid));
      let stdout = '', stderr = '';
      child.stdout.on('data', d => { stdout += d; }); child.stderr.on('data', d => { stderr += d; });
      child.on('close', status => resolve(finish({ status, stdout, stderr })));
    }),
    verify: (...args: string[]) => spawnSync(`${args[0]}/scripts/verify-release.sh`, args.slice(1), { env, encoding: 'utf8' }),
    serviceCwd: () => realpathSync(`/proc/${readFileSync(`${state}/pid`, 'utf8').trim()}/cwd`),
    systemctl: () => existsSync(`${state}/systemctl.log`) ? readFileSync(`${state}/systemctl.log`, 'utf8') : '',
    snapshot: () => snapshot([root, path.dirname(unit), `${home}/.config/storagi`, data]),
  };
}

// Path → mode plus content hash or link target, ignoring the lock file.
function snapshot(dirs: string[]) {
  const out: Record<string, string> = {};
  const walk = (p: string) => {
    if (p.endsWith('/.deploy.lock')) return;
    const s = lstatSync(p);
    if (s.isSymbolicLink()) out[p] = `link ${readlinkSync(p)}`;
    else if (s.isDirectory()) { out[p] = `dir ${s.mode}`; for (const e of readdirSync(p)) walk(`${p}/${e}`); }
    else out[p] = `file ${s.mode} ${createHash('sha256').update(readFileSync(p)).digest('hex')}`;
  };
  dirs.forEach(walk);
  return out;
}
// Replace (or with null remove) one KEY= line of the fixture environment.
function setEnv(f: ReturnType<typeof fixture>, key: string, value: string | null) {
  const file = `${f.home}/.config/storagi/environment`;
  const lines = readFileSync(file, 'utf8').split('\n').filter(l => !l.startsWith(`${key}=`));
  writeFileSync(file, [...(value === null ? [] : [`${key}=${value}`]), ...lines].join('\n'));
}
const manifest = (release: string) => Object.fromEntries(readFileSync(`${release}/BUILD_MANIFEST`, 'utf8').trim().split('\n').map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

test('deploys a tag: stamped read-only release, new unit, backup, pruning', { timeout: 120000 }, () => {
  const f = fixture();
  const old = (name: string, age: number, ro = false) => {
    write(`${f.root}/releases/${name}/server/x`, name);
    if (ro) sh(f.dir, `chmod -R a-w '${f.root}/releases/${name}'`);
    utimesSync(`${f.root}/releases/${name}`, Date.now() / 1000 - age, Date.now() / 1000 - age);
  };
  utimesSync(`${f.root}/releases/main-old-hand-copied`, Date.now() / 1000 - 9000, Date.now() / 1000 - 9000);
  old('v0.1.0-old1', 4000, true); old('v0.2.0-old2', 3000); old('v0.3.0-old3', 2000);
  for (const [i, b] of ['b1', 'b2', 'b3', 'b4'].entries()) { write(`${f.root}/backups/${b}/storagi.sqlite`, b); utimesSync(`${f.root}/backups/${b}`, Date.now() / 1000 - 5000 + i * 100, Date.now() / 1000 - 5000 + i * 100); }

  const r = f.run('v1.1.0');
  assert.equal(r.status, 0, r.out);
  const sha = sh(f.clone, 'git rev-parse v1.1.0^{commit}');
  const target = readlinkSync(`${f.root}/current`);
  assert.match(target, new RegExp(`^releases/v1\\.1\\.0-${sha.slice(0, 7)}[0-9a-f]*-\\d{8}T\\d{6}Z$`));
  const release = `${f.root}/${target}`, name = path.basename(release);
  const m = manifest(release);
  assert.equal(m.TAG, 'v1.1.0'); assert.equal(m.COMMIT, sha); assert.equal(m.DEPLOYED_BY, 'scripts/deploy.sh');
  assert.equal(m.NODE, process.version); assert.match(m.BUILT_AT, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/); assert.match(m.CONTENT_SHA256, /^[0-9a-f]{64}$/);
  assert.equal(name.slice(-16), m.BUILT_AT.replace(/[-:]/g, ''));
  // Read-only, dev-pruned, stamped release; the service runs from it and passed ExecStartPre.
  assert.equal(lstatSync(release).mode & 0o777, 0o500);
  assert.equal(lstatSync(`${release}/server/dist/src/main.js`).mode & 0o222, 0);
  assert.ok(!existsSync(`${release}/web/node_modules`));
  assert.ok(readFileSync(`${f.state}/npm.log`, 'utf8').split('\n').includes(`prune --omit=dev in ${release}/server`));
  assert.equal(f.serviceCwd(), `${realpathSync(release)}/server`);
  assert.match(readFileSync(`${f.state}/prestart.log`, 'utf8'), /verify-release: v1\.1\.0 .* ok/);
  // New unit installed 0600 with the start-time gate; reload happened between stop and start.
  assert.equal(readFileSync(f.unit, 'utf8'), readFileSync(`${f.clone}/deploy/storagi-user.service`, 'utf8'));
  assert.match(readFileSync(f.unit, 'utf8'), /^ExecStartPre=%h\/\.local\/lib\/storagi\/current\/scripts\/verify-release\.sh$/m);
  assert.equal(lstatSync(f.unit).mode & 0o777, 0o600);
  assert.match(f.systemctl(), /--user stop storagi-user\.service\n(.*\n)*--user daemon-reload\n(.*\n)*--user start storagi-user\.service/);
  // Database backup only (no objects), private, identical; old unit kept beside it.
  const backup = `${f.root}/backups/${name}`;
  assert.equal(lstatSync(backup).mode & 0o777, 0o700);
  assert.deepEqual(readdirSync(backup).sort(), ['storagi-user.service', 'storagi.sqlite', 'storagi.sqlite-wal']);
  for (const file of ['storagi.sqlite', 'storagi.sqlite-wal']) {
    assert.equal(readFileSync(`${backup}/${file}`, 'utf8'), readFileSync(`${f.data}/${file}`, 'utf8'));
    assert.equal(lstatSync(`${backup}/${file}`).mode & 0o777, 0o600);
  }
  assert.equal(readFileSync(`${backup}/storagi-user.service`, 'utf8'), oldUnit);
  // Pruning: newest three plus previous kept; the read-only oldest removed; three newest backups kept.
  assert.deepEqual(readdirSync(`${f.root}/releases`).sort(), ['main-old-hand-copied', name, 'v0.2.0-old2', 'v0.3.0-old3'].sort());
  assert.deepEqual(readdirSync(`${f.root}/backups`).sort(), ['b3', 'b4', name].sort());
  assert.ok(existsSync(`${f.data}/objects/owner-file`));
  // The app's config check ran with the service's environment file in the running release, then the new one.
  const runs = [...readFileSync(`${f.state}/systemd-run.log`, 'utf8').matchAll(/^--user --pipe --wait --quiet --collect -p RuntimeMaxSec=60 -p EnvironmentFile=(\S+) -p WorkingDirectory=(\S+) (\S+) /gm)].map(m => m.slice(1));
  const envFile = `${f.home}/.config/storagi/environment`;
  assert.deepEqual(runs, [[envFile, `${realpathSync(f.root)}/releases/main-old-hand-copied/server`, process.execPath], [envFile, `${realpathSync(release)}/server`, process.execPath]]);

  // verify-release: passes on the fresh release (default resolves its own release), fails on tampering.
  const ok = f.verify(release);
  assert.equal(ok.status, 0, ok.stderr);
  const copy = (label: string) => { const c = `${f.dir}/${label}`; cpSync(release, c, { recursive: true, verbatimSymlinks: true }); sh(f.dir, `chmod -R u+w '${c}'`); return c; };
  const tampered = copy('tampered'); writeFileSync(`${tampered}/server/dist/src/main.js`, 'evil\n');
  let bad = f.verify(tampered); assert.notEqual(bad.status, 0); assert.match(bad.stderr, /CONTENT_SHA256/);
  const relink = (label: string, target: string) => { const c = copy(label); unlinkSync(`${c}/server/node_modules/.bin/fake`); symlinkSync(target, `${c}/server/node_modules/.bin/fake`); return c; };
  const relinked = relink('relinked', '../better-sqlite3/../better-sqlite3/index.js');
  bad = f.verify(release, relinked); assert.notEqual(bad.status, 0); assert.match(bad.stderr, /CONTENT_SHA256/);
  // A link leaving the release, or dangling, fails even when the manifest was stamped with it.
  for (const target of [`${f.dir}/outside`, 'missing']) {
    writeFileSync(`${f.dir}/outside`, 'outside\n');
    const linked = relink(`link-${target.length}`, target);
    const hash = f.verify(release, '--print-hash', linked).stdout.trim();
    if (hash) writeFileSync(`${linked}/BUILD_MANIFEST`, readFileSync(`${linked}/BUILD_MANIFEST`, 'utf8').replace(/^CONTENT_SHA256=.*$/m, `CONTENT_SHA256=${hash}`));
    bad = f.verify(release, linked); assert.notEqual(bad.status, 0, target); assert.match(bad.stderr, /outside the release/);
  }
  const unstamped = copy('unstamped'); unlinkSync(`${unstamped}/BUILD_MANIFEST`);
  bad = f.verify(release, unstamped); assert.notEqual(bad.status, 0); assert.match(bad.stderr, /BUILD_MANIFEST/);
  const foreign = copy('foreign'); writeFileSync(`${foreign}/BUILD_MANIFEST`, readFileSync(`${foreign}/BUILD_MANIFEST`, 'utf8').replace('DEPLOYED_BY=scripts/deploy.sh', 'DEPLOYED_BY=manual'));
  bad = f.verify(release, foreign); assert.notEqual(bad.status, 0); assert.match(bad.stderr, /DEPLOYED_BY/);
  const empty = copy('empty'); writeFileSync(`${empty}/BUILD_MANIFEST`, readFileSync(`${empty}/BUILD_MANIFEST`, 'utf8').replace(/^NODE=.*$/m, 'NODE='));
  bad = f.verify(release, empty); assert.notEqual(bad.status, 0); assert.match(bad.stderr, /NODE/);
  // A second deploy keeps the first as previous and prunes the hand-copied release.
  const again = f.run('v1.0.0');
  assert.equal(again.status, 0, again.out);
  const second = path.basename(readlinkSync(`${f.root}/current`));
  assert.match(second, /^v1\.0\.0-/);
  assert.deepEqual(readdirSync(`${f.root}/releases`).sort(), [name, second, 'v0.3.0-old3'].sort());
});

test('a failing find in the release hash fails verify-release', { timeout: 120000 }, async t => {
  const f = fixture(), r = f.run('v1.1.0');
  assert.equal(r.status, 0, r.out);
  const release = `${f.root}/${readlinkSync(`${f.root}/current`)}`;
  // A find that lists everything but exits 1 when its arguments contain $FIND_FAILS.
  const bin = `${f.dir}/find-bin`;
  write(`${bin}/find`, `#!/bin/sh\n${JSON.stringify(which('find'))} "$@" || exit; case "$*" in *"$FIND_FAILS"*) exit 1 ;; esac\n`, 0o755);
  for (const call of ['-type l -print0', '-type f -print0', '-printf']) await t.test(call, () => {
    const env = { ...f.env, PATH: `${bin}:${f.env.PATH}`, FIND_FAILS: call };
    for (const args of [[], ['--print-hash', release]]) {
      const v = spawnSync(`${release}/scripts/verify-release.sh`, args, { env, encoding: 'utf8' });
      assert.notEqual(v.status, 0, `${args.join(' ')}\n${v.stdout}${v.stderr}`);
    }
  });
});

test('refusal gates leave the runtime untouched', { timeout: 120000 }, async t => {
  type Case = [string, (f: ReturnType<typeof fixture>) => void, string[], RegExp];
  const cases: Case[] = [
    ['no argument', () => {}, [], /usage/],
    ['non-version tag', () => {}, ['main'], /usage/],
    ['two arguments', () => {}, ['v1.1.0', 'v1.0.0'], /usage/],
    ['tracked change', f => writeFileSync(`${f.clone}/notes.txt`, 'changed'), ['v1.1.0'], /tracked changes/],
    ['git status fails', f => { sh(f.clone, 'git config fetch.recurseSubmodules false'); writeFileSync(`${f.clone}/.git/index`, 'corrupt'); writeFileSync(`${f.clone}/notes.txt`, 'changed'); }, ['v1.1.0'], /git status/],
    ['HEAD is not origin/main', f => sh(f.clone, 'git checkout -q HEAD~1'), ['v1.0.0'], /origin\/main/],
    ['missing tag', () => {}, ['v7.7.7'], /tag v7\.7\.7/],
    ['tag not on main', () => {}, ['v9.9.9'], /not on origin\/main/],
    ['tag only in this checkout', f => sh(f.clone, 'git tag v5.0.0'), ['v5.0.0'], /not pushed to origin/],
    ['no current release', f => unlinkSync(`${f.root}/current`), ['v1.1.0'], /current/],
    ['current outside releases', f => { mkdirSync(`${f.root}/elsewhere`); unlinkSync(`${f.root}/current`); symlinkSync('elsewhere', `${f.root}/current`); }, ['v1.1.0'], /current/],
    ['missing unit', f => unlinkSync(f.unit), ['v1.1.0'], /unit/],
    ['missing environment', f => unlinkSync(`${f.home}/.config/storagi/environment`), ['v1.1.0'], /environment/],
    ['environment not 0600', f => chmodSync(`${f.home}/.config/storagi/environment`, 0o640), ['v1.1.0'], /environment/],
    ['missing database', f => unlinkSync(`${f.data}/storagi.sqlite`), ['v1.1.0'], /storagi\.sqlite/],
    ['active connections', f => writeFileSync(`${f.state}/busy`, 'ESTAB 0 0 127.0.0.1:18787 127.0.0.1:50000\n'), ['v1.1.0'], /connection/],
    ['ss fails', f => writeFileSync(`${f.state}/ss-fails`, ''), ['v1.1.0'], /connection/],
    ['missing PUBLIC_ORIGIN', f => setEnv(f, 'PUBLIC_ORIGIN', null), ['v1.1.0'], /PUBLIC_ORIGIN/],
    ['http PUBLIC_ORIGIN', f => setEnv(f, 'PUBLIC_ORIGIN', 'http://example.invalid'), ['v1.1.0'], /PUBLIC_ORIGIN/],
    ['PUBLIC_ORIGIN with a path', f => setEnv(f, 'PUBLIC_ORIGIN', 'https://example.invalid/'), ['v1.1.0'], /PUBLIC_ORIGIN/],
    ['empty PORT', f => setEnv(f, 'PORT', '""'), ['v1.1.0'], /PORT/],
    ['PORT out of range', f => setEnv(f, 'PORT', '"70000"'), ['v1.1.0'], /PORT/],
    ['mismatched quotes in PUBLIC_ORIGIN', f => setEnv(f, 'PUBLIC_ORIGIN', '"https://example.invalid'), ['v1.1.0'], /config check/],
    // config.ts compares the untrimmed value with the canonical origin, so padding would stop the app.
    ['space inside quoted PUBLIC_ORIGIN', f => setEnv(f, 'PUBLIC_ORIGIN', '"https://example.invalid "'), ['v1.1.0'], /PUBLIC_ORIGIN/],
    // Stage58: forms a bash pattern accepted but the app's URL canonicalization rejects.
    ...['https://Example.invalid', 'https://example.invalid:443', 'https://example.invalid:08443', 'https://127.1'].map((o): Case =>
      [`non-canonical PUBLIC_ORIGIN ${o}`, f => setEnv(f, 'PUBLIC_ORIGIN', `"${o}"`), ['v1.1.0'], /PUBLIC_ORIGIN/]),
    ['config check hangs', f => writeFileSync(`${f.state}/config-hangs`, ''), ['v1.1.0'], /config check/],
    ['previous release without the config check', f => unlinkSync(`${f.root}/releases/main-old-hand-copied/server/dist/src/config.js`), ['v1.1.0'], /config check/],
    ['release name exists', f => { writeFileSync(`${f.state}/date`, '2026-10-21T01:02:03Z\n'); mkdirSync(`${f.root}/releases/v1.1.0-${sh(f.clone, 'git rev-parse --short v1.1.0^{commit}')}-20261021T010203Z`); }, ['v1.1.0'], /exists/],
  ];
  for (const [label, arrange, args, reason] of cases) await t.test(label, () => {
    const f = fixture(); arrange(f);
    const before = f.snapshot(), r = f.run(...args);
    assert.equal(r.status, 1, r.out); assert.match(r.out, reason);
    assert.deepEqual(f.snapshot(), before);
    assert.doesNotMatch(f.systemctl(), /stop|daemon-reload/);
  });
  await t.test('deploy lock held', async () => {
    const f = fixture();
    const holder = spawn('flock', [`${f.root}/.deploy.lock`, '/bin/sleep', '60'], { stdio: 'ignore' });
    try {
      while (spawnSync('flock', ['-n', `${f.root}/.deploy.lock`, 'true']).status === 0) await new Promise(r => setTimeout(r, 20));
      const before = f.snapshot(), r = f.run('v1.1.0');
      assert.equal(r.status, 1, r.out); assert.match(r.out, /another deploy/);
      assert.deepEqual(f.snapshot(), before);
    } finally { holder.kill(); }
  });
});

test('a failing check aborts with production untouched', { timeout: 60000 }, () => {
  const f = fixture(), before = f.snapshot(), r = f.run('v0.0.1');
  assert.equal(r.status, 1, r.out); assert.match(r.out, /removed releases\//);
  assert.deepEqual(f.snapshot(), before);
  assert.doesNotMatch(f.systemctl(), /stop/);
});

test('a connection opened during the build refuses before the stop', { timeout: 60000 }, () => {
  const f = fixture(); writeFileSync(`${f.state}/busy-late`, 'ESTAB 0 0 127.0.0.1:18787 127.0.0.1:50000\n');
  const before = f.snapshot(), r = f.run('v1.1.0');
  assert.equal(r.status, 1, r.out); assert.match(r.out, /during the build/); assert.match(r.out, /removed releases\//);
  assert.ok(existsSync(`${f.state}/busy`), 'the build must have run');
  assert.deepEqual(f.snapshot(), before);
  assert.doesNotMatch(f.systemctl(), /stop/);
});

test('a build with a symlink leaving the release refuses before the stop', { timeout: 60000 }, () => {
  const f = fixture(); writeFileSync(`${f.state}/external-link`, 'outside\n');
  const before = f.snapshot(), r = f.run('v1.1.0');
  assert.equal(r.status, 1, r.out); assert.match(r.out, /outside the release/); assert.match(r.out, /removed releases\//);
  assert.deepEqual(f.snapshot(), before);
  assert.doesNotMatch(f.systemctl(), /stop/);
});

test('the backup uses the DATA_DIR the app resolves', { timeout: 120000 }, async t => {
  // JavaScript .trim() drops more than spaces: a database also sits in the untrimmed directory.
  for (const [label, pad] of [['space', ' '], ['NBSP', '\u00a0'], ['CR', '\r']]) await t.test(label, () => {
    const f = fixture();
    write(`${f.data}${pad}/storagi.sqlite`, 'wrong db\n', 0o600);
    setEnv(f, 'DATA_DIR', `"${f.data}${pad}"`);
    const r = f.run('v1.1.0');
    assert.equal(r.status, 0, r.out);
    const backup = `${f.root}/backups/${path.basename(readlinkSync(`${f.root}/current`))}`;
    assert.equal(readFileSync(`${backup}/storagi.sqlite`, 'utf8'), 'db bytes\n');
  });
  // storage.ts uses path.join, which drops link/.. lexically; the shell would follow the link first.
  await t.test('symlink then ..', () => {
    const f = fixture(), other = `${path.dirname(f.data)}/elsewhere`;
    write(`${other}/storagi.sqlite`, 'wrong db\n', 0o600);
    mkdirSync(`${other}/child`);
    symlinkSync(`${other}/child`, `${f.data}/link`);
    setEnv(f, 'DATA_DIR', `"${f.data}/link/.."`);
    const r = f.run('v1.1.0');
    assert.equal(r.status, 0, r.out);
    const backup = `${f.root}/backups/${path.basename(readlinkSync(`${f.root}/current`))}`;
    assert.equal(readFileSync(`${backup}/storagi.sqlite`, 'utf8'), 'db bytes\n');
  });
});

test('a new release resolving different settings refuses before the stop', { timeout: 60000 }, () => {
  const f = fixture();
  write(`${f.root}/releases/main-old-hand-copied/server/dist/src/config.js`,
    `export const loadConfig = () => ({ port: 18787, dataDir: ${JSON.stringify(f.data)}, origin: 'https://other.invalid' });\n`);
  const before = f.snapshot(), r = f.run('v1.1.0');
  assert.equal(r.status, 1, r.out); assert.match(r.out, /differ/); assert.match(r.out, /removed releases\//);
  assert.deepEqual(f.snapshot(), before);
  assert.doesNotMatch(f.systemctl(), /stop/);
});

test('unquoted and single-quoted environment values deploy too', { timeout: 60000 }, () => {
  const f = fixture();
  setEnv(f, 'PORT', '18787'); setEnv(f, 'PUBLIC_ORIGIN', "'https://example.invalid'");
  const r = f.run('v1.1.0');
  assert.equal(r.status, 0, r.out);
  assert.match(readlinkSync(`${f.root}/current`), /^releases\/v1\.1\.0-/);
});

test('a non-default PUBLIC_ORIGIN port is sent in the health Host header', { timeout: 60000 }, () => {
  const f = fixture('https://example.invalid:8443'), r = f.run('v1.1.0');
  assert.equal(r.status, 0, r.out);
  assert.match(readlinkSync(`${f.root}/current`), /^releases\/v1\.1\.0-/);
});

test('a failed stop restarts the service and changes nothing', { timeout: 60000 }, () => {
  const f = fixture(); writeFileSync(`${f.state}/stop-fails`, '');
  const before = f.snapshot(), r = f.run('v1.1.0');
  assert.equal(r.status, 1, r.out); assert.match(r.out, /could not stop.*healthy again/);
  const now = f.snapshot();
  for (const [p, v] of Object.entries(before)) assert.equal(now[p], v, p);
  assert.match(f.systemctl(), /stop storagi-user\.service\n--user start storagi-user\.service\n(--user show .*\n)+$/);
  assert.equal(readlinkSync(`${f.root}/current`), 'releases/main-old-hand-copied');
});

test('a signal after a failed stop does not skip the restart', { timeout: 60000 }, () => {
  // The stop kills the service but reports failure; a DEBUG hook then sends TERM
  // before every top-level command once phase has left cutover.
  const f = fixture(); for (const m of ['stop-fails', 'stop-kills']) writeFileSync(`${f.state}/${m}`, '');
  write(`${f.state}/bash-env`, `trap '[[ \${phase-} == cutover ]] && armed_=1; [[ \${armed_-} && -z \${phase-x} ]] && kill -TERM $$' DEBUG\n`);
  f.env.BASH_ENV = `${f.state}/bash-env`;
  const r = f.run('v1.1.0');
  assert.equal(r.status, 1, r.out); assert.match(r.out, /could not stop.*healthy again/);
  assert.match(f.systemctl(), /stop storagi-user\.service\n--user start storagi-user\.service/);
  assert.equal(f.serviceCwd(), `${realpathSync(f.root)}/releases/main-old-hand-copied/server`);
});

test('a failed stop with a failed restart requires manual recovery (exit 3)', { timeout: 60000 }, () => {
  const f = fixture(); for (const m of ['stop-fails', 'stop-kills', 'start-fails']) writeFileSync(`${f.state}/${m}`, '');
  const r = f.run('v1.1.0');
  assert.equal(r.status, 3, r.out); assert.match(r.out, /MANUAL RECOVERY REQUIRED/);
  assert.doesNotMatch(r.out, /nothing changed/);
  assert.equal(readlinkSync(`${f.root}/current`), 'releases/main-old-hand-copied');
});

test('a failing listener check counts as not stopped', { timeout: 60000 }, () => {
  const f = fixture(); writeFileSync(`${f.state}/ss-listen-fails`, '');
  const r = f.run('v1.1.0');
  assert.equal(r.status, 1, r.out); assert.match(r.out, /could not stop/);
  assert.equal(readlinkSync(`${f.root}/current`), 'releases/main-old-hand-copied');
  assert.equal(f.serviceCwd(), `${realpathSync(f.root)}/releases/main-old-hand-copied/server`);
});

const rolledBack = (f: ReturnType<typeof fixture>) => {
  assert.equal(readlinkSync(`${f.root}/current`), 'releases/main-old-hand-copied');
  assert.equal(readFileSync(f.unit, 'utf8'), oldUnit);
  assert.equal(lstatSync(f.unit).mode & 0o777, 0o600);
  assert.equal(readFileSync(`${f.data}/storagi.sqlite`, 'utf8'), 'db bytes\n');
};

test('an unhealthy new release rolls back to the previous release and unit (exit 2)', { timeout: 60000 }, () => {
  const f = fixture(); writeFileSync(`${f.state}/bad`, '/releases/v1.1.0-');
  const r = f.run('v1.1.0');
  assert.equal(r.status, 2, r.out); assert.match(r.out, /rolled back/); assert.match(r.out, /backups\/v1\.1\.0-/);
  rolledBack(f);
  assert.equal(f.serviceCwd(), `${realpathSync(f.root)}/releases/main-old-hand-copied/server`);
});

test('a signal during cutover rolls back (exit 2)', { timeout: 60000 }, async () => {
  const f = fixture(); writeFileSync(`${f.state}/term-on-start`, '');
  const r = await f.runAsync('v1.1.0');
  assert.equal(r.status, 2, r.out); assert.match(r.out, /rolled back/);
  rolledBack(f);
});

test('an unhealthy rollback requires manual recovery (exit 3)', { timeout: 60000 }, () => {
  const f = fixture(); writeFileSync(`${f.state}/bad`, '/releases/');
  const r = f.run('v1.1.0');
  assert.equal(r.status, 3, r.out); assert.match(r.out, /MANUAL RECOVERY REQUIRED/); assert.match(r.out, /backups\/v1\.1\.0-/);
  rolledBack(f);
});

test('a failed rollback step requires manual recovery even when health passes (exit 3)', { timeout: 120000 }, () => {
  const f = fixture();
  const first = f.run('v1.0.0'); assert.equal(first.status, 0, first.out);
  const prev = readlinkSync(`${f.root}/current`);
  writeFileSync(`${f.state}/bad`, '/releases/v1.1.0-'); writeFileSync(`${f.state}/break-unit-backup`, '');
  const r = f.run('v1.1.0');
  assert.equal(r.status, 3, r.out); assert.match(r.out, /MANUAL RECOVERY REQUIRED/); assert.match(r.out, /unit/);
  // Everything else was restored and the previous scripted release is healthy again.
  assert.equal(readlinkSync(`${f.root}/current`), prev);
  assert.equal(f.serviceCwd(), `${realpathSync(f.root)}/${prev}/server`);
});
