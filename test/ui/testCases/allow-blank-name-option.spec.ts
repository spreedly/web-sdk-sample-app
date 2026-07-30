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


test.describe("Allow Blank Name Option - Monorepo", () => {
  
  test("should allow blank name when option is enabled in tokenize flow with Express Checkout", async ({
    page,
  }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnAllowBlankNameCheckbox(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: "",
      lastName: "",
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await expect(await helperFunctions.getExpressCheckoutFirstNameField(page)).not.toHaveCSS('border-color', CSS_PROPERTIES.RED_BORDER);
    await expect(await helperFunctions.getExpressCheckoutLastNameField(page)).not.toHaveCSS('border-color', CSS_PROPERTIES.RED_BORDER);
    await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
    const resultTitle = await tokenizePage.getResultCardTitle(page);
    await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
    await helperFunctions.verifyResultCard(page, TEST_DATA.CARD_FIRST_SIX_DIGITS_VISA, TEST_DATA.CARD_LAST_FOUR_DIGITS_VISA, TEST_DATA.CACHED_STORAGE_STATE,{
      expiryDate: {
        year: getValidYearString(),
        month: TEST_DATA.EXPIRY_MONTH,
      },
    });
  });

  test("should show warning in express checkout when allow blank name option is disabled", async ({
    page,
  }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: "",
      lastName: "",
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
    await expect(await helperFunctions.getExpressCheckoutFirstNameField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(await helperFunctions.getExpressCheckoutLastNameField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.FIRST_NAME_REQUIRED_EXPRESS_CHECKOUT}"]`).first()).toBeVisible()
    await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.LAST_NAME_REQUIRED_EXPRESS_CHECKOUT}"]`).first()).toBeVisible()
  });

  test("should allow blank name when option is enabled in tokenize flow with Hosted Fields", async ({
    page,
  }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnAllowBlankNameCheckbox(page);
    await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
    await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    }
  );
   await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.CARD_NUMBER_FORMATTED, {
    firstName: "",
    lastName: "",
    cvv: TEST_DATA.CVV,
    expiryMonth: TEST_DATA.EXPIRY_MONTH,
    expiryYear: getValidYearString(),
   });
   await helperFunctions.clickOnHostedFieldsSubmitButton(page);
   const resultTitle = await tokenizePage.getResultCardTitle(page);
   await helperFunctions.verifyResultCard(page, TEST_DATA.CARD_FIRST_SIX_DIGITS_VISA, TEST_DATA.CARD_LAST_FOUR_DIGITS_VISA, TEST_DATA.CACHED_STORAGE_STATE,{
    expiryDate: {
      year: getValidYearString(),
      month: TEST_DATA.EXPIRY_MONTH,
    },
   });
   await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
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
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    }
  );
   await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.CARD_NUMBER_FORMATTED, {
    firstName: "",
    lastName: "",
    cvv: TEST_DATA.CVV,
    expiryMonth: TEST_DATA.EXPIRY_MONTH,
    expiryYear: getValidYearString(),
   });
   await expect(await helperFunctions.getHostedFieldsSubmitButton(page)).toBeDisabled();
  });

  test("should show warning when blank name option is enabled in tokenize flow with Express Checkout dialog mode", async ({
    page,
  }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnAllowBlankNameCheckbox(page);
    await tokenizePage.clickOnDialogMode(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: "",
      lastName: "",
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await expect(await helperFunctions.getExpressCheckoutFirstNameField(page)).not.toHaveCSS('border-color', CSS_PROPERTIES.RED_BORDER);
    await expect(await helperFunctions.getExpressCheckoutLastNameField(page)).not.toHaveCSS('border-color', CSS_PROPERTIES.RED_BORDER);
    await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
    const resultTitle = await tokenizePage.getResultCardTitle(page);
    await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
    await helperFunctions.verifyResultCard(page, TEST_DATA.CARD_FIRST_SIX_DIGITS_VISA, TEST_DATA.CARD_LAST_FOUR_DIGITS_VISA, TEST_DATA.CACHED_STORAGE_STATE,{
      expiryDate: {
        year: getValidYearString(),
        month: TEST_DATA.EXPIRY_MONTH,
      },
    });
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
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: "",
      lastName: "",
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
    await expect(await helperFunctions.getExpressCheckoutFirstNameField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(await helperFunctions.getExpressCheckoutLastNameField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.FIRST_NAME_REQUIRED_EXPRESS_CHECKOUT}"]`).first()).toBeVisible()
    await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.LAST_NAME_REQUIRED_EXPRESS_CHECKOUT}"]`).first()).toBeVisible()
  });
});

