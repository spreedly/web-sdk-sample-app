import axios from 'axios';
import { createHash } from 'crypto';
import { Request, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import config from '../config';
import { clientIp } from '../clientIp';
import { core } from '../coreClient';
import {
  BackendError,
  CreateSpreedlyPaymentMethod,
  PazeCheckoutService,
  SpreedlyApiError,
} from '../paze/checkoutService';
import { SESSION_ID_PATTERN } from '../paze/clientContext';
import {
  PazeApiError,
  PazeClient,
  PazeInvalidResponseError,
  PazeUnavailableError,
} from '../paze/pazeClient';
import { PazeSessionStore, SessionStoreFullError } from '../paze/sessionStore';
import { createHttpsTransport } from '../paze/transport';
import { isAuthorized } from './paze-oauth';

// POST /api/v1/paze/sessions, /paze/sessions/:sessionId/review and /:sessionId/complete:
// the backend-mediated Paze checkout for the Spreedly mobile SDK. The backend makes every call
// to Paze and to Spreedly; the app only runs the wallet browser step.
//
// The sample has no shopper accounts. A caller is the demo API key (X-Demo-Api-Key) plus the
// app's own session id (X-Shopper-Session), which stands in for the shopper's authenticated app
// session: a checkout's review and complete only work with the X-Shopper-Session that created it.

const SESSION_TTL_MS = 30 * 60_000; // until Paze confirms its session lifetime
const MAX_SESSIONS = 5_000;
const MAX_TRANSACTION_AMOUNT = 10_000; // a demo cap on the shopper-supplied amount
const SHOPPER_SESSION_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

const store = new PazeSessionStore({
  ttlMs: SESSION_TTL_MS,
  maxSessions: MAX_SESSIONS,
});

const createPaymentMethod: CreateSpreedlyPaymentMethod = async token => {
  // Retried once with the same body after a network error or a 5xx. The session lock and the
  // COMPLETED status keep this to one payment method per sessionId.
  for (let attempt = 1; ; attempt++) {
    const startedAt = Date.now();
    try {
      const response = await core.post('/v1/payment_methods.json', {
        payment_method: { third_party_network_token: token },
      });
      const paymentMethod = response.data?.transaction?.payment_method;
      console.info(
        JSON.stringify({
          event: 'spreedly_call',
          step: 'spreedly_payment_method',
          sessionId: token.session_id,
          status: response.status,
          duration_ms: Date.now() - startedAt,
          attempt,
        })
      );
      if (typeof paymentMethod?.token !== 'string') {
        throw new Error('no payment method token');
      }
      const lastFour = paymentMethod.last_four_digits;
      return {
        token: paymentMethod.token,
        ...(typeof lastFour === 'string' &&
          /^\d{4}$/.test(lastFour) && { lastFour }),
      };
    } catch (error) {
      const status = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;
      console.warn(
        JSON.stringify({
          event: 'spreedly_call',
          step: 'spreedly_payment_method',
          sessionId: token.session_id,
          status: status ?? null,
          duration_ms: Date.now() - startedAt,
          attempt,
        })
      );
      const retryable =
        axios.isAxiosError(error) &&
        (!error.response || error.response.status >= 500);
      if (!retryable || attempt >= 2) {
        throw axios.isAxiosError(error) && error.response
          ? new SpreedlyApiError(error.response.status, error.response.data)
          : error;
      }
    }
  }
};

let service: PazeCheckoutService | null | undefined;

// Built on first use, so a missing setting only turns these routes off.
const getService = (): PazeCheckoutService | null => {
  if (service !== undefined) return service;
  const ready =
    config.pazeEnvironment &&
    config.pazeClientContextKey &&
    config.pazeMobileLoginId &&
    config.pazeSigningKid &&
    config.pazeSigningPrivateKey &&
    config.pazeTokenUrl &&
    config.pazeDemoApiKey &&
    config.pazeClientId &&
    config.pazeClientName &&
    config.pazeProfileId &&
    config.pazeCertificateToken &&
    config.spreedlyEnvironmentKey &&
    config.spreedlyAccessSecret;
  if (!ready || !config.pazeEnvironment || !config.pazeClientContextKey) {
    service = null;
    return service;
  }
  const paze = new PazeClient({
    settings: {
      environment: config.pazeEnvironment,
      tokenUrl: config.pazeTokenUrl,
      assertion: {
        loginId: config.pazeMobileLoginId,
        signingKid: config.pazeSigningKid,
        signingPrivateKey: config.pazeSigningPrivateKey,
        tokenUrl: config.pazeTokenUrl,
      },
      clientContextKey: config.pazeClientContextKey,
    },
    transport: createHttpsTransport({
      connectTimeoutMs: 5_000,
      totalTimeoutMs: 20_000,
    }),
    log: entry => console.info(JSON.stringify(entry)),
  });
  service = new PazeCheckoutService({
    paze,
    store,
    createPaymentMethod,
    client: {
      id: config.pazeClientId,
      name: config.pazeClientName,
      profileId: config.pazeProfileId,
    },
    certificateToken: config.pazeCertificateToken,
    maxTransactionAmount: MAX_TRANSACTION_AMOUNT,
    currencies: new Set(['USD']),
  });
  return service;
};

const callerKeyOf = (req: Request): string | null => {
  const shopperSession = req.get('x-shopper-session') || '';
  if (!SHOPPER_SESSION_PATTERN.test(shopperSession)) return null;
  return createHash('sha256').update(shopperSession).digest('hex');
};

// Logged in errorHandler's format. Never the error object: an axios error carries the
// Authorization header.
const logFailure = (req: Request, status: number, name: string): void => {
  console.error(
    `${req.method} ${req.baseUrl}${req.path} failed: ${status} ${name}`
  );
};

const backendError = (
  req: Request,
  res: Response,
  status: number,
  message: string,
  name = `BackendError: ${message}`
): void => {
  logFailure(req, status, name);
  res.status(status).json({ source: 'backend', message });
};

// Every non-2xx answer has one of two shapes, which the SDK's client reads into
// PazeBackendException. A Paze failure passes Paze's status and body through unchanged, and a
// Spreedly failure passes Spreedly's, as sendCoreError does on the other routes.
const sendError = (req: Request, res: Response, error: unknown): void => {
  if (error instanceof PazeApiError) {
    const status = error.status === 429 ? 429 : 502;
    logFailure(req, status, `${error.name} (Paze ${error.status})`);
    res.status(status).json({
      source: 'paze',
      pazeStatusCode: error.status,
      pazeError: error.body ?? null,
    });
    return;
  }
  if (error instanceof SpreedlyApiError) {
    logFailure(req, error.status, `${error.name}: ${error.message}`);
    res.status(error.status).json({
      source: 'backend',
      message: error.message,
      spreedlyError: error.body ?? null,
    });
    return;
  }
  if (error instanceof BackendError) {
    backendError(req, res, error.status, error.message);
    return;
  }
  if (error instanceof PazeUnavailableError) {
    backendError(req, res, 503, 'Paze is unavailable', error.name);
    return;
  }
  if (error instanceof PazeInvalidResponseError) {
    backendError(
      req,
      res,
      502,
      'Paze returned an invalid response',
      `${error.name}: ${error.message}`
    );
    return;
  }
  if (error instanceof SessionStoreFullError) {
    backendError(
      req,
      res,
      503,
      'too many open checkouts; try again later',
      error.name
    );
    return;
  }
  backendError(
    req,
    res,
    500,
    'the Paze checkout failed',
    error instanceof Error ? error.name : 'Error'
  );
};

// The shared checks for all three routes: no caching, configured, demo key, caller.
const guard = (
  req: Request,
  res: Response
): { service: PazeCheckoutService; callerKey: string } | null => {
  res.set('Cache-Control', 'no-store');
  const current = getService();
  if (!current) {
    backendError(req, res, 503, 'not_configured');
    return null;
  }
  if (!isAuthorized(req)) {
    backendError(req, res, 401, 'unauthorized');
    return null;
  }
  const callerKey = callerKeyOf(req);
  if (!callerKey) {
    backendError(req, res, 401, 'X-Shopper-Session is required');
    return null;
  }
  return { service: current, callerKey };
};

const readSessionId = (req: Request, res: Response): string | null => {
  const sessionId = req.params.sessionId;
  if (typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId)) {
    backendError(req, res, 404, 'session not found');
    return null;
  }
  return sessionId;
};

// Create is limited per shopper (X-Shopper-Session), falling back to the caller's IP.
export const pazeCreateSessionRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: req =>
    callerKeyOf(req) ||
    ipKeyGenerator(clientIp(req, Boolean(config.edgeGuard))),
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    logFailure(req, 429, 'RateLimited');
    res
      .set('Cache-Control', 'no-store')
      .status(429)
      .json({ source: 'backend', message: 'rate_limited' });
  },
});

// Review and complete share a looser limit per caller IP.
export const pazeSessionStepRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: req => ipKeyGenerator(clientIp(req, Boolean(config.edgeGuard))),
  validate: { xForwardedForHeader: false },
  handler: (req, res) => {
    logFailure(req, 429, 'RateLimited');
    res
      .set('Cache-Control', 'no-store')
      .status(429)
      .json({ source: 'backend', message: 'rate_limited' });
  },
});

export const createPazeSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  const checked = guard(req, res);
  if (!checked) return;
  try {
    res.json(await checked.service.createSession(req.body, checked.callerKey));
  } catch (error) {
    sendError(req, res, error);
  }
};

export const reviewPazeSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  const checked = guard(req, res);
  if (!checked) return;
  const sessionId = readSessionId(req, res);
  if (!sessionId) return;
  try {
    res.json(
      await checked.service.reviewSession(
        sessionId,
        req.body,
        checked.callerKey
      )
    );
  } catch (error) {
    sendError(req, res, error);
  }
};

export const completePazeSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  const checked = guard(req, res);
  if (!checked) return;
  const sessionId = readSessionId(req, res);
  if (!sessionId) return;
  try {
    res.json(
      await checked.service.completeSession(
        sessionId,
        req.body,
        checked.callerKey
      )
    );
  } catch (error) {
    sendError(req, res, error);
  }
};
