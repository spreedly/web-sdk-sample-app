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
  spreedlySCAProviderKeyTestScenario: string;
  stripeGatewayToken: string;
  paypalGatewayToken: string;
  ebanxGatewayToken: string;
  braintreeGatewayToken: string;
  pazeCertificateToken: string;
  pazeClientId: string;
  pazeClientName: string;
  pazeProfileId: string;
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
  spreedlySCAProviderKeyTestScenario: process.env.SPREEDLY_SCA_PROVIDER_KEY_TEST_SCENARIO_NEW || '',
  stripeGatewayToken: process.env.STRIPE_GATEWAY_TOKEN_NEW || '',
  paypalGatewayToken: process.env.PAYPAL_GATEWAY_TOKEN_NEW || '',
  ebanxGatewayToken: process.env.EBANX_GATEWAY_TOKEN_NEW || '',
  braintreeGatewayToken: process.env.BRAINTREE_GATEWAY_TOKEN_NEW || '',
  pazeCertificateToken: process.env.PAZE_CERTIFICATE_TOKEN || '',
  pazeClientId: process.env.PAZE_CLIENT_ID || '',
  pazeClientName: process.env.PAZE_CLIENT_NAME || '',
  pazeProfileId: process.env.PAZE_PROFILE_ID || '',
};

export default config;
