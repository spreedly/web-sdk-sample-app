import { expect, test } from '@playwright/test';
import { generateKeyPairSync, randomBytes } from 'crypto';
import {
  BackendError,
  PazeCheckoutService,
  SpreedlyApiError,
} from '../../src/paze/checkoutService';
import {
  deriveClientContext,
  generateSessionId,
  parseClientContextKey,
  SESSION_ID_PATTERN,
} from '../../src/paze/clientContext';
import {
  PazeApiError,
  PazeCallLog,
  PazeClient,
  PazeInvalidResponseError,
  PazeUnavailableError,
} from '../../src/paze/pazeClient';
import { PazeSessionStore } from '../../src/paze/sessionStore';
import {
  createHttpsTransport,
  TransportError,
  TransportRequest,
  TransportResponse,
} from '../../src/paze/transport';

// The backend-mediated Paze checkout, driven with a fake Paze and a fake Spreedly. Imports only
// src/paze, never src/config, so the suite needs no .env and makes no network calls.
// Every value here is synthetic.

const CAT_EAST = 'https://mobile-east.wallet.cat.earlywarning.io';
const CAT_WEST = 'https://mobile.wallet.cat.earlywarning.io';
const TOKEN_URL = 'https://auth.wallet.cat.earlywarning.io/token';
const CHECKOUT_URL =
  'https://checkout.wallet.cat.earlywarning.io/checkout?s=abc';
const SCHEME = 'com.example.merchant.paze';
const CALLER = 'caller-a';
const KEY = randomBytes(32);
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const SIGNING_KEY = privateKey
  .export({ type: 'pkcs8', format: 'pem' })
  .toString();

// Synthetic secrets the logs must never contain.
const ACCESS_TOKEN = 'synthetic-access-token-123';
const CODE = 'synthetic-checkout-code-456';
const SECURED_PAYLOAD = 'synthetic.secured.payload.789';
const EMAIL = 'shopper@example.com';

type Reply = TransportResponse | TransportError;
type Handler = (request: TransportRequest, index: number) => Reply;

const json = (status: number, body: unknown): TransportResponse => ({
  status,
  headers: {},
  body: Buffer.from(JSON.stringify(body)),
});

const pathOf = (url: string) => new URL(url).pathname.split('/').pop();

// A fake Paze: tokens by default, and a scripted reply list per step.
class FakePaze {
  calls: TransportRequest[] = [];
  scripts: Record<string, Reply[]> = {};
  defaults: Record<string, Handler> = {
    token: () => json(200, { access_token: ACCESS_TOKEN, expires_in: 300 }),
    create: request =>
      json(200, {
        clientContext: JSON.parse(request.body).clientContext,
        data: { pazeCheckoutUrl: CHECKOUT_URL, ewSID: 'ew-1' },
      }),
    review: () =>
      json(200, {
        data: { maskedCard: { panLastFour: '1111' }, ewSID: 'ew-2' },
      }),
    complete: () =>
      json(200, {
        data: {
          securedPayload: SECURED_PAYLOAD,
          payloadId: 'payload-1',
          maskedCard: {
            panLastFour: '1111',
            paymentCardNetwork: 'VISA',
            billingAddress: {
              line1: '123 Main St',
              city: 'Phoenix',
              state: 'AZ',
              zip: '85001',
              countryCode: 'US',
            },
            paymentToken: '4111111111111111',
            paymentAccountReference: 'PAR-SYNTHETIC',
          },
          consumer: { fullName: 'Pat Example', emailAddress: EMAIL },
          tokenExpirationMonth: '12',
          tokenExpirationYear: '2030',
          dynamicData: 'cryptogram',
          eci: '07',
        },
      }),
  };

  step(request: TransportRequest): string {
    return request.url === TOKEN_URL ? 'token' : pathOf(request.url) || '';
  }

  transport = async (request: TransportRequest): Promise<TransportResponse> => {
    this.calls.push(request);
    const step = this.step(request);
    const scripted = this.scripts[step]?.shift();
    const reply =
      scripted ?? this.defaults[step]!(request, this.calls.length - 1);
    if (reply instanceof TransportError) throw reply;
    return reply;
  };

  callsFor(step: string) {
    return this.calls.filter(call => this.step(call) === step);
  }
}

const setup = (
  options: { spreedly?: () => Promise<{ token: string }> } = {}
) => {
  const paze = new FakePaze();
  const logs: PazeCallLog[] = [];
  const spreedlyBodies: Record<string, unknown>[] = [];
  const client = new PazeClient({
    settings: {
      environment: 'cat',
      tokenUrl: TOKEN_URL,
      assertion: {
        loginId: 'login-id',
        signingKid: 'kid-1',
        signingPrivateKey: SIGNING_KEY,
        tokenUrl: TOKEN_URL,
      },
      clientContextKey: KEY,
    },
    transport: paze.transport,
    log: entry => logs.push(entry),
  });
  const store = new PazeSessionStore({ ttlMs: 60_000, maxSessions: 100 });
  const service = new PazeCheckoutService({
    paze: client,
    store,
    createPaymentMethod: async body => {
      spreedlyBodies.push(body);
      return options.spreedly ? options.spreedly() : { token: 'PMsynthetic1' };
    },
    client: {
      id: 'client-id',
      name: 'Example Merchant',
      profileId: 'profile-1',
    },
    certificateToken: 'CERTsynthetic',
    maxTransactionAmount: 10_000,
    currencies: new Set(['USD']),
  });
  return { paze, logs, spreedlyBodies, client, store, service };
};

const CREATE_BODY = {
  callbackURLScheme: SCHEME,
  intent: 'REVIEW_AND_PAY',
  transactionType: 'PURCHASE',
  transactionValue: { transactionCurrency: 'USD', transactionAmount: '10.00' },
  emailAddress: EMAIL,
  phoneNumber: null,
  shippingPreference: 'ALL',
  billingPreference: 'ALL',
};

const COMPLETE_BODY = {
  code: CODE,
  transactionType: 'PURCHASE',
  transactionValue: { transactionCurrency: 'USD', transactionAmount: '10.00' },
  billingPreference: 'ALL',
  merchantCategoryCode: null,
};

const bodyOf = (request: TransportRequest) => JSON.parse(request.body);

test.describe('clientContext and sessionId', () => {
  test('sessionId is 24 letters and digits', () => {
    const ids = new Set(Array.from({ length: 50 }, generateSessionId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(SESSION_ID_PATTERN);
  });

  test('clientContext is a stable version 8 UUID per key and sessionId', () => {
    const value = deriveClientContext(KEY, 'SyntheticSession00000001');
    expect(value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    expect(deriveClientContext(KEY, 'SyntheticSession00000001')).toBe(value);
    expect(deriveClientContext(KEY, 'SyntheticSession00000002')).not.toBe(
      value
    );
    expect(
      deriveClientContext(randomBytes(32), 'SyntheticSession00000001')
    ).not.toBe(value);
  });

  test('the key must be 32 bytes, hex or base64', () => {
    expect(parseClientContextKey('ab'.repeat(32))?.length).toBe(32);
    expect(
      parseClientContextKey(randomBytes(32).toString('base64'))?.length
    ).toBe(32);
    expect(parseClientContextKey('ab'.repeat(16))).toBeNull();
    expect(parseClientContextKey('not a key')).toBeNull();
    expect(parseClientContextKey('')).toBeNull();
  });
});

test.describe('Request bodies', () => {
  test('create mints a session-bound token and sends the spec body', async () => {
    const { paze, service } = setup();
    const result = await service.createSession(CREATE_BODY, CALLER);

    expect(result).toEqual({
      sessionId: expect.stringMatching(SESSION_ID_PATTERN),
      checkoutUrl: CHECKOUT_URL,
    });
    const [token] = paze.callsFor('token');
    const form = new URLSearchParams(token!.body);
    expect(form.get('grant_type')).toBe('client_credentials');
    expect(form.get('client_assertion_type')).toBe(
      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
    );
    expect(form.get('session_id')).toBe(result.sessionId);
    expect(form.get('client_assertion')!.split('.')).toHaveLength(3);

    const [create] = paze.callsFor('create');
    expect(create!.url).toBe(`${CAT_EAST}/v1/checkout/sessions/create`);
    expect(create!.headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
    expect(bodyOf(create!)).toEqual({
      clientContext: deriveClientContext(KEY, result.sessionId),
      data: {
        client: {
          id: 'client-id',
          name: 'Example Merchant',
          profileId: 'profile-1',
        },
        sessionId: result.sessionId,
        emailAddress: EMAIL,
        callbackURLScheme: SCHEME,
        intent: 'REVIEW_AND_PAY',
        transactionType: 'PURCHASE',
        shippingPreference: 'ALL',
        billingPreference: 'ALL',
        transactionValue: {
          transactionCurrency: 'USD',
          transactionAmount: '10.00',
        },
      },
    });
  });

  test('review and complete each mint their own token and send the spec bodies', async () => {
    const { paze, service, spreedlyBodies } = setup();
    const { sessionId } = await service.createSession(CREATE_BODY, CALLER);
    const clientContext = deriveClientContext(KEY, sessionId);

    const review = await service.reviewSession(
      sessionId,
      { code: CODE },
      CALLER
    );
    expect(review.pazeResponse).toEqual({
      data: { maskedCard: { panLastFour: '1111' }, ewSID: 'ew-2' },
    });
    expect(bodyOf(paze.callsFor('review')[0]!)).toEqual({
      clientContext,
      data: { sessionId, code: CODE },
    });

    await service.completeSession(
      sessionId,
      { ...COMPLETE_BODY, merchantCategoryCode: '5999' },
      CALLER
    );
    expect(bodyOf(paze.callsFor('complete')[0]!)).toEqual({
      clientContext,
      data: {
        transactionType: 'PURCHASE',
        sessionId,
        code: CODE,
        transactionOptions: {
          payloadTypeIndicator: 'PAYMENT',
          billingPreference: 'ALL',
          merchantCategoryCode: '5999',
        },
        transactionValue: {
          transactionCurrency: 'USD',
          transactionAmount: '10.00',
        },
      },
    });
    expect(paze.callsFor('token')).toHaveLength(3);
    for (const token of paze.callsFor('token')) {
      expect(new URLSearchParams(token.body).get('session_id')).toBe(sessionId);
    }

    expect(spreedlyBodies).toEqual([
      {
        certificate_token: 'CERTsynthetic',
        secured_payload: SECURED_PAYLOAD,
        session_id: sessionId,
        payload_id: 'payload-1',
        source: 'paze',
      },
    ]);
  });

  test('CARD_ON_FILE sends no transactionValue to create or complete', async () => {
    const { paze, service } = setup();
    const { sessionId } = await service.createSession(
      {
        ...CREATE_BODY,
        transactionType: 'CARD_ON_FILE',
        transactionValue: undefined,
      },
      CALLER
    );
    await service.completeSession(
      sessionId,
      { code: CODE, transactionType: 'CARD_ON_FILE' },
      CALLER
    );
    expect(bodyOf(paze.callsFor('create')[0]!).data).not.toHaveProperty(
      'transactionValue'
    );
    expect(bodyOf(paze.callsFor('complete')[0]!).data).not.toHaveProperty(
      'transactionValue'
    );
  });

  test('complete returns display-safe fields only', async () => {
    const { service } = setup();
    const { sessionId } = await service.createSession(CREATE_BODY, CALLER);
    const result = await service.completeSession(
      sessionId,
      COMPLETE_BODY,
      CALLER
    );
    expect(result).toEqual({
      paymentMethodToken: 'PMsynthetic1',
      paymentCardNetwork: 'VISA',
      lastFour: '1111',
      consumer: { fullName: 'Pat Example', emailAddress: EMAIL },
      billingAddress: {
        line1: '123 Main St',
        city: 'Phoenix',
        state: 'AZ',
        zip: '85001',
        countryCode: 'US',
      },
    });
    const text = JSON.stringify(result);
    for (const secret of [
      SECURED_PAYLOAD,
      '4111111111111111',
      'PAR-SYNTHETIC',
      'cryptogram',
      '2030',
    ]) {
      expect(text).not.toContain(secret);
    }
  });
});

test.describe('Input checks', () => {
  test('create needs an email or a phone number, and a valid amount', async () => {
    const { service } = setup();
    await expect(
      service.createSession({ ...CREATE_BODY, emailAddress: null }, CALLER)
    ).rejects.toBeInstanceOf(BackendError);
    for (const amount of ['0.00', '10', '-1.00', '10000.01', '1e3']) {
      await expect(
        service.createSession(
          {
            ...CREATE_BODY,
            transactionValue: {
              transactionCurrency: 'USD',
              transactionAmount: amount,
            },
          },
          CALLER
        )
      ).rejects.toMatchObject({ status: 400 });
    }
    await expect(
      service.createSession(
        {
          ...CREATE_BODY,
          transactionValue: {
            transactionCurrency: 'EUR',
            transactionAmount: '10.00',
          },
        },
        CALLER
      )
    ).rejects.toMatchObject({ status: 400 });
  });

  test('complete refuses an amount or type that differs from the order', async () => {
    const { paze, service } = setup();
    const { sessionId } = await service.createSession(CREATE_BODY, CALLER);
    await expect(
      service.completeSession(
        sessionId,
        {
          ...COMPLETE_BODY,
          transactionValue: {
            transactionCurrency: 'USD',
            transactionAmount: '1.00',
          },
        },
        CALLER
      )
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.completeSession(
        sessionId,
        { ...COMPLETE_BODY, transactionType: 'CARD_ON_FILE' },
        CALLER
      )
    ).rejects.toMatchObject({ status: 400 });
    expect(paze.callsFor('complete')).toHaveLength(0);
  });

  test('review and complete answer 404 for another caller or an unknown session', async () => {
    const { paze, service } = setup();
    const { sessionId } = await service.createSession(CREATE_BODY, CALLER);
    const before = paze.calls.length;
    await expect(
      service.reviewSession(sessionId, { code: CODE }, 'caller-b')
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.completeSession(sessionId, COMPLETE_BODY, 'caller-b')
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      service.completeSession('ZZZZZZZZZZZZZZZZZZZZZZZZ', COMPLETE_BODY, CALLER)
    ).rejects.toMatchObject({ status: 404 });
    expect(paze.calls.length).toBe(before);
  });

  test('sessions expire', async () => {
    let now = 1_000_000;
    const store = new PazeSessionStore({
      ttlMs: 1_000,
      maxSessions: 2,
      now: () => now,
    });
    const base = {
      callerKey: CALLER,
      environment: 'cat',
      transactionType: 'PURCHASE' as const,
      billingPreference: 'ALL',
    };
    store.create({ ...base, sessionId: 'a' });
    store.create({ ...base, sessionId: 'b' });
    expect(() => store.create({ ...base, sessionId: 'c' })).toThrow();
    now += 1_001;
    expect(store.get('a', CALLER)).toBeUndefined();
    store.create({ ...base, sessionId: 'c' });
    expect(store.size).toBe(1);
  });
});

test.describe('Paze responses', () => {
  test('a checkoutUrl off the checkout host is refused', async () => {
    const { paze, service } = setup();
    for (const url of [
      'https://attacker.example/checkout',
      'http://checkout.wallet.cat.earlywarning.io/x',
      'https://checkout.paze.com/x',
      'https://user@checkout.wallet.cat.earlywarning.io/x',
    ]) {
      paze.scripts.create = [json(200, { data: { pazeCheckoutUrl: url } })];
      await expect(
        service.createSession(CREATE_BODY, CALLER)
      ).rejects.toBeInstanceOf(PazeInvalidResponseError);
    }
  });

  test('a clientContext that differs from the derived one is refused', async () => {
    const { paze, service } = setup();
    paze.scripts.create = [
      json(200, {
        clientContext: '00000000-0000-8000-8000-000000000000',
        data: { pazeCheckoutUrl: CHECKOUT_URL },
      }),
    ];
    await expect(
      service.createSession(CREATE_BODY, CALLER)
    ).rejects.toBeInstanceOf(PazeInvalidResponseError);
  });

  test('complete reads securePayload when securedPayload is missing', async () => {
    const { paze, service, spreedlyBodies } = setup();
    paze.scripts.complete = [
      json(200, { data: { securePayload: SECURED_PAYLOAD } }),
    ];
    const { sessionId } = await service.createSession(CREATE_BODY, CALLER);
    await service.completeSession(sessionId, COMPLETE_BODY, CALLER);
    expect(spreedlyBodies[0]).toMatchObject({
      secured_payload: SECURED_PAYLOAD,
    });
    expect(spreedlyBodies[0]).not.toHaveProperty('payload_id');
  });
});

test.describe('Retries', () => {
  test('/token is retried once after a 5xx or a connection failure', async () => {
    const { paze, client } = setup();
    paze.scripts.token = [json(503, {})];
    await expect(client.mintToken('s')).resolves.toBe(ACCESS_TOKEN);
    paze.scripts.token = [new TransportError('refused', false)];
    await expect(client.mintToken('s')).resolves.toBe(ACCESS_TOKEN);
    paze.scripts.token = [json(500, {}), json(502, { error: 'bad' })];
    await expect(client.mintToken('s')).rejects.toMatchObject({
      step: 'token',
      status: 502,
    });
    paze.scripts.token = [json(400, { error: 'invalid_client' })];
    await expect(client.mintToken('s')).rejects.toBeInstanceOf(PazeApiError);
    expect(paze.callsFor('token')).toHaveLength(7);
  });

  test('a 401 gets one new token and one more try', async () => {
    const { paze, client } = setup();
    paze.scripts.review = [json(401, {})];
    await client.callSession('review', 's', { sessionId: 's', code: CODE });
    expect(paze.callsFor('token')).toHaveLength(2);
    expect(paze.callsFor('review')).toHaveLength(2);

    paze.scripts.review = [json(401, {}), json(401, { error: 'unauthorized' })];
    await expect(client.callSession('review', 's', {})).rejects.toMatchObject({
      status: 401,
    });
    expect(paze.callsFor('review')).toHaveLength(4);
  });

  test('create and review move to the CAT fallback origin after a connection failure', async () => {
    const { paze, client } = setup();
    paze.scripts.review = [new TransportError('read timeout', true)];
    await client.callSession('review', 's', {});
    expect(
      paze.callsFor('review').map(call => new URL(call.url).origin)
    ).toEqual([CAT_EAST, CAT_WEST]);
  });

  test('an HTTP error is not retried on the fallback origin', async () => {
    const { paze, client } = setup();
    paze.scripts.review = [json(400, { reason: 'INVALID_CODE' })];
    await expect(client.callSession('review', 's', {})).rejects.toMatchObject({
      status: 400,
      body: { reason: 'INVALID_CODE' },
    });
    expect(paze.callsFor('review')).toHaveLength(1);
  });

  test('complete moves on only when the connection was never established', async () => {
    const { paze, client } = setup();
    paze.scripts.complete = [new TransportError('ECONNREFUSED', false)];
    await client.callSession('complete', 's', {});
    expect(paze.callsFor('complete')).toHaveLength(2);

    paze.scripts.complete = [new TransportError('read timeout', true)];
    await expect(
      client.callSession('complete', 's', {})
    ).rejects.toBeInstanceOf(PazeUnavailableError);
    expect(paze.callsFor('complete')).toHaveLength(3);
  });

  test('a 429 is returned, not retried', async () => {
    const { paze, client } = setup();
    paze.scripts.create = [json(429, { reason: 'TOO_MANY' })];
    await expect(client.callSession('create', 's', {})).rejects.toMatchObject({
      status: 429,
    });
    expect(paze.callsFor('create')).toHaveLength(1);
  });
});

test.describe('Idempotent complete', () => {
  test('a repeated complete returns the stored result and calls nothing', async () => {
    const { paze, service, spreedlyBodies } = setup();
    const { sessionId } = await service.createSession(CREATE_BODY, CALLER);
    const first = await service.completeSession(
      sessionId,
      COMPLETE_BODY,
      CALLER
    );
    const callsAfterFirst = paze.calls.length;
    const second = await service.completeSession(
      sessionId,
      COMPLETE_BODY,
      CALLER
    );
    expect(second).toEqual(first);
    expect(paze.calls.length).toBe(callsAfterFirst);
    expect(spreedlyBodies).toHaveLength(1);
  });

  test('concurrent completes make one Paze call and one payment method', async () => {
    const { paze, service, spreedlyBodies } = setup();
    const { sessionId } = await service.createSession(CREATE_BODY, CALLER);
    const results = await Promise.all([
      service.completeSession(sessionId, COMPLETE_BODY, CALLER),
      service.completeSession(sessionId, COMPLETE_BODY, CALLER),
      service.completeSession(sessionId, COMPLETE_BODY, CALLER),
    ]);
    expect(new Set(results.map(r => r.paymentMethodToken)).size).toBe(1);
    expect(paze.callsFor('complete')).toHaveLength(1);
    expect(spreedlyBodies).toHaveLength(1);
  });

  test('a Spreedly failure keeps the session completing, and a retry skips Paze', async () => {
    let fail = true;
    const { paze, service, store, spreedlyBodies } = setup({
      spreedly: async () => {
        if (fail) throw new Error('Spreedly unavailable');
        return { token: 'PMsynthetic2' };
      },
    });
    const { sessionId } = await service.createSession(CREATE_BODY, CALLER);
    await expect(
      service.completeSession(sessionId, COMPLETE_BODY, CALLER)
    ).rejects.toMatchObject({ status: 502 });
    expect(store.get(sessionId, CALLER)?.status).toBe('COMPLETING');
    // securedPayload waits encrypted.
    expect(JSON.stringify(store.get(sessionId, CALLER))).not.toContain(
      SECURED_PAYLOAD
    );

    fail = false;
    const result = await service.completeSession(
      sessionId,
      COMPLETE_BODY,
      CALLER
    );
    expect(result.paymentMethodToken).toBe('PMsynthetic2');
    expect(paze.callsFor('complete')).toHaveLength(1);
    expect(spreedlyBodies).toHaveLength(2);
    expect(spreedlyBodies[1]).toEqual(spreedlyBodies[0]);
    expect(store.get(sessionId, CALLER)?.pending).toBeUndefined();
  });

  test('a Spreedly HTTP error passes its status and reason through and keeps the session completing', async () => {
    const spreedlyBody = {
      errors: [
        {
          key: 'errors.certificate_not_found',
          message: 'Unable to find the specified certificate.',
        },
      ],
    };
    const { service, store } = setup({
      spreedly: async () => {
        throw new SpreedlyApiError(404, spreedlyBody);
      },
    });
    const { sessionId } = await service.createSession(CREATE_BODY, CALLER);
    const failure = service.completeSession(sessionId, COMPLETE_BODY, CALLER);
    await expect(failure).rejects.toBeInstanceOf(SpreedlyApiError);
    await expect(failure).rejects.toMatchObject({
      status: 404,
      body: spreedlyBody,
      message: 'Unable to find the specified certificate.',
    });
    expect(store.get(sessionId, CALLER)?.status).toBe('COMPLETING');
  });

  test('a Spreedly error without messages is reported by its status', () => {
    expect(
      new SpreedlyApiError(422, {
        transaction: { message: 'Payment method was invalid' },
      }).message
    ).toBe('Payment method was invalid');
    expect(new SpreedlyApiError(500, '<html>').message).toBe(
      'Spreedly returned HTTP 500'
    );
  });

  test('a Paze complete failure fails the session', async () => {
    const { paze, service } = setup();
    paze.scripts.complete = [json(400, { reason: 'CODE_EXPIRED' })];
    const { sessionId } = await service.createSession(CREATE_BODY, CALLER);
    await expect(
      service.completeSession(sessionId, COMPLETE_BODY, CALLER)
    ).rejects.toBeInstanceOf(PazeApiError);
    await expect(
      service.completeSession(sessionId, COMPLETE_BODY, CALLER)
    ).rejects.toMatchObject({ status: 409 });
  });
});

test.describe('Logging', () => {
  test('one structured log per call, with no secrets or contact details', async () => {
    const { logs, service } = setup();
    const { sessionId } = await service.createSession(CREATE_BODY, CALLER);
    await service.reviewSession(sessionId, { code: CODE }, CALLER);
    await service.completeSession(sessionId, COMPLETE_BODY, CALLER);

    expect(logs.map(log => log.step)).toEqual([
      'token',
      'create',
      'token',
      'review',
      'token',
      'complete',
    ]);
    for (const log of logs) {
      expect(log).toMatchObject({
        event: 'paze_call',
        sessionId,
        attempt: 1,
        outcome: 'ok',
      });
      expect(typeof log.duration_ms).toBe('number');
    }
    expect(logs[1]).toMatchObject({
      origin: CAT_EAST,
      status: 200,
      ewSID: 'ew-1',
    });
    const text = JSON.stringify(logs);
    for (const secret of [
      ACCESS_TOKEN,
      CODE,
      SECURED_PAYLOAD,
      EMAIL,
      'client_assertion',
      'Bearer',
    ]) {
      expect(text).not.toContain(secret);
    }
  });
});

test.describe('HTTPS transport', () => {
  test('a refused connection is reported as never connected', async () => {
    const transport = createHttpsTransport({
      connectTimeoutMs: 2_000,
      totalTimeoutMs: 4_000,
    });
    // Port 9 (discard) on loopback is closed on CI and dev machines.
    const error = await transport({
      url: 'https://127.0.0.1:9/x',
      headers: {},
      body: '{}',
    }).catch(e => e);
    expect(error).toBeInstanceOf(TransportError);
    expect(error.connected).toBe(false);
  });

  test('a non-https URL is refused without a request', async () => {
    const transport = createHttpsTransport({
      connectTimeoutMs: 2_000,
      totalTimeoutMs: 4_000,
    });
    const error = await transport({
      url: 'http://127.0.0.1:9/x',
      headers: {},
      body: '{}',
    }).catch(e => e);
    expect(error).toBeInstanceOf(TransportError);
    expect(error.connected).toBe(false);
  });
});
