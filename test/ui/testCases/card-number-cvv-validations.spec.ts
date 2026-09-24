import { landingPage } from '../pages/landingPage';
import { tokenizePage } from '../pages/tokenizePage';
import { test, expect } from '../util/fixtures';
import { MONOREPO_URLS } from '../util/urls';
import {
  ERROR_MESSAGES,
  HEADINGS,
  getValidYearString,
  SELECTORS,
  TEST_DATA,
  waitForAuthParams,
  getValidTwoDigitExpiryString,
} from '../util/test-constants';
import { helperFunctions } from '../util/utils';

test.describe('Card Number and CVV Validation', () => {
  test('shows validation for invalid card in express checkout', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.INVALID_CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      cvv: TEST_DATA.CVV,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.INVALID_CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await expect(await helperFunctions.getExpressCheckoutCardNumberField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.INVALID_CARD_NUMBER}"]`).first()).toBeVisible()
  });

  test('shows validation for invalid card in hosted fields', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
    await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.INVALID_CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      cvv: TEST_DATA.CVV,
      twoDigitExpiry: getValidTwoDigitExpiryString(),
    });
    await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.INVALID_CARD_NUMBER_FORMATTED, {
      cvv: TEST_DATA.CVV,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      twoDigitExpiry: getValidTwoDigitExpiryString(),
    });
    await helperFunctions.clickOnHostedFieldsSubmitButton(page);
    await expect(page.locator(SELECTORS.TOKENIZATION_FAILED_MESSAGE_SELECTOR)).toBeVisible();
    await expect(page.locator(SELECTORS.TOKENIZATION_FAILED_MESSAGE_SELECTOR)).toHaveText(ERROR_MESSAGES.TOKENIZATION_FAILED_MESSAGE);
  });

  test('CVV validation for express checkout', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.INVALID_CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      cvv: TEST_DATA.INVALID_CVV_SHORT,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.INVALID_CARD_NUMBER, {
      cvv: TEST_DATA.INVALID_CVV_SHORT,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await expect(await helperFunctions.getExpressCheckoutCvvField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.INVALID_CVV}"]`).first()).toBeVisible()
  });

  test('tokenizes hosted fields with empty CVV when CVV optional is enabled', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.checkCvvOptionalCheckbox(page);
    await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
    await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      twoDigitExpiry: getValidTwoDigitExpiryString(),
    });
    await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.CARD_NUMBER_FORMATTED, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      twoDigitExpiry: getValidTwoDigitExpiryString(),
    });
    await expect(await helperFunctions.getHostedFieldsCvvField(page)).toHaveValue('');
    await helperFunctions.clickOnHostedFieldsSubmitButton(page);
    const resultTitle = await tokenizePage.getResultCardTitle(page);
    await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
    await helperFunctions.verifyResultCard(page, TEST_DATA.CARD_FIRST_SIX_DIGITS_VISA, TEST_DATA.CARD_LAST_FOUR_DIGITS_VISA, TEST_DATA.CACHED_STORAGE_STATE, {
      expiryDate: {
        year: getValidYearString(),
        month: TEST_DATA.EXPIRY_MONTH,
      },
    });
  });

  test('still validates typed CVV in hosted fields when CVV optional is enabled', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.checkCvvOptionalCheckbox(page);
    await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
    await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      cvv: TEST_DATA.INVALID_CVV_SHORT,
      twoDigitExpiry: getValidTwoDigitExpiryString(),
    });
    await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.CARD_NUMBER_FORMATTED, {
      cvv: TEST_DATA.INVALID_CVV_SHORT,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      twoDigitExpiry: getValidTwoDigitExpiryString(),
    });
    await helperFunctions.clickOnHostedFieldsSubmitButton(page);
    await expect(page.locator('#cvv-error')).toHaveText('CVV is invalid');
    await expect(page.locator(SELECTORS.TOKENIZATION_FAILED_MESSAGE_SELECTOR)).toBeVisible();
    await expect(page.locator(SELECTORS.TOKENIZATION_FAILED_MESSAGE_SELECTOR)).toHaveText(ERROR_MESSAGES.TOKENIZATION_FAILED_MESSAGE);
  });

  test('tokenizes express checkout with empty CVV when CVV at launch is optional', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.selectCvvAtLaunchOption(page, 'optional');
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await expect(await helperFunctions.getExpressCheckoutCvvField(page)).toBeVisible();
    await expect(await helperFunctions.getExpressCheckoutCvvField(page)).toHaveValue('');
    await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
    const resultTitle = await tokenizePage.getResultCardTitle(page);
    await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
    await helperFunctions.verifyResultCard(page, TEST_DATA.CARD_FIRST_SIX_DIGITS_VISA, TEST_DATA.CARD_LAST_FOUR_DIGITS_VISA, TEST_DATA.CACHED_STORAGE_STATE, {
      expiryDate: {
        year: getValidYearString(),
        month: TEST_DATA.EXPIRY_MONTH,
      },
    });
  });

  test('still validates typed CVV in express checkout when CVV at launch is optional', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.selectCvvAtLaunchOption(page, 'optional');
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      cvv: TEST_DATA.INVALID_CVV_SHORT,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.INVALID_CVV_SHORT,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await expect(await helperFunctions.getExpressCheckoutCvvField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.INVALID_CVV}"]`).first()).toBeVisible();
  });

  test('hides CVV and tokenizes express checkout when CVV at launch is hidden', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.selectCvvAtLaunchOption(page, 'hidden');
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).getByTestId('verification_value')).toHaveCount(0);
    await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
    const resultTitle = await tokenizePage.getResultCardTitle(page);
    await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
    await helperFunctions.verifyResultCard(page, TEST_DATA.CARD_FIRST_SIX_DIGITS_VISA, TEST_DATA.CARD_LAST_FOUR_DIGITS_VISA, TEST_DATA.CACHED_STORAGE_STATE, {
      expiryDate: {
        year: getValidYearString(),
        month: TEST_DATA.EXPIRY_MONTH,
      },
    });
  });

  test('tokenizes express checkout with empty CVV when runtime CVV optional is enabled', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await tokenizePage.checkExpressCheckoutCvvRuntimeOption(page, 'optional');
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await expect(await helperFunctions.getExpressCheckoutCvvField(page)).toBeVisible();
    await expect(await helperFunctions.getExpressCheckoutCvvField(page)).toHaveValue('');
    await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
    const resultTitle = await tokenizePage.getResultCardTitle(page);
    await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
    await helperFunctions.verifyResultCard(page, TEST_DATA.CARD_FIRST_SIX_DIGITS_VISA, TEST_DATA.CARD_LAST_FOUR_DIGITS_VISA, TEST_DATA.CACHED_STORAGE_STATE, {
      expiryDate: {
        year: getValidYearString(),
        month: TEST_DATA.EXPIRY_MONTH,
      },
    });
  });

  test('still validates typed CVV in express checkout when runtime CVV optional is enabled', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await tokenizePage.checkExpressCheckoutCvvRuntimeOption(page, 'optional');
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      cvv: TEST_DATA.INVALID_CVV_SHORT,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.INVALID_CVV_SHORT,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await expect(await helperFunctions.getExpressCheckoutCvvField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.INVALID_CVV}"]`).first()).toBeVisible();
  });

  test('hides CVV and tokenizes express checkout when runtime CVV hidden is enabled', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await tokenizePage.checkExpressCheckoutCvvRuntimeOption(page, 'hidden');
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await expect(await helperFunctions.getExpressCheckoutCvvField(page)).toBeHidden();
    await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
    const resultTitle = await tokenizePage.getResultCardTitle(page);
    await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
    await helperFunctions.verifyResultCard(page, TEST_DATA.CARD_FIRST_SIX_DIGITS_VISA, TEST_DATA.CARD_LAST_FOUR_DIGITS_VISA, TEST_DATA.CACHED_STORAGE_STATE, {
      expiryDate: {
        year: getValidYearString(),
        month: TEST_DATA.EXPIRY_MONTH,
      },
    });
  });
});
