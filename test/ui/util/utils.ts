import { Page } from "@playwright/test";
import { expect } from "../util/fixtures";
import { getMaskedCardNumber, LABELS, ERROR_MESSAGES, getValidYearString } from "../util/test-constants";
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

    clickOnNewCardButton: async (page: Page) => {
        const newCardButton = page.locator(SELECTORS.NEW_CARD_BUTTON);
        await expect(newCardButton).toBeVisible();
        await newCardButton.click();
    },
    clickOnSavedCardButton: async (page: Page) => {
        const savedCardButton = page.locator(SELECTORS.SAVED_CARD_BUTTON);
        await expect(savedCardButton).toBeVisible();
        await savedCardButton.click();
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

    clickOnThreeDS2PayButton: async (page: Page) => {
        const payButton = page.locator(SELECTORS.THREE_DS2_PAY_BUTTON);
        await expect(payButton).toBeEnabled();
        await payButton.click();
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
        return page.frameLocator(SELECTORS.HOSTED_CVV_IFRAME).locator('input[data-testid="hosted-cvv-field"]');
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
    await cardNumberField.type(cardNumber, { delay: 50 });
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
    },

    formatExpiryYear: (year: string, month: string) => {
        return `${month}/${year.slice(-2)}`;
    },

    verifyResultCard: async (page: Page, cardFirstSixDigits: string, cardLastFourDigits: string, storageState: string, options?: {
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

    verifyRequestPayloadData: async (apiRequestPayload: any, firstName: string, lastName: string, cardNumber: string, cvv: string, month: string, year: string) => {
     const { firstNameInRequest, lastNameInRequest, cardNumberInRequest, cvvInRequest, monthInRequest, yearInRequest } = helperFunctions.requestPayloadData(apiRequestPayload);
      await expect(firstNameInRequest).toBe(firstName);
      await expect(lastNameInRequest).toBe(lastName);
      await expect(cardNumberInRequest).toBe(cardNumber);
      await expect(cvvInRequest).toBe(cvv);
      await expect(monthInRequest).toBe(month);
      await expect(yearInRequest).toBe(year); 

      },

    async tokenGenerationScenarioToHave(page: Page, apiResponse: any) {
        expect(apiResponse).toHaveProperty('transaction');
        const paymentMethod = apiResponse.transaction.payment_method;
            expect(apiResponse.transaction).toHaveProperty('token');
            expect(apiResponse.transaction).toHaveProperty('succeeded');
            expect(apiResponse.transaction).toHaveProperty('state');
            expect(apiResponse.transaction).toHaveProperty('message');
            expect(apiResponse.transaction).toHaveProperty('transaction_type');
            expect(apiResponse.transaction).toHaveProperty('payment_method');
            expect(paymentMethod).toHaveProperty('token');
            expect(paymentMethod).toHaveProperty('last_four_digits');
            expect(paymentMethod).toHaveProperty('first_six_digits');
            expect(paymentMethod).toHaveProperty('card_type');
            expect(paymentMethod).toHaveProperty('first_name');
            expect(paymentMethod).toHaveProperty('last_name');
            expect(paymentMethod).toHaveProperty('month');
            expect(paymentMethod).toHaveProperty('year');
            expect(paymentMethod).toHaveProperty('test');
            expect(paymentMethod).toHaveProperty('payment_method_type');
            expect(paymentMethod).toHaveProperty('storage_state');
            expect(paymentMethod).toHaveProperty('eligible_for_card_updater');
            expect(paymentMethod).toHaveProperty('issuer_identification_number');
            expect(paymentMethod).toHaveProperty('managed');
            expect(paymentMethod).toHaveProperty('fingerprint');
            expect(paymentMethod).toHaveProperty('verification_value');
            expect(paymentMethod).toHaveProperty('number');
            expect(paymentMethod).toHaveProperty('created_at');
            expect(paymentMethod).toHaveProperty('updated_at');
            expect(paymentMethod.bin_metadata).toHaveProperty('card_brand');
            expect(paymentMethod.bin_metadata).toHaveProperty('issuing_bank');
            expect(paymentMethod.bin_metadata).toHaveProperty('card_type');
            expect(paymentMethod.bin_metadata.card_brand).toBe('VISA');
        return paymentMethod;
      },

      requestPayloadData: (apiRequestPayload: any) => {
        const firstNameInRequest = apiRequestPayload.payment_method.credit_card.first_name;
        const lastNameInRequest = apiRequestPayload.payment_method.credit_card.last_name;
        const cardNumberInRequest = apiRequestPayload.payment_method.credit_card.number;
        const cvvInRequest = apiRequestPayload.payment_method.credit_card.verification_value;
        const monthInRequest = apiRequestPayload.payment_method.credit_card.month;
        const yearInRequest = apiRequestPayload.payment_method.credit_card.year;
        return { firstNameInRequest, lastNameInRequest, cardNumberInRequest, cvvInRequest, monthInRequest, yearInRequest };
      },

      verifyApiResponse: async (page: Page, apiResponse: any,succeeded: boolean,state: string, message: string, transactionType: string, lastFourDigits: string, firstSixDigits: string, cardType: string, firstName: string, lastName: string, month: number, year: number, paymentMethodType: string, issuerIdentificationNumber: string, eligibleForCardUpdater: boolean, managed: boolean, number: string) => {
        const paymentMethod = await helperFunctions.tokenGenerationScenarioToHave(page, apiResponse);
        expect(apiResponse.transaction.succeeded).toBe(succeeded);
        expect(apiResponse.transaction.state).toBe(state);
        expect(apiResponse.transaction.message).toMatch(message);
        expect(apiResponse.transaction.transaction_type).toBe(transactionType);
        expect(paymentMethod.last_four_digits).toBe(lastFourDigits);
        expect(paymentMethod.first_six_digits).toBe(firstSixDigits);
        expect(paymentMethod.card_type).toBe(cardType);
        expect(paymentMethod.first_name).toBe(firstName);
        expect(paymentMethod.last_name).toBe(lastName);
        expect(paymentMethod.month).toBe(month);
        expect(paymentMethod.year).toBe(year);
        expect(paymentMethod.payment_method_type).toBe(paymentMethodType);
        expect(paymentMethod.issuer_identification_number).toBe(issuerIdentificationNumber);
        expect(paymentMethod.eligible_for_card_updater).toBe(eligibleForCardUpdater);
        expect(paymentMethod.managed).toBe(managed);
        expect(paymentMethod.number).toMatch(new RegExp(`XXXX-XXXX-XXXX-${number.slice(-4)}`));
      },
}
