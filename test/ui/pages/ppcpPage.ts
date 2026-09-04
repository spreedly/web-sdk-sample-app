import { expect, Locator, Page } from '@playwright/test';
import { config } from 'dotenv';
import { LABELS, SELECTORS } from '../util/test-constants';
config({ path: 'test/ui/credentials.env' });


const paypalUserId = String(process.env.PAYPAL_USER_ID);
const paypalUserPassword = String(process.env.PAYPAL_USER_PASSWORD);
const venmoUserId = String(process.env.VENMO_USER_ID);
const venmoUserPassword = String(process.env.VENMO_USER_PASSWORD);

export const ppcpPage = {

    clickOnPayPalButton: async (page: Page) => {
        const paypalButton = await ppcpPage.getPaymentButtonLocator(page, LABELS.PAYPAL_BUTTON);
        await expect(paypalButton).toBeVisible();
        await paypalButton.click();
    },
    clickOnVenmoButton: async (page: Page) => {
      const venmoButton = await ppcpPage.getPaymentButtonLocator(page, LABELS.VENMO_BUTTON);
      await expect(venmoButton).toBeVisible();
      await venmoButton.click();
    },
    clickOnPayLaterButton: async (page: Page) => {
        const payLaterButton = await ppcpPage.getPaymentButtonLocator(page, LABELS.PAY_LATER_BUTTON);
        await expect(payLaterButton).toBeVisible();
        await payLaterButton.click();
    },
    getCheckboxLocator: async (page: Page, checkboxName: string) => {
        return page.locator('label.cfg-opt').filter({
            has: page.getByText(checkboxName, { exact: true })
          }).locator('input')
    },
    clickOnCheckbox: async (page: Page, checkboxName: string) => {
        const checkbox = await ppcpPage.getCheckboxLocator(page, checkboxName);
        await expect(checkbox).toBeVisible();
        await checkbox.click();
    },

    clickOnProductIncreaseButton: async (page: Page, productId: string) => {
        const productSelect = page.locator(`.product-card[data-id="${productId}"] .quantity-btn`);
        const increaseButton = productSelect.getByText(`+`);
        await expect(increaseButton).toBeVisible();
        await expect(increaseButton).toBeEnabled();
        await increaseButton.click();
    },

    clickOnProductDecreaseButton: async (page: Page, productId: string) => {
        const productSelect = page.locator(`.product-card[data-id="${productId}"] .quantity-btn`);
        const decreaseButton = productSelect.getByText(`-`);
        await expect(decreaseButton).toBeVisible();
        await expect(decreaseButton).toBeEnabled();
        await decreaseButton.click();
    },

    waitForPaymentButtonsToBeLoaded: async (page: Page) => {
        await page.getByText('Loading payment buttons...').waitFor({ state: 'hidden', timeout: 5000 });
    },

    getPaymentButtonBorderRadius: async (page: Page, buttonName: Locator) => {
        const borderRadius = await buttonName.evaluate((el) =>
            getComputedStyle(el).borderRadius
          );
        return borderRadius;
    },

    fillPaymentButtonBorderRadius: async (page: Page, buttonName: string, borderRadius: string) => {
        const paypalrad = page.locator(`input[name="${buttonName}"]`)
        await paypalrad.fill(borderRadius);
    },

    getPaymentButtonLocator: async (page: Page, buttonName: string) => {
        const button = page.getByRole('button', {
            name: buttonName
          });
        return button;
    },
    
    getPaymentButtonBackgroundColor: async (page: Page, buttonName: string) => {
        const button = await ppcpPage.getPaymentButtonLocator(page, buttonName);
        return button.evaluate((el) => getComputedStyle(el).backgroundColor);
    },

    clickOnPayPalCompletePurchaseButton: async (page: Page, buttonName: string) => {
        const payBtn = page.getByText(buttonName);
        await expect(payBtn).toBeVisible();
        await expect(payBtn).toBeEnabled();
        await payBtn.click();
    },

    verifyOrderStatus: async (page: Page) => {
        const orderStatusBody = page.locator(SELECTORS.ORDER_STATUS_BODY);
        await expect(orderStatusBody).toBeVisible();
        return orderStatusBody.textContent();
    },


    
}


export { paypalUserId, paypalUserPassword, venmoUserId, venmoUserPassword };



