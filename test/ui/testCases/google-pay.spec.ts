import { test, expect } from '../util/fixtures';
import { landingPage } from '../pages/landingPage';
import { googlePayPage } from '../pages/googlePayPage';
import { SELECTORS, TEST_DATA } from '../util/test-constants';
import { MONOREPO_URLS } from '../util/urls';

/**
 * Google Pay — SpreedlyGooglePay, exposed by both the Hosted Fields and Express Checkout bundles.
 *
 * Google's real payment sheet needs a signed-in Google account, so these specs run against a
 * SYNTHETIC window.google stub and fulfil Spreedly's tokenize call with a synthetic response.
 * They skip when the loaded SDK build predates SpreedlyGooglePay (the rc CDN until release).
 */
test.describe('Google Pay', () => {
  test('landing card opens the flow on the selected bundle', async ({ page }) => {
    await googlePayPage.installGooglePayStub(page);
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnGooglePayButton(page);

    await expect(page).toHaveURL(/google-pay\/index\.html\?sdk=express-checkout/);
  });

  // The `from` tag the SDK puts on the payment method identifies the bundle.
  const BUNDLES = [
    { sdk: 'hosted-fields', from: 'web/fields' },
    { sdk: 'express-checkout', from: 'web/form' },
  ] as const;

  for (const { sdk, from } of BUNDLES) {
    test(`draws the button and tokenizes in the sheet (${sdk})`, async ({ page }) => {
      await googlePayPage.installGooglePayStub(page);
      const tokenizeRequests = await googlePayPage.mockSpreedlyTokenize(page);
      await page.goto(`${MONOREPO_URLS.GOOGLE_PAY}?sdk=${sdk}`);
      test.skip(!(await googlePayPage.hasSdkGlobal(page)), 'SpreedlyGooglePay not in this SDK build');

      await googlePayPage.waitForButton(page);
      await expect(googlePayPage.eventLog(page)).toContainText('googlePayReady');

      await googlePayPage.clickGooglePay(page);

      const resultCard = page.locator(SELECTORS.GOOGLE_PAY_RESULT_CARD);
      await expect(resultCard).toContainText('Payment method created', { timeout: 15000 });
      await expect(resultCard).toContainText('synthetic_google_pay_pm_token');
      await expect(resultCard).toContainText('NON_TOKENIZED_CARD');

      expect(tokenizeRequests).toHaveLength(1);
      const [body] = tokenizeRequests;
      expect(body.environment_key).toBeTruthy();
      expect(body.signature).toBeTruthy();
      expect(body.payment_method.google_pay.payment_data).toEqual({
        signature: 'synthetic-google-signature',
        protocolVersion: 'ECv2',
        signedMessage: JSON.stringify({ encryptedMessage: 'synthetic-ciphertext' }),
      });
      expect(body.payment_method.from).toBe(from);

      const request = await page.evaluate(() => (window as any).__gpStub.requests[0]);
      expect(request.allowedPaymentMethods[0].tokenizationSpecification.parameters).toEqual({
        gateway: 'spreedly',
        gatewayMerchantId: body.environment_key,
      });
    });
  }

  test('keeps the sheet open with an error when Spreedly rejects the token', async ({ page }) => {
    await googlePayPage.installGooglePayStub(page);
    await googlePayPage.mockSpreedlyTokenize(page, {
      status: 422,
      body: { errors: [{ key: 'errors.invalid', message: 'is invalid', attribute: 'payment_data' }] },
    });
    await page.goto(`${MONOREPO_URLS.GOOGLE_PAY}?sdk=hosted-fields`);
    test.skip(!(await googlePayPage.hasSdkGlobal(page)), 'SpreedlyGooglePay not in this SDK build');

    await googlePayPage.waitForButton(page);
    await googlePayPage.clickGooglePay(page);

    await expect(googlePayPage.eventLog(page)).toContainText('TOKENIZATION_FAILED', { timeout: 15000 });
    await expect(googlePayPage.eventLog(page)).toContainText('googlePayCancelled');
    const authorization = await page.evaluate(() => (window as any).__gpStub.authorizations[0]);
    expect(authorization.transactionState).toBe('ERROR');
    await expect(page.locator(SELECTORS.GOOGLE_PAY_RESULT_CARD)).toBeHidden();
  });

  test('draws nothing and shows the fallback when Google Pay is not ready', async ({ page }) => {
    await googlePayPage.installGooglePayStub(page, { ready: false });
    await page.goto(`${MONOREPO_URLS.GOOGLE_PAY}?sdk=hosted-fields`);
    test.skip(!(await googlePayPage.hasSdkGlobal(page)), 'SpreedlyGooglePay not in this SDK build');

    await expect(page.locator(SELECTORS.GOOGLE_PAY_FALLBACK)).toBeVisible({ timeout: 15000 });
    await expect(page.locator(SELECTORS.GOOGLE_PAY_FALLBACK)).toContainText('NOT_READY_TO_PAY');
    await expect(page.locator(SELECTORS.GOOGLE_PAY_STUB_BUTTON)).toHaveCount(0);
  });

  test.describe('purchase and 3DS', () => {
    // Purchase routes are fulfilled with SYNTHETIC transactions: these specs check which route the
    // demo picks and what it sends, not Spreedly's 3DS behaviour.
    const withGooglePayType = (googlePayType: string) => {
      const response = JSON.parse(JSON.stringify(TEST_DATA.GOOGLE_PAY_SYNTHETIC_CORE_RESPONSE));
      response.transaction.payment_method.google_pay_type = googlePayType;
      return response;
    };

    test('NON_TOKENIZED_CARD goes through gateway 3DS with browser info', async ({ page }) => {
      await googlePayPage.installGooglePayStub(page);
      await googlePayPage.mockSpreedlyTokenize(page, { body: withGooglePayType('NON_TOKENIZED_CARD') });
      const threeDS = await googlePayPage.mockPurchaseRoute(page, 'create-purchase-with-3ds-gateway-specific');
      const simple = await googlePayPage.mockPurchaseRoute(page, 'simple-purchase');
      await page.goto(`${MONOREPO_URLS.GOOGLE_PAY}?sdk=hosted-fields`);
      test.skip(!(await googlePayPage.hasSdkGlobal(page)), 'SpreedlyGooglePay not in this SDK build');

      await googlePayPage.tokenize(page);
      await googlePayPage.clickPurchase(page);

      await expect(page.locator(SELECTORS.GOOGLE_PAY_RESULT_TITLE)).toHaveText('Purchase succeeded');
      expect(simple).toHaveLength(0);
      expect(threeDS).toHaveLength(1);
      expect(threeDS[0]).toEqual(
        expect.objectContaining({
          payment_method_token: 'synthetic_google_pay_pm_token',
          amount: 4200,
          currency_code: 'USD',
        })
      );
      expect(typeof threeDS[0].browser_info).toBe('string');
    });

    test('TOKENIZED_CARD skips 3DS and uses a simple purchase', async ({ page }) => {
      await googlePayPage.installGooglePayStub(page);
      await googlePayPage.mockSpreedlyTokenize(page, { body: withGooglePayType('TOKENIZED_CARD') });
      const threeDS = await googlePayPage.mockPurchaseRoute(page, 'create-purchase-with-3ds-gateway-specific');
      const simple = await googlePayPage.mockPurchaseRoute(page, 'simple-purchase');
      await page.goto(`${MONOREPO_URLS.GOOGLE_PAY}?sdk=hosted-fields`);
      test.skip(!(await googlePayPage.hasSdkGlobal(page)), 'SpreedlyGooglePay not in this SDK build');

      await googlePayPage.tokenize(page);
      await googlePayPage.clickPurchase(page);

      await expect(page.locator(SELECTORS.GOOGLE_PAY_RESULT_TITLE)).toHaveText('Purchase succeeded');
      await expect(googlePayPage.eventLog(page)).toContainText('skipping 3DS');
      expect(threeDS).toHaveLength(0);
      expect(simple).toHaveLength(1);
    });

    test('3DS Global sends the test SCA provider and scenario', async ({ page }) => {
      await googlePayPage.installGooglePayStub(page);
      await googlePayPage.mockSpreedlyTokenize(page, { body: withGooglePayType('NON_TOKENIZED_CARD') });
      const global3DS = await googlePayPage.mockPurchaseRoute(page, 'create-purchase-with-3ds');
      await page.goto(`${MONOREPO_URLS.GOOGLE_PAY}?sdk=hosted-fields`);
      test.skip(!(await googlePayPage.hasSdkGlobal(page)), 'SpreedlyGooglePay not in this SDK build');

      await googlePayPage.choose3DSMode(page, 'global');
      await googlePayPage.choose3DSScenario(page, 'authenticated');
      await googlePayPage.tokenize(page);
      await googlePayPage.clickPurchase(page);

      await expect(page.locator(SELECTORS.GOOGLE_PAY_RESULT_TITLE)).toHaveText('Purchase succeeded');
      expect(global3DS).toHaveLength(1);
      expect(global3DS[0]).toEqual(
        expect.objectContaining({
          payment_method_token: 'synthetic_google_pay_pm_token',
          sca_provider_type: 'test',
          test_scenario: 'authenticated',
        })
      );
    });
  });
});
