import axios from 'axios';
import https from 'https';
import { Request, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import config from '../config';

// POST /api/v1/apple-pay/validate
// Requests an Apple Pay merchant session over mutual TLS with the Merchant Identity Certificate.
// The merchant's job, not Spreedly's: the browser can't hold the certificate.
const APPLE_TIMEOUT_MS = 15_000; // under the SDK's 20 s merchant validation limit
const APPLE_SESSION_PATH = '/paymentservices/paymentSession';
// Apple's fixed hosts. The browser's validationURL is never called, so this route can't be used
// to make the server fetch an arbitrary URL.
const APPLE_HOSTS = {
  sandbox: 'apple-pay-gateway-cert.apple.com',
  production: 'apple-pay-gateway.apple.com',
} as const;
const MAX_DISPLAY_NAME_LENGTH = 64; // Apple's limit, in UTF-8 characters

const isConfigured = (): boolean =>
  Boolean(
    config.applePayMerchantId &&
      config.applePayDisplayName &&
      config.applePayDomain &&
      config.applePayMerchantIdentityCert &&
      config.applePayMerchantIdentityKey
  );

const callerIp = (req: Request): string => {
  const forwarded = req.get('x-forwarded-for');
  return (
    forwarded?.split(',').pop()?.trim() || req.socket.remoteAddress || 'unknown'
  );
};

export const applePayValidateRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: req => ipKeyGenerator(callerIp(req)),
  validate: { xForwardedForHeader: false },
  handler: (_req, res) => {
    res
      .set('Cache-Control', 'no-store')
      .status(429)
      .json({ error: 'rate_limited' });
  },
});

let identityAgent: https.Agent | null = null;
const getIdentityAgent = (): https.Agent => {
  if (!identityAgent) {
    identityAgent = new https.Agent({
      cert: config.applePayMerchantIdentityCert,
      key: config.applePayMerchantIdentityKey,
      minVersion: 'TLSv1.2',
    });
  }
  return identityAgent;
};

export const validateApplePayMerchant = async (
  _req: Request,
  res: Response
): Promise<void> => {
  res.set('Cache-Control', 'no-store');

  if (!isConfigured()) {
    res.status(503).json({ error: 'not_configured' });
    return;
  }

  const host = APPLE_HOSTS[config.applePayEnvironment];
  const startedAt = Date.now();
  let status: number;
  let session: unknown;
  try {
    const response = await axios.post(
      `https://${host}${APPLE_SESSION_PATH}`,
      {
        merchantIdentifier: config.applePayMerchantId,
        displayName: [...config.applePayDisplayName]
          .slice(0, MAX_DISPLAY_NAME_LENGTH)
          .join(''),
        initiative: 'web',
        initiativeContext: config.applePayDomain,
      },
      {
        httpsAgent: getIdentityAgent(),
        timeout: APPLE_TIMEOUT_MS,
        validateStatus: () => true,
      }
    );
    status = response.status;
    session = response.data;
  } catch {
    // Never log the error object: it can carry the TLS client configuration.
    console.warn(
      `[apple-pay] validation upstream unreachable host=${host} latency_ms=${Date.now() - startedAt}`
    );
    res.status(503).json({ error: 'upstream_unavailable' });
    return;
  }
  console.info(
    `[apple-pay] validation upstream status=${status} host=${host} latency_ms=${Date.now() - startedAt}`
  );

  if (status >= 500) {
    res.status(503).json({ error: 'upstream_unavailable' });
    return;
  }
  if (status >= 400 || typeof session !== 'object' || session === null) {
    res.status(502).json({ error: 'upstream_rejected' });
    return;
  }
  // Apple's merchant session, unchanged. Single use; expires 5 minutes after creation.
  res.json(session);
};

// GET /.well-known/apple-developer-merchantid-domain-association
// Apple's domain verification file, served from an env var so dotfiles stay off for the
// static mount. Public by design: Apple fetches it from the domain.
export const serveApplePayDomainAssociation = (
  _req: Request,
  res: Response
): void => {
  if (!config.applePayDomainAssociation) {
    res.status(404).end();
    return;
  }
  res.type('text/plain').send(config.applePayDomainAssociation);
};
