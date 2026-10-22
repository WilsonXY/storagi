// scripts/deploy.sh, scripts/storagi-promote and scripts/verify-release.sh against a temporary
// tree, a fixture origin and PATH shims. Never touches the real runtime, sudo, systemd or network.
// Run: server/node_modules/.bin/tsx --test scripts/deploy.test.ts
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, symlinkSync, unlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..');
const base = realpathSync(mkdtempSync(path.join(tmpdir(), 'storagi-deploy-')));
const origin = `${base}/origin.git`;
const secret = 'synthetic-secret-never-printed';
const env0 = { PATH: process.env.PATH!, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid', npm_config_update_notifier: 'false', npm_config_fund: 'false', npm_config_audit: 'false', ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}) };
const pids = new Set<number>();
const which = (cmd: string) => spawnSync('bash', ['-c', `command -v ${cmd}`], { encoding: 'utf8' }).stdout.trim();
const realNpm = which('npm'), bash = which('bash');
const user = userInfo().username, uid = process.getuid!(), gid = process.getgid!();
const promoteSrc = readFileSync(`${repo}/scripts/storagi-promote`, 'utf8');
const staged: Record<string, string> = {}; // tag -> a staging dir built by scripts/deploy.sh
let configJs = '', count = 0;

function sh(cwd: string, command: string, env: Record<string, string> = env0) {
  const r = spawnSync('bash', ['-ec', command], { cwd, env, encoding: 'utf8' });
  assert.equal(r.status, 0, `${command}\n${r.stdout}${r.stderr}`);
  return r.stdout.trim();
}
const write = (file: string, text: string, mode = 0o644) => { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, text, { mode }); };

// The installed helper's path constants and what a test copy sets them to: the only lines that differ.
function promoteCopy(c: { opt: string; backups: string; data: string; envFile: string; unit: string; bin: string; owner: string; inject?: string }) {
  const lines: Record<string, string> = {
    'opt=/opt/storagi': `opt=${c.opt}`,
    'backups=/var/backups/storagi': `backups=${c.backups}`,
    'data=/var/lib/storagi': `data=${c.data}`,
    'env_file=/etc/storagi/environment': `env_file=${c.envFile}`,
    'unit=/etc/systemd/system/storagi.service': `unit=${c.unit}`,
    'owner=root': `owner=${c.owner}`,
    'export PATH=/usr/sbin:/usr/bin:/sbin:/bin LC_ALL=C': `export PATH=${c.bin}:/usr/sbin:/usr/bin:/sbin:/bin LC_ALL=C`,
  };
  const out = promoteSrc.split('\n').map(l => lines[l] ?? l);
  for (const from of Object.keys(lines)) assert.equal(promoteSrc.split('\n').filter(l => l === from).length, 1, from);
  if (c.inject) out.splice(out.indexOf('set -euo pipefail') + 1, 0, c.inject);
  return out.join('\n');
}

// Tiny project: trivial setup/check producing the release layout, plus the real scripts and unit.
before(() => {
  const src = `${base}/src`;
  // The real compiled server/src/config.ts, so the config gate runs the app's own rules.
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
    '[ ! -f "$EXTERNAL_LINK" ] || ln -s "$EXTERNAL_LINK" server/dist/src/main.js.map',
    'echo dev > web/node_modules/vite/index.js', ''].join('\n'));
  write(`${src}/server/package.json`, '{"name":"fixture-server","type":"module"}\n');
  write(`${src}/server/src/config.js`, configJs);
  write(`${src}/server/package-lock.json`, '{"lockfileVersion":3}\n');
  for (const s of ['deploy.sh', 'storagi-promote', 'verify-release.sh']) write(`${src}/scripts/${s}`, readFileSync(`${repo}/scripts/${s}`, 'utf8'), 0o755);
  // Same unit, but the native check and NODE stamp use the node running these tests.
  write(`${src}/deploy/storagi.service`, readFileSync(`${repo}/deploy/storagi.service`, 'utf8').replaceAll('/usr/bin/node', process.execPath));
  sh(base, `git init -q --bare -b main origin.git && cd src && git init -q -b main && git remote add origin ${origin}
    git add -A && git commit -qm broken && git tag v0.0.1`);
  pkg('test -f server/dist/src/main.js');
  sh(src, `git commit -qam good && git tag v1.0.0
    echo note > notes.txt && git add notes.txt && git commit -qm newer && git tag v1.1.0
    git checkout -q -b side && echo side > side.txt && git add side.txt && git commit -qm side && git tag v9.9.9 && git checkout -q main
    git push -q origin main v0.0.1 v1.0.0 v1.1.0 v9.9.9`);
  // Staging dirs exactly as scripts/deploy.sh hands them to the helper, kept by a capturing sudo.
  const b = fixture('https://example.invalid', { bare: true });
  mkdirSync(`${base}/staged`); writeFileSync(`${b.state}/capture`, `${base}/staged`);
  for (const tag of ['v1.0.0', 'v1.1.0']) {
    const r = b.run(tag); assert.equal(r.status, 0, r.out);
    staged[tag] = `${base}/staged/${readdirSync(`${base}/staged`).find(n => n.startsWith(`${tag}-`))}`;
  }
});
after(() => { for (const pid of pids) try { process.kill(pid); } catch {} spawnSync('chmod', ['-R', 'u+w', base]); rmSync(base, { recursive: true, force: true }); });

function fixture(publicOrigin = 'https://example.invalid', o: { bare?: boolean; inject?: string; owner?: string } = {}) {
  const dir = `${base}/case${++count}`, home = `${dir}/home`, state = `${dir}/state`, bin = `${dir}/bin`, clone = `${dir}/clone`;
  const opt = `${dir}/opt`, backups = `${dir}/backups`, data = `${dir}/data`, envFile = `${dir}/etc/environment`, unit = `${dir}/units/storagi.service`;
  const stagingRoot = `${home}/.cache/storagi/staging`, promote = `${dir}/storagi-promote`;
  mkdirSync(state, { recursive: true }); mkdirSync(stagingRoot, { recursive: true }); mkdirSync(`${opt}/releases`, { recursive: true });
  sh(dir, `git clone -q ${origin} clone`);
  write(promote, promoteCopy({ opt, backups, data, envFile, unit, bin, owner: o.owner ?? user, inject: o.inject }), 0o755);
  // The owner-installed unit, pointing at this tree.
  const unitText = readFileSync(`${repo}/deploy/storagi.service`, 'utf8').replaceAll('/opt/storagi', opt).replaceAll('/usr/bin/node', process.execPath);
  write(unit, unitText);
  // Double-quoted like the live file; systemd strips one pair of matching quotes.
  write(envFile, `PUBLIC_ORIGIN="${publicOrigin}"\nGOOGLE_CLIENT_ID="client.example.invalid"\nGOOGLE_CLIENT_SECRET="${secret}"\nOWNER_GOOGLE_SUB="1234567890"\nPORT="18787"\nDATA_DIR="${data}"\n`, 0o600);
  write(`${data}/storagi.sqlite`, 'db bytes\n', 0o600);
  write(`${data}/storagi.sqlite-wal`, 'wal bytes\n', 0o600);
  write(`${data}/objects/owner-file`, 'owner object\n', 0o600);
  // Shims know their paths: the helper passes no environment on.
  const shim = (name: string, body: string) => write(`${bin}/${name}`, `#!/bin/sh\nSTATE='${state}'\n${body}`, 0o755);
  // The fake service runs while its sleep is alive. kill -0 also succeeds for a killed sleep nobody has
  // reaped yet (a zombie): orphans are reaped at once under a desktop user manager but can linger on CI.
  const alive = `[ -f "$STATE/pid" ] && grep -qs '^[0-9]* (sleep) [^Z]' "/proc/$(cat "$STATE/pid")/stat"`;
  // Fake system manager: the "service" is a sleep whose cwd is current/server; start runs the unit's ExecStartPre.
  shim('systemctl', `echo "$*" >> "$STATE/systemctl.log"
running() { ${alive}; }
case "$1" in
  stop) [ -f "$STATE/stop-kills" ] && running && kill "$(cat "$STATE/pid")"
    [ -f "$STATE/stop-fails" ] && exit 1; running && kill "$(cat "$STATE/pid")"; rm -f "$STATE/pid" ;;
  start) running && exit 0
    if [ -f "$STATE/term-on-start" ]; then rm "$STATE/term-on-start"; kill -TERM "$(cat "$STATE/helper-pid")"; fi
    if [ -f "$STATE/break-current" ]; then rm "$STATE/break-current"; mkdir '${opt}/current.next'; fi
    [ -f "$STATE/start-fails" ] && exit 1
    pre=$(sed -n 's/^ExecStartPre=//p' '${unit}')
    [ -z "$pre" ] || $pre >> "$STATE/prestart.log" 2>&1 || exit 1
    cd '${opt}/current/server' || exit 1
    /bin/sleep 600 </dev/null >/dev/null 2>&1 9>&- & echo $! > "$STATE/pid"; echo $! >> "$STATE/pids" ;;
  is-active) running && { echo active; exit 0; }; echo inactive; exit 3 ;;
  show) running && cat "$STATE/pid" || echo 0 ;;
esac
`);
  // Fake app: 200 for / and 401 for /api/session while running, unless its cwd matches $STATE/bad.
  // Like server/src/app.ts it answers 400 unless Host is the PUBLIC_ORIGIN authority (WHATWG URL host).
  writeFileSync(`${state}/host`, new URL(publicOrigin).host);
  // Health checks must ignore any ~/.curlrc (-q, which curl only honours first).
  shim('curl', `[ "$1" = -q ] || { echo 000; exit 2; }
host=
for a; do case "$a" in "Host: "*) host=\${a#Host: } ;; esac; url=$a; done
${alive} || { echo 000; exit 7; }
[ "$host" = "$(cat "$STATE/host")" ] || { echo 400; exit 0; }
cwd=$(readlink -f "/proc/$(cat "$STATE/pid")/cwd")
if [ -f "$STATE/bad" ]; then case "$cwd" in *"$(cat "$STATE/bad")"*) echo 500; exit 0 ;; esac; fi
case "$url" in */api/session) echo 401 ;; */) echo 200 ;; *) echo 404 ;; esac
`);
  // Fake sockets: listener while the service runs; established connections from $STATE/busy.
  // $STATE/ss-fails fails every call, $STATE/ss-listen-fails only listener queries, with no output.
  shim('ss', `[ -f "$STATE/ss-fails" ] && exit 1
case "$*" in *-Htln*) [ -f "$STATE/ss-listen-fails" ] && exit 1 ;; esac
case "$*" in *established*) cat "$STATE/busy" 2>/dev/null ;; *) ${alive} && echo "LISTEN 0 511 127.0.0.1:18787 0.0.0.0:*" ;; esac; exit 0
`);
  shim('npm', `if [ "$1" = prune ]; then echo "$* in $PWD" >> "$STATE/npm.log"; exit 0; fi
exec ${JSON.stringify(realNpm)} "$@"
`);
  // Fake sudo: only the helper, by its installed path. Like a permissive sudo rule it passes the
  // caller's environment through, so the helper's own clean-up is what the tests see.
  shim('sudo', `echo "$*" >> "$STATE/sudo.log"
[ "$1" = /usr/local/sbin/storagi-promote ] || exit 99
shift
if [ -f "$STATE/capture" ]; then cp -a "$1" "$(cat "$STATE/capture")/"; exit 0; fi
echo $$ > "$STATE/helper-pid"
[ -z "$FAKE_UMASK" ] || umask "$FAKE_UMASK"
export SUDO_UID="\${FAKE_SUDO_UID-${uid}}" SUDO_GID=${gid}
exec '${bash}' -p '${promote}' "$@"
`);
  // Fake privilege drop: logs its arguments, then runs the command as the test user.
  shim('setpriv', `echo "$*" >> "$STATE/setpriv.log"
[ -f "$STATE/busy-late" ] && mv "$STATE/busy-late" "$STATE/busy"
while [ "$1" != -- ]; do shift; done; shift
exec "$@"
`);
  // Fake transient unit: a clean environment loaded from EnvironmentFile (shell quoting stands in
  // for systemd's, fine for these values), the command run in WorkingDirectory with stdin/stdout.
  // $STATE/config-hangs: a config check that never finishes. systemd stops it at RuntimeMaxSec and
  // systemd-run exits 1; unbounded, it stands in for the hang by finishing normally.
  shim('systemd-run', `echo "$*" | tr '\\n' ' ' >> "$STATE/systemd-run.log"; echo >> "$STATE/systemd-run.log"
umask >> "$STATE/umask.log"
file= dir=/ max=
while [ $# -gt 0 ]; do case "$1" in
  -p) case "$2" in EnvironmentFile=*) file=\${2#*=} ;; WorkingDirectory=*) dir=\${2#*=} ;; RuntimeMaxSec=*) max=\${2#*=} ;; esac; shift 2 ;;
  --*) shift ;;
  *) break ;;
esac; done
[ -f "$STATE/config-hangs" ] && [ -n "$file" ] && [ -n "$max" ] && exit 1
cd "$dir" && exec env -i sh -c 'set -a; [ -z "$0" ] || . "$0"; set +a; exec "$@"' "$file" "$@"
`);
  shim('sleep', 'exit 0\n');
  shim('date', '[ -f "$STATE/date" ] && exec cat "$STATE/date"\nexec /bin/date "$@"\n');
  const env: Record<string, string> = { ...env0, HOME: home, PATH: `${bin}:${env0.PATH}` };
  let prev = '';
  if (!o.bare) {
    // The running release: a stamped staging copied in as the helper would, read-only.
    prev = `${opt}/releases/${path.basename(staged['v1.0.0'])}`;
    sh(dir, `cp -a '${staged['v1.0.0']}' '${prev}' && chmod -R a+rX,a-w '${prev}'`);
    symlinkSync(`releases/${path.basename(prev)}`, `${opt}/current`);
    sh(dir, 'systemctl start storagi.service', env);
  }
  const finish = (r: { status: number | null; stdout: string; stderr: string }) => {
    if (existsSync(`${state}/pids`)) for (const pid of readFileSync(`${state}/pids`, 'utf8').split('\n').filter(Boolean)) pids.add(Number(pid));
    const out = `${r.stdout}${r.stderr}`;
    assert.ok(!out.includes(secret), 'output must not contain environment secrets');
    return { status: r.status, out };
  };
  const read = (name: string) => existsSync(`${state}/${name}`) ? readFileSync(`${state}/${name}`, 'utf8') : '';
  return {
    dir, home, state, clone, opt, backups, data, envFile, unit, unitText, stagingRoot, prev, env,
    run: (...args: string[]) => { const r = spawnSync(`${clone}/scripts/deploy.sh`, args, { env, encoding: 'utf8' }); if (r.error) throw r.error; return finish(r); },
    // The helper as sudo runs it, with extra caller environment and optionally another cwd.
    promote: (args: string[], extra: Record<string, string> = {}, cwd = dir) => finish(spawnSync(`${bin}/sudo`, ['/usr/local/sbin/storagi-promote', ...args], { env: { ...env, ...extra }, cwd, encoding: 'utf8' })),
    promoteAsync: (args: string[]) => new Promise<{ status: number | null; out: string }>(resolve => {
      const child = spawn(`${bin}/sudo`, ['/usr/local/sbin/storagi-promote', ...args], { env });
      let stdout = '', stderr = '';
      child.stdout.on('data', d => { stdout += d; }); child.stderr.on('data', d => { stderr += d; });
      child.on('close', status => resolve(finish({ status, stdout, stderr })));
    }),
    // A private copy of a deploy.sh staging dir, as the helper receives it.
    stage: (tag: string) => { const s = `${stagingRoot}/${path.basename(staged[tag])}`; sh(dir, `cp -a '${staged[tag]}' '${s}'`); return s; },
    verify: (...args: string[]) => spawnSync(`${args[0]}/scripts/verify-release.sh`, args.slice(1), { env, encoding: 'utf8' }),
    serviceCwd: () => realpathSync(`/proc/${readFileSync(`${state}/pid`, 'utf8').trim()}/cwd`),
    log: read,
    systemctl: () => read('systemctl.log'),
    snapshot: () => snapshot([opt, backups, data, path.dirname(envFile), path.dirname(unit), stagingRoot]),
  };
}
type Fixture = ReturnType<typeof fixture>;

// Path → mode plus content hash or link target.
function snapshot(dirs: string[]) {
  const out: Record<string, string> = {};
  const walk = (p: string) => {
    if (!existsSync(p) && !lstatSync(p, { throwIfNoEntry: false })) return;
    const s = lstatSync(p);
    if (s.isSymbolicLink()) out[p] = `link ${readlinkSync(p)}`;
    else if (s.isDirectory()) { out[p] = `dir ${s.mode}`; for (const e of readdirSync(p)) walk(`${p}/${e}`); }
    else if (s.isFIFO()) out[p] = `fifo ${s.mode}`;
    else out[p] = `file ${s.mode} ${(s.mode & 0o444) ? createHash('sha256').update(readFileSync(p)).digest('hex') : 'unreadable'}`;
  };
  dirs.forEach(walk);
  return out;
}
// Replace (or with null remove) one KEY= line of the fixture environment.
function setEnv(f: Fixture, key: string, value: string | null) {
  const lines = readFileSync(f.envFile, 'utf8').split('\n').filter(l => !l.startsWith(`${key}=`));
  writeFileSync(f.envFile, [...(value === null ? [] : [`${key}=${value}`]), ...lines].join('\n'));
}
// Replace the running release's config.js (release code the helper must not trust).
function prevConfig(f: Fixture, js: string) {
  const file = `${f.prev}/server/dist/src/config.js`;
  chmodSync(path.dirname(file), 0o755); chmodSync(file, 0o644); writeFileSync(file, js);
}
const manifest = (release: string) => Object.fromEntries(readFileSync(`${release}/BUILD_MANIFEST`, 'utf8').trim().split('\n').map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const asApp = '--uid=storagi --gid=storagi --pipe --wait --quiet --collect -p RuntimeMaxSec=60 -p ProtectSystem=strict -p ProtectHome=yes -p PrivateTmp=yes -p NoNewPrivileges=yes';
const releaseOf = (f: Fixture) => `${f.opt}/${readlinkSync(`${f.opt}/current`)}`;

test('a test copy of the helper differs from the installed one only in its path constants', () => {
  const copy = promoteCopy({ opt: '/o', backups: '/b', data: '/d', envFile: '/e', unit: '/u', bin: '/x', owner: 'someone' }).split('\n');
  const orig = promoteSrc.split('\n');
  assert.equal(copy.length, orig.length);
  assert.equal(copy.filter((l, i) => l !== orig[i]).length, 7);
  // bash -p: no BASH_ENV, SHELLOPTS or exported functions. Tests run it with bash -p explicitly.
  assert.equal(orig[0], '#!/bin/bash -p');
});

test('deploys a tag: caller build, root promote, stamped read-only release, backup, pruning', { timeout: 120000 }, () => {
  const f = fixture();
  const old = (name: string, age: number) => {
    write(`${f.opt}/releases/${name}/server/x`, name);
    sh(f.dir, `chmod -R a-w '${f.opt}/releases/${name}'`);
    utimesSync(`${f.opt}/releases/${name}`, Date.now() / 1000 - age, Date.now() / 1000 - age);
  };
  utimesSync(f.prev, Date.now() / 1000 - 9000, Date.now() / 1000 - 9000);
  old('v0.1.0-old1', 4000); old('v0.2.0-old2', 3000); old('v0.3.0-old3', 2000);
  for (const [i, b] of ['b1', 'b2', 'b3', 'b4'].entries()) { write(`${f.backups}/${b}/storagi.sqlite`, b); utimesSync(`${f.backups}/${b}`, Date.now() / 1000 - 5000 + i * 100, Date.now() / 1000 - 5000 + i * 100); }

  const r = f.run('v1.1.0');
  assert.equal(r.status, 0, r.out);
  const sha = sh(f.clone, 'git rev-parse v1.1.0^{commit}');
  const target = readlinkSync(`${f.opt}/current`);
  assert.match(target, new RegExp(`^releases/v1\\.1\\.0-${sha.slice(0, 7)}[0-9a-f]*-\\d{8}T\\d{6}Z$`));
  const release = `${f.opt}/${target}`, name = path.basename(release), staging = `${f.stagingRoot}/${name}`;
  const m = manifest(release);
  assert.equal(m.TAG, 'v1.1.0'); assert.equal(m.COMMIT, sha); assert.equal(m.DEPLOYED_BY, 'scripts/deploy.sh');
  assert.equal(m.NODE, process.version); assert.match(m.BUILT_AT, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/); assert.match(m.CONTENT_SHA256, /^[0-9a-f]{64}$/);
  assert.equal(name.slice(-16), m.BUILT_AT.replace(/[-:]/g, ''));
  // Built and pruned in the caller's staging dir, which is gone afterwards; the helper got its path by sudo.
  assert.ok(readFileSync(`${f.state}/npm.log`, 'utf8').split('\n').includes(`prune --omit=dev in ${staging}/server`));
  assert.deepEqual(readdirSync(f.stagingRoot), []);
  assert.equal(f.log('sudo.log'), `/usr/local/sbin/storagi-promote ${staging}\n`);
  // The staging dir is read as the caller; the database files only as storagi (read, then compared).
  const asStoragi = (file: string) => `--reuid=storagi --regid=storagi --clear-groups -- cat -- ${f.data}/${file}\n`;
  assert.equal(f.log('setpriv.log'), `--reuid=${uid} --regid=${gid} --clear-groups -- tar -C ${staging} -cf - .\n` +
    ['storagi.sqlite', 'storagi.sqlite-wal'].map(file => asStoragi(file).repeat(2)).join(''));
  // Owner-owned (root when installed), read-only, readable, no setuid bits; dev dependencies gone.
  assert.equal(lstatSync(release).mode & 0o7777, 0o555);
  assert.equal(lstatSync(`${release}/server/dist/src/main.js`).mode & 0o7777, 0o444);
  assert.equal(sh(f.dir, `find '${release}' \\( ! -type l -perm /7222 \\) -o ! -user '${user}'`), '');
  assert.ok(lstatSync(`${release}/server/node_modules/.bin/fake`).isSymbolicLink());
  assert.ok(!existsSync(`${release}/web/node_modules`));
  assert.equal(f.serviceCwd(), `${release}/server`);
  assert.match(f.log('prestart.log'), /verify-release: v1\.1\.0 .* ok/);
  // The installed unit is never written; no daemon-reload; the system manager, not a user manager.
  assert.equal(readFileSync(f.unit, 'utf8'), f.unitText);
  assert.match(f.systemctl(), /^stop storagi\.service\n(.*\n)*start storagi\.service\n/m);
  assert.doesNotMatch(f.systemctl(), /daemon-reload|--user|enable|link/);
  // Database backup only (no objects, no unit), private, identical.
  const backup = `${f.backups}/${name}`;
  assert.equal(lstatSync(backup).mode & 0o777, 0o700);
  assert.deepEqual(readdirSync(backup).sort(), ['storagi.sqlite', 'storagi.sqlite-wal']);
  for (const file of ['storagi.sqlite', 'storagi.sqlite-wal']) {
    assert.equal(readFileSync(`${backup}/${file}`, 'utf8'), readFileSync(`${f.data}/${file}`, 'utf8'));
    assert.equal(lstatSync(`${backup}/${file}`).mode & 0o777, 0o600);
  }
  // Pruning: newest three plus previous kept; the read-only oldest removed; three newest backups kept.
  assert.deepEqual(readdirSync(`${f.opt}/releases`).sort(), [path.basename(f.prev), name, 'v0.2.0-old2', 'v0.3.0-old3'].sort());
  assert.deepEqual(readdirSync(f.backups).sort(), ['b3', 'b4', name].sort());
  assert.ok(existsSync(`${f.data}/objects/owner-file`));
  // Release code ran only as storagi (config check of the running and the new release, verify-release);
  // the copy ran as root without capabilities, writing only the new release.
  const runs = f.log('systemd-run.log').trimEnd().split('\n').map(l => l.trimEnd());
  assert.equal(runs.length, 4, runs.join('\n'));
  assert.ok(runs[0].startsWith(`${asApp} -p EnvironmentFile=${f.envFile} -p WorkingDirectory=${f.prev}/server ${process.execPath} --input-type=module -e `), runs[0]);
  assert.equal(runs[1], `--pipe --wait --quiet --collect -p RuntimeMaxSec=300 -p ProtectSystem=strict -p ReadWritePaths=${release} -p ProtectHome=yes -p PrivateTmp=yes -p PrivateDevices=yes -p NoNewPrivileges=yes -p CapabilityBoundingSet= tar -C ${release} -xf - --no-same-owner --no-same-permissions`);
  assert.equal(runs[2], `${asApp} ${release}/scripts/verify-release.sh`);
  assert.ok(runs[3].startsWith(`${asApp} -p EnvironmentFile=${f.envFile} -p WorkingDirectory=${release}/server ${process.execPath} --input-type=module -e `), runs[3]);

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
  // A second deploy keeps the first as previous and prunes the older one.
  const again = f.run('v1.0.0');
  assert.equal(again.status, 0, again.out);
  const second = path.basename(readlinkSync(`${f.opt}/current`));
  assert.match(second, /^v1\.0\.0-/);
  assert.deepEqual(readdirSync(`${f.opt}/releases`).sort(), [name, second, 'v0.3.0-old3'].sort());
});

test('a failing find in the release hash fails verify-release', { timeout: 120000 }, async t => {
  const f = fixture(), r = f.promote([f.stage('v1.1.0')]);
  assert.equal(r.status, 0, r.out);
  const release = releaseOf(f);
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

test('deploy.sh refusals build nothing and never call sudo', { timeout: 120000 }, async t => {
  type Case = [string, (f: Fixture) => void, string[], RegExp];
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
    ['a failing check', () => {}, ['v0.0.1'], /building v0\.0\.1/],
    // The caller's content hash refuses a link leaving the release before anything is handed over.
    ['a symlink leaving the release', f => { writeFileSync(`${f.state}/external-link`, 'outside\n'); f.env.EXTERNAL_LINK = `${f.state}/external-link`; }, ['v1.1.0'], /outside the release/],
  ];
  for (const [label, arrange, args, reason] of cases) await t.test(label, () => {
    const f = fixture(); arrange(f);
    const before = f.snapshot(), r = f.run(...args);
    assert.equal(r.status, 1, r.out); assert.match(r.out, reason);
    assert.deepEqual(f.snapshot(), before);
    assert.deepEqual(readdirSync(f.stagingRoot), []);
    assert.equal(f.log('sudo.log'), '');
  });
});

test('helper refusals leave production and the staging dir untouched', { timeout: 300000 }, async t => {
  // arrange returns the helper's arguments (default: the staging dir) and optional caller environment.
  type Case = [string, (f: Fixture, src: string) => void | { args?: string[]; env?: Record<string, string> }, RegExp, { owner?: string; copied?: boolean }?];
  const rename = (src: string, to: string) => { const p = `${path.dirname(src)}/${to}`; renameSync(src, p); return { args: [p] }; };
  const lying = (f: Fixture, js: string, port = '18787') => prevConfig(f, `${js}\nexport const loadConfig = () => ({ port: ${port}, dataDir: ${JSON.stringify(f.data)}, origin: 'https://example.invalid' });\n`);
  const cases: Case[] = [
    ['not root', () => {}, /run as nobody-here/, { owner: 'nobody-here' }],
    ['no SUDO_UID', () => ({ env: { FAKE_SUDO_UID: '' } }), /through sudo/],
    ['SUDO_UID 0', () => ({ env: { FAKE_SUDO_UID: '0' } }), /through sudo/],
    ['staging dir owned by someone else', () => ({ env: { FAKE_SUDO_UID: String(uid + 1) } }), /not owned by the calling user/],
    ['no argument', () => ({ args: [] }), /usage/],
    ['two arguments', (f, src) => ({ args: [src, src] }), /usage/],
    ['relative path', (f, src) => ({ args: [path.relative(f.dir, src)] }), /absolute path/],
    ['dot-dot in the path', (f, src) => ({ args: [`${f.stagingRoot}/../staging/${path.basename(src)}`] }), /absolute path/],
    ['dot in the path', (f, src) => ({ args: [`${f.stagingRoot}/./${path.basename(src)}`] }), /absolute path/],
    ['double slash', (f, src) => ({ args: [`${f.stagingRoot}//${path.basename(src)}`] }), /absolute path/],
    ['staging dir is a symlink', (f, src) => { symlinkSync(src, `${f.home}/${path.basename(src)}`); return { args: [`${f.home}/${path.basename(src)}`] }; }, /absolute path/],
    ['parent reached through a symlink', (f, src) => { symlinkSync(f.stagingRoot, `${f.home}/linked`); return { args: [`${f.home}/linked/${path.basename(src)}`] }; }, /absolute path/],
    ['missing staging dir', f => ({ args: [`${f.stagingRoot}/v1.2.3-abcdef0-20261021T010203Z`] }), /absolute path/],
    ['staging path is a file', f => { write(`${f.stagingRoot}/v1.2.3-abcdef0-20261021T010203Z`, 'x'); return { args: [`${f.stagingRoot}/v1.2.3-abcdef0-20261021T010203Z`] }; }, /absolute path/],
    ['trailing slash', (f, src) => ({ args: [`${src}/`] }), /release name/],
    ['release name ..', f => ({ args: [`${f.stagingRoot}/..`] }), /release name/],
    ...['v1.1.0', 'v1.1.0-abcdef-20261021T010203Z', 'v1.1.0-ABCDEF0-20261021T010203Z', 'v1.1.0-abcdef0-20261021T010203', 'v1.1.0-abcdef0-20261021T010203Z.x', 'v1.1.0-abcdef0-20261021T010203Z\n'].map((n): Case =>
      [`release name ${JSON.stringify(n)}`, (f, src) => rename(src, n), /release name/]),
    ['no current release', f => unlinkSync(`${f.opt}/current`), /current/],
    ['current outside releases', f => { mkdirSync(`${f.opt}/elsewhere`); unlinkSync(`${f.opt}/current`); symlinkSync('elsewhere', `${f.opt}/current`); }, /current/],
    ['missing unit', f => unlinkSync(f.unit), /unit/],
    ['missing environment', f => unlinkSync(f.envFile), /environment/],
    ['environment not 0600', f => chmodSync(f.envFile, 0o640), /environment/],
    ['missing database', f => unlinkSync(`${f.data}/storagi.sqlite`), /storagi\.sqlite/],
    ['active connections', f => writeFileSync(`${f.state}/busy`, 'ESTAB 0 0 127.0.0.1:18787 127.0.0.1:50000\n'), /connection/],
    ['ss fails', f => writeFileSync(`${f.state}/ss-fails`, ''), /connection/],
    ['missing PUBLIC_ORIGIN', f => setEnv(f, 'PUBLIC_ORIGIN', null), /PUBLIC_ORIGIN/],
    ['http PUBLIC_ORIGIN', f => setEnv(f, 'PUBLIC_ORIGIN', 'http://example.invalid'), /PUBLIC_ORIGIN/],
    ['PUBLIC_ORIGIN with a path', f => setEnv(f, 'PUBLIC_ORIGIN', 'https://example.invalid/'), /PUBLIC_ORIGIN/],
    ['empty PORT', f => setEnv(f, 'PORT', '""'), /PORT/],
    ['PORT out of range', f => setEnv(f, 'PORT', '"70000"'), /PORT/],
    ['mismatched quotes in PUBLIC_ORIGIN', f => setEnv(f, 'PUBLIC_ORIGIN', '"https://example.invalid'), /config check/],
    // config.ts compares the untrimmed value with the canonical origin, so padding would stop the app.
    ['space inside quoted PUBLIC_ORIGIN', f => setEnv(f, 'PUBLIC_ORIGIN', '"https://example.invalid "'), /PUBLIC_ORIGIN/],
    // Stage58: forms a bash pattern accepted but the app's URL canonicalization rejects.
    ...['https://Example.invalid', 'https://example.invalid:443', 'https://example.invalid:08443', 'https://127.1'].map((o): Case =>
      [`non-canonical PUBLIC_ORIGIN ${o}`, f => setEnv(f, 'PUBLIC_ORIGIN', `"${o}"`), /PUBLIC_ORIGIN/]),
    ['DATA_DIR other than the fixed one', f => { write(`${f.dir}/other/storagi.sqlite`, 'x'); setEnv(f, 'DATA_DIR', `"${f.dir}/other"`); }, /DATA_DIR must be/],
    // Release code chooses what the config check prints; root only accepts a port, a host and the fixed database.
    ['release code printing a port that is not a number', f => lying(f, '', "'80@other.invalid/'"), /did not return port/],
    ['release code printing a host with a path', f => lying(f, "globalThis.URL = class { host = 'other.invalid/x'; };"), /did not return port/],
    ['config check hangs', f => writeFileSync(`${f.state}/config-hangs`, ''), /config check/],
    ['running release without the config check', f => { chmodSync(`${f.prev}/server/dist/src`, 0o755); unlinkSync(`${f.prev}/server/dist/src/config.js`); }, /config check/],
    ['release name exists', (f, src) => mkdirSync(`${f.opt}/releases/${path.basename(src)}`), /exists/],
    ['backup name exists', (f, src) => mkdirSync(`${f.backups}/${path.basename(src)}`, { recursive: true }), /exists/],
    // After the copy: the new release is removed again.
    ['a FIFO in the release', (f, src) => sh(f.dir, `mkdir '${src}/docs' && mkfifo '${src}/docs/fifo'`), /docs\/fifo is not a .*-owned read-only file/, { copied: true }],
    ['a symlink leaving the release outside the hashed paths', (f, src) => { write(`${f.dir}/outside`, 'outside\n'); mkdirSync(`${src}/docs`); symlinkSync(`${f.dir}/outside`, `${src}/docs/out`); }, /symlink docs\/out points outside/, { copied: true }],
    ['a dangling symlink', (f, src) => { mkdirSync(`${src}/docs`); symlinkSync('missing', `${src}/docs/dangling`); }, /symlink docs\/dangling points outside/, { copied: true }],
    ['a file the caller cannot read', (f, src) => { write(`${src}/docs/private`, 'x'); chmodSync(`${src}/docs/private`, 0); }, /removed releases\//, { copied: true }],
    ['tampered content', (f, src) => { chmodSync(`${src}/server/dist/src/main.js`, 0o644); writeFileSync(`${src}/server/dist/src/main.js`, 'evil\n'); }, /CONTENT_SHA256[\s\S]*verify-release refuses/, { copied: true }],
    ['no manifest', (f, src) => unlinkSync(`${src}/BUILD_MANIFEST`), /BUILD_MANIFEST/, { copied: true }],
    ['a connection opened during the copy', f => writeFileSync(`${f.state}/busy-late`, 'ESTAB 0 0 127.0.0.1:18787 127.0.0.1:50000\n'), /during the copy/, { copied: true }],
    ['a new release resolving different settings', f => prevConfig(f, `export const loadConfig = () => ({ port: 18787, dataDir: ${JSON.stringify(f.data)}, origin: 'https://other.invalid' });\n`), /differ/, { copied: true }],
  ];
  for (const [label, arrange, reason, o = {}] of cases) await t.test(label, () => {
    const f = fixture('https://example.invalid', { owner: o.owner });
    const src = f.stage('v1.1.0'), plan = arrange(f, src) || {};
    const before = f.snapshot(), r = f.promote(plan.args ?? [src], plan.env);
    assert.equal(r.status, 1, r.out); assert.match(r.out, reason);
    if (o.copied) assert.match(r.out, /removed releases\/.*production untouched/);
    assert.deepEqual(f.snapshot(), before);
    assert.doesNotMatch(f.systemctl().split('\n').slice(1).join('\n'), /stop|start/);
  });
  await t.test('deploy lock held', async () => {
    const f = fixture(), src = f.stage('v1.1.0');
    const holder = spawn('flock', [f.opt, '/bin/sleep', '60'], { stdio: 'ignore' });
    try {
      while (spawnSync('flock', ['-n', f.opt, 'true']).status === 0) await new Promise(r => setTimeout(r, 20));
      const before = f.snapshot(), r = f.promote([src]);
      assert.equal(r.status, 1, r.out); assert.match(r.out, /another deploy/);
      assert.deepEqual(f.snapshot(), before);
    } finally { holder.kill(); }
  });
});

test('release files come out owner-owned and read-only, with no setuid bits, links kept as links', { timeout: 60000 }, () => {
  const f = fixture(), src = f.stage('v1.1.0');
  write(`${src}/docs/setuid`, '#!/bin/sh\n', 0o755); chmodSync(`${src}/docs/setuid`, 0o4755);
  write(`${src}/docs/open`, 'x', 0o666); chmodSync(`${src}/docs/open`, 0o666);
  mkdirSync(`${src}/docs/wide`); chmodSync(`${src}/docs/wide`, 0o2777);
  symlinkSync('../server/package.json', `${src}/docs/in`);
  const before = snapshot([src]), r = f.promote([src]);
  assert.equal(r.status, 0, r.out);
  const release = releaseOf(f);
  assert.equal(lstatSync(`${release}/docs/setuid`).mode & 0o7777, 0o555);
  assert.equal(lstatSync(`${release}/docs/open`).mode & 0o7777, 0o444);
  assert.equal(lstatSync(`${release}/docs/wide`).mode & 0o7777, 0o555);
  assert.equal(readlinkSync(`${release}/docs/in`), '../server/package.json');
  assert.deepEqual(snapshot([src]), before, 'the helper never changes the staging dir');
});

test('the caller environment, umask and cwd do not reach the helper', { timeout: 60000 }, () => {
  const f = fixture(), src = f.stage('v1.1.0'), evil = `${f.dir}/evil`, marker = `${f.dir}/evil-ran`;
  for (const cmd of ['systemctl', 'systemd-run', 'setpriv', 'tar', 'curl', 'ss', 'find', 'readlink', 'stat', 'id', 'flock', 'chmod', 'install', 'mv', 'ln'])
    write(`${evil}/${cmd}`, `#!/bin/sh\ntouch '${marker}'\nexit 1\n`, 0o755);
  write(`${evil}/bash-env`, `touch '${marker}'\n`);
  const r = f.promote([src], {
    PATH: `${evil}:${f.env.PATH}`, BASH_ENV: `${evil}/bash-env`, ENV: `${evil}/bash-env`, SHELLOPTS: 'xtrace', IFS: '/',
    'BASH_FUNC_systemctl%%': `() { touch '${marker}'; }`, 'BASH_FUNC_curl%%': `() { touch '${marker}'; }`,
    TMPDIR: evil, LC_ALL: 'tr_TR.UTF-8', FAKE_UMASK: '000', TAR_OPTIONS: `--checkpoint=1 --checkpoint-action=exec=touch ${marker}`,
  }, evil);
  assert.equal(r.status, 0, r.out);
  assert.ok(!existsSync(marker), 'nothing from the caller ran');
  assert.deepEqual([...new Set(f.log('umask.log').trim().split('\n'))], ['0022']);
  assert.equal(f.serviceCwd(), `${releaseOf(f)}/server`);
});

test('a failed stop restarts the service and changes nothing', { timeout: 60000 }, () => {
  const f = fixture(), src = f.stage('v1.1.0'); writeFileSync(`${f.state}/stop-fails`, '');
  const before = f.snapshot(), r = f.promote([src]);
  assert.equal(r.status, 1, r.out); assert.match(r.out, /could not stop.*healthy again/);
  const now = f.snapshot();
  for (const [p, v] of Object.entries(before)) assert.equal(now[p], v, p);
  assert.match(f.systemctl(), /stop storagi\.service\nstart storagi\.service\n(show .*\n)+$/);
  assert.equal(realpathSync(`${f.opt}/current`), f.prev);
});

test('a signal after a failed stop does not skip the restart', { timeout: 60000 }, () => {
  // The stop kills the service but reports failure; a DEBUG hook then sends TERM
  // before every top-level command once phase has left cutover.
  const f = fixture('https://example.invalid', { inject: "trap '[[ ${phase-} == cutover ]] && armed_=1; [[ ${armed_-} && -z ${phase-x} ]] && kill -TERM $$' DEBUG" });
  for (const m of ['stop-fails', 'stop-kills']) writeFileSync(`${f.state}/${m}`, '');
  const r = f.promote([f.stage('v1.1.0')]);
  assert.equal(r.status, 1, r.out); assert.match(r.out, /could not stop.*healthy again/);
  assert.match(f.systemctl(), /stop storagi\.service\nstart storagi\.service/);
  assert.equal(f.serviceCwd(), `${f.prev}/server`);
});

test('a failed stop with a failed restart requires manual recovery (exit 3)', { timeout: 60000 }, () => {
  const f = fixture(); for (const m of ['stop-fails', 'stop-kills', 'start-fails']) writeFileSync(`${f.state}/${m}`, '');
  const r = f.promote([f.stage('v1.1.0')]);
  assert.equal(r.status, 3, r.out); assert.match(r.out, /MANUAL RECOVERY REQUIRED/);
  assert.doesNotMatch(r.out, /nothing changed/);
  assert.equal(realpathSync(`${f.opt}/current`), f.prev);
});

test('a failing listener check counts as not stopped', { timeout: 60000 }, () => {
  const f = fixture(); writeFileSync(`${f.state}/ss-listen-fails`, '');
  const r = f.promote([f.stage('v1.1.0')]);
  assert.equal(r.status, 1, r.out); assert.match(r.out, /could not stop/);
  assert.equal(realpathSync(`${f.opt}/current`), f.prev);
  assert.equal(f.serviceCwd(), `${f.prev}/server`);
});

const rolledBack = (f: Fixture) => {
  assert.equal(realpathSync(`${f.opt}/current`), f.prev);
  assert.equal(readFileSync(f.unit, 'utf8'), f.unitText);
  assert.equal(readFileSync(`${f.data}/storagi.sqlite`, 'utf8'), 'db bytes\n');
};

test('an unhealthy new release rolls back to the previous release (exit 2), also through deploy.sh', { timeout: 120000 }, async t => {
  for (const via of ['helper', 'deploy.sh']) await t.test(via, () => {
    const f = fixture(); writeFileSync(`${f.state}/bad`, '/releases/v1.1.0-');
    const r = via === 'helper' ? f.promote([f.stage('v1.1.0')]) : f.run('v1.1.0');
    assert.equal(r.status, 2, r.out); assert.match(r.out, /rolled back/); assert.match(r.out, /in .*backups\/v1\.1\.0-/);
    rolledBack(f);
    assert.equal(f.serviceCwd(), `${f.prev}/server`);
    assert.deepEqual(readdirSync(f.stagingRoot), via === 'helper' ? [path.basename(staged['v1.1.0'])] : []);
  });
});

test('a signal during cutover rolls back (exit 2)', { timeout: 60000 }, async () => {
  const f = fixture(), src = f.stage('v1.1.0'); writeFileSync(`${f.state}/term-on-start`, '');
  const r = await f.promoteAsync([src]);
  assert.equal(r.status, 2, r.out); assert.match(r.out, /rolled back/);
  rolledBack(f);
});

test('an unhealthy rollback requires manual recovery (exit 3)', { timeout: 60000 }, () => {
  const f = fixture(); writeFileSync(`${f.state}/bad`, '/releases/');
  const r = f.promote([f.stage('v1.1.0')]);
  assert.equal(r.status, 3, r.out); assert.match(r.out, /MANUAL RECOVERY REQUIRED/); assert.match(r.out, /backups\/v1\.1\.0-/);
  rolledBack(f);
});

test('a rollback that cannot restore current requires manual recovery (exit 3)', { timeout: 60000 }, () => {
  const f = fixture(); writeFileSync(`${f.state}/bad`, '/releases/v1.1.0-'); writeFileSync(`${f.state}/break-current`, '');
  const r = f.promote([f.stage('v1.1.0')]);
  assert.equal(r.status, 3, r.out); assert.match(r.out, /rollback failed at: current/); assert.match(r.out, /MANUAL RECOVERY REQUIRED/);
});

test('the backup uses the DATA_DIR the app resolves', { timeout: 120000 }, async t => {
  // JavaScript .trim() drops more than spaces: a database also sits in the untrimmed directory.
  for (const [label, pad] of [['space', ' '], ['NBSP', '\u00a0'], ['CR', '\r']]) await t.test(label, () => {
    const f = fixture();
    write(`${f.data}${pad}/storagi.sqlite`, 'wrong db\n', 0o600);
    setEnv(f, 'DATA_DIR', `"${f.data}${pad}"`);
    const r = f.promote([f.stage('v1.1.0')]);
    assert.equal(r.status, 0, r.out);
    assert.equal(readFileSync(`${f.backups}/${path.basename(releaseOf(f))}/storagi.sqlite`, 'utf8'), 'db bytes\n');
  });
  // storage.ts uses path.join, which drops link/.. lexically; the shell would follow the link first.
  await t.test('symlink then ..', () => {
    const f = fixture(), other = `${path.dirname(f.data)}/elsewhere`;
    write(`${other}/storagi.sqlite`, 'wrong db\n', 0o600);
    mkdirSync(`${other}/child`);
    symlinkSync(`${other}/child`, `${f.data}/link`);
    setEnv(f, 'DATA_DIR', `"${f.data}/link/.."`);
    const r = f.promote([f.stage('v1.1.0')]);
    assert.equal(r.status, 0, r.out);
    assert.equal(readFileSync(`${f.backups}/${path.basename(releaseOf(f))}/storagi.sqlite`, 'utf8'), 'db bytes\n');
  });
});

test('a database file replaced by a symlink is not followed by the backup (rolls back)', { timeout: 60000 }, () => {
  const f = fixture(), src = f.stage('v1.1.0');
  write(`${f.dir}/not-the-db`, 'other\n'); symlinkSync(`${f.dir}/not-the-db`, `${f.data}/storagi.sqlite-shm`);
  const r = f.promote([src]);
  assert.equal(r.status, 2, r.out); assert.match(r.out, /storagi\.sqlite-shm in .* is not a regular file/);
  rolledBack(f);
  assert.ok(!existsSync(`${f.backups}/${path.basename(src)}/storagi.sqlite-shm`));
});

test('unquoted and single-quoted environment values deploy too', { timeout: 60000 }, () => {
  const f = fixture();
  setEnv(f, 'PORT', '18787'); setEnv(f, 'PUBLIC_ORIGIN', "'https://example.invalid'");
  const r = f.promote([f.stage('v1.1.0')]);
  assert.equal(r.status, 0, r.out);
  assert.match(readlinkSync(`${f.opt}/current`), /^releases\/v1\.1\.0-/);
});

test('a non-default PUBLIC_ORIGIN port is sent in the health Host header', { timeout: 60000 }, () => {
  const f = fixture('https://example.invalid:8443'), r = f.promote([f.stage('v1.1.0')]);
  assert.equal(r.status, 0, r.out);
  assert.match(readlinkSync(`${f.opt}/current`), /^releases\/v1\.1\.0-/);
});
