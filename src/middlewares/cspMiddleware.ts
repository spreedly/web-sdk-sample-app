import { Request, Response, NextFunction } from 'express';
import config from '../config';

const appConnectSources = config.publicAppOrigin

export const cspMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://*.spreedly.com https://cdn.jsdelivr.net https://checkout.wallet.cat.earlywarning.io https://checkout.paze.com https://applepay.cdn-apple.com https://pay.google.com",
      "style-src 'self' 'unsafe-inline'",
      `connect-src 'self' ${appConnectSources} https://*.spreedly.com https://pci.browser-intake-datadoghq.com https://checkout.wallet.cat.earlywarning.io https://checkout.paze.com https://pay.google.com`,
      "frame-src 'self' https://*.spreedly.com https://checkout.wallet.cat.earlywarning.io https://checkout.paze.com https://applepay.cdn-apple.com https://pay.google.com",
      "img-src 'self' data: https://applepay.cdn-apple.com",
      "font-src 'self'",
    ].join('; ')
  );
  next();
};

