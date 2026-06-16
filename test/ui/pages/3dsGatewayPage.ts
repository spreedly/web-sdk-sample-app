import { expect, Page } from "@playwright/test";
import { SELECTORS } from "../util/test-constants";

export const threeDSGatewayPage = {

    selectTheTransactionAmount: async (page: Page, amount: string) => {
        const amountInput = page.locator(`input[value="${amount}"]`);
        await expect(amountInput).toBeVisible();
        await amountInput.click();
    },

    waitForAcsChallengeForm: async (page: Page) => {
        await page.locator(SELECTORS.THREE_DS_GATEWAY_SPECIFIC_ACS_SIMULATOR_IFRAME).waitFor({ state: 'visible' });
    },

    clickOnAllowButton: async (page: Page) => {
        const challengeFrame = page.frameLocator(SELECTORS.THREE_DS_GATEWAY_SPECIFIC_ACS_SIMULATOR_IFRAME);
        await expect(challengeFrame.locator(SELECTORS.THREE_DS_GATEWAY_SPECIFIC_ACS_SIMULATOR_ALLOW_BUTTON)).toBeVisible();
        await challengeFrame.locator(SELECTORS.THREE_DS_GATEWAY_SPECIFIC_ACS_SIMULATOR_ALLOW_BUTTON).click();
    },

    clickOnDenyButton: async (page: Page) => {
        const challengeFrame = page.frameLocator(SELECTORS.THREE_DS_GATEWAY_SPECIFIC_ACS_SIMULATOR_IFRAME);
        await expect(challengeFrame.locator(SELECTORS.THREE_DS_GATEWAY_SPECIFIC_ACS_SIMULATOR_DENY_BUTTON)).toBeVisible();
        await challengeFrame.locator(SELECTORS.THREE_DS_GATEWAY_SPECIFIC_ACS_SIMULATOR_DENY_BUTTON).click();
    },

};