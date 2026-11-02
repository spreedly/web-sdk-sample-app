import axios from 'axios';
import { Request, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { createSign, randomUUID, timingSafeEqual } from 'crypto';
import config from '../config';

// POST /api/v1/paze/oauth/token
// Mints a Paze access token for the Spreedly mobile SDK's Paze checkout (CAT/sandbox).
const ASSERTION_LIFETIME_S = 1800; // Paze's limit
const PAZE_TIMEOUT_MS = 15_000; // well under the SDK's 30 s budget, so this endpoint fails first
const MAX_TOKEN_BYTES = 8 * 1024; // the SDK rejects larger tokens as malformed
// Paze binds the token to the checkout session, so the app sends its session_id (JSON or form body).
const SESSION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
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

const callerIp = (req: Request): string => {
  const forwarded = req.get('x-forwarded-for');
  return (
    forwarded?.split(',').pop()?.trim() || req.socket.remoteAddress || 'unknown'
  );
};

// Runs before the demo key check, so callers with a wrong key are limited too.
export const pazeTokenRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8', // also sets Retry-After on a 429
  legacyHeaders: false,
  keyGenerator: req => ipKeyGenerator(callerIp(req)),
  // callerIp reads X-Forwarded-For itself, so the app doesn't need `trust proxy`.
  validate: { xForwardedForHeader: false },
  handler: (_req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .status(429)
      .json({ error: 'rate_limited' });
  },
});

const base64url = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

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
  const sessionId = req.body?.session_id;
  if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
    res.status(400).json({ error: 'invalid_session_id' });
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

  const form = new URLSearchParams({
    grant_type: 'client_credentials',
    client_assertion_type:
      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
    session_id: sessionId,
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
    console.warn(
      `[paze-oauth] upstream unreachable latency_ms=${Date.now() - startedAt}`
    );
    res.status(503).json({ error: 'upstream_unavailable' });
    return;
  }
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
