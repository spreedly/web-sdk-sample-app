import axios from 'axios';
import { Request, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { timingSafeEqual } from 'crypto';
import config from '../config';
import { clientIp } from '../clientIp';
import { buildClientAssertion } from '../paze/assertion';

// POST /api/v1/paze/oauth/token
// Mints a Paze access token for the Spreedly mobile SDK's Paze checkout (CAT/sandbox).
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

export const isAuthorized = (req: Request): boolean => {
  const supplied = Buffer.from(req.get('x-demo-api-key') || '');
  const expected = Buffer.from(config.pazeDemoApiKey);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
};

// Runs before the demo key check, so callers with a wrong key are limited too.
export const pazeTokenRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8', // also sets Retry-After on a 429
  legacyHeaders: false,
  keyGenerator: req => ipKeyGenerator(clientIp(req, Boolean(config.edgeGuard))),
  // clientIp reads the forwarding headers itself, so the app doesn't need `trust proxy`.
  validate: { xForwardedForHeader: false },
  handler: (_req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .status(429)
      .json({ error: 'rate_limited' });
  },
});

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
    clientAssertion = buildClientAssertion({
      loginId: config.pazeMobileLoginId,
      signingKid: config.pazeSigningKid,
      signingPrivateKey: config.pazeSigningPrivateKey,
      tokenUrl: config.pazeTokenUrl,
    });
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
