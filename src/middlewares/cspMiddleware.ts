import { Request, Response, NextFunction } from 'express';

export const cspMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://*.spreedly.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.spreedly.com https://checkout-web-sample-app-049a3c617015.herokuapp.com",
      "frame-src 'self' https://*.spreedly.com",
      "img-src 'self' data:",
      "font-src 'self'",
    ].join('; ')
  );
  next();
};
