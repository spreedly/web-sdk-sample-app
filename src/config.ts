import dotenv from 'dotenv';

dotenv.config();

const PRODUCTION_SDK_BASE_URL = 'https://core.spreedly.com';

const SDK_HOSTS = new Set(['core.spreedly.com', 'core-test.spreedly.com']);

export const isSdkHost = (hostname: string): boolean => SDK_HOSTS.has(hostname);

const resolvePublicAppOrigin = (): string => {
  const raw = process.env.PUBLIC_APP_ORIGIN;
  if (!raw) throw new Error('PUBLIC_APP_ORIGIN is required');
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:') return url.origin;
  } catch {
    // Fall through to the error below.
  }
  throw new Error('PUBLIC_APP_ORIGIN must be an https origin');
};
const publicAppOrigin = resolvePublicAppOrigin();

const resolveOriginList = (raw: string, name: string): string[] => {
  const origins: string[] = [];
  for (const entry of raw.split(',')) {
    const candidate = entry.trim();
    if (!candidate) continue;
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new Error(`${name} has an invalid origin`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`${name} origins must be http or https`);
    }
    if (isSdkHost(url.hostname)) throw new Error(`${name} must not include an SDK host`);
    origins.push(url.origin);
  }
  if (origins.length === 0) throw new Error(`${name} is required`);
  return origins;
};

const resolveFrontendOrigins = (): string[] => {
  const raw = process.env.FRONTEND_ORIGINS;
  if (!raw || !raw.trim()) return [publicAppOrigin];
  return resolveOriginList(raw, 'FRONTEND_ORIGINS');
};
const frontendOrigins = resolveFrontendOrigins();


const resolveCorsAllowedOrigins = (): ReadonlySet<string> => {
  const allowed = new Set<string>(frontendOrigins);
  const raw = process.env.CORS_ALLOWED_ORIGINS || '';
  if (raw.trim()) {
    for (const origin of resolveOriginList(raw, 'CORS_ALLOWED_ORIGINS')) {
      allowed.add(origin);
    }
  }
  return allowed;
};

export interface EdgeGuardConfig {
  secret: string;
  headerName: string;
  herokuAppHost: string;
}

// The guard fails closed: the app won't start without the three Fastly vars. Off Heroku,
// EDGE_GUARD_DISABLED=true turns it off for local runs. On Heroku (DYNO is set) it can't be turned off.
const resolveEdgeGuard = (): EdgeGuardConfig | null => {
  const secret = process.env.FASTLY_SHARED_SECRET || '';
  const headerName = (process.env.FASTLY_SECRET_HEADER || '').trim().toLowerCase();
  const herokuAppHost = (process.env.HEROKU_APP_HOST || '').trim().toLowerCase();
  if (!secret && !headerName && !herokuAppHost) {
    if (process.env.DYNO) {
      throw new Error(
        'FASTLY_SHARED_SECRET, FASTLY_SECRET_HEADER and HEROKU_APP_HOST are required on Heroku'
      );
    }
    if (process.env.EDGE_GUARD_DISABLED === 'true') return null;
    throw new Error(
      'FASTLY_SHARED_SECRET, FASTLY_SECRET_HEADER and HEROKU_APP_HOST are required; ' +
        'set EDGE_GUARD_DISABLED=true to run locally without them'
    );
  }
  if (!secret || !headerName || !herokuAppHost) {
    throw new Error(
      'FASTLY_SHARED_SECRET, FASTLY_SECRET_HEADER and HEROKU_APP_HOST must be set together'
    );
  }
  if (secret.length < 32) throw new Error('FASTLY_SHARED_SECRET is too short');
  if (!/^[a-z0-9-]+$/.test(headerName)) {
    throw new Error('FASTLY_SECRET_HEADER is not a header name');
  }
  // Redirecting the Heroku host to itself would loop.
  if (new URL(publicAppOrigin).hostname === herokuAppHost) {
    throw new Error('PUBLIC_APP_ORIGIN must not be the Heroku app host');
  }
  return { secret, headerName, herokuAppHost };
};

export interface BasicAuthConfig {
  user: string;
  password: string;
}

const CORE_TEST_HOST = 'core-test.spreedly.com';

const hostnameOf = (raw: string | undefined): string | undefined => {
  if (!raw) return undefined;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return undefined;
  }
};

// The server calls core-test, or the pages load SDK builds from core-test.
const usesCoreTest = (): boolean =>
  hostnameOf(process.env.SPREEDLY_URL) === CORE_TEST_HOST ||
  hostnameOf(process.env.SDK_BASE_URL) === CORE_TEST_HOST;

// A browser login for the staging app only: on once BASIC_AUTH_USER and BASIC_AUTH_PASSWORD are set.
// Never set them on the public app. On Heroku, an app that uses core-test won't start without them,
// so the staging app can't run without its login, and the public app can't run on core-test.
const resolveBasicAuth = (): BasicAuthConfig | null => {
  const user = process.env.BASIC_AUTH_USER || '';
  const password = process.env.BASIC_AUTH_PASSWORD || '';
  if (!user && !password) {
    if (process.env.DYNO && usesCoreTest()) {
      throw new Error(
        'BASIC_AUTH_USER and BASIC_AUTH_PASSWORD are required on Heroku when SPREEDLY_URL or SDK_BASE_URL is core-test'
      );
    }
    return null;
  }
  if (!user || !password) {
    throw new Error('BASIC_AUTH_USER and BASIC_AUTH_PASSWORD must be set together');
  }
  // Basic Auth splits user and password at the first colon.
  if (user.includes(':')) throw new Error('BASIC_AUTH_USER must not contain a colon');
  // Nothing limits login attempts, so the password has to be long.
  if (password.length < 16) throw new Error('BASIC_AUTH_PASSWORD is too short');
  return { user, password };
};

const resolveSdkBaseUrl = (): string => {
  const raw = process.env.SDK_BASE_URL;
  if (!raw) return PRODUCTION_SDK_BASE_URL;
  try {
    const url = new URL(raw);
    const spreedlyHost =
      url.hostname === 'core.spreedly.com' ||
      url.hostname.endsWith('.spreedly.com');
    if (url.protocol === 'https:' && spreedlyHost) return url.origin;
  } catch {
    // Fall through to the production origin.
  }
  console.warn(
    'SDK_BASE_URL must be an https spreedly.com origin; using the production SDK host'
  );
  return PRODUCTION_SDK_BASE_URL;
};



interface Config {
  port: number;
  nodeEnv: string;
  spreedlyUrl: string;
  sdkBaseUrl: string;
  corsAllowedOrigins: ReadonlySet<string>;
  publicAppOrigin: string;
  // Origins a redirect_url may point at: this app's own pages.
  appOrigins: ReadonlySet<string>;
  edgeGuard: EdgeGuardConfig | null;
  basicAuth: BasicAuthConfig | null;
  privateKey: string;
  certificateToken: string;
  spreedlyEnvironmentKey: string;
  spreedlyAccessSecret: string;
  spreedlyGatewayToken: string;
  spreedlySCAProviderKey: string;
  spreedlySCAProviderKeyTestScenario: string;
  stripeGatewayToken: string;
  paypalGatewayToken: string;
  ebanxGatewayToken: string;
  braintreeGatewayToken: string;
  // PPCP (PayPal Complete Payments) — interim direct-to-PayPal spike (sandbox).
  paypalPpcpClientId: string;
  paypalPpcpClientSecret: string;
  paypalApiBaseUrl: string;
  // PPCP via Spreedly's paypal_commerce_platform gateway (the production path).
  ppcpGatewayToken: string;
  pazeCertificateToken: string;
  pazeClientId: string;
  pazeClientName: string;
  pazeProfileId: string;
  pazeMobileLoginId: string;
  pazeSigningKid: string;
  pazeSigningPrivateKey: string;
  pazeTokenUrl: string;
  pazeDemoApiKey: string;
  // Apple Pay (web): merchant validation and domain verification. Merchant ID, display name,
  // domain and environment default to the Heroku sample app; the routes answer
  // 503 not_configured / 404 until the certificate, key and verification file are set.
  applePayMerchantId: string;
  applePayDisplayName: string;
  applePayDomain: string;
  applePayEnvironment: 'sandbox' | 'production';
  applePayMerchantIdentityCert: string;
  applePayMerchantIdentityKey: string;
  applePayDomainAssociation: string;
  // Cash App Pay (Pay Kit). Browser-safe identifiers from Cash App partner onboarding.
  cashAppClientId: string;
  cashAppMerchantId: string;
}

const corsAllowedOrigins = resolveCorsAllowedOrigins();

const config: Config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  spreedlyUrl: process.env.SPREEDLY_URL || 'https://core.spreedly.com',
  sdkBaseUrl: resolveSdkBaseUrl(),
  corsAllowedOrigins,
  publicAppOrigin,
  appOrigins: new Set([...corsAllowedOrigins, publicAppOrigin]),
  edgeGuard: resolveEdgeGuard(),
  basicAuth: resolveBasicAuth(),
  privateKey: process.env.PRIVATE_KEY_NEW || '',
  certificateToken: process.env.CERTIFICATE_TOKEN_NEW || '',
  spreedlyEnvironmentKey: process.env.SPREEDLY_ENVIRONMENT_KEY_NEW || '',
  spreedlyAccessSecret: process.env.SPREEDLY_ACCESS_SECRET_NEW || '',
  spreedlyGatewayToken: process.env.SPREEDLY_GATEWAY_TOKEN_NEW || '',
  spreedlySCAProviderKey: process.env.SPREEDLY_SCA_PROVIDER_KEY_NEW || '',
  spreedlySCAProviderKeyTestScenario: process.env.SPREEDLY_SCA_PROVIDER_KEY_TEST_SCENARIO_NEW || '',
  stripeGatewayToken: process.env.STRIPE_GATEWAY_TOKEN_NEW || '',
  paypalGatewayToken: process.env.PAYPAL_GATEWAY_TOKEN_NEW || '',
  ebanxGatewayToken: process.env.EBANX_GATEWAY_TOKEN_NEW || '',
  braintreeGatewayToken: process.env.BRAINTREE_GATEWAY_TOKEN_NEW || '',
  // PPCP interim spike — see ppcp/integration-plan/07-interim-direct-order-spike.md
  paypalPpcpClientId: process.env.PAYPAL_PPCP_CLIENT_ID_NEW || '',
  paypalPpcpClientSecret: process.env.PAYPAL_PPCP_CLIENT_SECRET_NEW || '',
  paypalApiBaseUrl:
    process.env.PAYPAL_API_BASE_URL_NEW || 'https://api-m.sandbox.paypal.com',
  // PPCP gateway — see ppcp/integration-plan/14-spreedly-pivot-plan.md §7Z
  ppcpGatewayToken: process.env.PPCP_GATEWAY_TOKEN_NEW || '',
  pazeCertificateToken: process.env.PAZE_CERTIFICATE_TOKEN || '',
  pazeClientId: process.env.PAZE_CLIENT_ID || '',
  pazeClientName: process.env.PAZE_CLIENT_NAME || '',
  pazeProfileId: process.env.PAZE_PROFILE_ID || '',
  pazeMobileLoginId: process.env.PAZE_MOBILE_LOGIN_ID || '',
  pazeSigningKid: process.env.PAZE_SIGNING_KID || '',
  pazeSigningPrivateKey: (process.env.PAZE_SIGNING_PRIVATE_KEY || '').replace(
    /\\n/g,
    '\n'
  ),
  pazeTokenUrl:
    process.env.PAZE_TOKEN_URL ||
    'https://auth.wallet.cat.earlywarning.io/token',
  pazeDemoApiKey: process.env.PAZE_DEMO_API_KEY || '',
  applePayMerchantId:
    process.env.APPLE_PAY_MERCHANT_ID || 'merchant.com.spreedly.example',
  applePayDisplayName:
    process.env.APPLE_PAY_DISPLAY_NAME || 'Spreedly Sample App',
  applePayDomain: process.env.APPLE_PAY_DOMAIN || new URL(publicAppOrigin).hostname,
  // Sandbox unless production is asked for by name.
  applePayEnvironment:
    process.env.APPLE_PAY_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
  // PEMs are stored on one line with \n escapes, like PAZE_SIGNING_PRIVATE_KEY.
  applePayMerchantIdentityCert: (
    process.env.APPLE_PAY_MERCHANT_IDENTITY_CERT || ''
  ).replace(/\\n/g, '\n'),
  applePayMerchantIdentityKey: (
    process.env.APPLE_PAY_MERCHANT_IDENTITY_KEY || ''
  ).replace(/\\n/g, '\n'),
  applePayDomainAssociation: process.env.APPLE_PAY_DOMAIN_ASSOCIATION || '',
  cashAppClientId: process.env.CASH_APP_CLIENT_ID_NEW || '',
  cashAppMerchantId: process.env.CASH_APP_MERCHANT_ID_NEW || '',
};

export default config;
