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

    clickOn3DSGatewaySpecificButton: async (page: Page) => {
        const threeDSGatewaySpecificButton = page.locator(SELECTORS.THREE_DS_GATEWAY_SPECIFIC_BUTTON);
        await expect(threeDSGatewaySpecificButton).toBeVisible();
        await threeDSGatewaySpecificButton.click();
},
    clickOnOffsitePaymentsButton: async (page: Page) => {
        const offsitePaymentsButton = page.locator(SELECTORS.OFFSITE_PAYMENTS_BUTTON);
        await expect(offsitePaymentsButton).toBeVisible();
        await offsitePaymentsButton.click();
},
    clickOnACHPaymentsButton: async (page: Page) => {
        const achPaymentsButton = page.locator(SELECTORS.ACH_PAYMENTS_BUTTON);
        await expect(achPaymentsButton).toBeVisible();
        await achPaymentsButton.click();
},
    clickOnStripeRadarButton: async (page: Page) => {
        const stripeRadarButton = page.locator(SELECTORS.STRIPE_RADAR_BUTTON);
        await expect(stripeRadarButton).toBeVisible();
        await stripeRadarButton.click();
},
}
