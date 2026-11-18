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
