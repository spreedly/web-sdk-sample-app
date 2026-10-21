import axios from 'axios';
import { Request, Response } from 'express';
import { createSign, randomUUID, timingSafeEqual } from 'crypto';
import config from '../config';

// POST /api/v1/paze/oauth/token
// Mints a Paze access token for the Spreedly mobile SDK's Paze checkout (CAT/sandbox). A merchant
// hosts this endpoint in production; the sample app hosts one for the mobile demo apps.
// The request body is ignored: nothing from the caller is sent to Paze. Paze tokens are single-use
// per checkout, so every call mints a new one and nothing is cached.

const ASSERTION_LIFETIME_S = 1800; // Paze's limit
const PAZE_TIMEOUT_MS = 15_000; // well under the SDK's 30 s budget, so this endpoint fails first
const MAX_TOKEN_BYTES = 8 * 1024; // the SDK rejects larger tokens as malformed
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

const rateWindows = new Map<string, { count: number; resetAt: number }>();

const isConfigured = (): boolean =>
  Boolean(
    config.pazeMobileLoginId &&
      config.pazeSigningKid &&
      config.pazeSigningPrivateKey &&
      config.pazeTokenUrl &&
      config.pazeDemoApiKey
  );

const isAuthorized = (req: Request): boolean => {
  const supplied = Buffer.from(req.get('x-demo-api-key') || '');
  const expected = Buffer.from(config.pazeDemoApiKey);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
};

// Heroku's router appends the client's IP as the last X-Forwarded-For entry.
const callerId = (req: Request): string => {
  const forwarded = req.get('x-forwarded-for');
  return (
    forwarded?.split(',').pop()?.trim() || req.socket.remoteAddress || 'unknown'
  );
};

// Returns the seconds to wait when the caller is over the limit, otherwise 0.
const rateLimitWait = (caller: string): number => {
  const now = Date.now();
  for (const [key, window] of rateWindows) {
    if (window.resetAt <= now) rateWindows.delete(key);
  }
  const window = rateWindows.get(caller) || {
    count: 0,
    resetAt: now + RATE_WINDOW_MS,
  };
  window.count += 1;
  rateWindows.set(caller, window);
  return window.count > RATE_LIMIT
    ? Math.ceil((window.resetAt - now) / 1000)
    : 0;
};

const base64url = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

// RS256 client assertion (RFC 7523). iss and sub are the Paze mobile login id, not the web client
// id: Paze answers 401 invalid_client to the web one. aud must be the exact token URL, or Paze
// answers 400 invalid_grant.
const buildClientAssertion = (): string => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT', kid: config.pazeSigningKid };
  const claims = {
    iss: config.pazeMobileLoginId,
    sub: config.pazeMobileLoginId,
    aud: config.pazeTokenUrl,
    jti: randomUUID(),
    iat: now,
    nbf: now,
    exp: now + ASSERTION_LIFETIME_S,
  };
  const unsigned = `${base64url(header)}.${base64url(claims)}`;
  const signature = createSign('RSA-SHA256')
    .update(unsigned)
    .sign(config.pazeSigningPrivateKey, 'base64url');
  return `${unsigned}.${signature}`;
};

export const getPazeAccessToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  res.set('Cache-Control', 'no-store');

  if (!isConfigured()) {
    res.status(503).json({ error: 'not_configured' });
    return;
  }
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const wait = rateLimitWait(callerId(req));
  if (wait > 0) {
    res
      .set('Retry-After', String(wait))
      .status(429)
      .json({ error: 'rate_limited' });
    return;
  }

  let clientAssertion: string;
  try {
    clientAssertion = buildClientAssertion();
  } catch {
    console.error(
      '[paze-oauth] could not sign the client assertion: check PAZE_SIGNING_PRIVATE_KEY'
    );
    res.status(503).json({ error: 'not_configured' });
    return;
  }

  // Exactly these three fields, in every environment. Never session_id.
  const form = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type:
      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    client_assertion: clientAssertion,
  });

  const startedAt = Date.now();
  let status: number;
  let data: {
    access_token?: unknown;
    token_type?: unknown;
    expires_in?: unknown;
  };
  try {
    const response = await axios.post(config.pazeTokenUrl, form, {
      timeout: PAZE_TIMEOUT_MS,
      validateStatus: () => true,
    });
    status = response.status;
    data = response.data || {};
  } catch {
    // Timeout, DNS or connection failure. Never log the error: it holds the request body.
    console.warn(
      `[paze-oauth] upstream unreachable latency_ms=${Date.now() - startedAt}`
    );
    res.status(503).json({ error: 'upstream_unavailable' });
    return;
  }
  // Status and latency only: never the token, the assertion or Paze's response body.
  console.info(
    `[paze-oauth] upstream status=${status} latency_ms=${Date.now() - startedAt}`
  );

  if (status >= 500) {
    res.status(503).json({ error: 'upstream_unavailable' });
    return;
  }
  if (status >= 400) {
    res.status(502).json({ error: 'upstream_rejected' });
    return;
  }
  const accessToken = data.access_token;
  if (
    typeof accessToken !== 'string' ||
    !accessToken.trim() ||
    Buffer.byteLength(accessToken, 'utf8') > MAX_TOKEN_BYTES
  ) {
    res.status(502).json({ error: 'upstream_invalid' });
    return;
  }
  res.json({
    access_token: accessToken,
    ...(data.token_type !== undefined && { token_type: data.token_type }),
    ...(data.expires_in !== undefined && { expires_in: data.expires_in }),
  });
};
