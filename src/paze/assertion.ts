import { createSign, randomUUID } from 'crypto';

// The private_key_jwt client assertion Paze's /token endpoint takes, signed with the merchant's
// Paze signing key. Shared by /paze/oauth/token and the backend-mediated session routes.

const ASSERTION_LIFETIME_S = 1800; // Paze's limit

export interface ClientAssertionSettings {
  loginId: string;
  signingKid: string;
  signingPrivateKey: string;
  tokenUrl: string;
}

const base64url = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

export const buildClientAssertion = (
  settings: ClientAssertionSettings,
  now: number = Math.floor(Date.now() / 1000)
): string => {
  const header = { alg: 'RS256', typ: 'JWT', kid: settings.signingKid };
  const claims = {
    iss: settings.loginId,
    sub: settings.loginId,
    aud: settings.tokenUrl,
    jti: randomUUID(),
    iat: now,
    nbf: now,
    exp: now + ASSERTION_LIFETIME_S,
  };
  const unsigned = `${base64url(header)}.${base64url(claims)}`;
  const signature = createSign('RSA-SHA256')
    .update(unsigned)
    .sign(settings.signingPrivateKey, 'base64url');
  return `${unsigned}.${signature}`;
};

export const tokenForm = (clientAssertion: string, sessionId: string): string =>
  new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type:
      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    session_id: sessionId,
    client_assertion: clientAssertion,
  }).toString();
