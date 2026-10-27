import { Request, Response, NextFunction } from 'express';

export const cspMiddleware = (req: Request, res: Response, next: NextFunction) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://*.spreedly.com https://cdn.jsdelivr.net https://checkout.wallet.cat.earlywarning.io https://checkout.paze.com https://sandbox.kit.cash.app https://kit.cash.app",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.spreedly.com https://pci.browser-intake-datadoghq.com https://checkout-web-sample-app-049a3c617015.herokuapp.com https://checkout.wallet.cat.earlywarning.io https://checkout.paze.com https://sandbox.kit.cash.app https://kit.cash.app",
      "frame-src 'self' https://*.spreedly.com https://checkout.wallet.cat.earlywarning.io https://checkout.paze.com https://sandbox.kit.cash.app https://kit.cash.app",
      "img-src 'self' data:",
      "font-src 'self'",
    ].join('; ')
  );
  next();
};

