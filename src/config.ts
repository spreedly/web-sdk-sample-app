import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  privateKey: string;
  certificateToken: string;
  apiKeyExpiryDays: number;
  dbSource: string;
}

const config: Config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  privateKey: process.env.PRIVATE_KEY || '',
  certificateToken: process.env.CERTIFICATE_TOKEN || '',
  apiKeyExpiryDays: Number(process.env.API_KEY_EXPIRY_DAYS) || 30, // Default 30 days
  dbSource: process.env.DB_SOURCE || 'database.db',
};

export default config;
