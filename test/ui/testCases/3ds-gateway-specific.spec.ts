import { purchasePage } from "../pages/3dsPage";
import { landingPage } from "../pages/landingPage";
import { test, expect } from "../util/fixtures";
import { TEST_DATA, waitForAuthParams, getValidYearString, SELECTORS } from "../util/test-constants";
import { MONOREPO_URLS } from "../util/urls";
import { helperFunctions } from "../util/utils";
import { tokenizePage } from "../pages/tokenizePage";
import { threeDSGatewayPage } from "../pages/3dsGatewayPage";

test.describe('3DS gateway specific flow', () => {
    test('3DS gateway specific flow for hosted fields Frictionless Flow (3001) case', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOn3DSGatewaySpecificButton(page);
        await waitForAuthParams(page);
        await threeDSGatewayPage.selectTheTransactionAmount(page, '3001');
        await helperFunctions.clickOnNewCardButton(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        let apiResponse: any = null;
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/status.json')) {
                try {
                    apiResponse = await response.json();
                    console.log('API Request URL:', url);
                } catch (error) {
                    console.log('Response is not JSON or empty');
                }
            }
        });
        await helperFunctions.clickOnThreeDS2PayButton(page);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        expect(resultPageType).toBe('success');
        if (apiResponse) {
            expect(apiResponse).toBeDefined();
            expect(apiResponse).not.toBeNull();
            const state = apiResponse.transaction.state;
            expect(state).toBe('succeeded');
        }
    })

    test('3DS gateway specific flow for hosted fields Challenge Flow (3003) Fingerprint authorize case', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOn3DSGatewaySpecificButton(page);
        await waitForAuthParams(page);
        await threeDSGatewayPage.selectTheTransactionAmount(page, '3003');
        await helperFunctions.clickOnNewCardButton(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        let apiResponse: any = null;
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/complete')) {
                try {
                    apiResponse = await response.json();
                } catch (error) {
                    console.log('Response is not JSON or empty');
                }
            }
        });
        await helperFunctions.clickOnThreeDS2PayButton(page);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        expect(resultPageType).toBe('success');
        if (apiResponse) {
            expect(apiResponse).toBeDefined();
            expect(apiResponse).not.toBeNull();
            const state = apiResponse.transaction.state;
            expect(state).toBe('succeeded');
        }
    })

    test('3DS gateway specific flow for hosted fields Challenge Flow (3004) Fingerprint challenge success case', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOn3DSGatewaySpecificButton(page);
        await waitForAuthParams(page);
        await threeDSGatewayPage.selectTheTransactionAmount(page, '3004');
        await helperFunctions.clickOnNewCardButton(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        let apiResponse: any = null;
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/status.json')) {
                try {
                    apiResponse = await response.json();
                } catch (error) {
                    console.log('Response is not JSON or empty');
                }
            }
        });
        await helperFunctions.clickOnThreeDS2PayButton(page);
        await threeDSGatewayPage.waitForAcsChallengeForm(page);
        await threeDSGatewayPage.clickOnAllowButton(page);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        expect(resultPageType).toBe('success');
        if (apiResponse) {
            expect(apiResponse).toBeDefined();
            expect(apiResponse).not.toBeNull();
            const state = apiResponse.transaction.state;
            expect(state).toBe('succeeded');
        }
    })

    test('3DS gateway specific flow for hosted fields Challenge Flow (3004) Fingerprint challenge failure case', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOn3DSGatewaySpecificButton(page);
        await waitForAuthParams(page);
        await threeDSGatewayPage.selectTheTransactionAmount(page, '3004');
        await helperFunctions.clickOnNewCardButton(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        let apiResponse: any = null;
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/status.json')) {
                try {
                    apiResponse = await response.json();
                } catch (error) {
                    console.log('Response is not JSON or empty');
                }
            }
        });
        await helperFunctions.clickOnThreeDS2PayButton(page);
        await threeDSGatewayPage.waitForAcsChallengeForm(page);
        await threeDSGatewayPage.clickOnDenyButton(page);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        expect(resultPageType).toBe('error');
        if (apiResponse) {
            expect(apiResponse).toBeDefined();
            expect(apiResponse).not.toBeNull();
            const state = apiResponse.transaction.state;
            expect(state).toBe('gateway_processing_failed');
        }
    })

    test('3DS gateway specific flow for hosted fields Challenge Flow (3005) Direct challenge success case', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOn3DSGatewaySpecificButton(page);
        await waitForAuthParams(page);
        await threeDSGatewayPage.selectTheTransactionAmount(page, '3005');
        await helperFunctions.clickOnNewCardButton(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        let apiResponse: any = null;
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/status.json')) {
                try {
                    apiResponse = await response.json();
                } catch (error) {
                    console.log('Response is not JSON or empty');
                }
            }
        });
        await helperFunctions.clickOnThreeDS2PayButton(page);
        await threeDSGatewayPage.waitForAcsChallengeForm(page);
        await threeDSGatewayPage.clickOnAllowButton(page);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        expect(resultPageType).toBe('success');
        if (apiResponse) {
            expect(apiResponse).toBeDefined();
            expect(apiResponse).not.toBeNull();
            const state = apiResponse.transaction.state;
            expect(state).toBe('succeeded');
        }
    })

    test('3DS gateway specific flow for hosted fields Challenge Flow (3005) Direct challenge failure case', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOn3DSGatewaySpecificButton(page);
        await waitForAuthParams(page);
        await threeDSGatewayPage.selectTheTransactionAmount(page, '3005');
        await helperFunctions.clickOnNewCardButton(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        let apiResponse: any = null;
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/status.json')) {
                try {
                    apiResponse = await response.json();
                } catch (error) {
                    console.log('Response is not JSON or empty');
                }
            }
        });
        await helperFunctions.clickOnThreeDS2PayButton(page);
        await threeDSGatewayPage.waitForAcsChallengeForm(page);
        await threeDSGatewayPage.clickOnDenyButton(page);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        expect(resultPageType).toBe('error');
        if (apiResponse) {
            expect(apiResponse).toBeDefined();
            expect(apiResponse).not.toBeNull();
            const state = apiResponse.transaction.state;
            expect(state).toBe('gateway_processing_failed');
        }
    })

    test('3DS gateway specific flow for hosted fields Challenge Flow (3103) Fingerprint authorize failure case', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOn3DSGatewaySpecificButton(page);
        await waitForAuthParams(page);
        await threeDSGatewayPage.selectTheTransactionAmount(page, '3103');
        await helperFunctions.clickOnNewCardButton(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        let apiResponse: any = null;
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/complete')) {
                try {
                    apiResponse = await response.json();
                } catch (error) {
                    console.log('Response is not JSON or empty');
                }
            }
        });
        await helperFunctions.clickOnThreeDS2PayButton(page);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        expect(resultPageType).toBe('error');
        if (apiResponse) {
            expect(apiResponse).toBeDefined();
            expect(apiResponse).not.toBeNull();
            const state = apiResponse.transaction.state;
            expect(state).toBe('gateway_processing_failed');
        }
    })

    test('3DS gateway specific flow for hosted fields Challenge Flow (3104) challenge failure allow case', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOn3DSGatewaySpecificButton(page);
        await waitForAuthParams(page);
        await threeDSGatewayPage.selectTheTransactionAmount(page, '3104');
        await helperFunctions.clickOnNewCardButton(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        let apiResponse: any = null;
        page.on('response', async (response) => {
         const url = response.url();
         if (url.includes('/status.json')) {
            try {
                apiResponse = await response.json();
            } catch (error) {
                console.log('Response is not JSON or empty');
            }
         }
        });
        await helperFunctions.clickOnThreeDS2PayButton(page);
        await threeDSGatewayPage.waitForAcsChallengeForm(page);
        await threeDSGatewayPage.clickOnAllowButton(page);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        expect(resultPageType).toBe('error');
        if (apiResponse) {
            expect(apiResponse).toBeDefined();
            expect(apiResponse).not.toBeNull();
            const state = apiResponse.transaction.state;
            expect(state).toBe('gateway_processing_failed');
        }
    })

    test('3DS gateway specific flow for hosted fields Challenge Flow (3104) challenge failure deny case', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOn3DSGatewaySpecificButton(page);
        await waitForAuthParams(page);
        await threeDSGatewayPage.selectTheTransactionAmount(page, '3104');
        await helperFunctions.clickOnNewCardButton(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        }); 
        let apiResponse: any = null;
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/status.json')) {
                try {
                    apiResponse = await response.json();
                } catch (error) {
                    console.log('Response is not JSON or empty');
                }
            }
        });
        await helperFunctions.clickOnThreeDS2PayButton(page);
        await threeDSGatewayPage.waitForAcsChallengeForm(page);
        await threeDSGatewayPage.clickOnDenyButton(page);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        expect(resultPageType).toBe('error');
        if (apiResponse) {
            expect(apiResponse).toBeDefined();
            expect(apiResponse).not.toBeNull();
            const state = apiResponse.transaction.state;
            expect(state).toBe('gateway_processing_failed');
        }
    })
})