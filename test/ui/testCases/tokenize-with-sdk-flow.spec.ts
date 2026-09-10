import { purchasePage } from "../pages/3dsPage";
import { landingPage } from "../pages/landingPage";
import { test, expect } from "../util/fixtures";
import { TEST_DATA, waitForAuthParams, getValidYearString, getValidTwoDigitExpiryString, SELECTORS, ERROR_MESSAGES, ERROR_SELECTORS } from "../util/test-constants";
import { MONOREPO_URLS } from "../util/urls";
import { helperFunctions } from "../util/utils";
import { tokenizePage } from "../pages/tokenizePage";
import { tokenizeWithSdkPage } from "../pages/tokenizeWithSdkPage";

test.describe('Tokenize with SDK Flow', () => {
    test('Verify ZIP validation in hosted fields', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnTokenizeWithSDKButton(page);
        await waitForAuthParams(page);
        await tokenizeWithSdkPage.clickOnCustomFieldValidatorDropdown(page);
        await tokenizeWithSdkPage.selectCustomFieldValidatorByName(page, SELECTORS.CUSTOM_FIELD_VALIDATOR_ZIP_FORMAT);
        await tokenizeWithSdkPage.clickOnHostedCatalogueFieldsDropdown(page);
        await tokenizeWithSdkPage.selectFieldsByName(page, 'zip')
        await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
        await helperFunctions.fillHostedFieldsFormWithCatalogueFields(page, TEST_DATA.CARD_NUMBER, {
            zip: TEST_DATA.INVALID_ZIP_CODE,
        });
        await helperFunctions.clickOnValidateButton(page);
        const error = await tokenizeWithSdkPage.getHostedFieldErrorByFieldName(page, ERROR_SELECTORS.HOSTED_FIELD_ZIP_ERROR_HOSTED_FIELDS);
        await expect(error).toBeVisible();
        const errorText = await error.innerText();
        expect(errorText).toContain(ERROR_MESSAGES.HOSTED_FIELD_ZIP_ERROR_HOSTED_FIELDS);
        await helperFunctions.fillHostedFieldsFormWithCatalogueFields(page, TEST_DATA.CARD_NUMBER, {
            zip: TEST_DATA.VALID_ZIP_CODE,
        });
        await helperFunctions.clickOnValidateButton(page);
        await expect(error).not.toBeVisible();
    });

    test('Verify Cross-field rule on state in hosted fields', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnTokenizeWithSDKButton(page);
        await waitForAuthParams(page);
        await tokenizeWithSdkPage.clickOnCustomFieldValidatorDropdown(page);
        await tokenizeWithSdkPage.selectCustomFieldValidatorByName(page, SELECTORS.CUSTOM_CROSS_FIELD_VALIDATION);
        await tokenizeWithSdkPage.clickOnHostedCatalogueFieldsDropdown(page);
        await tokenizeWithSdkPage.selectFieldsByName(page, 'country');
        await tokenizeWithSdkPage.selectFieldsByName(page, 'state');
        await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
        await helperFunctions.fillHostedFieldsFormWithCatalogueFields(page, TEST_DATA.CARD_NUMBER, {
            country: TEST_DATA.COUNTRY_US,
            state: TEST_DATA.STATE_VALID_FORMAT,
        });
        await helperFunctions.clickOnValidateButton(page);
        let error = await tokenizeWithSdkPage.getHostedFieldErrorByFieldName(page, ERROR_SELECTORS.HOSTED_FIELD_STATE_ERROR_HOSTED_FIELDS);
        await helperFunctions.clickOnValidateButton(page);
        expect(error).not.toBeVisible();
        await tokenizePage.clickOnDestroySDKButton(page);
        await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
        await helperFunctions.fillHostedFieldsFormWithCatalogueFields(page, TEST_DATA.CARD_NUMBER, {
            country: TEST_DATA.COUNTRY_US,
            state: TEST_DATA.STATE_INVALID_FORMAT,
        });
        await helperFunctions.clickOnValidateButton(page);
        error = await tokenizeWithSdkPage.getHostedFieldErrorByFieldName(page, ERROR_SELECTORS.HOSTED_FIELD_STATE_ERROR_HOSTED_FIELDS);
        await expect(error).toBeVisible();
        expect(await error.innerText()).toContain(ERROR_MESSAGES.HOSTED_FIELD_STATE_ERROR_HOSTED_FIELDS);
        await tokenizePage.clickOnDestroySDKButton(page);
        await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
        await helperFunctions.fillHostedFieldsFormWithCatalogueFields(page, TEST_DATA.CARD_NUMBER, {
            country: TEST_DATA.COUNTRY_US
        });
        await helperFunctions.clickOnValidateButton(page);
        error = await tokenizeWithSdkPage.getHostedFieldErrorByFieldName(page, ERROR_SELECTORS.HOSTED_FIELD_STATE_ERROR_HOSTED_FIELDS);
        await expect(error).toBeVisible();
        expect(await error.innerText()).toContain(ERROR_MESSAGES.HOSTED_FIELD_STATE_ERROR_HOSTED_FIELDS);
        await tokenizePage.clickOnDestroySDKButton(page);
        await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
        await helperFunctions.fillHostedFieldsFormWithCatalogueFields(page, TEST_DATA.CARD_NUMBER, {
            country: TEST_DATA.COUNTRY_NON_US,
            state: TEST_DATA.STATE_INVALID_FORMAT,
        });
        await helperFunctions.clickOnValidateButton(page);
        error = await tokenizeWithSdkPage.getHostedFieldErrorByFieldName(page, ERROR_SELECTORS.HOSTED_FIELD_STATE_ERROR_HOSTED_FIELDS);
        await expect(error).not.toBeVisible();
    });
 
    test('Verify conditonal requirement on ZIP Validator in hosted fields', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnTokenizeWithSDKButton(page);
        await waitForAuthParams(page);
        await tokenizeWithSdkPage.clickOnCustomFieldValidatorDropdown(page);
        await tokenizeWithSdkPage.selectCustomFieldValidatorByName(page, SELECTORS.CONDITIONAL_REQUIREMENT_ON_ZIP_VALIDATION);
        await tokenizeWithSdkPage.clickOnHostedCatalogueFieldsDropdown(page);
        await tokenizeWithSdkPage.selectFieldsByName(page, 'country');
        await tokenizeWithSdkPage.selectFieldsByName(page, 'zip');
        await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
        await helperFunctions.fillHostedFieldsFormWithCatalogueFields(page, TEST_DATA.CARD_NUMBER, {
            country: TEST_DATA.COUNTRY_US,
        });
        await helperFunctions.clickOnValidateButton(page);
        let error = await tokenizeWithSdkPage.getHostedFieldErrorByFieldName(page, ERROR_SELECTORS.HOSTED_FIELD_ZIP_ERROR_HOSTED_FIELDS);
        await expect(error).toBeVisible();
        expect(await error.innerText()).toContain(ERROR_MESSAGES.HOSTED_FIELD_ZIP_REQUIRED_ERROR);
        await tokenizePage.clickOnDestroySDKButton(page);
        await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
        await helperFunctions.fillHostedFieldsFormWithCatalogueFields(page, TEST_DATA.CARD_NUMBER, {
            country: TEST_DATA.COUNTRY_US,
            zip: TEST_DATA.VALID_ZIP_CODE,
        });
        await helperFunctions.clickOnValidateButton(page);
        await tokenizePage.clickOnDestroySDKButton(page);
        await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
        error = await tokenizeWithSdkPage.getHostedFieldErrorByFieldName(page, ERROR_SELECTORS.HOSTED_FIELD_ZIP_ERROR_HOSTED_FIELDS);
        await expect(error).not.toBeVisible();
        await helperFunctions.fillHostedFieldsFormWithCatalogueFields(page, TEST_DATA.CARD_NUMBER, {
            country: TEST_DATA.COUNTRY_NON_US,
        });
        await helperFunctions.clickOnValidateButton(page);
        error = await tokenizeWithSdkPage.getHostedFieldErrorByFieldName(page, ERROR_SELECTORS.HOSTED_FIELD_ZIP_ERROR_HOSTED_FIELDS);
        await expect(error).not.toBeVisible();
    });

    test('Verify ZIP validation in express checkout', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnExpressCheckoutButton(page);
        await landingPage.clickOnTokenizeWithSDKButton(page);
        await waitForAuthParams(page);
        await tokenizeWithSdkPage.clickOnCustomFieldValidatorDropdown(page);
        await tokenizeWithSdkPage.selectCustomFieldValidatorByName(page, SELECTORS.CUSTOM_FIELD_VALIDATOR_ZIP_FORMAT);
        await tokenizeWithSdkPage.clickOnHostedCatalogueFieldsDropdownExpressCheckout(page);
        await tokenizeWithSdkPage.selectFieldsByNameExpressCheckout(page, 'zip');
        await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
            zip: TEST_DATA.INVALID_ZIP_CODE,
        });
        await page.waitForTimeout(5000);
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.ZIP_ERROR_EXPRESS_CHECKOUT}"]`)).toBeVisible()
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
            zip: TEST_DATA.VALID_ZIP_CODE,
        });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.ZIP_ERROR_EXPRESS_CHECKOUT}"]`)).not.toBeVisible()
    });

    test('Verify Cross-field rule on state in express checkout', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnExpressCheckoutButton(page);
        await landingPage.clickOnTokenizeWithSDKButton(page);
        await waitForAuthParams(page);
        await tokenizeWithSdkPage.clickOnCustomFieldValidatorDropdown(page);
        await tokenizeWithSdkPage.selectCustomFieldValidatorByName(page, SELECTORS.CUSTOM_CROSS_FIELD_VALIDATION);
        await tokenizeWithSdkPage.clickOnHostedCatalogueFieldsDropdownExpressCheckout(page);
        await tokenizeWithSdkPage.selectFieldsByNameExpressCheckout(page, 'country');
        await tokenizeWithSdkPage.selectFieldsByNameExpressCheckout(page, 'state');
        await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
            country: TEST_DATA.COUNTRY_US,
        });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.STATE_ERROR_EXPRESS_CHECKOUT}"]`)).not.toBeVisible()
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
            country: TEST_DATA.COUNTRY_US,
            state: TEST_DATA.STATE_INVALID_FORMAT,
        });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.STATE_ERROR_EXPRESS_CHECKOUT}"]`)).toBeVisible()
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
            country: TEST_DATA.COUNTRY_US,
            state: TEST_DATA.STATE_VALID_FORMAT,
        });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.STATE_ERROR_EXPRESS_CHECKOUT}"]`)).not.toBeVisible()
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
            country: TEST_DATA.COUNTRY_NON_US,
            state: TEST_DATA.STATE_INVALID_FORMAT,
        });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.STATE_ERROR_EXPRESS_CHECKOUT}"]`)).not.toBeVisible()
    });

    test('Verify conditonal requirement on ZIP Validator in express checkout', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnExpressCheckoutButton(page);
        await landingPage.clickOnTokenizeWithSDKButton(page);
        await waitForAuthParams(page);
        await tokenizeWithSdkPage.clickOnCustomFieldValidatorDropdown(page);
        await tokenizeWithSdkPage.selectCustomFieldValidatorByName(page, SELECTORS.CONDITIONAL_REQUIREMENT_ON_ZIP_VALIDATION);
        await tokenizeWithSdkPage.clickOnHostedCatalogueFieldsDropdownExpressCheckout(page);
        await tokenizeWithSdkPage.selectFieldsByNameExpressCheckout(page, 'country');
        await tokenizeWithSdkPage.selectFieldsByNameExpressCheckout(page, 'zip');
        await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
            country: TEST_DATA.COUNTRY_US,
        });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.ZIP_REQUIRED_ERROR_EXPRESS_CHECKOUT}"]`)).toBeVisible()
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
            country: TEST_DATA.COUNTRY_US,
            zip: TEST_DATA.VALID_ZIP_CODE,
        });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.ZIP_REQUIRED_ERROR_EXPRESS_CHECKOUT}"]`)).not.toBeVisible()
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
            country: TEST_DATA.COUNTRY_NON_US,
        });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.ZIP_REQUIRED_ERROR_EXPRESS_CHECKOUT}"]`)).not.toBeVisible()
    });




});