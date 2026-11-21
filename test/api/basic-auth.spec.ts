import { expect, test } from '@playwright/test';
import express from 'express';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { createBasicAuth } from '../../src/middlewares/basicAuthMiddleware';

// Runs the staging login in its own app on a random port, with a made-up login, so the suite needs
// no .env and never sends a real password anywhere.

const AUTH = { user: 'demo', password: 'staging-login-test-password' };
const APPLE_FILE = '/.well-known/apple-developer-merchantid-domain-association';

let server: Server;
let baseURL: string;

test.beforeAll(async () => {
  const app = express();
  app.use(createBasicAuth(AUTH));
  app.all('/{*path}', (_req, res) => {
    res.send('app');
  });
  server = await new Promise<Server>(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

const basic = (user: string, password: string) => ({
  Authorization: `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`,
});

test.describe('Requests without the right login get a 401 challenge', () => {
  const refused: [string, Record<string, string>][] = [
    ['no Authorization header', {}],
    ['a wrong password', basic(AUTH.user, 'wrong-password-wrong-password')],
    ['a wrong user', basic('someone', AUTH.password)],
    ['an empty login', basic('', '')],
    ['a Bearer token', { Authorization: 'Bearer abc' }],
    [
      'Basic without a colon',
      { Authorization: `Basic ${Buffer.from('demo').toString('base64')}` },
    ],
  ];

  for (const [name, headers] of refused) {
    test(name, async ({ request }) => {
      const response = await request.get(`${baseURL}/purchase/`, { headers });
      expect(response.status()).toBe(401);
      expect(response.headers()['www-authenticate']).toBe(
        'Basic realm="Spreedly sample app (staging)", charset="UTF-8"'
      );
      expect(response.headers()['cache-control']).toBe('no-store');
      expect(await response.text()).toBe('');
    });
  }

  test('API routes need the login too', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/v1/auth/params`);
    expect(response.status()).toBe(401);
  });
});

test.describe('The right login is let through', () => {
  test('GET a page', async ({ request }) => {
    const response = await request.get(`${baseURL}/purchase/`, {
      headers: basic(AUTH.user, AUTH.password),
    });
    expect(response.status()).toBe(200);
    expect(await response.text()).toBe('app');
  });

  test('POST an API route', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/v1/simple-purchase`, {
      headers: basic(AUTH.user, AUTH.password),
      data: {},
    });
    expect(response.status()).toBe(200);
  });

  test('a password with a colon in it', async ({ request }) => {
    const server2 = express();
    server2.use(
      createBasicAuth({ user: 'demo', password: 'pass:word:with:colons' })
    );
    server2.get('/', (_req, res) => {
      res.send('app');
    });
    const s = await new Promise<Server>(resolve => {
      const listening = server2.listen(0, '127.0.0.1', () =>
        resolve(listening)
      );
    });
    try {
      const url = `http://127.0.0.1:${(s.address() as AddressInfo).port}/`;
      const response = await request.get(url, {
        headers: basic('demo', 'pass:word:with:colons'),
      });
      expect(response.status()).toBe(200);
    } finally {
      await new Promise(resolve => s.close(resolve));
    }
  });
});

test.describe('Callers that cannot log in are let through', () => {
  test('Spreedly offsite callback', async ({ request }) => {
    const response = await request.post(`${baseURL}/api/v1/offsite-callback`, {
      data: {},
    });
    expect(response.status()).toBe(200);
  });

  test('Apple Pay domain verification file', async ({ request }) => {
    expect((await request.get(`${baseURL}${APPLE_FILE}`)).status()).toBe(200);
    expect((await request.get(`${baseURL}${APPLE_FILE}.txt`)).status()).toBe(
      200
    );
  });

  test('a path that only starts like an open one still needs the login', async ({
    request,
  }) => {
    const response = await request.post(
      `${baseURL}/api/v1/offsite-callback-other`,
      { data: {} }
    );
    expect(response.status()).toBe(401);
  });
});
