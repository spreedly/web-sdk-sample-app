import { expect, test } from '@playwright/test';
import { PAZE_ENVIRONMENTS } from '../../src/paze/pazeClient';

// Runs against whatever PAZE_ENVIRONMENT the server has, so it checks the shape and that the
// wallet host matches the environment.
test.describe('GET /paze/web-config', () => {
  test('returns the client settings and the wallet host for the environment', async ({
    request,
  }) => {
    const response = await request.get('/api/v1/paze/web-config');
    expect(response.headers()['cache-control']).toBe('no-store');

    if (response.status() === 503) {
      expect(await response.json()).toEqual({ error: 'not_configured' });
      return;
    }

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Object.keys(PAZE_ENVIRONMENTS)).toContain(body.environment);
    expect(body.checkoutHost).toBe(
      PAZE_ENVIRONMENTS[body.environment as keyof typeof PAZE_ENVIRONMENTS]
        .checkoutHost
    );
    expect(body.clientConfig).toEqual({
      id: expect.any(String),
      name: expect.any(String),
      profileId: expect.any(String),
    });
  });
});
