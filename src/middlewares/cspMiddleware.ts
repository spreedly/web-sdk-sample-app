import { Request, Response, NextFunction } from 'express';
import config from '../config';
import { PAZE_ENVIRONMENTS } from '../paze/pazeClient';

const appConnectSources = config.publicAppOrigin;

// The web Paze page loads Paze's SDK from the host PAZE_ENVIRONMENT picks.
const pazeCheckoutOrigin = `https://${PAZE_ENVIRONMENTS[config.pazeEnvironment || 'cat'].checkoutHost}`;

export const cspMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'self' https://*.spreedly.com https://cdn.jsdelivr.net ${pazeCheckoutOrigin} https://checkout.paze.com https://applepay.cdn-apple.com https://pay.google.com`,
      "style-src 'self' 'unsafe-inline'",
      `connect-src 'self' ${appConnectSources} https://*.spreedly.com https://pci.browser-intake-datadoghq.com ${pazeCheckoutOrigin} https://checkout.paze.com https://pay.google.com`,
      `frame-src 'self' https://*.spreedly.com ${pazeCheckoutOrigin} https://checkout.paze.com https://applepay.cdn-apple.com https://pay.google.com`,
      "img-src 'self' data: https://applepay.cdn-apple.com",
      "font-src 'self'",
    ].join('; ')
  );
  next();
};

