import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  privateKey: string;
  certificateToken: string;
}

const config: Config = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  privateKey: process.env.PRIVATE_KEY || '',
  certificateToken: process.env.CERTIFICATE_TOKEN || '',
};

export default config;
