import { expect } from "../util/fixtures";
import { Page } from "@playwright/test";
import { SELECTORS, THREE_DS_SELECTORS } from "../util/test-constants";

export const purchasePage = {

    clickOnProductIncreaseButton: async (page: Page, productId: string) => {
        const increaseButton = page.locator(`.product-card[data-product-id="${productId}"] .quantity-btn.increase-qty`);
        await expect(increaseButton).toBeVisible();
        await expect(increaseButton).toBeEnabled();
        await increaseButton.click();
    },

    clickOnProductDecreaseButton: async (page: Page, productId: string) => {
        const decreaseButton = page.locator(`.product-card[data-product-id="${productId}"] .quantity-btn.decrease-qty`);
        await expect(decreaseButton).toBeVisible();
        await expect(decreaseButton).toBeEnabled();
        await decreaseButton.click();
    },

    getProductQuantity: async (page: Page, productId: string) => {
        const quantityInput = page.locator(`.product-card[data-product-id="${productId}"] .quantity-input`);
        await expect(quantityInput).toBeVisible();
        const value = await quantityInput.inputValue();
        return parseInt(value);
    },
    clickOnProceedToPaymentButton: async (page: Page) => {
        const proceedToPaymentButton = page.locator(THREE_DS_SELECTORS.PROCEED_TO_PAYMENT_BUTTON);
        await expect(proceedToPaymentButton).toBeVisible();
        await expect(proceedToPaymentButton).toBeEnabled();
        await proceedToPaymentButton.click();
    },

    // 3DS Challenge Form Functions
    waitForChallengeForm: async (page: Page, timeout: number = 20000) => {
        await page.waitForTimeout(3000);
        const challengeIframe = page.locator(THREE_DS_SELECTORS.CHALLENGE_IFRAME);
        await expect(challengeIframe).toBeVisible({ timeout });
        
        // Wait for the form inside the iframe to be loaded
        const challengeFrame = page.frameLocator(THREE_DS_SELECTORS.CHALLENGE_IFRAME);
        
        //3DS2 Challenge UI changed no longer needed
        //const challengeForm = challengeFrame.locator(THREE_DS_SELECTORS.CHALLENGE_FORM);
        //await expect(challengeForm).toBeVisible({ timeout });
        
        return challengeFrame;
    },

    inputChallengePin: async (page: Page, pin: string) => {
        // Wait for challenge form to appear
        const challengeFrame = await purchasePage.waitForChallengeForm(page);
        
        // Find the OTP/PIN input field
        // Try multiple selectors to find the input field
        const codeSection = challengeFrame.locator(THREE_DS_SELECTORS.CHALLENGE_CODE_SECTION);
        await expect(codeSection).toBeVisible();
        
        // Try to find input within code section first, then fallback to generic selectors
        let otpInput = codeSection.locator('input').first();
        
        // If not found in code section, try generic selectors
        if (await otpInput.count() === 0) {
            otpInput = challengeFrame.locator(THREE_DS_SELECTORS.CHALLENGE_OTP_INPUT).first();
        }
        
        // Alternative: try finding by label and then the associated input
        const labelExists = await challengeFrame.locator(THREE_DS_SELECTORS.CHALLENGE_OTP_LABEL).count() > 0;
        if (labelExists) {
            // Find input that follows or is associated with the label
            const labelInput = challengeFrame.locator(THREE_DS_SELECTORS.CHALLENGE_OTP_LABEL).locator('+ input').first();
            if (await labelInput.count() > 0) {
                otpInput = labelInput;
            }
        }
        await expect(otpInput).toBeVisible();
        await expect(otpInput).toBeEnabled();
        await otpInput.type(pin, { delay: 50 });
        //await otpInput.blur();
        // await otpInput.press('Tab');
        const payButton = challengeFrame.locator(THREE_DS_SELECTORS.CHALLENGE_PAY_BUTTON).first();
        await expect(payButton).toBeEnabled({ timeout: 5000 });
    },

    clickChallengePayButton: async (page: Page) => {
        const challengeFrame = await purchasePage.waitForChallengeForm(page);
        const payButton = challengeFrame.locator(THREE_DS_SELECTORS.CHALLENGE_PAY_BUTTON).first();
        await expect(payButton).toBeVisible();
        await expect(payButton).toBeEnabled();
        await payButton.click();
    },

    clickChallengeCancelButton: async (page: Page) => {
        // Get the challenge frame
        const challengeFrame = await purchasePage.waitForChallengeForm(page);
        // Find and click the Cancel button
        const cancelButton = challengeFrame.locator(THREE_DS_SELECTORS.CHALLENGE_CANCEL_BUTTON).first();
        await expect(cancelButton).toBeVisible();
        await expect(cancelButton).toBeEnabled();
        await cancelButton.click();
    },

    completeChallengeForm: async (page: Page, pin: string) => {
        await purchasePage.inputChallengePin(page, pin);
        await purchasePage.clickChallengePayButton(page);
    },

    waitForChallengeModalToHide: async (page: Page, timeout: number = 15000) => {
        const challengeOverlay = page.locator(THREE_DS_SELECTORS.CHALLENGE_OVERLAY);
        await expect(challengeOverlay).toHaveClass(/hidden/, { timeout });
    },

    waitForResultPage: async (page: Page, timeout: number = 30000) => {
        await purchasePage.waitForChallengeModalToHide(page, timeout);
        const resultSection = page.locator(THREE_DS_SELECTORS.RESULT_SECTION);
        await expect(resultSection).toBeVisible({ timeout });
        const resultTitle = page.locator(THREE_DS_SELECTORS.RESULT_TITLE);
        await expect(resultTitle).toBeVisible({ timeout });
        return resultSection;
    },

    getResultPageType: async (page: Page): Promise<'success' | 'error'> => {
        await purchasePage.waitForResultPage(page);
        
        const successTitle = page.locator(THREE_DS_SELECTORS.RESULT_TITLE_SUCCESS);
        const errorTitle = page.locator(THREE_DS_SELECTORS.RESULT_TITLE_ERROR);
        
        if (await successTitle.count() > 0 && await successTitle.isVisible()) {
            return 'success';
        } else if (await errorTitle.count() > 0 && await errorTitle.isVisible()) {
            return 'error';
        }
        else {
            throw new Error('Unable to determine result page type');
        }
    },

    getTransactionId: async (page: Page) => {
        await purchasePage.waitForResultPage(page);
        const resultDetails = page.locator(THREE_DS_SELECTORS.RESULT_DETAILS);
        
        // Check if result details exist (only present on success page)
        if (await resultDetails.count() > 0 && await resultDetails.isVisible()) {
            const transactionIdRow = resultDetails.locator(THREE_DS_SELECTORS.RESULT_DETAIL_ROW).filter({ hasText: 'Transaction ID' });
            if (await transactionIdRow.count() > 0) {
                const transactionIdValue = transactionIdRow.locator(THREE_DS_SELECTORS.RESULT_DETAIL_VALUE);
                return await transactionIdValue.textContent();
            }
        }
        return null;
    },

    getErrorMessage: async (page: Page) => {
        await purchasePage.waitForResultPage(page);
        const errorMessage = page.locator(THREE_DS_SELECTORS.RESULT_MESSAGE);
        if (await errorMessage.count() > 0 && await errorMessage.isVisible()) {
            return await errorMessage.textContent();
        }
        return null;
    },

    clickChallengePassButton: async (page: Page) => {
        const challengeFrame = page.frameLocator(THREE_DS_SELECTORS.CHALLENGE_IFRAME);
        const passButton = challengeFrame.locator(THREE_DS_SELECTORS.CHALLENGE_PASS_BUTTON);
        await expect(passButton).toBeVisible();
        await expect(passButton).toBeEnabled();
        await passButton.click();
      },
      clickChallengeFailButton: async (page: Page) => {
        const challengeFrame = page.frameLocator(THREE_DS_SELECTORS.CHALLENGE_IFRAME);
        const failButton = challengeFrame.locator(THREE_DS_SELECTORS.CHALLENGE_FAIL_BUTTON);
        await expect(failButton).toBeVisible();
        await expect(failButton).toBeEnabled();
        await failButton.click();
      },
    
}
