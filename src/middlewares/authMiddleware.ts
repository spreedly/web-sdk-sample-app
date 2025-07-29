import { Request, Response, NextFunction } from 'express';
import { apiKeys } from '../models/apiKeys';
import { getCurrentTimeInDays } from '../utils/date';

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.method === 'GET' && req.path === '/api/auth/get-api-key') {
    return next();
  }

  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ message: 'Unauthorized: API key is required' });
  }

  const key = apiKeys.getApiKeys().find((item) => item.key === apiKey);
  if (!key) {
    return res.status(401).json({ message: 'Unauthorized: Invalid API key' });
  }

  if (key.expiresAt < getCurrentTimeInDays()) {
    return res.status(401).json({ message: 'Unauthorized: API key expired' });
  }

  return next();
};
