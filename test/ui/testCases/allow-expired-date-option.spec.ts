import { test, expect } from '../util/fixtures';
import { landingPage } from '../pages/landingPage';
import { tokenizePage } from '../pages/tokenizePage';
import { helperFunctions } from '../util/utils';
import { MONOREPO_URLS } from '../util/urls';
import {
  URLS,
  SELECTORS,
  PLACEHOLDERS,
  LABELS,
  TEST_DATA,
  HEADINGS,
  ERROR_PATTERNS,
  ERROR_MESSAGES,
  CSS_PROPERTIES,
  getExpiredYearString,
  waitForAuthParams,
  getMaskedCardNumber,
  getValidYearString
} from '../util/test-constants';

test.describe("Allow Expired Date Option", () => {
    test("should show warning in express checkout when expired date option is disabled", async ({
      page,
    }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnExpressCheckoutButton(page);
        await landingPage.clickOnTokenizeButton(page);
        await waitForAuthParams(page);
        await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
          firstName: TEST_DATA.FIRST_NAME,
          lastName: TEST_DATA.LAST_NAME,
          cvv: TEST_DATA.CVV,
          expiryMonth: TEST_DATA.EXPIRY_MONTH,
          expiryYear: getExpiredYearString(),
        });
        await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
            cvv: TEST_DATA.CVV,
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getExpiredYearString(),
          });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await expect(await helperFunctions.getExpiredYearErrorMessage(page)).toBeVisible()
        await expect(await helperFunctions.getExpressCheckoutMonthField(page)).toHaveAttribute('aria-invalid', 'false');
        await expect(await helperFunctions.getExpressCheckoutYearField(page)).toHaveAttribute('aria-invalid', 'true');
    });
    
    test("should allow expired date in express checkout when option is enabled", async ({
      page,
    }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnExpressCheckoutButton(page);
        await landingPage.clickOnTokenizeButton(page);
        await waitForAuthParams(page);
        await tokenizePage.clickOnAllowExpiredDateCheckbox(page);
        await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
          firstName: TEST_DATA.FIRST_NAME,
          lastName: TEST_DATA.LAST_NAME,
          cvv: TEST_DATA.CVV,
          expiryMonth: TEST_DATA.EXPIRY_MONTH,
          expiryYear: getExpiredYearString(),
        });
        await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
            cvv: TEST_DATA.CVV,
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getExpiredYearString(),
          });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await expect(await helperFunctions.getExpiredYearErrorMessage(page)).not.toBeVisible()
        await expect(await helperFunctions.getExpressCheckoutMonthField(page)).toHaveAttribute('aria-invalid', 'false');
        await expect(await helperFunctions.getExpressCheckoutYearField(page)).toHaveAttribute('aria-invalid', 'false');
        const resultTitle = await tokenizePage.getResultCardTitle(page);
        await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
        await helperFunctions.verifyResultCard(page, TEST_DATA.CARD_FIRST_SIX_DIGITS_VISA, TEST_DATA.CARD_LAST_FOUR_DIGITS_VISA, { year: getExpiredYearString(), month: TEST_DATA.EXPIRY_MONTH }, TEST_DATA.CACHED_STORAGE_STATE);
    });
  
    test("should allow expired date in hosted fields when option is enabled", async ({
      page,
    }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnTokenizeButton(page);
        await waitForAuthParams(page);
        await tokenizePage.clickOnAllowExpiredDateCheckbox(page);
        await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.CARD_NUMBER, {
          firstName: TEST_DATA.FIRST_NAME,
          lastName: TEST_DATA.LAST_NAME,
          cvv: TEST_DATA.CVV,
          expiryMonth: TEST_DATA.EXPIRY_MONTH,
          expiryYear: getExpiredYearString(),
        });
        await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.CARD_NUMBER, {
            cvv: TEST_DATA.CVV,
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getExpiredYearString(),
          });
        await helperFunctions.clickOnHostedFieldsSubmitButton(page);
        const resultTitle = await tokenizePage.getResultCardTitle(page);
        await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
        await helperFunctions.verifyResultCard(page, TEST_DATA.CARD_FIRST_SIX_DIGITS_VISA, TEST_DATA.CARD_LAST_FOUR_DIGITS_VISA, { year: getExpiredYearString(), month: TEST_DATA.EXPIRY_MONTH }, TEST_DATA.CACHED_STORAGE_STATE);
    });
  
    test("should show warning in hosted fields when expired date option is disabled", async ({
      page,
    }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnTokenizeButton(page);
        await waitForAuthParams(page);
        await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.CARD_NUMBER, {
          firstName: TEST_DATA.FIRST_NAME,
          lastName: TEST_DATA.LAST_NAME,
          cvv: TEST_DATA.CVV,
          expiryMonth: TEST_DATA.EXPIRY_MONTH,
          expiryYear: getExpiredYearString(),
        });
        await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.CARD_NUMBER, {
            cvv: TEST_DATA.CVV,
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getExpiredYearString(),
          });
        await helperFunctions.clickOnHostedFieldsSubmitButton(page);
        await expect(await helperFunctions.getTokenizationFailedMessage(page)).toBeVisible();
        await expect(await helperFunctions.getTokenizationFailedMessage(page)).toHaveText(ERROR_MESSAGES.TOKENIZATION_FAILED_MESSAGE);
    });

    test("should show warning when allow expired date option is disabled in tokenize flow with express checkout dialog mode", async ({
      page,
    }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnExpressCheckoutButton(page);
        await landingPage.clickOnTokenizeButton(page);
        await waitForAuthParams(page);
        await tokenizePage.clickOnDialogMode(page);
        await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
          firstName: TEST_DATA.FIRST_NAME,
          lastName: TEST_DATA.LAST_NAME,
          cvv: TEST_DATA.CVV,
          expiryMonth: TEST_DATA.EXPIRY_MONTH,
          expiryYear: getExpiredYearString(),
        });
        await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
            cvv: TEST_DATA.CVV,
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getExpiredYearString(),
          });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await expect(await helperFunctions.getExpiredYearErrorMessage(page)).toBeVisible()
        await expect(await helperFunctions.getExpressCheckoutMonthField(page)).toHaveAttribute('aria-invalid', 'false');
        await expect(await helperFunctions.getExpressCheckoutYearField(page)).toHaveAttribute('aria-invalid', 'true');
        
    });

    test("should allow expired date when allow expired date option is enabled in tokenize flow with hosted fields dialog mode", async ({
      page,
    }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnExpressCheckoutButton(page);
        await landingPage.clickOnTokenizeButton(page);
        await waitForAuthParams(page);
        await tokenizePage.clickOnAllowExpiredDateCheckbox(page);
        await tokenizePage.clickOnDialogMode(page);
        await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
          firstName: TEST_DATA.FIRST_NAME,
          lastName: TEST_DATA.LAST_NAME,
          cvv: TEST_DATA.CVV,
          expiryMonth: TEST_DATA.EXPIRY_MONTH,
          expiryYear: getExpiredYearString(),
        });
        await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.CARD_NUMBER, {
            cvv: TEST_DATA.CVV,
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getExpiredYearString(),
          });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await expect(await helperFunctions.getExpiredYearErrorMessage(page)).not.toBeVisible()
        await expect(await helperFunctions.getExpressCheckoutMonthField(page)).toHaveAttribute('aria-invalid', 'false');
        await expect(await helperFunctions.getExpressCheckoutYearField(page)).toHaveAttribute('aria-invalid', 'false');
        const resultTitle = await tokenizePage.getResultCardTitle(page);
        await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
        await helperFunctions.verifyResultCard(page, TEST_DATA.CARD_FIRST_SIX_DIGITS_VISA, TEST_DATA.CARD_LAST_FOUR_DIGITS_VISA, { year: getExpiredYearString(), month: TEST_DATA.EXPIRY_MONTH }, TEST_DATA.CACHED_STORAGE_STATE);
    });
  });
  
  
  