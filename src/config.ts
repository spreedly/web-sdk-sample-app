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
}

const config: Config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  privateKey: process.env.PRIVATE_KEY || '',
  certificateToken: process.env.CERTIFICATE_TOKEN || '',
  spreedlyUrl: process.env.SPREEDLY_URL || 'https://core.spreedly.com',
  spreedlyEnvironmentKey: process.env.SPREEDLY_ENVIRONMENT_KEY || '',
  spreedlyAccessSecret: process.env.SPREEDLY_ACCESS_SECRET || '',
};

export default config;
