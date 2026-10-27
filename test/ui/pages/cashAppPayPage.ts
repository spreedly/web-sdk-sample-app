import { Page, Route } from '@playwright/test';
import { SELECTORS } from '../util/test-constants';

// Synthetic values — not real Cash App identifiers.
export const CASH_APP_SYNTHETIC_CONFIG = {
  clientId: 'CAS-CI_SYNTHETIC_CLIENT',
  merchantId: 'MMI_SYNTHETIC_MERCHANT',
};

export const CASH_APP_SYNTHETIC_APPROVAL = {
  customerProfile: { cashtag: '$synthetic', id: 'C_SYNTHETIC' },
  grants: { payment: { expiresAt: '2030-01-01T00:00:00.000Z', grantId: 'GRG_SYNTHETIC' } },
  referenceId: 'order-synthetic',
};

type StubState = {
  calls: {
    customerRequest: Record<string, unknown>[];
    pay: Record<string, unknown>[];
    render: { options: Record<string, unknown>; target: string }[];
    restart: number;
    update: Record<string, unknown>[];
  };
};

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({
    body: JSON.stringify(body),
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    status,
  });

export const cashAppPayPage = {
  /**
   * Replaces Block's Pay Kit with a synthetic window.CashApp. The real pay.js is aborted; the stub
   * records customerRequest / render / update calls in window.__cashAppStub and lets a spec fire
   * Pay Kit events with window.__cashAppStub.emit(type, data).
   */
  installCashAppStub: async (page: Page) => {
    await page.route('**/kit.cash.app/**', route => route.abort());
    await page.addInitScript(() => {
      const listeners: Record<string, Array<(data?: unknown) => void>> = {};
      const stub = {
        calls: { customerRequest: [], pay: [], render: [], restart: 0, update: [] },
        emit(type: string, data?: unknown) {
          (listeners[type] || []).forEach(listener => listener(data));
        },
        updateResult: true,
      } as Record<string, any>;
      const removeButton = () => document.getElementById('stub-cash-app-button')?.remove();
      const pay = {
        addEventListener(type: string, listener: (data?: unknown) => void) {
          listeners[type] = [...(listeners[type] || []), listener];
        },
        async customerRequest(request: Record<string, unknown>) {
          stub.calls.customerRequest.push(request);
          return {
            async update(details: Record<string, unknown>) {
              stub.calls.update.push(details);
              return stub.updateResult;
            },
          };
        },
        removeEventListener(type: string, listener: (data?: unknown) => void) {
          listeners[type] = (listeners[type] || []).filter(l => l !== listener);
        },
        async render(target: string, options: Record<string, unknown>) {
          stub.calls.render.push({ options, target });
          const button = document.createElement('button');
          button.id = 'stub-cash-app-button';
          button.type = 'button';
          button.textContent = 'Cash App Pay (stub)';
          document.querySelector(target)?.appendChild(button);
          return { begin() {}, destroy: removeButton };
        },
        restart() {
          stub.calls.restart += 1;
          removeButton();
        },
      };
      (window as any).__cashAppStub = stub;
      (window as any).CashApp = {
        async pay(options: Record<string, unknown>) {
          stub.calls.pay.push(options);
          return pay;
        },
      };
    });
  },

  /** Serves the config route and the mock purchase route without the sample-app server */
  mockServerRoutes: async (page: Page) => {
    await page.route('**/api/v1/cash-app-pay/config', route =>
      json(route, 200, CASH_APP_SYNTHETIC_CONFIG)
    );
    await page.route('**/api/v1/cash-app-pay-purchase', route => {
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({
          headers: {
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Origin': '*',
          },
          status: 204,
        });
      }
      const body = route.request().postDataJSON();
      return json(route, 200, {
        transaction: {
          amount: body.amount,
          currency_code: body.currency_code,
          mock: true,
          state: 'succeeded',
          succeeded: true,
          token: 'mock_txn_synthetic',
        },
      });
    });
  },

  /** Resolves true once the demo is ready, false when this SDK build has no SpreedlyCashAppPay */
  waitForDemo: async (page: Page): Promise<boolean> => {
    const error = page.locator(SELECTORS.CASH_APP_PAY_ERROR_STATE);
    // Both cards start hidden; wait for whichever the page reveals.
    await page
      .locator(
        `${SELECTORS.CASH_APP_PAY_WORKSPACE}:not(.hidden), ${SELECTORS.CASH_APP_PAY_ERROR_STATE}:not(.hidden)`
      )
      .waitFor({ state: 'visible' });
    if (await error.isVisible()) {
      const text = (await error.textContent()) || '';
      if (text.includes('SpreedlyCashAppPay')) return false;
      throw new Error(`Cash App Pay demo failed to load: ${text.trim()}`);
    }
    await page.locator(SELECTORS.CASH_APP_PAY_STUB_BUTTON).waitFor({ state: 'visible' });
    return true;
  },

  getStubCalls: (page: Page) =>
    page.evaluate(() => (window as any).__cashAppStub.calls as StubState['calls']),

  emit: (page: Page, type: string, data?: unknown) =>
    page.evaluate(([eventType, payload]) => (window as any).__cashAppStub.emit(eventType, payload), [
      type,
      data,
    ] as const),

  setUpdateResult: (page: Page, result: boolean) =>
    page.evaluate(value => {
      (window as any).__cashAppStub.updateResult = value;
    }, result),
};
