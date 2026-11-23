import crypto from 'crypto';
import { RequestHandler } from 'express';
import type { EdgeGuardConfig } from '../config';

const digest = (value: string): Buffer =>
  crypto.createHash('sha256').update(value).digest();

export const createEdgeGuard = (
  guard: EdgeGuardConfig,
  publicAppOrigin: string
): RequestHandler => {
  const expected = digest(guard.secret);
  return (req, res, next) => {
    const sent = req.header(guard.headerName);
    if (
      typeof sent === 'string' &&
      crypto.timingSafeEqual(digest(sent), expected)
    ) {
      next();
      return;
    }
    // if a old user tries to hit heroku url redirect it via fastly
    if (req.hostname.toLowerCase() === guard.herokuAppHost) {
      const status = req.method === 'GET' || req.method === 'HEAD' ? 301 : 308;
      res.redirect(status, `${publicAppOrigin}${req.originalUrl}`);
      return;
    }
    res.status(403).end();
  };
};
