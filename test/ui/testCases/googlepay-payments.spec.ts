import { test, expect } from '../util/fixtures';
import { landingPage } from '../pages/landingPage';
import { googlePayPage } from '../pages/googlePayPage';
import { LABELS, SELECTORS, TEST_DATA, waitForAuthParams } from '../util/test-constants';
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

  test.only('updates Google Pay button color, type and corner radius on the rendered button', async ({ page }) => {
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
});
