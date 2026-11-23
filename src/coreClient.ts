import axios, { AxiosResponse } from 'axios';
import { Response } from 'express';
import config from './config';

// Every call this app makes to Spreedly Core goes through this file. It sends only the
// requests listed in CORE_ROUTES, so a value from a browser can never steer the app's
// credentials to another Core endpoint.

// Spreedly tokens (payment methods, transactions, gateways) are letters and digits.
const TOKEN = '[A-Za-z0-9]{1,64}';
const TOKEN_PATTERN = new RegExp(`^${TOKEN}$`);

export const isSpreedlyToken = (value: unknown): value is string =>
  typeof value === 'string' && TOKEN_PATTERN.test(value);

type CoreMethod = 'GET' | 'POST' | 'PUT';

interface CoreRoute {
  method: CoreMethod;
  path: RegExp;
  // Query parameters the route may carry. Anything else is refused.
  query?: readonly string[];
  // For /v1/gateways/:gateway/... routes: the gateway tokens the route may use.
  gateways?: () => string[];
}

const purchaseGateways = () => [
  config.spreedlyGatewayToken,
  config.stripeGatewayToken,
  config.paypalGatewayToken,
  config.ebanxGatewayToken,
  config.braintreeGatewayToken,
  config.ppcpGatewayToken,
];

const ppcpGateway = () => [config.ppcpGatewayToken];

const CORE_ROUTES: readonly CoreRoute[] = [
  { method: 'PUT', path: new RegExp(`^/v1/payment_methods/${TOKEN}/retain$`) },
  // Paze and PPCP payment method creation
  { method: 'POST', path: /^\/v1\/payment_methods\.json$/ },
  // PPCP: re-read a payment method for its vault reference
  { method: 'GET', path: new RegExp(`^/v1/payment_methods/${TOKEN}\\.json$`) },
  // Purchases on the gateways the app is configured with
  {
    method: 'POST',
    path: new RegExp(`^/v1/gateways/(${TOKEN})/purchase\\.json$`),
    gateways: purchaseGateways,
  },
  // PPCP authorize and vault verify
  {
    method: 'POST',
    path: new RegExp(`^/v1/gateways/(${TOKEN})/(authorize|verify)\\.json$`),
    gateways: ppcpGateway,
  },
  { method: 'GET', path: new RegExp(`^/v1/transactions/${TOKEN}\\.json$`) },
  // 3DS complete, offsite confirm, PPCP capture
  {
    method: 'POST',
    path: new RegExp(`^/v1/transactions/${TOKEN}/(complete|confirm|capture)\\.json$`),
  },
];

export class CoreRequestRefusedError extends Error {
  status = 400;
  constructor() {
    super('Request refused');
    this.name = 'CoreRequestRefusedError';
  }
}

const isAllowed = (
  method: CoreMethod,
  path: string,
  query: Record<string, string> | undefined
): boolean => {
  const route = CORE_ROUTES.find(r => r.method === method && r.path.test(path));
  if (!route) return false;

  const allowedQuery = route.query || [];
  if (query && Object.keys(query).some(key => !allowedQuery.includes(key))) return false;

  if (route.gateways) {
    const gateway = route.path.exec(path)?.[1];
    const configured = route.gateways().filter(Boolean);
    if (!gateway || !configured.includes(gateway)) return false;
  }

  // The path must survive URL parsing unchanged: no dot segments, no encoded slashes.
  const base = new URL(config.spreedlyUrl);
  const url = new URL(path, base);
  return url.origin === base.origin && url.pathname === path;
};

const authorizationHeader = (): string => {
  if (!config.spreedlyEnvironmentKey || !config.spreedlyAccessSecret) {
    throw new Error(
      'SPREEDLY_ENVIRONMENT_KEY_NEW and SPREEDLY_ACCESS_SECRET_NEW environment variables are required'
    );
  }
  const credentials = Buffer.from(
    `${config.spreedlyEnvironmentKey}:${config.spreedlyAccessSecret}`
  ).toString('base64');
  return `Basic ${credentials}`;
};

// No redirects: a 3xx from Core is returned to the caller, never followed with our credentials.
const http = axios.create({ maxRedirects: 0 });

const request = <T>(
  method: CoreMethod,
  path: string,
  body?: unknown,
  query?: Record<string, string>
): Promise<AxiosResponse<T>> => {
  if (!isAllowed(method, path, query)) {
    return Promise.reject(new CoreRequestRefusedError());
  }
  return http.request<T>({
    method,
    url: `${new URL(config.spreedlyUrl).origin}${path}`,
    params: query,
    data: body,
    headers: {
      Authorization: authorizationHeader(),
      'Content-Type': 'application/json',
    },
  });
};

// Core's JSON responses are read field by field with optional chaining, as before.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CoreData = any;

export const core = {
  get: (path: string, query?: Record<string, string>) =>
    request<CoreData>('GET', path, undefined, query),
  post: (path: string, body: unknown) => request<CoreData>('POST', path, body),
  put: (path: string, body: unknown) => request<CoreData>('PUT', path, body),
};

// Passes Core's own status and body back to the page, as the routes always have.
export const sendCoreError = (error: unknown, res: Response): void => {
  if (error instanceof CoreRequestRefusedError) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (axios.isAxiosError(error) && error.response) {
    res.status(error.response.status).json(error.response.data);
    return;
  }
  res.status(500).json({ error: 'The request to Spreedly failed' });
};

export const INVALID_TOKEN = { error: 'Invalid token format' };
