import { RequestHandler } from 'express';
import cors from 'cors';
import config, { isSdkHost } from '../config';

export const isAllowedCorsOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  if (isSdkHost(parsed.hostname)) return false;
  return config.corsAllowedOrigins.has(parsed.origin);
};

// cors() gets the allowlist itself, so it only ever echoes an origin on that list.
const allowlistedCors = cors({ origin: Array.from(config.corsAllowedOrigins) });

export const corsMiddleware: RequestHandler = (req, res, next) => {
  if (!isAllowedCorsOrigin(req.header('origin'))) {
    res.status(403).end();
    return;
  }
  allowlistedCors(req, res, next);
};
