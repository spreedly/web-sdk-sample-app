import { test, expect } from '../util/fixtures';
import { landingPage } from '../pages/landingPage';
import { tokenizePage } from '../pages/tokenizePage';
import { helperFunctions } from '../util/utils';
import { MONOREPO_URLS } from '../util/urls';
import {
  PLACEHOLDERS,
  HEADINGS,
  LABELS,
  TEST_DATA,
  ERROR_PATTERNS,
  ERROR_SELECTORS,
  CSS_PROPERTIES,
  getValidYearString,
  waitForAuthParams,
  getMaskedCardNumber,
  SELECTORS,
  ERROR_MESSAGES,
} from "../util/test-constants";


test.describe("Allow Blank Date Option", () => {
  
  test("should allow blank date when option is enabled in tokenize flow with Express Checkout", async ({
    page,
  }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnAllowBlankDateCheckbox(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME
    });
    await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
    const resultTitle = await tokenizePage.getResultCardTitle(page);
    await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
    await helperFunctions.verifyResultCard(page, TEST_DATA.CARD_FIRST_SIX_DIGITS_VISA, TEST_DATA.CARD_LAST_FOUR_DIGITS_VISA, TEST_DATA.CACHED_STORAGE_STATE);
    // To be changed if the output in result card is changed
    const expiryValue = page.locator('.result-label:has-text("Expiry")').locator('+ .result-value');
    await expect(expiryValue).toHaveText(TEST_DATA.BLANK_DATE_RESULT_CARD);
  });

  test("should show warning in express checkout when allow blank date option is disabled", async ({
    page,
  }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME
    });
    await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
    await expect(await helperFunctions.getExpressCheckoutYearField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(await helperFunctions.getExpressCheckoutMonthField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.YEAR_REQUIRED_EXPRESS_CHECKOUT}"]`).first()).toBeVisible()
    await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.MONTH_REQUIRED_EXPRESS_CHECKOUT}"]`).first()).toBeVisible()
  });

  test("should allow blank date when option is enabled in tokenize flow with Hosted Fields", async ({
    page,
  }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnAllowBlankDateCheckbox(page);
    await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
    await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      cvv: TEST_DATA.CVV,
    }
  );
   await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.CARD_NUMBER_FORMATTED, {
    firstName: TEST_DATA.FIRST_NAME,
    lastName: TEST_DATA.LAST_NAME,
    cvv: TEST_DATA.CVV,
   });
   await helperFunctions.clickOnHostedFieldsSubmitButton(page);
   const resultTitle = await tokenizePage.getResultCardTitle(page);
   await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
   await helperFunctions.verifyResultCard(page, TEST_DATA.CARD_FIRST_SIX_DIGITS_VISA, TEST_DATA.CARD_LAST_FOUR_DIGITS_VISA, TEST_DATA.CACHED_STORAGE_STATE);
    // To be changed if the output in result card is changed
   const expiryValue = page.locator('.result-label:has-text("Expiry")').locator('+ .result-value');
   await expect(expiryValue).toHaveText(TEST_DATA.BLANK_DATE_RESULT_CARD);
  });

  test("should show warning when blank name option is disabled in tokenize flow with Hosted Fields", async ({
    page,
  }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
    await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME
    }
  );
   await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.CARD_NUMBER_FORMATTED, {
    firstName: TEST_DATA.FIRST_NAME,
    lastName: TEST_DATA.LAST_NAME,
    cvv: TEST_DATA.CVV
   });
   await expect(await helperFunctions.getHostedFieldsSubmitButton(page)).toBeDisabled();
  });

  test("should allow blank date when option is enabled in tokenize flow with Express Checkout dialog mode", async ({
    page,
  }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnAllowBlankDateCheckbox(page);
    await tokenizePage.clickOnDialogMode(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      cvv: TEST_DATA.CVV,
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
    });
    await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
    const resultTitle = await tokenizePage.getResultCardTitle(page);
    await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
    await helperFunctions.verifyResultCard(page, TEST_DATA.CARD_FIRST_SIX_DIGITS_VISA, TEST_DATA.CARD_LAST_FOUR_DIGITS_VISA, TEST_DATA.CACHED_STORAGE_STATE);
    // To be changed if the output in result card is changed
    const expiryValue = page.locator('.result-label:has-text("Expiry")').locator('+ .result-value');
    await expect(expiryValue).toHaveText(TEST_DATA.BLANK_DATE_RESULT_CARD);
  });

  test("should show warning when blank name option is disabled in tokenize flow with express checkout dialog mode", async ({
    page,
  }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnDialogMode(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
    });
    await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
    await expect(await helperFunctions.getExpressCheckoutYearField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(await helperFunctions.getExpressCheckoutMonthField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.YEAR_REQUIRED_EXPRESS_CHECKOUT}"]`).first()).toBeVisible()
    await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.MONTH_REQUIRED_EXPRESS_CHECKOUT}"]`).first()).toBeVisible()
  });
});

