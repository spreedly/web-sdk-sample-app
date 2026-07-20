import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  spreedlyUrl: string;
  privateKey: string;
  certificateToken: string;
  spreedlyEnvironmentKey: string;
  spreedlyAccessSecret: string;
  spreedlyGatewayToken: string;
  spreedlySCAProviderKey: string;
  stripeGatewayToken: string;
  paypalGatewayToken: string;
  ebanxGatewayToken: string;
  braintreeGatewayToken: string;
  // PPCP (PayPal Complete Payments) — interim direct-to-PayPal spike (sandbox).
  paypalPpcpClientId: string;
  paypalPpcpClientSecret: string;
  paypalApiBaseUrl: string;
}

const config: Config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  spreedlyUrl: process.env.SPREEDLY_URL || 'https://core.spreedly.com',
  privateKey: process.env.PRIVATE_KEY_NEW || '',
  certificateToken: process.env.CERTIFICATE_TOKEN_NEW || '',
  spreedlyEnvironmentKey: process.env.SPREEDLY_ENVIRONMENT_KEY_NEW || '',
  spreedlyAccessSecret: process.env.SPREEDLY_ACCESS_SECRET_NEW || '',
  spreedlyGatewayToken: process.env.SPREEDLY_GATEWAY_TOKEN_NEW || '',
  spreedlySCAProviderKey: process.env.SPREEDLY_SCA_PROVIDER_KEY_NEW || '',
  stripeGatewayToken: process.env.STRIPE_GATEWAY_TOKEN_NEW || '',
  paypalGatewayToken: process.env.PAYPAL_GATEWAY_TOKEN_NEW || '',
  ebanxGatewayToken: process.env.EBANX_GATEWAY_TOKEN_NEW || '',
  braintreeGatewayToken: process.env.BRAINTREE_GATEWAY_TOKEN_NEW || '',
  // PPCP interim spike — see ppcp/integration-plan/07-interim-direct-order-spike.md
  paypalPpcpClientId: process.env.PAYPAL_PPCP_CLIENT_ID_NEW || '',
  paypalPpcpClientSecret: process.env.PAYPAL_PPCP_CLIENT_SECRET_NEW || '',
  paypalApiBaseUrl:
    process.env.PAYPAL_API_BASE_URL_NEW || 'https://api-m.sandbox.paypal.com',
};

export default config;
