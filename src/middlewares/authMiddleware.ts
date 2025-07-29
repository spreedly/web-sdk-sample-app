import { Request, Response, NextFunction } from 'express';
import { getCurrentTimeInDays } from '../utils/date';
import { db } from '../services/db';

interface APIKey {
  apiKey: string;
  expiryIndays: number;
}

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

  const sql = `SELECT * FROM api_keys WHERE apiKey = ?;`;
  db.get<APIKey>(sql, [apiKey], (err, row) => {
    if (err) {
      return res.status(500).json({ message: 'Database error', error: err.message });
    }
    if (!row) {
      return res.status(401).json({ message: 'Unauthorized: Invalid API key' });
    }
    if (row.expiryIndays < getCurrentTimeInDays()) {
      return res.status(401).json({ message: 'Unauthorized: API key expired' });
    }
    return next();
  });
};
