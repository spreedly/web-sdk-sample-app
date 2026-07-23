import { expect } from "../util/fixtures";
import { Page } from "@playwright/test";
import { SELECTORS } from "../util/test-constants";

export const stripeRadarPage = {
    getPayButton: async (page: Page) => {
        return page.locator(SELECTORS.STRIPE_RADAR_PAY_BUTTON);
    },
    clickOnPayButton: async (page: Page) => {
        const payButton = await stripeRadarPage.getPayButton(page);
        await expect(payButton).toBeVisible();
        await payButton.click();
    },
    waitForResultCardToBeVisible: async (page: Page) => {
        await expect(page.locator('#result-section')).toBeVisible({ timeout: 10000 });
    },
};