import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  privateKey: string;
  certificateToken: string;
  spreedlyUrl: string;
  spreedlyEnvironmentKey: string;
  spreedlyAccessSecret: string;
  spreedlyGatewayToken: string;
  spreedlySCAProviderKey: string;
  paypalGatewayToken: string;
}

const config: Config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  privateKey: process.env.PRIVATE_KEY || '',
  certificateToken: process.env.CERTIFICATE_TOKEN || '',
  spreedlyUrl: process.env.SPREEDLY_URL || 'https://core.spreedly.com',
  spreedlyEnvironmentKey: process.env.SPREEDLY_ENVIRONMENT_KEY || '',
  spreedlyAccessSecret: process.env.SPREEDLY_ACCESS_SECRET || '',
  spreedlyGatewayToken: process.env.SPREEDLY_GATEWAY_TOKEN || '',
  spreedlySCAProviderKey: process.env.SPREEDLY_SCA_PROVIDER_KEY || '',
  paypalGatewayToken: process.env.PAYPAL_GATEWAY_TOKEN || '',
};

export default config;
