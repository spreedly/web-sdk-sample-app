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
  spreedlyEnvironmentKey: process.env.SPREEDLY_ENVIRONMENT_KEY || '0RMACG59RG8VQ9A4G09QDD3F1Q',
  spreedlyAccessSecret: process.env.SPREEDLY_ACCESS_SECRET || 'lDDszZajmJS6pPWBcRzZPe7ql6a87YBlFAFuqPpu85I44tTuxEtlx9QiuR9dhBCO',
};

export default config;
