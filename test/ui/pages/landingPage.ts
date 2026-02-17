import { Page } from '@playwright/test';
import { expect } from '../util/fixtures';
import { SELECTORS } from '../util/test-constants';

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
},

    clickOn3DSButton: async (page: Page) => {
        const threeDSButton = page.locator(SELECTORS.THREE_DS_BUTTON);
        await expect(threeDSButton).toBeVisible();
        await threeDSButton.click();
},
}