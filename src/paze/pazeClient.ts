import {
  buildClientAssertion,
  ClientAssertionSettings,
  tokenForm,
} from './assertion';
import { deriveClientContext } from './clientContext';
import { Transport, TransportError, TransportResponse } from './transport';

// Every call the backend makes to Paze: a fresh /token before each session call, then
// sessions/create, review or complete. Tokens are held only for the call they were minted for.

export type PazeEnvironment = 'cat' | 'uat' | 'production';

export interface PazeEnvironmentHosts {
  tokenUrl: string;
  // In the order they're tried. Only CAT has a fallback.
  apiOrigins: readonly string[];
  checkoutHost: string;
}

export const PAZE_ENVIRONMENTS: Record<PazeEnvironment, PazeEnvironmentHosts> =
  {
    cat: {
      tokenUrl: 'https://auth.wallet.cat.earlywarning.io/token',
      apiOrigins: [
        'https://mobile-east.wallet.cat.earlywarning.io',
        'https://mobile.wallet.cat.earlywarning.io',
      ],
      checkoutHost: 'checkout.wallet.cat.earlywarning.io',
    },
    uat: {
      tokenUrl: 'https://auth.wallet.uat.earlywarning.io/token',
      apiOrigins: ['https://mobile.wallet.uat.earlywarning.io'],
      checkoutHost: 'checkout.wallet.uat.earlywarning.io',
    },
    production: {
      tokenUrl: 'https://auth.wallet.earlywarning.com/token',
      apiOrigins: ['https://api.paze.com'],
      checkoutHost: 'checkout.paze.com',
    },
  };

export const isPazeEnvironment = (value: string): value is PazeEnvironment =>
  Object.prototype.hasOwnProperty.call(PAZE_ENVIRONMENTS, value);

export type PazeStep = 'token' | 'create' | 'review' | 'complete';

const SESSION_PATHS: Record<Exclude<PazeStep, 'token'>, string> = {
  create: '/v1/checkout/sessions/create',
  review: '/v1/checkout/sessions/review',
  complete: '/v1/checkout/sessions/complete',
};

const MAX_TOKEN_BYTES = 8 * 1024;

// Paze answered with an error status. Its status and body go back to the app unchanged.
export class PazeApiError extends Error {
  constructor(
    readonly step: PazeStep,
    readonly status: number,
    readonly body: unknown
  ) {
    super(`Paze ${step} failed with ${status}`);
    this.name = 'PazeApiError';
  }
}

// Paze couldn't be reached, or the connection broke before an answer.
export class PazeUnavailableError extends Error {
  constructor(readonly step: PazeStep) {
    super(`Paze ${step} is unavailable`);
    this.name = 'PazeUnavailableError';
  }
}

// Paze answered 2xx with something unusable: not JSON, no token, or the wrong clientContext.
export class PazeInvalidResponseError extends Error {
  constructor(
    readonly step: PazeStep,
    reason: string
  ) {
    super(`Paze ${step} response is invalid: ${reason}`);
    this.name = 'PazeInvalidResponseError';
  }
}

export interface PazeCallLog {
  event: 'paze_call';
  step: PazeStep;
  sessionId: string;
  status: number | null;
  duration_ms: number;
  attempt: number;
  origin: string;
  ewSID?: string;
  outcome: 'ok' | 'http_error' | 'transport_error';
  reauthenticated?: boolean;
}

export interface PazeClientSettings {
  environment: PazeEnvironment;
  tokenUrl: string;
  assertion: ClientAssertionSettings;
  clientContextKey: Buffer;
}

export interface PazeClientDeps {
  settings: PazeClientSettings;
  transport: Transport;
  // One structured log per outbound call. Never carries tokens, codes, payloads or bodies.
  log: (entry: PazeCallLog) => void;
  now?: () => number;
}

export interface PazeSessionResponse {
  body: Record<string, unknown>;
  ewSID?: string | undefined;
}

const parseJson = (body: Buffer): unknown => {
  if (body.length === 0) return null;
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    return null;
  }
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readEwSID = (
  body: unknown,
  headers: TransportResponse['headers']
): string | undefined => {
  const fromBody =
    (isObject(body) && body.ewSID) ||
    (isObject(body) && isObject(body.data) && body.data.ewSID);
  if (typeof fromBody === 'string' && fromBody.length <= 128) return fromBody;
  const header = headers.ewsid;
  return typeof header === 'string' && header.length <= 128
    ? header
    : undefined;
};

export class PazeClient {
  private readonly now: () => number;

  constructor(private readonly deps: PazeClientDeps) {
    this.now = deps.now || Date.now;
  }

  get environment(): PazeEnvironment {
    return this.deps.settings.environment;
  }

  get hosts(): PazeEnvironmentHosts {
    return PAZE_ENVIRONMENTS[this.deps.settings.environment];
  }

  clientContextFor(sessionId: string): string {
    return deriveClientContext(this.deps.settings.clientContextKey, sessionId);
  }

  // sessions/create, review or complete, with `data` as the request's data object.
  async callSession(
    step: Exclude<PazeStep, 'token'>,
    sessionId: string,
    data: Record<string, unknown>
  ): Promise<PazeSessionResponse> {
    const clientContext = this.clientContextFor(sessionId);
    const body = JSON.stringify({ clientContext, data });
    let token = await this.mintToken(sessionId);
    let reauthenticated = false;
    let attempt = 0;
    const origins = this.hosts.apiOrigins;

    for (let i = 0; i < origins.length; i++) {
      const origin = origins[i];
      if (!origin) break;
      attempt++;
      const startedAt = this.now();
      let response: TransportResponse;
      try {
        response = await this.deps.transport({
          url: `${origin}${SESSION_PATHS[step]}`,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body,
        });
      } catch (error) {
        const connected = error instanceof TransportError && error.connected;
        this.log(
          step,
          sessionId,
          null,
          startedAt,
          attempt,
          origin,
          'transport_error'
        );
        // complete may have used the code once the request reached Paze, so it only moves on
        // when the connection was never established. create and review move on after any
        // connection failure.
        const mayRetry = step === 'complete' ? !connected : true;
        if (mayRetry && i + 1 < origins.length) continue;
        throw new PazeUnavailableError(step);
      }

      const parsed = parseJson(response.body);
      const ewSID = readEwSID(parsed, response.headers);
      const ok = response.status >= 200 && response.status < 300;
      this.log(
        step,
        sessionId,
        response.status,
        startedAt,
        attempt,
        origin,
        ok ? 'ok' : 'http_error',
        ewSID,
        reauthenticated
      );

      // A 401 gets one new token and one more try on the same origin.
      if (response.status === 401 && !reauthenticated) {
        reauthenticated = true;
        token = await this.mintToken(sessionId);
        i--;
        continue;
      }
      if (!ok) throw new PazeApiError(step, response.status, parsed);
      if (!isObject(parsed)) {
        throw new PazeInvalidResponseError(step, 'not a JSON object');
      }
      if (
        parsed.clientContext !== undefined &&
        parsed.clientContext !== clientContext
      ) {
        throw new PazeInvalidResponseError(step, 'clientContext mismatch');
      }
      return { body: parsed, ewSID };
    }
    throw new PazeUnavailableError(step);
  }

  // A new token for each Paze call, bound to the checkout's sessionId. Retried once after a
  // connection failure or a 5xx.
  async mintToken(sessionId: string): Promise<string> {
    const { settings } = this.deps;
    for (let attempt = 1; attempt <= 2; attempt++) {
      // A fresh assertion per attempt: each carries its own jti.
      const form = tokenForm(
        buildClientAssertion(settings.assertion),
        sessionId
      );
      const startedAt = this.now();
      let response: TransportResponse;
      try {
        response = await this.deps.transport({
          url: settings.tokenUrl,
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: form,
        });
      } catch {
        this.log(
          'token',
          sessionId,
          null,
          startedAt,
          attempt,
          settings.tokenUrl,
          'transport_error'
        );
        if (attempt < 2) continue;
        throw new PazeUnavailableError('token');
      }
      const parsed = parseJson(response.body);
      const ok = response.status >= 200 && response.status < 300;
      this.log(
        'token',
        sessionId,
        response.status,
        startedAt,
        attempt,
        settings.tokenUrl,
        ok ? 'ok' : 'http_error',
        readEwSID(parsed, response.headers)
      );
      if (response.status >= 500 && attempt < 2) continue;
      if (!ok) throw new PazeApiError('token', response.status, parsed);
      const accessToken = isObject(parsed) ? parsed.access_token : undefined;
      if (
        typeof accessToken !== 'string' ||
        !accessToken.trim() ||
        Buffer.byteLength(accessToken, 'utf8') > MAX_TOKEN_BYTES
      ) {
        throw new PazeInvalidResponseError('token', 'no usable access_token');
      }
      return accessToken;
    }
    throw new PazeUnavailableError('token');
  }

  private log(
    step: PazeStep,
    sessionId: string,
    status: number | null,
    startedAt: number,
    attempt: number,
    origin: string,
    outcome: PazeCallLog['outcome'],
    ewSID?: string,
    reauthenticated?: boolean
  ): void {
    this.deps.log({
      event: 'paze_call',
      step,
      sessionId,
      status,
      duration_ms: this.now() - startedAt,
      attempt,
      origin: new URL(origin).origin,
      ...(ewSID && { ewSID }),
      outcome,
      ...(reauthenticated && { reauthenticated }),
    });
  }
}
