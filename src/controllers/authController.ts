import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import config from '../config';

export const getAuthParams = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const privateKey = config.privateKey;
    const certificateToken = config.certificateToken;
    const uuid = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);
    const signatureData = `${uuid}${timestamp}${certificateToken}`;

    if (!privateKey || !certificateToken) {
      console.error('Error: PRIVATE_KEY and CERTIFICATE_TOKEN environment variables are required');
      throw new Error('PRIVATE_KEY and CERTIFICATE_TOKEN environment variables are required');
    }

    try {
      const sign = crypto.createSign('SHA256');
      sign.write(signatureData);
      const signature = sign.sign(privateKey, 'base64');
      res.json({ nonce: uuid, timestamp, signature, certificateToken });
    } catch (error) {
      console.error('Error generating signature:', error);
      throw new Error('Error generating signature');
    }
  } catch (error) {
    next(error);
  }
};
