import { Request, Response } from 'express';
import config from '../config';
import { PAZE_ENVIRONMENTS } from '../paze/pazeClient';

// GET /api/v1/paze/web-config
// The Paze client settings and wallet host the web demo page needs, so it follows
// PAZE_ENVIRONMENT like the mobile session routes. None of these are secret: Paze's web SDK
// puts them in the page.
export const getPazeWebConfig = (_req: Request, res: Response): void => {
  res.set('Cache-Control', 'no-store');
  if (
    !config.pazeEnvironment ||
    !config.pazeClientId ||
    !config.pazeClientName ||
    !config.pazeProfileId
  ) {
    res.status(503).json({ error: 'not_configured' });
    return;
  }
  res.json({
    environment: config.pazeEnvironment,
    checkoutHost: PAZE_ENVIRONMENTS[config.pazeEnvironment].checkoutHost,
    clientConfig: {
      id: config.pazeClientId,
      name: config.pazeClientName,
      profileId: config.pazeProfileId,
    },
  });
};
