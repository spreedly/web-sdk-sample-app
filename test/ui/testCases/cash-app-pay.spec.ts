import { test, expect } from '../util/fixtures';
import { landingPage } from '../pages/landingPage';
import {
  CASH_APP_SYNTHETIC_APPROVAL,
  CASH_APP_SYNTHETIC_CONFIG,
  cashAppPayPage,
} from '../pages/cashAppPayPage';
import { MONOREPO_URLS } from '../util/urls';
import { SELECTORS } from '../util/test-constants';

// Pay Kit is stubbed: scanning a real QR code or the mobile redirect can't run here. Those are
// covered by manual sandbox QA (docs/cash-app-pay/DEMO_GUIDE.md).
test.describe('Cash App Pay', () => {
  test.beforeEach(async ({ page }) => {
    await cashAppPayPage.installCashAppStub(page);
    await cashAppPayPage.mockServerRoutes(page);
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnCashAppPayButton(page);
    const ready = await cashAppPayPage.waitForDemo(page);
    test.skip(!ready, 'The loaded SDK build has no SpreedlyCashAppPay yet');
  });

  test('initializes Pay Kit and sends the customer request in cents', async ({ page }) => {
    const calls = await cashAppPayPage.getStubCalls(page);

    expect(calls.pay).toEqual([{ clientId: CASH_APP_SYNTHETIC_CONFIG.clientId }]);
    expect(calls.customerRequest).toHaveLength(1);
    expect(calls.customerRequest[0]).toEqual({
      actions: {
        payment: {
          amount: { currency: 'USD', value: 1234 },
          scopeId: CASH_APP_SYNTHETIC_CONFIG.merchantId,
        },
      },
      redirectURL: expect.stringContaining(MONOREPO_URLS.CASH_APP_PAY),
    });
    expect(calls.render[0]).toEqual({
      options: {
        button: { label: 'cashAppPay', shape: 'round', size: 'medium', theme: 'dark', width: 'full' },
        manage: true,
      },
      target: '#cash-app-pay-container',
    });
  });

  test('turns an approval into a mock token and completes a mock purchase', async ({ page }) => {
    await cashAppPayPage.emit(page, 'CUSTOMER_REQUEST_APPROVED', CASH_APP_SYNTHETIC_APPROVAL);

    await expect(page.locator(SELECTORS.CASH_APP_PAY_RESULT_CASHTAG)).toHaveText('$synthetic');
    await expect(page.locator(SELECTORS.CASH_APP_PAY_RESULT_TOKEN)).toHaveText(/^mock_/);
    // The grant is exchanged inside the SDK and never shown on the page.
    await expect(page.locator('body')).not.toContainText('GRG_SYNTHETIC');

    const token = await page.locator(SELECTORS.CASH_APP_PAY_RESULT_TOKEN).textContent();
    const purchaseRequest = page.waitForRequest(
      request =>
        request.url().includes('/api/v1/cash-app-pay-purchase') && request.method() === 'POST'
    );
    await page.locator(SELECTORS.CASH_APP_PAY_PURCHASE_BUTTON).click();

    expect((await purchaseRequest).postDataJSON()).toEqual({
      amount: 1234,
      currency_code: 'USD',
      payment_method_token: token,
    });
    await expect(page.locator(SELECTORS.CASH_APP_PAY_RESULT_TRANSACTION)).toContainText(
      'mock_txn_synthetic'
    );
    await expect(page.locator(SELECTORS.CASH_APP_PAY_STATUS)).toContainText(
      'Mock purchase succeeded.'
    );
  });

  test('shows a decline', async ({ page }) => {
    await cashAppPayPage.emit(page, 'CUSTOMER_REQUEST_DECLINED');
    await expect(page.locator(SELECTORS.CASH_APP_PAY_STATUS)).toContainText('Declined in Cash App');
  });

  test('shows a dismissal', async ({ page }) => {
    await cashAppPayPage.emit(page, 'CUSTOMER_DISMISSED', {});
    await expect(page.locator(SELECTORS.CASH_APP_PAY_STATUS)).toContainText('Cash App Pay was closed');
  });

  test('shows a failed customer request', async ({ page }) => {
    await cashAppPayPage.emit(page, 'CUSTOMER_REQUEST_FAILED', {});
    await expect(page.locator(SELECTORS.CASH_APP_PAY_STATUS)).toContainText('CUSTOMER_REQUEST_FAILED');
  });

  test('updates the open request when the total changes', async ({ page }) => {
    await page.locator(SELECTORS.CASH_APP_PAY_AMOUNT).fill('20.00');
    await page.locator(SELECTORS.CASH_APP_PAY_AMOUNT).press('Tab');

    await expect
      .poll(async () => (await cashAppPayPage.getStubCalls(page)).update)
      .toEqual([
        {
          actions: {
            payment: {
              amount: { currency: 'USD', value: 2000 },
              scopeId: CASH_APP_SYNTHETIC_CONFIG.merchantId,
            },
          },
        },
      ]);
    expect((await cashAppPayPage.getStubCalls(page)).customerRequest).toHaveLength(1);
  });

  test('reports UPDATE_REJECTED once the shopper has started', async ({ page }) => {
    await cashAppPayPage.setUpdateResult(page, false);
    await page.locator(SELECTORS.CASH_APP_PAY_AMOUNT).fill('20.00');
    await page.locator(SELECTORS.CASH_APP_PAY_AMOUNT).press('Tab');
    await expect(page.locator(SELECTORS.CASH_APP_PAY_STATUS)).toContainText('UPDATE_REJECTED');
  });
});
