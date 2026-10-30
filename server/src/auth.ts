import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto';
import * as oidc from 'openid-client';
import { Storage, HttpError, DAY } from './storage.js';
const random = () => randomBytes(32).toString('base64url');
const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export type Session = { csrf: string; expiresAt: number; sub: string };
type Flow = {
  state: string;
  nonce: string;
  verifier: string;
  expiresAt: number;
};
const FLOW_LIFETIME = 10 * 60000,
  MAX_REPLAYS = 1000;
export class Auth {
  private readonly flowKey: Buffer;
  constructor(
    readonly storage: Storage,
    readonly origin: string,
    readonly ownerSub: string,
    readonly config: oidc.Configuration,
  ) {
    oidc.enableNonRepudiationChecks(config);
    const saved = storage.db
      .prepare("SELECT value FROM secrets WHERE name='flow-key'")
      .get() as { value: Buffer } | undefined;
    this.flowKey = saved?.value ?? randomBytes(32);
    if (this.flowKey.length !== 32)
      throw new Error('Invalid persisted flow key');
    if (!saved)
      storage.db
        .prepare("INSERT INTO secrets VALUES ('flow-key',?)")
        .run(this.flowKey);
  }
  private seal(flow: Flow): string {
    const iv = randomBytes(12),
      cipher = createCipheriv('aes-256-gcm', this.flowKey, iv);
    cipher.setAAD(Buffer.from(this.origin + '\0' + this.ownerSub));
    return Buffer.concat([
      iv,
      cipher.update(JSON.stringify(flow)),
      cipher.final(),
      cipher.getAuthTag(),
    ]).toString('base64url');
  }
  private unseal(token: string): Flow {
    try {
      if (token.length > 1024 || !token || !/^[A-Za-z0-9_-]+$/.test(token))
        throw new Error();
      const bytes = Buffer.from(token, 'base64url');
      if (bytes.length < 29 || bytes.toString('base64url') !== token)
        throw new Error();
      const cipher = createDecipheriv(
        'aes-256-gcm',
        this.flowKey,
        bytes.subarray(0, 12),
      );
      cipher.setAAD(Buffer.from(this.origin + '\0' + this.ownerSub));
      cipher.setAuthTag(bytes.subarray(-16));
      const flow = JSON.parse(
        Buffer.concat([
          cipher.update(bytes.subarray(12, -16)),
          cipher.final(),
        ]).toString('utf8'),
      );
      if (
        !flow ||
        Object.keys(flow).sort().join(',') !==
          'expiresAt,nonce,state,verifier' ||
        !['state', 'nonce', 'verifier'].every(
          (key) =>
            typeof flow[key] === 'string' &&
            /^[A-Za-z0-9_-]{43}$/.test(flow[key]),
        ) ||
        !Number.isSafeInteger(flow.expiresAt) ||
        flow.expiresAt <= this.storage.now() ||
        flow.expiresAt > this.storage.now() + FLOW_LIFETIME
      )
        throw new Error();
      return flow;
    } catch {
      throw new HttpError(401, 'Login expired; try again');
    }
  }
  async begin() {
    const state = oidc.randomState(),
      nonce = oidc.randomNonce(),
      verifier = oidc.randomPKCECodeVerifier();
    const token = this.seal({
      state,
      nonce,
      verifier,
      expiresAt: this.storage.now() + FLOW_LIFETIME,
    });
    const url = oidc.buildAuthorizationUrl(this.config, {
      redirect_uri: this.origin + '/auth/callback',
      scope: 'openid profile',
      state,
      nonce,
      code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
      code_challenge_method: 'S256',
    });
    return { url: url.href, token };
  }
  async callback(token: string, url: URL) {
    const flow = this.unseal(token),
      digest = hash(token);
    if (
      this.storage.db
        .prepare('SELECT 1 FROM flow_replays WHERE hash=?')
        .get(digest)
    )
      throw new HttpError(401, 'Login already used');
    const { sub, name, picture } = await verifyIdentity(this.config, url, flow);
    if (sub !== this.ownerSub)
      throw new HttpError(403, 'Account is not authorized');
    const sessionToken = random(),
      csrf = random();
    this.storage.db.transaction(() => {
      this.prune();
      if (
        flow.expiresAt <= this.storage.now() ||
        this.storage.db
          .prepare('SELECT 1 FROM flow_replays WHERE hash=?')
          .get(digest)
      )
        throw new HttpError(401, 'Login expired or already used');
      const count = (
        this.storage.db
          .prepare('SELECT COUNT(*) AS n FROM flow_replays')
          .get() as { n: number }
      ).n;
      if (count >= MAX_REPLAYS)
        throw new HttpError(
          429,
          'Too many completed logins; try again shortly',
        );
      this.storage.db
        .prepare('INSERT INTO flow_replays VALUES (?,?)')
        .run(digest, flow.expiresAt);
      this.storage.db
        .prepare('INSERT INTO sessions VALUES (?,?,?,?)')
        .run(
          hash(sessionToken),
          csrf,
          this.storage.now() + 7 * DAY,
          this.ownerSub,
        );
      this.storage.db
        .prepare('INSERT OR REPLACE INTO profile VALUES (?,?,?)')
        .run(sub, name, picture);
    })();
    return { token: sessionToken, csrf };
  }
  session(token: string): Session | undefined {
    if (!/^[\w-]{43}$/.test(token)) return;
    return this.storage.db
      .prepare(
        'SELECT csrf,expiresAt,sub FROM sessions WHERE hash=? AND expiresAt>? AND sub=?',
      )
      .get(hash(token), this.storage.now(), this.ownerSub) as
      Session | undefined;
  }
  profile() {
    return (this.storage.db
      .prepare('SELECT name,picture FROM profile WHERE sub=?')
      .get(this.ownerSub) ?? { name: null, picture: null }) as {
      name: string | null;
      picture: string | null;
    };
  }
  revoke(token: string): void {
    this.storage.db
      .prepare('DELETE FROM sessions WHERE hash=?')
      .run(hash(token));
  }
  prune(): void {
    const now = this.storage.now();
    this.storage.db
      .prepare('DELETE FROM sessions WHERE expiresAt<=? OR sub<>?')
      .run(now, this.ownerSub);
    this.storage.db
      .prepare('DELETE FROM flow_replays WHERE expiresAt<=?')
      .run(now);
  }
}
export async function googleConfig(clientId: string, clientSecret: string) {
  return oidc.discovery(new URL('https://accounts.google.com'), clientId, {
    client_secret: clientSecret,
    id_token_signed_response_alg: 'RS256',
  });
}

export async function verifyIdentity(
  config: oidc.Configuration,
  url: URL,
  flow: { state: string; nonce: string; verifier: string },
): Promise<{ sub: string; name: string | null; picture: string | null }> {
  oidc.enableNonRepudiationChecks(config);
  const tokens = await oidc.authorizationCodeGrant(config, url, {
    pkceCodeVerifier: flow.verifier,
    expectedState: flow.state,
    expectedNonce: flow.nonce,
    idTokenExpected: true,
  });
  const claims = tokens.claims();
  if (!claims?.sub) throw new HttpError(401, 'Missing verified identity');
  const text = (value: unknown) => (typeof value === 'string' ? value : null);
  // Only Google's photo host, which the CSP allows.
  const picture = text(claims.picture);
  return {
    sub: claims.sub,
    name: text(claims.name),
    picture: picture?.startsWith('https://lh3.googleusercontent.com/')
      ? picture
      : null,
  };
}
