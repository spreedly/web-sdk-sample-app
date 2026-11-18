import dotenv from 'dotenv';

dotenv.config();

const PRODUCTION_SDK_BASE_URL = 'https://core.spreedly.com';

// Callers are this app's own pages. The SDK hosts never call it.
const TRUSTED_FRONTEND_ORIGINS = [
  'https://checkout-web-sample-app-049a3c617015.herokuapp.com',
];

const SDK_HOSTS = new Set(['core.spreedly.com', 'core-test.spreedly.com']);

export const isSdkHost = (hostname: string): boolean => SDK_HOSTS.has(hostname);

const resolveCorsAllowedOrigins = (): ReadonlySet<string> => {
  const allowed = new Set<string>(TRUSTED_FRONTEND_ORIGINS);
  const raw = process.env.CORS_ALLOWED_ORIGINS || '';
  for (const entry of raw.split(',')) {
    const candidate = entry.trim();
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (isSdkHost(url.hostname)) continue;
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      allowed.add(url.origin);
    } catch {
      console.warn('Ignoring invalid CORS_ALLOWED_ORIGINS entry');
    }
  }
  return allowed;
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
}

const config: Config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  spreedlyUrl: process.env.SPREEDLY_URL || 'https://core.spreedly.com',
  sdkBaseUrl: resolveSdkBaseUrl(),
  corsAllowedOrigins: resolveCorsAllowedOrigins(),
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
  applePayDomain:
    process.env.APPLE_PAY_DOMAIN ||
    'checkout-web-sample-app-049a3c617015.herokuapp.com',
  applePayEnvironment:
    process.env.APPLE_PAY_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'production',
  // PEMs are stored on one line with \n escapes, like PAZE_SIGNING_PRIVATE_KEY.
  applePayMerchantIdentityCert: (
    process.env.APPLE_PAY_MERCHANT_IDENTITY_CERT || ''
  ).replace(/\\n/g, '\n'),
  applePayMerchantIdentityKey: (
    process.env.APPLE_PAY_MERCHANT_IDENTITY_KEY || ''
  ).replace(/\\n/g, '\n'),
  applePayDomainAssociation: process.env.APPLE_PAY_DOMAIN_ASSOCIATION || '',
};

export default config;
