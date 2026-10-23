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

const googlePayConfigFromSnippet = (text: string): Record<string, any> => {
  const standalone = text.match(/SpreedlyGooglePay\((\{[\s\S]*\})\)\s*;/);
  if (standalone?.[1]) {
    return JSON.parse(standalone[1]);
  }
  const express = text.match(/expressCheckout\((\{[\s\S]*\})\)\s*;/);
  if (express?.[1]) {
    const options = JSON.parse(express[1]);
    return options.googlePay || options;
  }
  throw new Error(`Could not parse Google Pay config from snippet: ${text.slice(0, 200)}`);
};

export const googlePayPage = {
  installGooglePayStub,

  hasSdkGlobal: async (page: Page) => {
    await page.waitForFunction(
      () => document.getElementById('loading-state')?.classList.contains('hidden'),
      undefined,
      { timeout: 20000 }
    );
    return page.evaluate(() => typeof (window as any).SpreedlyGooglePay === 'function');
  },

  waitForButton: async (page: Page) => {
    await expect(page.locator(SELECTORS.GOOGLE_PAY_RENDERED_BUTTON).first()).toBeVisible({ timeout: 20000 });
  },

  getRenderedButton: async (page: Page) => {
    const button = page.locator(SELECTORS.GOOGLE_PAY_RENDERED_BUTTON).first();
    await expect(button).toBeVisible({ timeout: 20000 });
    return button;
  },

  getRenderedButtonClass: async (page: Page) => {
    const button = await googlePayPage.getRenderedButton(page);
    return (await button.getAttribute('class')) || '';
  },

  getRenderedButtonBorderRadius: async (page: Page) => {
    const button = await googlePayPage.getRenderedButton(page);
    return button.evaluate(el => getComputedStyle(el).borderRadius);
  },

  selectDropdownOption: async (page: Page, dropdownSelector: string, optionValue: string) => {
    const dropdown = page.locator(dropdownSelector);
    await expect(dropdown).toBeVisible();
    await dropdown.selectOption(optionValue);
    await expect(dropdown).toHaveValue(optionValue);
  },

  waitForConfigSnippet: async (page: Page) => {
    const snippet = page.locator(SELECTORS.GOOGLE_PAY_CONFIG_SNIPPET);
    await expect(snippet).toContainText('SpreedlyGooglePay', { timeout: 15000 });
  },

  getPassedConfig: async (page: Page) => {
    await googlePayPage.waitForConfigSnippet(page);
    const text = (await page.locator(SELECTORS.GOOGLE_PAY_CONFIG_SNIPPET).textContent()) || '';
    return googlePayConfigFromSnippet(text);
  },

  waitForConfigMatching: async (
    page: Page,
    predicate: (config: Record<string, any>) => boolean,
    timeout = 15000
  ) => {
    await expect
      .poll(async () => {
        try {
          return predicate(await googlePayPage.getPassedConfig(page));
        } catch {
          return false;
        }
      }, { timeout })
      .toBe(true);
    return googlePayPage.getPassedConfig(page);
  },

  clickOnGooglePayButton: async (page: Page) => {
    const googlePayButton = page.locator(SELECTORS.GOOGLE_PAY_BUTTON);
    await expect(googlePayButton).toBeVisible();
    await googlePayButton.click();
  },

  getCheckboxByName: async (page: Page, checkboxName: string) => {
    return page.locator(SELECTORS.GOOGLE_PAY_PAYMENT_SHEET_CHECKBOX(checkboxName));
  },

  clickOnCheckbox: async (page: Page, checkboxName: string) => {
    const checkbox = await googlePayPage.getCheckboxByName(page, checkboxName);
    await expect(checkbox).toBeVisible();
    await checkbox.click();
  },

  checkCheckbox: async (page: Page, checkboxName: string) => {
    const checkbox = await googlePayPage.getCheckboxByName(page, checkboxName);
    await expect(checkbox).toBeVisible();
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  },

  uncheckCheckbox: async (page: Page, checkboxName: string) => {
    const checkbox = await googlePayPage.getCheckboxByName(page, checkboxName);
    await expect(checkbox).toBeVisible();
    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();
  },

  setCheckbox: async (page: Page, selector: string, checked: boolean) => {
    const box = page.locator(selector);
    await expect(box).toBeVisible();
    if (checked) {
      await box.check();
    } else {
      await box.uncheck();
    }
  },

  selectOption: async (page: Page, selector: string, value: string) => {
    await googlePayPage.selectDropdownOption(page, selector, value);
  },

  setCornerRadius: async (page: Page, radius: number) => {
    const input = page.locator(SELECTORS.GOOGLE_PAY_BTN_RADIUS);
    await input.fill(String(radius));
    await input.dispatchEvent('change');
  },

  enablePaymentSheetOptions: async (page: Page) => {
    await googlePayPage.setCheckbox(page, SELECTORS.GOOGLE_PAY_AUTH_CRYPTOGRAM, true);
    await googlePayPage.setCheckbox(page, SELECTORS.GOOGLE_PAY_BILLING, true);
    await googlePayPage.setCheckbox(page, SELECTORS.GOOGLE_PAY_SHIPPING, true);
    await googlePayPage.setCheckbox(page, SELECTORS.GOOGLE_PAY_EMAIL, true);
    await googlePayPage.setCheckbox(page, SELECTORS.GOOGLE_PAY_PROMO, true);
    await googlePayPage.setCheckbox(page, SELECTORS.GOOGLE_PAY_NO_PREPAID, true);
    await googlePayPage.setCheckbox(page, SELECTORS.GOOGLE_PAY_NO_CREDIT, true);
    await googlePayPage.setCheckbox(page, SELECTORS.GOOGLE_PAY_ASSURANCE, true);
    for (const network of ['AMEX', 'DISCOVER', 'JCB', 'MASTERCARD', 'VISA']) {
      await googlePayPage.setCheckbox(page, SELECTORS.GOOGLE_PAY_NETWORK(network), true);
    }
  },
};
