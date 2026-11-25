import { Locator, Page } from '@playwright/test';
import { expect } from '../util/fixtures';
import { SELECTORS } from '../util/test-constants';

// The landing page groups its flow cards into collapsible sections that start closed. Open the
// card's section (if it isn't open already) and return the card.
export const showFlowCard = async (page: Page, selector: string): Promise<Locator> => {
    const card = page.locator(selector);
    const group = page.locator('details.flow-group', { has: card });
    if (!(await group.evaluate((details: HTMLDetailsElement) => details.open))) {
        await group.locator('summary').click();
    }
    return card;
};

export const landingPage = {
    clickOnExpressCheckoutButton: async (page: Page) => {
    const expressCheckoutButton = page.locator(SELECTORS.EXPRESS_CHECKOUT_BUTTON);
    await expect(expressCheckoutButton).toBeVisible();
    await expressCheckoutButton.click();
},

    clickOnTokenizeButton: async (page: Page) => {
    const tokenizeButton = await showFlowCard(page, SELECTORS.TOKENIZE_BUTTON);
    await expect(tokenizeButton).toBeVisible();
    await tokenizeButton.click();
},

    clickOn3DSButton: async (page: Page) => {
        const threeDSButton = await showFlowCard(page, SELECTORS.THREE_DS_BUTTON);
        await expect(threeDSButton).toBeVisible();
        await threeDSButton.click();
},

    clickOn3DSGatewaySpecificButton: async (page: Page) => {
        const threeDSGatewaySpecificButton = await showFlowCard(page, SELECTORS.THREE_DS_GATEWAY_SPECIFIC_BUTTON);
        await expect(threeDSGatewaySpecificButton).toBeVisible();
        await threeDSGatewaySpecificButton.click();
},
    clickOnOffsitePaymentsButton: async (page: Page) => {
        const offsitePaymentsButton = await showFlowCard(page, SELECTORS.OFFSITE_PAYMENTS_BUTTON);
        await expect(offsitePaymentsButton).toBeVisible();
        await offsitePaymentsButton.click();
},
    clickOnACHPaymentsButton: async (page: Page) => {
        const achPaymentsButton = await showFlowCard(page, SELECTORS.ACH_PAYMENTS_BUTTON);
        await expect(achPaymentsButton).toBeVisible();
        await achPaymentsButton.click();
},
    clickOnStripeRadarButton: async (page: Page) => {
        const stripeRadarButton = await showFlowCard(page, SELECTORS.STRIPE_RADAR_BUTTON);
        await expect(stripeRadarButton).toBeVisible();
        await stripeRadarButton.click();
},
    clickOnTokenizeWithSDKButton: async (page: Page) => {
        const tokenizeWithSDKButton = await showFlowCard(page, SELECTORS.TOKENIZE_WITH_SDK_BUTTON);
        await expect(tokenizeWithSDKButton).toBeVisible();
        await tokenizeWithSDKButton.click();
    },
    clickOnGooglePayButton: async (page: Page) => {
        const googlePayButton = await showFlowCard(page, SELECTORS.GOOGLE_PAY_BUTTON);
        await expect(googlePayButton).toBeVisible();
        await googlePayButton.click();
    },
    clickOnCashAppPayButton: async (page: Page) => {
        const cashAppPayButton = await showFlowCard(page, SELECTORS.CASH_APP_PAY_BUTTON);
        await expect(cashAppPayButton).toBeVisible();
        await cashAppPayButton.click();
    },
    clickOnPPCPDirectButton: async (page: Page) => {
        const ppcpDirectButton = await showFlowCard(page, SELECTORS.PPCP_DIRECT_BUTTON);
        await expect(ppcpDirectButton).toBeVisible();
        await ppcpDirectButton.click();
},
}
