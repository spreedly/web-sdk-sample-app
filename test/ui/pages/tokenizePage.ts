import { expect } from "../util/fixtures";
import { Page } from "@playwright/test";
import { helperFunctions } from "../util/utils";
import { SELECTORS as TEST_SELECTORS } from "../util/test-constants";


export const SELECTORS = {
    openPaymentFormButtonHostedFields: '#open-hosted-fields-btn',
    openPaymentFormButtonExpressCheckout: '#open-payment-form-btn, #open-express-checkout-btn',
    allowBlankNameCheckbox: '#config-allow-blank-name',
    allowExpiredDateCheckbox: '#config-allow-expired-date',
    allowBlankDateCheckbox: '#config-allow-blank-date',
    twoDigitExpiryCheckbox: '#config-two-digit-expiry',
    hostedFieldsForm: '#hosted-fields-form',
    expressCheckoutForm: '#express-checkout-form, #express-checkout-dialog',
    resultCard: '#result-card',
    resultTitle: '#result-title',
    resultTokenLabel:'#result-label:has-text("Token")',
    resultCardType:'#result-label:has-text("Card Type")',
    resultLastFour:'#result-label:has-text("Last Four")',
    resultFirstSix:'#result-label:has-text("First Six")',
    resultExpiry:'#result-label:has-text("Expiry")',
    resultStorageState:'#result-label:has-text("Storage State")',
    dialogMode: 'label.display-mode-option:has(input[value="dialog"])',
    NUMBER_FORMAT_SELECT: '#hf-demo-number-format',
    INPUT_MODE_SELECT: '#hf-demo-input-mode',
}

export const tokenizePage={
    clickOnOpenPaymentFormButtonHostedFields: async (page: Page) => {
    const openPaymentFormButton = page.locator(SELECTORS.openPaymentFormButtonHostedFields);
    await expect(openPaymentFormButton).toBeVisible();
    await openPaymentFormButton.click();
    await expect(page.locator(SELECTORS.hostedFieldsForm)).toBeVisible();
},
    clickOnOpenPaymentFormButtonExpressCheckout: async (page: Page) => {
    const openPaymentFormButton = page.locator(SELECTORS.openPaymentFormButtonExpressCheckout);
    await expect(openPaymentFormButton).toBeVisible();
    await openPaymentFormButton.click();
    await expect(page.locator(SELECTORS.expressCheckoutForm)).toBeVisible();
},
    clickOnAllowBlankNameCheckbox: async (page: Page) => {
    const allowBlankNameCheckbox = page.locator(SELECTORS.allowBlankNameCheckbox);
    await expect(allowBlankNameCheckbox).toBeVisible();
    await allowBlankNameCheckbox.check();
    await expect(allowBlankNameCheckbox).toBeChecked();
},
    clickOnAllowExpiredDateCheckbox: async (page: Page) => {
    const allowExpiredDateCheckbox = page.locator(SELECTORS.allowExpiredDateCheckbox);
    await expect(allowExpiredDateCheckbox).toBeVisible();
    await allowExpiredDateCheckbox.check();
    await expect(allowExpiredDateCheckbox).toBeChecked();
},
    clickOnAllowBlankDateCheckbox: async (page: Page) => {
    const allowBlankDateCheckbox = page.locator(SELECTORS.allowBlankDateCheckbox);
    await expect(allowBlankDateCheckbox).toBeVisible();
    await allowBlankDateCheckbox.check();
    await expect(allowBlankDateCheckbox).toBeChecked();
},
    clickOnTwoDigitExpiryCheckbox: async (page: Page) => {
    const twoDigitExpiryCheckbox = page.locator(SELECTORS.twoDigitExpiryCheckbox);
    await expect(twoDigitExpiryCheckbox).toBeVisible();
    await twoDigitExpiryCheckbox.check();
    await expect(twoDigitExpiryCheckbox).toBeChecked();
},
    getResultCardTitle: async (page: Page) => {
    await expect(page.locator(SELECTORS.resultCard)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(SELECTORS.resultTitle)).toBeVisible();
    return await page.locator(SELECTORS.resultTitle).textContent();
},
    clickOnDialogMode: async (page: Page) => {
    const dialogMode = page.locator(SELECTORS.dialogMode);
    await dialogMode.check();
    await expect(dialogMode).toBeChecked();
},

    checkTheParityOption: async (page: Page, parityOption: string) => {
    const parityOptionElement = page.locator(`#hf-demo-${parityOption}`);
    if(await parityOptionElement.isChecked()) {
        await expect(parityOptionElement).toBeVisible();
        await parityOptionElement.uncheck();
        await expect(parityOptionElement).not.toBeChecked();
    } else {
        await parityOptionElement.check();
        await expect(parityOptionElement).toBeChecked();
    }
},

    getPlaceholderColor: async (page: Page) => {
    const cardNumberField = await helperFunctions.getHostedFieldsCardNumberField(page);
    const placeholderColor= await cardNumberField.evaluate((el) => getComputedStyle(el, '::placeholder').color);
    return placeholderColor;
},

    selectNumberFormatOption: async (
        page: Page, numberFormatOption: string) => {
        const numberFormatSelect = page.locator(SELECTORS.NUMBER_FORMAT_SELECT);
        await expect(numberFormatSelect).toBeVisible();
        await numberFormatSelect.selectOption(numberFormatOption);
        await expect(numberFormatSelect).toHaveValue(numberFormatOption);
        await page.waitForTimeout(2000);
  },

    selectInputModeOption: async (
        page: Page, inputModeOption: string) => {
        const inputModeSelect = page.locator(SELECTORS.INPUT_MODE_SELECT);
        await expect(inputModeSelect).toBeVisible();
        await inputModeSelect.selectOption(inputModeOption);
        await expect(inputModeSelect).toHaveValue(inputModeOption);
        await page.waitForTimeout(2000);
  },

    getCardNumberFieldInputMode: async (page: Page) => {
        const cardNumberField = await helperFunctions.getHostedFieldsCardNumberField(page);
        const inputMode = await cardNumberField.getAttribute('inputmode');
        return inputMode;
    },

    getCvvFieldInputMode: async (page: Page) => {
        const cvvField = await helperFunctions.getHostedFieldsCvvField(page);
        const inputMode = await cvvField.getAttribute('inputmode');
        return inputMode;
  },

    clickOnParityOption: async (page: Page, parityOption: string) => {
        const parityOptionElement = page.locator(`#hf-demo-${parityOption}`);
        await expect(parityOptionElement).toBeVisible();
        await parityOptionElement.click();
    },
}

