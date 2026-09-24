import { purchasePage } from "../pages/3dsPage";
import { landingPage } from "../pages/landingPage";
import { test, expect } from "../util/fixtures";
import { TEST_DATA, waitForAuthParams, getValidTwoDigitExpiryString, getValidYearString, SELECTORS, ERROR_MESSAGES, ERROR_SELECTORS, HEADINGS } from "../util/test-constants";
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
        await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.STATE_ERROR_EXPRESS_CHECKOUT}"]`)).toBeVisible();
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
            country: TEST_DATA.COUNTRY_US,
            state: TEST_DATA.STATE_INVALID_FORMAT,
        });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.STATE_ERROR_EXPRESS_CHECKOUT}"]`)).toBeVisible();
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
            country: TEST_DATA.COUNTRY_US,
            state: TEST_DATA.STATE_VALID_FORMAT,
        });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.STATE_ERROR_EXPRESS_CHECKOUT}"]`)).not.toBeVisible();
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
            country: TEST_DATA.COUNTRY_NON_US,
            state: TEST_DATA.STATE_INVALID_FORMAT,
        });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.STATE_ERROR_EXPRESS_CHECKOUT}"]`)).not.toBeVisible();
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

    test('Verify Canonical Fields for Address in hosted fields', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnTokenizeWithSDKButton(page);
        await waitForAuthParams(page);
        await tokenizeWithSdkPage.clickOnCustomFieldValidatorDropdown(page);
        await tokenizeWithSdkPage.selectCustomFieldValidatorByName(page, SELECTORS.CUSTOM_FIELD_VALIDATOR_ZIP_FORMAT);
        await tokenizeWithSdkPage.clickOnHostedCatalogueFieldsDropdown(page)
        await tokenizeWithSdkPage.selectFieldsByName(page, 'first_name');
        await tokenizeWithSdkPage.selectFieldsByName(page, 'last_name');
        await tokenizeWithSdkPage.selectFieldsByName(page, 'expiry');
        await tokenizeWithSdkPage.selectFieldsByName(page, 'house_number_or_name');
        await tokenizeWithSdkPage.selectFieldsByName(page, 'street');
        await tokenizeWithSdkPage.selectFieldsByName(page, 'street_line2');
        await tokenizeWithSdkPage.selectFieldsByName(page, 'shipping_house_number_or_name');
        await tokenizeWithSdkPage.selectFieldsByName(page, 'shipping_street');
        await tokenizeWithSdkPage.selectFieldsByName(page, 'shipping_street_line2');
        await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
        await helperFunctions.fillHostedFieldsFormWithCatalogueFields(page, TEST_DATA.CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            twoDigitExpiry: getValidTwoDigitExpiryString(),
            cvv: TEST_DATA.CVV,
            house_number_or_name: TEST_DATA.HOUSE_NUMBER_OR_NAME,
            street: TEST_DATA.STREET,
            street_line2: TEST_DATA.STREET_LINE2,
            shipping_house_number_or_name: TEST_DATA.SHIPPING_HOUSE_NUMBER_OR_NAME,
            shipping_street: TEST_DATA.SHIPPING_STREET,
            shipping_street_line2: TEST_DATA.SHIPPING_STREET_LINE2,
        });
        const paymentMethodResponsePromise = page.waitForResponse((response) =>
            response.url().includes('/v1/payment_methods/restricted.json') ||
            response.url().includes('/v1/payment_methods')
        );
        await helperFunctions.clickOnHostedFieldsSubmitButton(page);
        const paymentMethodResponse = await paymentMethodResponsePromise;
        const apiResponse = await paymentMethodResponse.json();
        const resultTitle = await tokenizePage.getResultCardTitle(page);
        await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);

        const paymentMethod = apiResponse.transaction.payment_method;
        const expectedAddress1 = `${TEST_DATA.HOUSE_NUMBER_OR_NAME} ${TEST_DATA.STREET}`;
        const expectedShippingAddress1 = `${TEST_DATA.SHIPPING_HOUSE_NUMBER_OR_NAME} ${TEST_DATA.SHIPPING_STREET}`;

        expect(paymentMethod.house_number_or_name).toBe(TEST_DATA.HOUSE_NUMBER_OR_NAME);
        expect(paymentMethod.street).toBe(TEST_DATA.STREET);
        expect(paymentMethod.street_line2).toBe(TEST_DATA.STREET_LINE2);
        expect(paymentMethod.address1).toBe(expectedAddress1);
        expect(paymentMethod.address2).toBe(TEST_DATA.STREET_LINE2);
        expect(paymentMethod.shipping_house_number_or_name).toBe(TEST_DATA.SHIPPING_HOUSE_NUMBER_OR_NAME);
        expect(paymentMethod.shipping_street).toBe(TEST_DATA.SHIPPING_STREET);
        expect(paymentMethod.shipping_street_line2).toBe(TEST_DATA.SHIPPING_STREET_LINE2);
        expect(paymentMethod.shipping_address1).toBe(expectedShippingAddress1);
        expect(paymentMethod.shipping_address2).toBe(TEST_DATA.SHIPPING_STREET_LINE2);
    });

    test('Verify Canonical Fields for Address in express checkout', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnExpressCheckoutButton(page);
        await landingPage.clickOnTokenizeWithSDKButton(page);
        await waitForAuthParams(page);
        await tokenizeWithSdkPage.clickOnHostedCatalogueFieldsDropdownExpressCheckout(page);
        await tokenizeWithSdkPage.selectFieldsByNameExpressCheckout(page, 'house_number_or_name');
        await tokenizeWithSdkPage.selectFieldsByNameExpressCheckout(page, 'street');
        await tokenizeWithSdkPage.selectFieldsByNameExpressCheckout(page, 'street_line2');
        await tokenizeWithSdkPage.selectFieldsByNameExpressCheckout(page, 'shipping_house_number_or_name');
        await tokenizeWithSdkPage.selectFieldsByNameExpressCheckout(page, 'shipping_street');
        await tokenizeWithSdkPage.selectFieldsByNameExpressCheckout(page, 'shipping_street_line2');
        await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
            cvv: TEST_DATA.CVV,
            house_number_or_name: TEST_DATA.HOUSE_NUMBER_OR_NAME,
            street: TEST_DATA.STREET,
            street_line2: TEST_DATA.STREET_LINE2,
            shipping_house_number_or_name: TEST_DATA.SHIPPING_HOUSE_NUMBER_OR_NAME,
            shipping_street: TEST_DATA.SHIPPING_STREET,
            shipping_street_line2: TEST_DATA.SHIPPING_STREET_LINE2,
        });

        const paymentMethodResponsePromise = page.waitForResponse((response) =>
            response.url().includes('/v1/payment_methods/restricted.json') ||
            response.url().includes('/v1/payment_methods')
        );
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        const paymentMethodResponse = await paymentMethodResponsePromise;
        const apiResponse = await paymentMethodResponse.json();
        const resultTitle = await tokenizePage.getResultCardTitle(page);
        await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);

        const paymentMethod = apiResponse.transaction.payment_method;
        const expectedAddress1 = `${TEST_DATA.HOUSE_NUMBER_OR_NAME} ${TEST_DATA.STREET}`;
        const expectedShippingAddress1 = `${TEST_DATA.SHIPPING_HOUSE_NUMBER_OR_NAME} ${TEST_DATA.SHIPPING_STREET}`;

        expect(paymentMethod.house_number_or_name).toBe(TEST_DATA.HOUSE_NUMBER_OR_NAME);
        expect(paymentMethod.street).toBe(TEST_DATA.STREET);
        expect(paymentMethod.street_line2).toBe(TEST_DATA.STREET_LINE2);
        expect(paymentMethod.address1).toBe(expectedAddress1);
        expect(paymentMethod.address2).toBe(TEST_DATA.STREET_LINE2);
        expect(paymentMethod.shipping_house_number_or_name).toBe(TEST_DATA.SHIPPING_HOUSE_NUMBER_OR_NAME);
        expect(paymentMethod.shipping_street).toBe(TEST_DATA.SHIPPING_STREET);
        expect(paymentMethod.shipping_street_line2).toBe(TEST_DATA.SHIPPING_STREET_LINE2);
        expect(paymentMethod.shipping_address1).toBe(expectedShippingAddress1);
        expect(paymentMethod.shipping_address2).toBe(TEST_DATA.SHIPPING_STREET_LINE2);
    });




});