import { Page } from '@playwright/test';
import { expect } from '../util/fixtures';


export const SELECTORS = {
    EXPRESS_CHECKOUT_BUTTON: '.sdk-option-title:has-text("Express Checkout")',
    TOKENIZE_BUTTON: '[data-flow="tokenize"]',
}

export const landingPage = {
    clickOnExpressCheckoutButton: async (page: Page) => {
    const expressCheckoutButton = page.locator(SELECTORS.EXPRESS_CHECKOUT_BUTTON);
    await expect(expressCheckoutButton).toBeVisible();
    await expressCheckoutButton.click();
},
    clickOnTokenizeButton: async (page: Page) => {
    const tokenizeButton = page.locator(SELECTORS.TOKENIZE_BUTTON);
    await expect(tokenizeButton).toBeVisible();
    await tokenizeButton.click();
}
}