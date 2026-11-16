import { type Page } from '@playwright/test';
import { test, expect } from '../util/fixtures';
import { landingPage } from '../pages/landingPage';
import { googlePayPage } from '../pages/googlePayPage';
import { purchasePage } from '../pages/3dsPage';
import { helperFunctions } from '../util/utils';
import {
  getValidYearString,
  LABELS,
  SELECTORS,
  TEST_DATA,
  THREE_DS_SELECTORS,
  waitForAuthParams,
} from '../util/test-constants';
import { MONOREPO_URLS } from '../util/urls';

test.describe('Google Pay payments — payment sheet', () => {
  test('selects each payment sheet option and verifies it in the Google Pay config', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnGooglePayButton(page);
    await waitForAuthParams(page);
    await googlePayPage.waitForConfigSnippet(page);

    await googlePayPage.uncheckCheckbox(page, LABELS.GOOGLE_PAY_CRYPTOGRAM_3DS);
    let config = await googlePayPage.waitForConfigMatching(
      page,
      c => Array.isArray(c.allowedAuthMethods) && !c.allowedAuthMethods.includes('CRYPTOGRAM_3DS')
    );
    expect(config.allowedAuthMethods).toEqual(['PAN_ONLY']);

    await googlePayPage.checkCheckbox(page, LABELS.GOOGLE_PAY_CRYPTOGRAM_3DS);
    config = await googlePayPage.waitForConfigMatching(
      page,
      c => Array.isArray(c.allowedAuthMethods) && c.allowedAuthMethods.includes('CRYPTOGRAM_3DS')
    );
    expect(config.allowedAuthMethods).toEqual(['PAN_ONLY', 'CRYPTOGRAM_3DS']);

    await googlePayPage.uncheckCheckbox(page, LABELS.GOOGLE_PAY_NETWORK_JCB);
    config = await googlePayPage.waitForConfigMatching(
      page,
      c => Array.isArray(c.allowedCardNetworks) && !c.allowedCardNetworks.includes('JCB')
    );
    expect(config.allowedCardNetworks).toEqual(['AMEX', 'DISCOVER', 'MASTERCARD', 'VISA']);

    await googlePayPage.checkCheckbox(page, LABELS.GOOGLE_PAY_NETWORK_JCB);
    config = await googlePayPage.waitForConfigMatching(
      page,
      c => Array.isArray(c.allowedCardNetworks) && c.allowedCardNetworks.includes('JCB')
    );
    expect(config.allowedCardNetworks).toEqual(['AMEX', 'DISCOVER', 'JCB', 'MASTERCARD', 'VISA']);

    await googlePayPage.checkCheckbox(page, LABELS.GOOGLE_PAY_BILLING_ADDRESS);
    config = await googlePayPage.waitForConfigMatching(page, c => c.billingAddressRequired === true);
    expect(config.billingAddressRequired).toBe(true);
    expect(config.billingAddressParameters).toEqual({ format: 'FULL' });

    await googlePayPage.checkCheckbox(page, LABELS.GOOGLE_PAY_SHIPPING_ADDRESS);
    config = await googlePayPage.waitForConfigMatching(page, c => c.shippingAddressRequired === true);
    expect(config.shippingAddressRequired).toBe(true);
    expect(config.shippingOptionRequired).toBe(true);
    expect(config.shippingAddressParameters).toEqual({ allowedCountryCodes: ['US'] });
    expect(config.shippingOptionParameters.defaultSelectedOptionId).toBe('standard');
    expect(config.callbackIntents).toEqual(expect.arrayContaining(['SHIPPING_ADDRESS', 'SHIPPING_OPTION']));

    await googlePayPage.checkCheckbox(page, LABELS.GOOGLE_PAY_EMAIL);
    config = await googlePayPage.waitForConfigMatching(page, c => c.emailRequired === true);
    expect(config.emailRequired).toBe(true);

    await googlePayPage.checkCheckbox(page, LABELS.GOOGLE_PAY_PROMO_CODES);
    config = await googlePayPage.waitForConfigMatching(
      page,
      c => Array.isArray(c.callbackIntents) && c.callbackIntents.includes('OFFER')
    );
    expect(config.callbackIntents).toEqual(
      expect.arrayContaining(['SHIPPING_ADDRESS', 'SHIPPING_OPTION', 'OFFER'])
    );
    expect(config.onPaymentDataChange).toBe('[Function onPaymentDataChange]');

    await googlePayPage.checkCheckbox(page, LABELS.GOOGLE_PAY_REFUSE_PREPAID);
    config = await googlePayPage.waitForConfigMatching(page, c => c.allowPrepaidCards === false);
    expect(config.allowPrepaidCards).toBe(false);

    await googlePayPage.checkCheckbox(page, LABELS.GOOGLE_PAY_REFUSE_CREDIT);
    config = await googlePayPage.waitForConfigMatching(page, c => c.allowCreditCards === false);
    expect(config.allowCreditCards).toBe(false);

    await googlePayPage.checkCheckbox(page, LABELS.GOOGLE_PAY_ASSURANCE_DETAILS);
    config = await googlePayPage.waitForConfigMatching(page, c => c.assuranceDetailsRequired === true);
    expect(config.assuranceDetailsRequired).toBe(true);
  });

  test('updates Google Pay button color, type and corner radius on the rendered button', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnGooglePayButton(page);
    await waitForAuthParams(page);
    await googlePayPage.waitForConfigSnippet(page);
    await googlePayPage.waitForButton(page);

    for (const color of TEST_DATA.GOOGLE_PAY_BUTTON_COLORS) {
      await googlePayPage.selectDropdownOption(page, SELECTORS.GOOGLE_PAY_BTN_COLOR, color);
      const config = await googlePayPage.waitForConfigMatching(page, c => c.button?.buttonColor === color);
      expect(config.button.buttonColor).toBe(color);
      await googlePayPage.waitForButton(page);
      const buttonClass = await googlePayPage.getRenderedButtonClass(page);
      const expectedColorClass = color === 'default' ? 'black' : color;
      expect(buttonClass.toLowerCase()).toContain(expectedColorClass);
    }

    for (const type of TEST_DATA.GOOGLE_PAY_BUTTON_TYPES) {
      await googlePayPage.selectDropdownOption(page, SELECTORS.GOOGLE_PAY_BTN_TYPE, type);
      const config = await googlePayPage.waitForConfigMatching(page, c => c.button?.buttonType === type);
      expect(config.button.buttonType).toBe(type);
      await googlePayPage.waitForButton(page);
      const buttonClass = await googlePayPage.getRenderedButtonClass(page);
      expect(buttonClass.toLowerCase()).toContain(type);
    }

    await googlePayPage.setCornerRadius(page, TEST_DATA.GOOGLE_PAY_BUTTON_CORNER_RADIUS);
    const config = await googlePayPage.waitForConfigMatching(
      page,
      c => c.button?.buttonRadius === TEST_DATA.GOOGLE_PAY_BUTTON_CORNER_RADIUS
    );
    expect(config.button.buttonRadius).toBe(TEST_DATA.GOOGLE_PAY_BUTTON_CORNER_RADIUS);
    await googlePayPage.waitForButton(page);
    const borderRadius = await googlePayPage.getRenderedButtonBorderRadius(page);
    expect(borderRadius).toBe(`${TEST_DATA.GOOGLE_PAY_BUTTON_CORNER_RADIUS}px`);
  });

  test('pays with the Express Checkout form and completes the 3DS challenge', async ({ page }) => {
    await openGooglePayExpressCheckout(page);
    await page.locator(SELECTORS.GOOGLE_PAY_3DS_SCENARIO('challenge')).check();
    const purchase = await fillExpressCheckoutAndPurchase(page);

    await purchasePage.waitForChallengeForm(page);
    const challengeFrame = page.frameLocator(THREE_DS_SELECTORS.CHALLENGE_IFRAME);
    await challengeFrame.getByRole('button', { name: 'Allow' }).click();

    await expect(page.locator(SELECTORS.GOOGLE_PAY_RESULT_TITLE)).toHaveText('Purchase succeeded', {
      timeout: 30000,
    });
    expect(purchase.status).toBe(200);
    expect(purchase.request).toEqual(
      expect.objectContaining({
        amount: 4200,
        currency_code: 'USD',
        sca_provider_type: 'test',
        test_scenario: 'challenge',
      })
    );
    expect(purchase.request.payment_method_token).toBeTruthy();
  });

  test('pays with the Express Checkout form on 3DS frictionless success', async ({ page }) => {
    await openGooglePayExpressCheckout(page);
    await page.locator(SELECTORS.GOOGLE_PAY_3DS_SCENARIO('authenticated')).check();
    const purchase = await fillExpressCheckoutAndPurchase(page);

    await expect(page.locator(SELECTORS.GOOGLE_PAY_RESULT_TITLE)).toHaveText('Purchase succeeded', {
      timeout: 30000,
    });
    expect(purchase.status).toBe(200);
    expect(purchase.request).toEqual(
      expect.objectContaining({
        amount: 4200,
        currency_code: 'USD',
        sca_provider_type: 'test',
        test_scenario: 'authenticated',
      })
    );
    expect(purchase.request.payment_method_token).toBeTruthy();
  });

  test('pays with the Express Checkout form on 3DS frictionless failure', async ({ page }) => {
    await openGooglePayExpressCheckout(page);
    await page.locator(SELECTORS.GOOGLE_PAY_3DS_SCENARIO('not_authenticated')).check();
    const purchase = await fillExpressCheckoutAndPurchase(page);

    await expect(page.locator(SELECTORS.GOOGLE_PAY_RESULT_TITLE)).toHaveText('Purchase failed', {
      timeout: 30000,
    });
    expect(purchase.request).toEqual(
      expect.objectContaining({
        amount: 4200,
        currency_code: 'USD',
        sca_provider_type: 'test',
        test_scenario: 'not_authenticated',
      })
    );
    expect(purchase.request.payment_method_token).toBeTruthy();
  });

  test('purchases with Gateway 3DS and triggers the gateway 3DS API', async ({ page }) => {
    await openGooglePayExpressCheckout(page);
    await page.locator(SELECTORS.GOOGLE_PAY_3DS_MODE('gateway')).check();

    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      cvv: TEST_DATA.CVV,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });

    const gatewayPurchase = page.waitForRequest(
      request =>
        request.url().includes('/v1/create-purchase-with-3ds-gateway-specific') && request.method() === 'POST',
      { timeout: 30000 }
    );

    await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
    await expect(page.locator(SELECTORS.GOOGLE_PAY_RESULT_TITLE)).toHaveText('Payment method created', {
      timeout: 20000,
    });
    await page.locator(SELECTORS.GOOGLE_PAY_PURCHASE_BUTTON).click();

    const request = await gatewayPurchase;
    const body = request.postDataJSON();
    expect(request.url()).toContain('/v1/create-purchase-with-3ds-gateway-specific');
    expect(body).toEqual(
      expect.objectContaining({
        amount: 4200,
        currency_code: 'USD',
      })
    );
    expect(body.payment_method_token).toBeTruthy();
    expect(body.browser_info).toBeTruthy();
  });
});

async function openGooglePayExpressCheckout(page: Page) {
  await page.goto(MONOREPO_URLS.BASE);
  await landingPage.clickOnExpressCheckoutButton(page);
  await landingPage.clickOnGooglePayButton(page);
  await waitForAuthParams(page);
  await page.locator(SELECTORS.GOOGLE_PAY_3DS_MODE('global')).check();

  const expressForm = page.locator(`${SELECTORS.GOOGLE_PAY_EC_CONTAINER} ${SELECTORS.EXPRESS_IFRAME}`);
  await expect(expressForm).toBeVisible({ timeout: 20000 });
}

async function fillExpressCheckoutAndPurchase(page: Page) {

  await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_CARD_NUMBER, {
    firstName: TEST_DATA.FIRST_NAME,
    lastName: TEST_DATA.LAST_NAME,
    cvv: TEST_DATA.CVV,
    expiryMonth: TEST_DATA.EXPIRY_MONTH,
    expiryYear: getValidYearString(),
  });

  let purchaseRequest: any = null;
  let purchaseStatus: number | null = null;
  page.on('request', request => {
    if (request.url().includes('/v1/create-purchase-with-3ds') && request.method() === 'POST') {
      purchaseRequest = request.postDataJSON();
    }
  });
  page.on('response', response => {
    if (response.url().includes('/v1/create-purchase-with-3ds') && response.request().method() === 'POST') {
      purchaseStatus = response.status();
    }
  });

  await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
  await expect(page.locator(SELECTORS.GOOGLE_PAY_RESULT_TITLE)).toHaveText('Payment method created', {
    timeout: 20000,
  });
  await page.locator(SELECTORS.GOOGLE_PAY_PURCHASE_BUTTON).click();

  return {
    get request() {
      return purchaseRequest;
    },
    get status() {
      return purchaseStatus;
    },
  };
}
