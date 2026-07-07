import { landingPage } from "../pages/landingPage";
import {CSS_PROPERTIES, getValidYearString, HEADINGS, SELECTORS, TEST_DATA, waitForAuthParams} from "../util/test-constants";
import { MONOREPO_URLS } from "../util/urls";
import { expect, test } from "../util/fixtures";
import { tokenizePage } from "../pages/tokenizePage";
import { helperFunctions } from "../util/utils";




test.describe('Iframe Parity tests', () => {
    test('should verify placeholder color', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnTokenizeButton(page);
        await waitForAuthParams(page);
        await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
        const placeholderColorBefore = await tokenizePage.getPlaceholderColor(page);
        expect(placeholderColorBefore).toBe(CSS_PROPERTIES.PLACEHOLDER_TEXT_COLOR_BEFORE);
        tokenizePage.checkTheParityOption(page, 'style-placeholders');
        await page.waitForTimeout(2000);
        const placeholderColorAfter = await tokenizePage.getPlaceholderColor(page);
        expect(placeholderColorAfter).toBe(CSS_PROPERTIES.PLACEHOLDER_TEXT_COLOR_AFTER);
    })

    test('should verify number format', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnTokenizeButton(page);
        await waitForAuthParams(page);
        await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.CARD_NUMBER, {});
        await tokenizePage.selectNumberFormatOption(page, 'prettyFormat');
        expect(await helperFunctions.getHostedFieldsCardNumberField(page)).toHaveValue(TEST_DATA.CARD_NUMBER_FORMATTED);
        await tokenizePage.selectNumberFormatOption(page, 'plainFormat');
        expect(await helperFunctions.getHostedFieldsCardNumberField(page)).toHaveValue(TEST_DATA.CARD_NUMBER);
        await tokenizePage.selectNumberFormatOption(page, 'maskedFormat');
        expect(await helperFunctions.getHostedFieldsCardNumberField(page)).toHaveValue(TEST_DATA.NUMBER_FORMAT_MASKED);
    })

    test('should verify input mode for number field and cvv field', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnTokenizeButton(page);
        await waitForAuthParams(page);
        await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
        await tokenizePage.selectInputModeOption(page, 'numeric');
        expect(await tokenizePage.getCardNumberFieldInputMode(page)).toBe('numeric');
        expect(await tokenizePage.getCvvFieldInputMode(page)).toBe('numeric');
        await tokenizePage.selectInputModeOption(page, 'tel');
        console.log(await tokenizePage.getCardNumberFieldInputMode(page), await tokenizePage.getCvvFieldInputMode(page));
        expect(await tokenizePage.getCardNumberFieldInputMode(page)).toBe('tel');
        expect(await tokenizePage.getCvvFieldInputMode(page)).toBe('tel');
        await tokenizePage.selectInputModeOption(page, 'text');
        console.log(await tokenizePage.getCardNumberFieldInputMode(page), await tokenizePage.getCvvFieldInputMode(page));
        expect(await tokenizePage.getCardNumberFieldInputMode(page)).toBe('text');
        expect(await tokenizePage.getCvvFieldInputMode(page)).toBe('text');
        await tokenizePage.selectInputModeOption(page, 'decimal');
        console.log(await tokenizePage.getCardNumberFieldInputMode(page), await tokenizePage.getCvvFieldInputMode(page));
        expect(await tokenizePage.getCardNumberFieldInputMode(page)).toBe('decimal');
        expect(await tokenizePage.getCvvFieldInputMode(page)).toBe('decimal');
        await tokenizePage.selectInputModeOption(page, 'search');
        console.log(await tokenizePage.getCardNumberFieldInputMode(page), await tokenizePage.getCvvFieldInputMode(page));
        expect(await tokenizePage.getCardNumberFieldInputMode(page)).toBe('search');
        expect(await tokenizePage.getCvvFieldInputMode(page)).toBe('search');
        await tokenizePage.selectInputModeOption(page, 'email');
        console.log(await tokenizePage.getCardNumberFieldInputMode(page), await tokenizePage.getCvvFieldInputMode(page));
        expect(await tokenizePage.getCardNumberFieldInputMode(page)).toBe('email');
        expect(await tokenizePage.getCvvFieldInputMode(page)).toBe('email');
        await tokenizePage.selectInputModeOption(page, 'url');
        console.log(await tokenizePage.getCardNumberFieldInputMode(page), await tokenizePage.getCvvFieldInputMode(page));
        expect(await tokenizePage.getCardNumberFieldInputMode(page)).toBe('url');
        expect(await tokenizePage.getCvvFieldInputMode(page)).toBe('url');
        await tokenizePage.selectInputModeOption(page, 'none');
        console.log(await tokenizePage.getCardNumberFieldInputMode(page), await tokenizePage.getCvvFieldInputMode(page));
        expect(await tokenizePage.getCardNumberFieldInputMode(page)).toBe('none');
        expect(await tokenizePage.getCvvFieldInputMode(page)).toBe('none');
    })

    test('should verify uncheck required attribute for number field and cvv field', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnTokenizeButton(page);
        await waitForAuthParams(page);
        await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
        await tokenizePage.checkTheParityOption(page, 'required');
        await page.waitForTimeout(1000);
        await tokenizePage.checkTheParityOption(page, 'required');
        expect(await helperFunctions.getHostedFieldsCvvField(page)).toHaveAttribute('required','');
        expect(await helperFunctions.getHostedFieldsCardNumberField(page)).toHaveAttribute('required','');
        await tokenizePage.checkTheParityOption(page, 'required');
        expect(await helperFunctions.getHostedFieldsCvvField(page)).not.toHaveAttribute('required','');
        expect(await helperFunctions.getHostedFieldsCardNumberField(page)).not.toHaveAttribute('required','');    
    })

    test('should verify eligible for card updater option', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
    await page.locator(SELECTORS.PARITY_OPTION_CARD_UPDATER).check();
    await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      cvv: TEST_DATA.CVV,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    
    await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.CARD_NUMBER_FORMATTED, {
      cvv: TEST_DATA.CVV,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    
    let apiResponse: any = null;
    let responseStatus: number | null = null;
    let apiRequestPayload: any = null;
    
    page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        try {
          apiRequestPayload = request.postDataJSON();
        } catch (error) {
          console.log('Request payload is not JSON or empty');
        }
      }
    });
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        responseStatus = response.status();
        try {
          apiResponse = await response.json();
          console.log('API Request URL:', url);
          console.log('API Response Status:', responseStatus);
        } catch (error) {
          console.log('Response is not JSON or empty');
        }
      }
    });
    await helperFunctions.clickOnHostedFieldsSubmitButton(page);
    const resultTitle = await tokenizePage.getResultCardTitle(page);
    await expect(resultTitle).toBe(HEADINGS.RESULT_TITLE_SUCCESS);
    expect(apiResponse.transaction.payment_method.eligible_for_card_updater).toBe(true);
    })

    test('should verify mask visible option', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnTokenizeButton(page);
        await waitForAuthParams(page);
        await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.CARD_NUMBER, {});
        await tokenizePage.checkTheParityOption(page, 'mask-visible');
        expect(await helperFunctions.getHostedFieldsCardNumberField(page)).toHaveValue(TEST_DATA.NUMBER_FORMAT_MASKED);
    })

    test('should verify isloaded option', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnTokenizeButton(page);
        await waitForAuthParams(page);
        await tokenizePage.clickOnOpenPaymentFormButtonHostedFields(page);
        await tokenizePage.clickOnParityOption(page, 'is-loaded');
        expect(page.locator(SELECTORS.PARITY_OPTION_IS_LOADED_RESULT)).toBeVisible();
        expect(page.locator(SELECTORS.PARITY_OPTION_IS_LOADED_RESULT)).toHaveText('isLoaded() → true');
    })


})