import * as oidc from 'openid-client';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
export async function identity() {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = {
    ...(await exportJWK(publicKey)),
    kid: 'synthetic',
    alg: 'RS256',
    use: 'sig',
  };
  const config = new oidc.Configuration(
    {
      issuer: 'https://accounts.google.com',
      authorization_endpoint: 'https://accounts.google.com/authorize',
      token_endpoint: 'https://accounts.google.com/token',
      jwks_uri: 'https://accounts.google.com/jwks',
    },
    'synthetic-client',
    {
      client_secret: 'synthetic-secret',
      id_token_signed_response_alg: 'RS256',
    },
  );
  let nonce = '';
  let sub = '123';
  let tamper = false;
  let expired = false;
  let audience = 'synthetic-client';
  let issuer = 'https://accounts.google.com';
  let verifier = '';
  config[oidc.customFetch] = async (url, options) => {
    if (String(url).endsWith('/jwks')) return Response.json({ keys: [jwk] });
    verifier =
      new URLSearchParams(String(options?.body)).get('code_verifier') || '';
    let token = await new SignJWT({ nonce })
      .setProtectedHeader({ alg: 'RS256', kid: 'synthetic' })
      .setSubject(sub)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expired ? 1 : '5m')
      .sign(privateKey);
    if (tamper) token = token.slice(0, -10) + 'AAAAAAAAAA';
    return Response.json({
      access_token: 'synthetic',
      token_type: 'Bearer',
      id_token: token,
    });
  };
  return {
    config,
    set: (values: {
      nonce?: string;
      sub?: string;
      tamper?: boolean;
      expired?: boolean;
      audience?: string;
      issuer?: string;
    }) => {
      nonce = values.nonce ?? nonce;
      sub = values.sub ?? sub;
      tamper = values.tamper ?? tamper;
      expired = values.expired ?? expired;
      audience = values.audience ?? audience;
      issuer = values.issuer ?? issuer;
    },
    verifier: () => verifier,
  };
}
