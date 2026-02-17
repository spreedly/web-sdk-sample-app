import { purchasePage } from "../pages/3dsPage";
import { landingPage } from "../pages/landingPage";
import { test, expect } from "../util/fixtures";
import { TEST_DATA, waitForAuthParams, getValidYearString } from "../util/test-constants";
import { MONOREPO_URLS } from "../util/urls";
import { helperFunctions } from "../util/utils";
import { tokenizePage } from "../pages/tokenizePage";

test.describe('3DS Flow', () => {
    test('3DS flow for hosted fields Challenge Flow authentication success case', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOn3DSButton(page);
        await waitForAuthParams(page);
        await purchasePage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await helperFunctions.clickOnNewCardButton(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
           });
           let responseStatus: number | null = null;
           let apiResponse: any = null;
           page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/status.json')) {
              responseStatus = response.status();
              try {
                apiResponse = await response.json();
                console.log('API Request URL:', url);
                console.log('API Response Status:', responseStatus);
              } catch (error) {
                console.log('Response is not JSON or empty');
              }
            }
          });
        await helperFunctions.clickOnThreeDS2PayButton(page);
        await purchasePage.waitForChallengeForm(page);
        await purchasePage.completeChallengeForm(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_SUCCESS_PIN);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        await expect(resultPageType).toBe('success');
        expect(responseStatus).toBeDefined();
        expect(responseStatus).toBe(200);
        expect(apiResponse).toBeDefined();
        expect(apiResponse).not.toBeNull();
        if (apiResponse) {
          const state = apiResponse.transaction.state;
          expect(state).toBe('succeeded');
        }
    });

    test('3DS flow for hosted fields Challenge Flow authentication failed case due to invalid PIN', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOn3DSButton(page);
        await waitForAuthParams(page);
        await purchasePage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await helperFunctions.clickOnNewCardButton(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        let responseStatus: number | null = null;
           let apiResponse: any = null;
           page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/status.json')) {
              responseStatus = response.status();
              try {
                apiResponse = await response.json();
                console.log('API Request URL:', url);
                console.log('API Response Status:', responseStatus);
              } catch (error) {
                console.log('Response is not JSON or empty');
              }
            }
          });
        await helperFunctions.clickOnThreeDS2PayButton(page);
        await purchasePage.waitForChallengeForm(page);
        await purchasePage.completeChallengeForm(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_FAILED_PIN);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        await expect(resultPageType).toBe('error');
        expect(responseStatus).toBeDefined();
        expect(responseStatus).toBe(200);
        expect(apiResponse).toBeDefined();
        expect(apiResponse).not.toBeNull();
        if (apiResponse) {
          const state = apiResponse.transaction.state;
          expect(state).toBe('failed');
        }
    });

    test('3DS flow for hosted fields Challenge Flow authentication failed case due to cancel button click', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOn3DSButton(page);
        await waitForAuthParams(page);
        await purchasePage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await helperFunctions.clickOnNewCardButton(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        let responseStatus: number | null = null;
        let apiResponse: any = null;
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/status.json')) {
                responseStatus = response.status();
                try {
                    apiResponse = await response.json();
                    console.log('API Request URL:', url);
                    console.log('API Response Status:', responseStatus);
                } catch (error) {
                    console.log('Response is not JSON or empty');
                }
            }
        });
        await helperFunctions.clickOnThreeDS2PayButton(page);
        await purchasePage.waitForChallengeForm(page);
        await purchasePage.clickChallengeCancelButton(page);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        await expect(resultPageType).toBe('error');
        expect(responseStatus).toBeDefined();
        expect(responseStatus).toBe(200);
        expect(apiResponse).toBeDefined();
        expect(apiResponse).not.toBeNull();
        if (apiResponse) {
          const state = apiResponse.transaction.state;
          expect(state).toBe('failed');
        }   
    });

    test('3DS flow for hosted fields Frictionless Success case', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOn3DSButton(page);
        await waitForAuthParams(page);
        await purchasePage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await helperFunctions.clickOnNewCardButton(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.THREE_DS2_FRUCTIONLESS_SUCCESS_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.THREE_DS2_FRUCTIONLESS_SUCCESS_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        let responseStatus: number | null = null;
        let apiResponse: any = null;
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/status.json')) {
                responseStatus = response.status();
                try {
                    apiResponse = await response.json();
                    console.log('API Request URL:', url);
                    console.log('API Response Status:', responseStatus);
                } catch (error) {
                    console.log('Response is not JSON or empty');
                }
            }
        });
        await helperFunctions.clickOnThreeDS2PayButton(page);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        await expect(resultPageType).toBe('success');
        expect(responseStatus).toBeDefined();
        expect(responseStatus).toBe(200);
        expect(apiResponse).toBeDefined();  
        expect(apiResponse).not.toBeNull();
        if (apiResponse) {
          const state = apiResponse.transaction.state;
          expect(state).toBe('succeeded');
        }
    });

    test('3DS flow for hosted fields Frictionless Failure case', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOn3DSButton(page);
        await waitForAuthParams(page);
        await purchasePage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await helperFunctions.clickOnNewCardButton(page);
        await helperFunctions.fillHostedFieldsForm(page, TEST_DATA.THREE_DS2_FRUCTIONLESS_FAILURE_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsHostedFields(page, TEST_DATA.THREE_DS2_FRUCTIONLESS_FAILURE_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        }); 
        let responseStatus: number | null = null;
        let apiResponse: any = null;
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/create-purchase-with-3ds')) {
                responseStatus = response.status();
                try {
                    apiResponse = await response.json();
                    console.log('API Request URL:', url);
                    console.log('API Response Status:', responseStatus);
                } catch (error) {
                    console.log('Response is not JSON or empty');
                }
            }
        });
        await helperFunctions.clickOnThreeDS2PayButton(page);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        await expect(resultPageType).toBe('error');
        expect(responseStatus).toBeDefined();
        expect(responseStatus).toBe(422);
        expect(apiResponse).toBeDefined();
        expect(apiResponse).not.toBeNull();
        if (apiResponse) {
          const state = apiResponse.transaction.state;
          expect(state).toBe('failed');
        }
    });

    test('3DS flow for Express Checkout Challenge Flow authentication success case', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnExpressCheckoutButton(page);
        await landingPage.clickOn3DSButton(page);
        await waitForAuthParams(page);
        await purchasePage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await helperFunctions.clickOnNewCardButton(page);
        await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
           });
           let responseStatus: number | null = null;
           let apiResponse: any = null;
           page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/status.json')) {
              responseStatus = response.status();
              try {
                apiResponse = await response.json();
                console.log('API Request URL:', url);
                console.log('API Response Status:', responseStatus);
              } catch (error) {
                console.log('Response is not JSON or empty');
              }
            }
          });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await purchasePage.waitForChallengeForm(page);
        await purchasePage.completeChallengeForm(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_SUCCESS_PIN);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        await expect(resultPageType).toBe('success');
        expect(responseStatus).toBeDefined();
        expect(responseStatus).toBe(200);
        expect(apiResponse).toBeDefined();
        expect(apiResponse).not.toBeNull();
        if (apiResponse) {
          const state = apiResponse.transaction.state;
          expect(state).toBe('succeeded');
        }
    });

    test('3DS flow for Express Checkout Challenge Flow authentication failed case due to invalid PIN', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnExpressCheckoutButton(page);
        await landingPage.clickOn3DSButton(page);
        await waitForAuthParams(page);
        await purchasePage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await helperFunctions.clickOnNewCardButton(page);
        await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        let responseStatus: number | null = null;
           let apiResponse: any = null;
           page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/status.json')) {
              responseStatus = response.status();
              try {
                apiResponse = await response.json();
                console.log('API Request URL:', url);
                console.log('API Response Status:', responseStatus);
              } catch (error) {
                console.log('Response is not JSON or empty');
              }
            }
          });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await purchasePage.waitForChallengeForm(page);
        await purchasePage.completeChallengeForm(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_FAILED_PIN);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        await expect(resultPageType).toBe('error');
        expect(responseStatus).toBeDefined();
        expect(responseStatus).toBe(200);
        expect(apiResponse).toBeDefined();
        expect(apiResponse).not.toBeNull();
        if (apiResponse) {
          const state = apiResponse.transaction.state;
          expect(state).toBe('failed');
        }
    });

    test('3DS flow for Express Checkout Challenge Flow authentication failed case due to cancel button click', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnExpressCheckoutButton(page);
        await landingPage.clickOn3DSButton(page);
        await waitForAuthParams(page);
        await purchasePage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await helperFunctions.clickOnNewCardButton(page);
        await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.THREE_DS2_CHALLENGE_FLOW_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        let responseStatus: number | null = null;
        let apiResponse: any = null;
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/status.json')) {
                responseStatus = response.status();
                try {
                    apiResponse = await response.json();
                    console.log('API Request URL:', url);
                    console.log('API Response Status:', responseStatus);
                } catch (error) {
                    console.log('Response is not JSON or empty');
                }
            }
        });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await purchasePage.waitForChallengeForm(page);
        await purchasePage.clickChallengeCancelButton(page);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        await expect(resultPageType).toBe('error');
        expect(responseStatus).toBeDefined();
        expect(responseStatus).toBe(200);
        expect(apiResponse).toBeDefined();
        expect(apiResponse).not.toBeNull();
        if (apiResponse) {
          const state = apiResponse.transaction.state;
          expect(state).toBe('failed');
        }   
    });

    test('3DS flow for Express Checkout Frictionless Success case', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnExpressCheckoutButton(page);
        await landingPage.clickOn3DSButton(page);
        await waitForAuthParams(page);
        await purchasePage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await helperFunctions.clickOnNewCardButton(page);
        await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.THREE_DS2_FRUCTIONLESS_SUCCESS_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.THREE_DS2_FRUCTIONLESS_SUCCESS_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        let responseStatus: number | null = null;
        let apiResponse: any = null;
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/status.json')) {
                responseStatus = response.status();
                try {
                    apiResponse = await response.json();
                    console.log('API Request URL:', url);
                    console.log('API Response Status:', responseStatus);
                } catch (error) {
                    console.log('Response is not JSON or empty');
                }
            }
        });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        await expect(resultPageType).toBe('success');
        expect(responseStatus).toBeDefined();
        expect(responseStatus).toBe(200);
        expect(apiResponse).toBeDefined();  
        expect(apiResponse).not.toBeNull();
        if (apiResponse) {
          const state = apiResponse.transaction.state;
          expect(state).toBe('succeeded');
        }
    });

    test('3DS flow for Express Checkout Frictionless Failure case', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnExpressCheckoutButton(page);
        await landingPage.clickOn3DSButton(page);
        await waitForAuthParams(page);
        await purchasePage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await helperFunctions.clickOnNewCardButton(page);
        await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
        await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.THREE_DS2_FRUCTIONLESS_FAILURE_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        });
        await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.THREE_DS2_FRUCTIONLESS_FAILURE_CARD_NUMBER, {
            firstName: TEST_DATA.FIRST_NAME,
            lastName: TEST_DATA.LAST_NAME,
            cvv: TEST_DATA.CVV,
            expiryMonth: TEST_DATA.EXPIRY_MONTH,
            expiryYear: getValidYearString(),
        }); 
        let responseStatus: number | null = null;
        let apiResponse: any = null;
        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('/create-purchase-with-3ds')) {
                responseStatus = response.status();
                try {
                    apiResponse = await response.json();
                    console.log('API Request URL:', url);
                    console.log('API Response Status:', responseStatus);
                } catch (error) {
                    console.log('Response is not JSON or empty');
                }
            }
        });
        await helperFunctions.clickOnExpressCheckoutSubmitButton(page);
        await purchasePage.waitForResultPage(page);
        const resultPageType = await purchasePage.getResultPageType(page);
        await expect(resultPageType).toBe('error');
        expect(responseStatus).toBeDefined();
        expect(responseStatus).toBe(422);
        expect(apiResponse).toBeDefined();
        expect(apiResponse).not.toBeNull();
        if (apiResponse) {
          const state = apiResponse.transaction.state;
          expect(state).toBe('failed');
        }
    });
});