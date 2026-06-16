import { expect, Page } from "@playwright/test";
import { PLACEHOLDERS, SELECTORS } from "../util/test-constants";

export const paymentPage = {
    selectStripeMethod: async (page: Page, method: string) => {
        await page.waitForTimeout(3000);
        const stripeFrame = page.frameLocator(SELECTORS.STRIPE_APM_FRAME_LOCATOR);
        const paymentMethod = stripeFrame.locator(`button[data-testid='${method}']`);
        await paymentMethod.click();
    },

    selectOffsitePaymentMethod: async (page: Page, method: string) => {
        const paymentMethod = await page.locator(`.payment-method-name:has-text("${method}")`);
        await paymentMethod.click();
    },

    clickSubmitButton: async (page: Page) => {
        const submitButton = page.locator(SELECTORS.HOSTED_SUBMIT_BUTTON);
        await submitButton.scrollIntoViewIfNeeded();
        await submitButton.click();
    },

    fillPaymentForm: async (page: Page,name: string, IBAN?: string,  email?: string, country?: string, address?: string, city?: string, countryState?:string, zip?: string, bank?: string) => {
        const stripeFrame = page.frameLocator(SELECTORS.STRIPE_APM_FRAME_LOCATOR);
        const nameField = stripeFrame.getByPlaceholder(PLACEHOLDERS.STRIPE_APM_NAME).last();
        await nameField.fill(name);
        if (IBAN) {
            const ibanField = await stripeFrame.getByPlaceholder(PLACEHOLDERS.STRIPE_APM_IBAN);
            await ibanField.fill(IBAN);
        }
        if (email) {
            const emailField = await stripeFrame.locator(SELECTORS.STRIPE_APM_EMAIL_FIELD);
            await emailField.fill(email);
        }
        if (country) {
            const countryField = await stripeFrame.locator(SELECTORS.STRIPE_APM_COUNTRY_SELECTOR);
            await countryField.selectOption(country);
        }
        if (address) {
            const addressField = await stripeFrame.locator(SELECTORS.STRIPE_APM_ADDRESS_FIELD);
            await addressField.fill(address);
        }
        if (city) {
            const cityField = await stripeFrame.locator(SELECTORS.STRIPE_APM_CITY_FIELD);
            await cityField.fill(city);
        }
        if (countryState) {
            const stateField = await stripeFrame.locator(SELECTORS.STRIPE_APM_COUNTRY_STATE_FIELD);
            await stateField.selectOption(countryState);
        }
        if (zip) {
            const zipField = await stripeFrame.locator(SELECTORS.STRIPE_APM_ZIP_FIELD);
            await zipField.fill(zip);
        }
        if (bank) {
            const bankField = await stripeFrame.locator(SELECTORS.STRIPE_APM_BANK_FIELD);
            await bankField.selectOption(bank);
        }
    },

    selectAdditionalPaymentMethod: async (page: Page, method: string) => {
        const stripeFrame = await page.frameLocator(SELECTORS.STRIPE_APM_FRAME_LOCATOR);
        const additionalPaymentMethod = await stripeFrame.locator(SELECTORS.ADDITIONAL_PAYMENT_METHOD_DROP_DOWN);
        await additionalPaymentMethod.selectOption(method);
    },

    selectEbanxPaymentMethod: async (page: Page, method: string) => {
        const paymentMethod = await page.locator(SELECTORS.EBANX_PAYMENT_METHOD_DROP_DOWN);
        await paymentMethod.selectOption(method);
    }
}

export const authorizationPage = {
    clickOnAuthorizeButton: async (page: Page) => {
        await page.waitForTimeout(3000);
        const authorizeButton = await page.locator(SELECTORS.AUTHORIZE_BUTTON);
        await expect(authorizeButton).toBeVisible({ timeout: 10000 });
        await authorizeButton.click();
    },
    clickOnDenyButton: async (page: Page) => {
        await page.waitForTimeout(3000);
        const denyButton = await page.locator(SELECTORS.DENY_BUTTON);
        await expect(denyButton).toBeVisible({ timeout: 10000 });
        await denyButton.click();
    },
    clickOnNupayAuthorizeYesButton: async (page: Page) => {
        await expect(page.locator(SELECTORS.NUPAY_TEST_ENVIRONMENT_SIMULATOR)).toBeVisible({ timeout: 10000 });
        const nupayAuthorizeYesButton = await page.locator(SELECTORS.NUPAY_AUTHORIZE_YES_BUTTON);
        await expect(nupayAuthorizeYesButton).toBeVisible({ timeout: 10000 });
        await nupayAuthorizeYesButton.click();
    },
    clickOnNupayAuthorizeNoButton: async (page: Page) => {
        await expect(page.locator(SELECTORS.NUPAY_TEST_ENVIRONMENT_SIMULATOR)).toBeVisible({ timeout: 10000 });
        const nupayAuthorizeNoButton = await page.locator(SELECTORS.NUPAY_AUTHORIZE_NO_BUTTON);
        await expect(nupayAuthorizeNoButton).toBeVisible({ timeout: 10000 });
        await nupayAuthorizeNoButton.click();
    },
    clickOnNupayAuthorizePendingButton: async (page: Page) => {
        await expect(page.locator(SELECTORS.NUPAY_TEST_ENVIRONMENT_SIMULATOR)).toBeVisible({ timeout: 10000 });
        const nupayAuthorizePendingButton = await page.locator(SELECTORS.NUPAY_AUTHORIZE_PENDING_BUTTON);
        await expect(nupayAuthorizePendingButton).toBeVisible({ timeout: 10000 });
        await nupayAuthorizePendingButton.click();
    }
}

export const redirectResultPage = {
    waitForRedirectResultPage: async (page: Page) => {
        await page.waitForTimeout(5000);
        await expect(page.locator(SELECTORS.REDIRECT_TITLE)).toBeVisible({ timeout: 10000 });
    },

    getRedirectResultPageType: async (page: Page): Promise<'success' | 'failed' | 'pending'> => {
        await page.waitForTimeout(5000);
        await redirectResultPage.waitForRedirectResultPage(page);
        const redirectTitle = await page.locator(SELECTORS.REDIRECT_TITLE);
        const redirectMessage = await redirectTitle.textContent();
        if (await redirectTitle.count() > 0 && await redirectMessage=='Payment Successful') {
            return 'success';

        }
        else if (await redirectTitle.count() > 0 && await redirectMessage=='Payment Failed') {
            return 'failed';
        }
        else if (await redirectTitle.count() > 0 && await redirectMessage=='Payment Pending') {
            return 'pending';
        }
        else {  
            throw new Error('Unable to determine redirect result page type');
        }
    },

    getTransactionDetailsRow: async (page: Page, row: string) => {
        return page.locator(`.detail-label:text-is("${row}") + .detail-value` )
    },

    getStatusRow: async (page: Page) => {
        return page.locator(`.detail-label:has-text("Status") + .status-badge` )
    },

    verifyTransactionDetails: async (page: Page, paymentMethod: string, gatewayMethod: string, resultStatus: string) => {
        const paymentMethodRow = await redirectResultPage.getTransactionDetailsRow(page, 'Payment Method');
        const paymentMethodValue = await paymentMethodRow.textContent();
        await expect(paymentMethodValue).toBe(paymentMethod);
        const gatewayRow = await redirectResultPage.getTransactionDetailsRow(page, 'Gateway');
        const gatewayValue = await gatewayRow.textContent();
        await expect(gatewayValue).toBe(gatewayMethod);
        const statusRow = await redirectResultPage.getStatusRow(page);
        const statusValue = await statusRow.textContent();
        await expect(statusValue).toBe(resultStatus);
    },


}
