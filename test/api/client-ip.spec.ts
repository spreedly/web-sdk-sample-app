import { expect, test } from '@playwright/test';
import express from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { clientIp } from '../../src/clientIp';
import { createEdgeGuard } from '../../src/middlewares/edgeGuardMiddleware';

// Runs the edge guard and a limiter keyed like the app's (10 a minute per clientIp) in their own app on
// a random port, with a made-up secret, so the suite needs no .env.

const GUARD = {
  secret: 'client-ip-test-secret-'.padEnd(40, 'x'),
  headerName: 'x-edge-secret',
  herokuAppHost: 'example-app.herokuapp.com',
};
const PUBLIC_HOST = 'checkout.example.test';
const LIMIT = 10;

let server: Server;
let baseURL: string;

test.beforeAll(async () => {
  const app = express();
  app.use(createEdgeGuard(GUARD, `https://${PUBLIC_HOST}`));
  app.post(
    '/limited',
    rateLimit({
      windowMs: 60_000,
      limit: LIMIT,
      keyGenerator: req => ipKeyGenerator(clientIp(req, true)),
      validate: { xForwardedForHeader: false },
    }),
    (_req, res) => {
      res.send('ok');
    }
  );
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const throughFastly = (clientIpHeader: string, extra: Record<string, string> = {}) => ({
  Host: PUBLIC_HOST,
  [GUARD.headerName]: GUARD.secret,
  'Fastly-Client-IP': clientIpHeader,
  ...extra,
});

test.describe('Behind Fastly, rate limits use Fastly-Client-IP', () => {
  test('the request after the limit from one client gets a 429', async ({ request }) => {
    for (let i = 0; i < LIMIT; i++) {
      const response = await request.post(`${baseURL}/limited`, {
        headers: throughFastly('203.0.113.10'),
      });
      expect(response.status()).toBe(200);
    }
    const response = await request.post(`${baseURL}/limited`, {
      headers: throughFastly('203.0.113.10'),
    });
    expect(response.status()).toBe(429);
  });

  test('another client on the same Fastly node is not limited', async ({ request }) => {
    for (let i = 0; i < LIMIT; i++) {
      await request.post(`${baseURL}/limited`, {
        headers: throughFastly('203.0.113.20', { 'X-Forwarded-For': '198.51.100.1' }),
      });
    }
    const response = await request.post(`${baseURL}/limited`, {
      headers: throughFastly('203.0.113.21', { 'X-Forwarded-For': '198.51.100.1' }),
    });
    expect(response.status()).toBe(200);
  });

  test('changing X-Forwarded-For does not get around the limit', async ({ request }) => {
    for (let i = 0; i <= LIMIT; i++) {
      const response = await request.post(`${baseURL}/limited`, {
        headers: throughFastly('203.0.113.30', { 'X-Forwarded-For': `198.51.100.${i}` }),
      });
      expect(response.status()).toBe(i < LIMIT ? 200 : 429);
    }
  });
});

test.describe('clientIp', () => {
  const fakeRequest = (headers: Record<string, string>, remoteAddress = '127.0.0.1') =>
    ({
      get: (name: string) => headers[name.toLowerCase()],
      socket: { remoteAddress },
    }) as unknown as express.Request;

  test('behind Fastly, a missing Fastly-Client-IP falls into one shared bucket', () => {
    expect(clientIp(fakeRequest({ 'x-forwarded-for': '198.51.100.1' }), true)).toBe(
      'missing-fastly-client-ip'
    );
  });

  test('without Fastly, it uses the last X-Forwarded-For entry', () => {
    expect(
      clientIp(
        fakeRequest({ 'x-forwarded-for': '198.51.100.1, 198.51.100.2', 'fastly-client-ip': '203.0.113.1' }),
        false
      )
    ).toBe('198.51.100.2');
  });

  test('without Fastly or X-Forwarded-For, it uses the socket address', () => {
    expect(clientIp(fakeRequest({}, '192.0.2.5'), false)).toBe('192.0.2.5');
  });
});
