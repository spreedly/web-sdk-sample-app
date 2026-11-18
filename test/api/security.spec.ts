import { expect, test } from '@playwright/test';

// Requests that must be refused before the app calls Spreedly Core. None of these reach Core,
// so the suite needs no Spreedly credentials and makes no transactions.

// Transaction tokens that try to leave /v1/transactions/:token. Every one is a single URL
// segment, so the app's route matches it and the token check has to refuse it.
const BAD_TOKENS = [
  '..%2Fgateways',
  '..%2F..%2Fv1%2Fgateways.json%3F',
  '..%2F..%2Fv1%2Freceivers.json%3F',
  '%2e%2e%2Fgateways',
  '..%252Fgateways',
  'abc%2Fdef',
  'abc%3Fx%3D1',
  'abc%23x',
  'abc_def',
  'abc-def',
  'a'.repeat(65),
];

const ATTACKER_URL = 'https://attacker.example/return';

test.describe('Transaction routes refuse tokens that are not letters and digits', () => {
  for (const token of BAD_TOKENS) {
    test(`GET /transactions/${token}`, async ({ request }) => {
      const response = await request.get(`/api/v1/transactions/${token}`);
      expect(response.status()).toBe(400);
    });

    test(`POST /transactions/${token}/complete`, async ({ request }) => {
      const response = await request.post(`/api/v1/transactions/${token}/complete`, { data: {} });
      expect(response.status()).toBe(400);
    });

    test(`POST /transactions/${token}/confirm`, async ({ request }) => {
      const response = await request.post(`/api/v1/transactions/${token}/confirm`, {
        data: { state: 'Successful', nonce: 'x', payment_method_type: 'paypal' },
      });
      expect(response.status()).toBe(400);
    });
  }
});

test.describe('Proxy routes are gone', () => {
  test('POST /payment_methods (tokenize proxy)', async ({ request }) => {
    const response = await request.post('/api/v1/payment_methods', {
      headers: { 'spreedly-environment-key': 'x' },
      data: { payment_method: {} },
    });
    expect(response.status()).toBe(404);
  });

  test('POST /payment_methods/:token/recache (recache proxy)', async ({ request }) => {
    const response = await request.post('/api/v1/payment_methods/abc123/recache', {
      headers: { 'spreedly-environment-key': 'x' },
      data: { payment_method: {} },
    });
    expect(response.status()).toBe(404);
  });
});

test.describe('Retain needs the owner secret of the tab that made the card', () => {
  // Refused before any Core call, so these need no Spreedly credentials.
  test('no owner_secret is refused', async ({ request }) => {
    const response = await request.put('/api/v1/payment_methods/abc123/retain');
    expect(response.status()).toBe(403);
  });

  test('a malformed owner_secret is refused', async ({ request }) => {
    for (const owner_secret of ['short', 'x'.repeat(129), 'a/b/c/d/e/f/g/h/i', 12345678901234567]) {
      const response = await request.put('/api/v1/payment_methods/abc123/retain', { data: { owner_secret } });
      expect(response.status()).toBe(403);
    }
  });

  test('a bad token is still a 400', async ({ request }) => {
    const response = await request.put('/api/v1/payment_methods/..%2Fgateways/retain', {
      data: { owner_secret: '00000000-0000-4000-8000-000000000000' },
    });
    expect(response.status()).toBe(400);
  });
});

test.describe('No shared list of saved cards', () => {
  test('GET /payment_methods is gone', async ({ request }) => {
    const response = await request.get('/api/v1/payment_methods');
    expect(response.status()).toBe(404);
  });
});

test.describe('Request bodies are capped at 32 KB', () => {
  test('a 33 KB JSON body is refused', async ({ request }) => {
    const response = await request.post('/api/v1/simple-purchase', {
      data: { amount: 100, payment_method_token: 'abc', padding: 'x'.repeat(33 * 1024) },
    });
    expect(response.status()).toBe(413);
  });

  test('a normal body is still read', async ({ request }) => {
    const response = await request.post('/api/v1/offsite-purchase', {
      data: { payment_method_token: 'abc', amount: 100, redirect_url: 'https://attacker.example/' },
    });
    // 400 from the redirect check proves the body was parsed, not refused for size.
    expect(response.status()).toBe(400);
  });
});

test.describe('Offsite routes refuse a redirect_url off this app', () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['/api/v1/offsite-purchase', { payment_method_token: 'abc', amount: 100, redirect_url: ATTACKER_URL }],
    ['/api/v1/stripe-apm-purchase', { amount: 100, redirect_url: ATTACKER_URL }],
    ['/api/v1/braintree-purchase', { amount: 100, redirect_url: ATTACKER_URL }],
    [
      '/api/v1/create-purchase',
      { gateway: 'ebanx', transaction: { payment_method_token: 'abc', amount: 100, redirect_url: ATTACKER_URL } },
    ],
    ['/api/v1/ppcp/spreedly/orders', { amount: '10.00', redirect_url: ATTACKER_URL }],
    ['/api/v1/ppcp/spreedly/vault/setup', { redirect_url: ATTACKER_URL }],
  ];

  for (const [path, body] of cases) {
    test(`POST ${path}`, async ({ request }) => {
      const response = await request.post(path, { data: body });
      expect(response.status()).toBe(400);
    });
  }

  test('a javascript: redirect_url is refused', async ({ request }) => {
    const response = await request.post('/api/v1/offsite-purchase', {
      data: { payment_method_token: 'abc', amount: 100, redirect_url: 'javascript:alert(1)' },
    });
    expect(response.status()).toBe(400);
  });

  test('a look-alike host is refused', async ({ request }) => {
    const response = await request.post('/api/v1/offsite-purchase', {
      data: {
        payment_method_token: 'abc',
        amount: 100,
        redirect_url: 'https://checkout-web-sample-app-049a3c617015.herokuapp.com.attacker.example/',
      },
    });
    expect(response.status()).toBe(400);
  });
});

test.describe('Errors do not echo the request body', () => {
  test('malformed JSON gets a generic 400', async ({ request }) => {
    const response = await request.post('/api/v1/simple-purchase', {
      headers: { 'Content-Type': 'application/json' },
      data: '{"payment_method": {"number": "4111111111111111", "verification_value": "123"',
    });
    expect(response.status()).toBe(400);
    const text = await response.text();
    expect(text).not.toContain('4111111111111111');
  });
});

test.describe('Plain HTTP is redirected to HTTPS, and HTTPS sends HSTS', () => {
  // Against Heroku, ask for the http:// URL and let the router set X-Forwarded-Proto. Locally there
  // is no router, so send the header the router would have sent.
  const plainHttp = (baseURL: string | undefined, path: string) => {
    const base = new URL(baseURL ?? '');
    return base.protocol === 'https:'
      ? { url: `http://${base.host}${path}`, headers: {} }
      : { url: path, headers: { 'X-Forwarded-Proto': 'http' } };
  };

  test('GET over http gets a 301 to https', async ({ request, baseURL }) => {
    const { url, headers } = plainHttp(baseURL, '/purchase/?sdk=hosted-fields');
    const response = await request.get(url, { headers, maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers()['location']).toMatch(/^https:\/\/[^/]+\/purchase\/\?sdk=hosted-fields$/);
  });

  test('POST over http gets a 308, not a 200', async ({ request, baseURL }) => {
    const { url, headers } = plainHttp(baseURL, '/api/v1/simple-purchase');
    const response = await request.post(url, { headers, data: {}, maxRedirects: 0 });
    expect(response.status()).toBe(308);
    expect(response.headers()['location']).toMatch(/^https:\/\//);
  });

  test('a forged Host header does not move the redirect off the app', async ({ request, baseURL }) => {
    const { url, headers } = plainHttp(baseURL, '/');
    const response = await request.get(url, {
      headers: { ...headers, Host: 'attacker.example' },
      maxRedirects: 0,
    });
    expect(response.headers()['location'] ?? '').not.toContain('attacker.example');
  });

  test('https responses carry Strict-Transport-Security', async ({ request, baseURL }) => {
    const headers = new URL(baseURL ?? '').protocol === 'https:' ? {} : { 'X-Forwarded-Proto': 'https' };
    const response = await request.get('/', { headers });
    expect(response.headers()['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
  });
});
