import { expect, test } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { createEdgeGuard } from '../../src/middlewares/edgeGuardMiddleware';

// Runs the edge guard in its own app on a random port, with a made-up secret, so the suite needs
// no .env and never sends a real secret anywhere. Never put the real secret in extraHTTPHeaders:
// the browser would send it to the SDK and third-party hosts too.

const GUARD = {
  secret: 'edge-guard-test-secret-'.padEnd(40, 'x'),
  headerName: 'x-edge-secret',
  herokuAppHost: 'example-app.herokuapp.com',
};
const PUBLIC_APP_ORIGIN = 'https://checkout.example.test';
const PUBLIC_HOST = new URL(PUBLIC_APP_ORIGIN).host;

let server: Server;
let baseURL: string;

test.beforeAll(async () => {
  const app = express();
  app.get('/healthz', (_req, res) => {
    res.set('Cache-Control', 'no-store').type('text/plain').send('ok');
  });
  app.use(createEdgeGuard(GUARD, PUBLIC_APP_ORIGIN));
  app.all('/{*path}', (_req, res) => {
    res.send('app');
  });
  server = await new Promise<Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const withSecret = (host: string, secret = GUARD.secret) => ({
  Host: host,
  [GUARD.headerName]: secret,
});

test.describe('Requests on the herokuapp host without the Fastly header are redirected', () => {
  test('GET gets a 301 to the public origin, path and query kept', async ({ request }) => {
    const response = await request.get(`${baseURL}/purchase/?sdk=hosted-fields`, {
      headers: { Host: GUARD.herokuAppHost },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toBe(`${PUBLIC_APP_ORIGIN}/purchase/?sdk=hosted-fields`);
  });

  test('POST gets a 308', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/v1/simple-purchase`, {
      headers: { Host: GUARD.herokuAppHost },
      data: {},
      maxRedirects: 0,
    });
    expect(response.status()).toBe(308);
    expect(response.headers()['location']).toBe(`${PUBLIC_APP_ORIGIN}/api/v1/simple-purchase`);
  });

  test('a wrong header is redirected too', async ({ request }) => {
    const response = await request.get(`${baseURL}/`, {
      headers: withSecret(GUARD.herokuAppHost, 'wrong'),
      maxRedirects: 0,
    });
    expect(response.status()).toBe(301);
  });

  test('the Host header casing does not matter', async ({ request }) => {
    const response = await request.get(`${baseURL}/`, {
      headers: { Host: GUARD.herokuAppHost.toUpperCase() },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(301);
  });

  test('with the header, the herokuapp host is served (Fastly forwarding with that Host)', async ({
    request,
  }) => {
    const response = await request.get(`${baseURL}/`, {
      headers: withSecret(GUARD.herokuAppHost),
      maxRedirects: 0,
    });
    expect(response.status()).toBe(200);
  });
});

test.describe('Requests on any other host without the Fastly header are refused', () => {
  test('no header gets a 403', async ({ request }) => {
    const response = await request.get(`${baseURL}/`, { headers: { Host: PUBLIC_HOST } });
    expect(response.status()).toBe(403);
  });

  test('a wrong header gets a 403', async ({ request }) => {
    const response = await request.get(`${baseURL}/`, { headers: withSecret(PUBLIC_HOST, 'wrong') });
    expect(response.status()).toBe(403);
  });

  test('a wrong header of the same length gets a 403', async ({ request }) => {
    const sameLength = 'y'.repeat(GUARD.secret.length);
    const response = await request.get(`${baseURL}/`, { headers: withSecret(PUBLIC_HOST, sameLength) });
    expect(response.status()).toBe(403);
  });

  test('a POST without the header gets a 403', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/v1/simple-purchase`, {
      headers: { Host: PUBLIC_HOST },
      data: {},
    });
    expect(response.status()).toBe(403);
  });

  test('the 403 is empty and does not echo the header', async ({ request }) => {
    const response = await request.get(`${baseURL}/`, { headers: withSecret(PUBLIC_HOST, 'wrong') });
    expect(await response.text()).toBe('');
  });
});

test.describe('Requests with the Fastly header are served', () => {
  test('GET on the public host', async ({ request }) => {
    const response = await request.get(`${baseURL}/purchase/`, { headers: withSecret(PUBLIC_HOST) });
    expect(response.status()).toBe(200);
    expect(await response.text()).toBe('app');
  });

  test('POST on the public host', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/v1/simple-purchase`, {
      headers: withSecret(PUBLIC_HOST),
      data: {},
    });
    expect(response.status()).toBe(200);
  });
});

test.describe('The health check needs no Fastly header', () => {
  for (const host of [PUBLIC_HOST, GUARD.herokuAppHost]) {
    test(`GET /healthz on ${host}`, async ({ request }) => {
      const response = await request.get(`${baseURL}/healthz`, { headers: { Host: host }, maxRedirects: 0 });
      expect(response.status()).toBe(200);
      expect(await response.text()).toBe('ok');
    });
  }
});

test.describe('A forged Host does not move the redirect off the app', () => {
  test('Location stays on the public origin', async ({ request }) => {
    const response = await request.get(`${baseURL}/x`, {
      headers: { Host: `${GUARD.herokuAppHost}.attacker.example` },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(403);
    expect(response.headers()['location']).toBeUndefined();
  });
});
