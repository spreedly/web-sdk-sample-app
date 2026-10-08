import { Page } from '@playwright/test';
import { expect } from '../util/fixtures';
import { SELECTORS, TEST_DATA } from '../util/test-constants';

type StubOptions = { ready?: boolean };

/**
 * Replaces Google's pay.js with a SYNTHETIC in-page stub: the real payment sheet needs a signed-in
 * Google account, which automated browsers cannot use. The stub mirrors the PaymentsClient
 * surface SpreedlyGooglePay calls, and "authorizes" a synthetic card when its button is clicked.
 */
const installGooglePayStub = async (page: Page, { ready = true }: StubOptions = {}) => {
  // Keep the real pay.js from loading and overwriting the stub.
  await page.route('https://pay.google.com/**', route => route.abort());

  await page.addInitScript(
    ({ isReady, token }) => {
      const w = window as unknown as Record<string, unknown>;
      w.__gpStub = { requests: [] as unknown[], authorizations: [] as unknown[] };
      w.google = {
        payments: {
          api: {
            PaymentsClient: function PaymentsClient(options: any) {
              const stub = w.__gpStub as any;
              return {
                isReadyToPay: async () => ({ result: isReady }),
                createButton: (buttonOptions: any) => {
                  const button = document.createElement('button');
                  button.id = 'gpay-stub-button';
                  button.textContent = 'Google Pay (stub)';
                  button.addEventListener('click', () => buttonOptions.onClick());
                  return button;
                },
                loadPaymentData: (request: unknown) => {
                  stub.requests.push(request);
                  const paymentData = {
                    paymentMethodData: {
                      info: { cardNetwork: 'VISA', cardDetails: '1111' },
                      tokenizationData: { type: 'PAYMENT_GATEWAY', token },
                    },
                  };
                  return new Promise((resolve, reject) => {
                    setTimeout(async () => {
                      const result = await options.paymentDataCallbacks.onPaymentAuthorized(paymentData);
                      stub.authorizations.push(result);
                      if (result.transactionState === 'SUCCESS') {
                        resolve(paymentData);
                      } else {
                        // A shopper who sees the in-sheet error and closes the sheet.
                        reject({ statusCode: 'CANCELED' });
                      }
                    }, 50);
                  });
                },
              };
            },
          },
        },
      };
    },
    { isReady: ready, token: TEST_DATA.GOOGLE_PAY_SYNTHETIC_TOKEN }
  );
};

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
};

/** Fulfils the SDK's Spreedly tokenize call with a SYNTHETIC response and records the body. */
const mockSpreedlyTokenize = async (
  page: Page,
  { status = 201, body = TEST_DATA.GOOGLE_PAY_SYNTHETIC_CORE_RESPONSE }: { status?: number; body?: unknown } = {}
) => {
  const requests: any[] = [];
  await page.route('https://core.spreedly.com/v1/payment_methods.json', async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    requests.push(request.postDataJSON());
    await route.fulfill({
      status,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  });
  return requests;
};

/**
 * Fulfils one sample-app purchase route (e.g. `simple-purchase`) with a SYNTHETIC transaction and
 * records the request bodies. The page calls the Heroku API even when served locally, so the
 * pattern matches any host.
 */
const mockPurchaseRoute = async (
  page: Page,
  path: string,
  transaction: Record<string, unknown> = {
    token: 'synthetic_purchase_token',
    state: 'succeeded',
    message: 'Succeeded!',
  }
) => {
  const requests: any[] = [];
  await page.route(`**/api/v1/${path}`, async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    requests.push(request.postDataJSON());
    const body = path === 'simple-purchase' ? { success: true, transaction } : { transaction };
    await route.fulfill({
      status: 200,
      headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  });
  return requests;
};

export const googlePayPage = {
  installGooglePayStub,
  mockSpreedlyTokenize,
  mockPurchaseRoute,

  choose3DSMode: async (page: Page, mode: 'gateway' | 'global' | 'none') => {
    await page.locator(SELECTORS.GOOGLE_PAY_3DS_MODE(mode)).check();
  },

  choose3DSScenario: async (page: Page, scenario: string) => {
    await page.locator(SELECTORS.GOOGLE_PAY_3DS_SCENARIO(scenario)).check();
  },

  clickPurchase: async (page: Page) => {
    const button = page.locator(SELECTORS.GOOGLE_PAY_PURCHASE_BUTTON);
    await expect(button).toBeEnabled({ timeout: 15000 });
    await button.click();
  },

  /** Taps the stub button and waits for the payment method result card. */
  tokenize: async (page: Page) => {
    await googlePayPage.waitForButton(page);
    await googlePayPage.clickGooglePay(page);
    await expect(page.locator(SELECTORS.GOOGLE_PAY_RESULT_TITLE)).toHaveText(
      'Payment method created',
      { timeout: 15000 }
    );
  },

  /** false when the loaded Express Checkout build predates its `googlePay` option. */
  hasExpressCheckoutGooglePay: async (page: Page) => {
    if (!(await googlePayPage.hasSdkGlobal(page))) return false;
    // The page reports a build without the option in its status line instead of mounting.
    return page.evaluate(
      () => !document.getElementById('status-message')?.textContent?.includes('no googlePay option')
    );
  },

  waitForExpressCheckoutButton: async (page: Page) => {
    await expect(page.locator(SELECTORS.GOOGLE_PAY_EC_STUB_BUTTON)).toBeVisible({ timeout: 15000 });
  },

  /** false when the loaded SDK build predates SpreedlyGooglePay (e.g. the rc CDN before merge). */
  hasSdkGlobal: async (page: Page) => {
    // The page leaves its loading state once the SDK loaded (or failed to).
    await page.waitForFunction(
      () => document.getElementById('loading-state')?.classList.contains('hidden'),
      undefined,
      { timeout: 20000 }
    );
    return page.evaluate(() => typeof (window as any).SpreedlyGooglePay === 'function');
  },

  waitForButton: async (page: Page) => {
    await expect(page.locator(SELECTORS.GOOGLE_PAY_STUB_BUTTON)).toBeVisible({ timeout: 15000 });
  },

  clickGooglePay: async (page: Page) => {
    const button = page.locator(SELECTORS.GOOGLE_PAY_STUB_BUTTON);
    await expect(button).toBeVisible();
    await button.click();
  },

  eventLog: (page: Page) => page.locator(SELECTORS.GOOGLE_PAY_EVENT_LOG),
};
