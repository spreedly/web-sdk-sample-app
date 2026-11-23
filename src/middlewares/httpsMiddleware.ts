import { RequestHandler } from 'express';
import config from '../config';

const HSTS_HEADER = 'max-age=31536000; includeSubDomains';

const forwardedProto = (header: string | undefined): string | undefined =>
  header?.split(',')[0]?.trim().toLowerCase();

export const httpsMiddleware: RequestHandler = (req, res, next) => {
  const proto = forwardedProto(req.header('x-forwarded-proto'));
  if (proto === undefined || proto === 'https') {
    if (proto === 'https') {
      res.setHeader('Strict-Transport-Security', HSTS_HEADER);
    }
    next();
    return;
  }

  // Redirect to the configured origin, not the Host header, so the redirect can't be pointed
  // off the app. 308 keeps the method for POSTs; browsers then retry over https.
  const status = req.method === 'GET' || req.method === 'HEAD' ? 301 : 308;
  res.redirect(status, `${config.publicAppOrigin}${req.originalUrl}`);
};
