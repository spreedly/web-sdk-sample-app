import { expect } from "../util/fixtures";
import { Page } from "@playwright/test";


export const SELECTORS = {
    openPaymentFormButtonHostedFields: '#open-hosted-fields-btn',
    openPaymentFormButtonExpressCheckout: '#open-payment-form-btn',
    allowBlankNameCheckbox: '#config-allow-blank-name',
    allowExpiredDateCheckbox: '#config-allow-expired-date',
    allowBlankDateCheckbox: '#config-allow-blank-date',
    twoDigitExpiryCheckbox: '#config-two-digit-expiry',
    hostedFieldsForm: '#hosted-fields-form',
    expressCheckoutForm: '#express-checkout-form',
    resultCard: '#result-card',
    resultTitle: '#result-title',
    resultTokenLabel:'#result-label:has-text("Token")',
    resultCardType:'#result-label:has-text("Card Type")',
    resultLastFour:'#result-label:has-text("Last Four")',
    resultFirstSix:'#result-label:has-text("First Six")',
    resultExpiry:'#result-label:has-text("Expiry")',
    resultStorageState:'#result-label:has-text("Storage State")',
    dialogMode: 'label.display-mode-option:has(input[value="dialog"])'
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
    await expect(page.locator(SELECTORS.resultCard)).toBeVisible();
    await expect(page.locator(SELECTORS.resultTitle)).toBeVisible();
    return await page.locator(SELECTORS.resultTitle).textContent();
},
    clickOnDialogMode: async (page: Page) => {
    const dialogMode = page.locator(SELECTORS.dialogMode);
    await dialogMode.check();
    await expect(dialogMode).toBeChecked();
},
}