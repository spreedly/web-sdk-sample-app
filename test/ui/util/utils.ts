import { Page } from "@playwright/test";
import { expect } from "../util/fixtures";
import { getMaskedCardNumber, LABELS, ERROR_MESSAGES } from "../util/test-constants";
import { SELECTORS, TEST_DATA } from "../util/test-constants";

export const TEST_ID = {
    EXPRESS_CHECKOUT_SUBMIT_BUTTON: 'express-checkout-submit-btn',
}

export const PLACEHOLDERS = {
    EXPRESS_FIRST_NAME: "Joe",
    EXPRESS_LAST_NAME: "Jones",
    EXPRESS_CARD_NUMBER: "1234 5678 9012 3456",
    EXPRESS_CVV: "123",
    RECACHE_CVV: "•••",
    EXPRESS_MONTH: "MM",
    EXPRESS_YEAR: "YYYY",
  };

  export const helperFunctions = {
    fillExpressCheckoutForm: async (
        page: Page, 
        cardNumber: string,
        options?: {
            firstName?: string;
            lastName?: string;
            cvv?: string;
            expiryMonth?: string;
            expiryYear?: string;
        }
    ) => {
        await expect(page.locator(SELECTORS.EXPRESS_IFRAME)).toBeVisible();
        const expressCheckoutIframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
        await expressCheckoutIframe
            .getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER)
            .fill(cardNumber);
        if (options?.firstName) {
            await expressCheckoutIframe
                .getByPlaceholder(PLACEHOLDERS.EXPRESS_FIRST_NAME)
                .fill(options.firstName);
        }
        
        if (options?.lastName) {
            await expressCheckoutIframe
                .getByPlaceholder(PLACEHOLDERS.EXPRESS_LAST_NAME)
                .fill(options.lastName);
        }
        
        if (options?.cvv) {
            await expressCheckoutIframe
                .locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_CVV}"]`)
                .fill(options.cvv);
        }
        
        if (options?.expiryMonth) {
            await expressCheckoutIframe
                .locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_MONTH}"]`)
                .fill(options.expiryMonth);
        }
        
        if (options?.expiryYear) {
            await expressCheckoutIframe
                .locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_YEAR}"]`)
                .fill(options.expiryYear);
        }
    },

    getExpiredYearErrorMessage: async (page: Page) => {
        return page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.CARD_EXPIRED}"]`);
    },

    getTokenizationFailedMessage: async (page: Page) => {
        return await page.locator(SELECTORS.tokenizationFailedMessage);
    },
   
    clickOnExpressCheckoutSubmitButton: async (page: Page) => {
        const expressCheckoutIframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
        const payButton = expressCheckoutIframe.getByTestId(TEST_ID.EXPRESS_CHECKOUT_SUBMIT_BUTTON);
        await expect(payButton).toBeEnabled();
        await payButton.click();
    },
    clickOnHostedFieldsSubmitButton: async (page: Page) => {
        const submitButton = page.locator(SELECTORS.HOSTED_SUBMIT_BUTTON);
        await expect(submitButton).toBeEnabled();
        await submitButton.click();
    },

    getExpressCheckoutCardNumberField: async (page: Page) => {
        return page.frameLocator(SELECTORS.EXPRESS_IFRAME).getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER);
    },
    getExpressCheckoutCvvField: async (page: Page) => {
        return page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_CVV}"]`);
    },
    getExpressCheckoutMonthField: async (page: Page) => {
        return page.frameLocator(SELECTORS.EXPRESS_IFRAME).getByPlaceholder(PLACEHOLDERS.EXPRESS_MONTH);
    },
    getExpressCheckoutYearField: async (page: Page) => {
        return page.frameLocator(SELECTORS.EXPRESS_IFRAME).getByPlaceholder(PLACEHOLDERS.EXPRESS_YEAR);
    },
    getExpressCheckoutFirstNameField: async (page: Page) => {
        return page.frameLocator(SELECTORS.EXPRESS_IFRAME).getByPlaceholder(PLACEHOLDERS.EXPRESS_FIRST_NAME);
    },
    getExpressCheckoutLastNameField: async (page: Page) => {
        return page.frameLocator(SELECTORS.EXPRESS_IFRAME).getByPlaceholder(PLACEHOLDERS.EXPRESS_LAST_NAME);
    },
    getExpressCheckoutSubmitButton: async (page: Page) => {
        return page.frameLocator(SELECTORS.EXPRESS_IFRAME).getByTestId(TEST_ID.EXPRESS_CHECKOUT_SUBMIT_BUTTON);
    },

    getHostedFieldsFirstNameField: async (page: Page) => {
        return page.getByLabel(LABELS.FIRST_NAME);
    },
    getHostedFieldsLastNameField: async (page: Page) => {
        return page.getByLabel(LABELS.LAST_NAME);
    },
    getHostedFieldsExpiryMonthField: async (page: Page) => {
        return page.locator(SELECTORS.EXPIRY_MONTH);
    },
    getHostedFieldsExpiryYearField: async (page: Page) => {
        return page.locator(SELECTORS.EXPIRY_YEAR);
    },
    getHostedFieldsCvvField: async (page: Page) => {
        return page.frameLocator(SELECTORS.HOSTED_CVV_IFRAME).getByRole("textbox", { name: LABELS.CVV_NUMBER });
    },
    getHostedFieldsCardNumberField: async (page: Page) => {
        return page.frameLocator(SELECTORS.HOSTED_CARD_IFRAME).getByRole("textbox", { name: LABELS.CARD_NUMBER });
    },
    getHostedFieldsSubmitButton: async (page: Page) => {
        return page.locator(SELECTORS.HOSTED_SUBMIT_BUTTON);
    },

    verifyFormFieldsHostedFields: async (page: Page, cardNumber: string, options?: {
        firstName?: string;
        lastName?: string;
        cvv?: string;
        expiryMonth?: string;
        expiryYear?: string;
    }) => {
        // TODO: Change to masked once implemented
        await expect(await helperFunctions.getHostedFieldsCardNumberField(page)).toHaveValue(cardNumber);
        if (options?.firstName) {
            await expect(await helperFunctions.getHostedFieldsFirstNameField(page)).toHaveValue(options?.firstName);
        }
        if (options?.lastName) {
            await expect(await helperFunctions.getHostedFieldsLastNameField(page)).toHaveValue(options?.lastName);
        }
        if (options?.expiryMonth) {
            await expect(await helperFunctions.getHostedFieldsExpiryMonthField(page)).toHaveValue(options?.expiryMonth);
        }
        if (options?.expiryYear) {
            await expect(await helperFunctions.getHostedFieldsExpiryYearField(page)).toHaveValue(options?.expiryYear);
        }
        if (options?.cvv) {
            await expect(await helperFunctions.getHostedFieldsCvvField(page)).toHaveValue(options?.cvv);
        }
    },

    verifyFormFieldsExpressCheckout: async (page: Page, cardNumber: string,
        options?: {
            firstName?: string;
            lastName?: string;
            cvv?: string;
            expiryMonth?: string;
            expiryYear?: string;
        }) => {
        
        await expect(await helperFunctions.getExpressCheckoutCardNumberField(page)).toHaveValue(getMaskedCardNumber(cardNumber));
        if (options?.firstName) {
            await expect(await helperFunctions.getExpressCheckoutFirstNameField(page)).toHaveValue(options?.firstName);
        }
        if (options?.lastName) {
            await expect(await helperFunctions.getExpressCheckoutLastNameField(page)).toHaveValue(options?.lastName);
        }
        if (options?.cvv) {
            await expect(await helperFunctions.getExpressCheckoutCvvField(page)).toHaveValue(options?.cvv);
        }
        if (options?.expiryMonth) {
            await expect(await helperFunctions.getExpressCheckoutMonthField(page)).toHaveValue(options?.expiryMonth);
        }
        if (options?.expiryYear) {
            await expect(await helperFunctions.getExpressCheckoutYearField(page)).toHaveValue(options?.expiryYear);
        }
    },

    fillHostedFieldsForm: async (page: Page, cardNumber: string, options?: {
        firstName?: string;
        lastName?: string;
        cvv?: string;
        expiryMonth?: string;
        expiryYear?: string;
    }) => {
    const firstNameField = await helperFunctions.getHostedFieldsFirstNameField(page);
    const lastNameField = await helperFunctions.getHostedFieldsLastNameField(page);
    const expiryMonthField = await helperFunctions.getHostedFieldsExpiryMonthField(page);
    const expiryYearField = await helperFunctions.getHostedFieldsExpiryYearField(page);
    const cardNumberField = await helperFunctions.getHostedFieldsCardNumberField(page);
    const cvvField = await helperFunctions.getHostedFieldsCvvField(page);
    
    if (options?.firstName) {
        await firstNameField.fill(options.firstName);
    }
    if (options?.lastName) {
        await lastNameField.fill(options.lastName);
    }
    if (options?.expiryMonth) {
        await expiryMonthField.fill(options.expiryMonth);
    }
    if (options?.expiryYear) {
        await expiryYearField.fill(options.expiryYear);
    }
    if (options?.cvv) {
        await cvvField.fill(options.cvv);
    }
    await cardNumberField.fill(cardNumber);
    },

    formatExpiryYear: (year: string, month: string) => {
        return `${month}/${year.slice(-2)}`;
    },

    verifyResultCard: async (page: Page, cardFirstSixDigits, cardLastFourDigits, storageState: string, options?: {
        expiryDate?: { year: string, month: string };
    }) => {
        await expect(page.locator('.result-card')).toBeVisible();
         const firstSixValue = page.locator('.result-label:has-text("First Six")')
        .locator('+ .result-value');
        await expect(firstSixValue).toHaveText(cardFirstSixDigits);
         const storageStateValue = page.locator('.result-label:has-text("Storage State")')
        .locator('+ .result-value');
        await expect(storageStateValue).toHaveText(storageState);
        const lastFourValue = page.locator('.result-label:has-text("Last Four")')
        .locator('+ .result-value');
        await expect(lastFourValue).toHaveText(cardLastFourDigits); 
        if (options?.expiryDate?.year && options?.expiryDate?.month) {
            const expiryValue = page.locator('.result-label:has-text("Expiry")')
                .locator('+ .result-value');
            await expect(expiryValue).toHaveText(
                helperFunctions.formatExpiryYear(options.expiryDate.year, options.expiryDate.month)
            );
        }
    },

    captureApiResponse: async (page: Page, url1: string, options?: { url2?: string }): Promise<{ apiResponse: any; responseStatus: number | null }> => {
        return new Promise((resolve) => {
            page.on('response', async (response) => {
                const url = response.url();
                if (url.includes(url1) || (options?.url2 && url.includes(options?.url2))) {
                    const responseStatus = response.status();
                    let apiResponse: any = null;
                    try {
                        apiResponse = await response.json();
                    } catch (error) {
                        console.log('Response is not JSON or empty');
                    }
                    resolve({ apiResponse, responseStatus });
                }
            });
        });
    },
   
    verifyApiResponse: async (page: Page, apiResponse: any, responseStatus: number) => {
        await expect(apiResponse).toBeDefined();
        await expect(responseStatus).toBeDefined();
        await expect(responseStatus).toBe(200);
    }
}