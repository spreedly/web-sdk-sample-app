import { expect, test } from '../util/fixtures';
import { MONOREPO_URLS } from '../util/urls';
import { landingPage } from '../pages/landingPage';
import { purchasePage } from '../pages/3dsPage';
import { ppcpPage } from '../pages/ppcpPage';
import { LABELS, TEST_DATA } from '../util/test-constants';





test.describe('PPCP UI tests', () => {
    test('PPCP show credit checkbox and paypal credit button', async ({ page }) => {
     await page.goto(MONOREPO_URLS.BASE);
     await landingPage.clickOnPPCPDirectButton(page);
     await ppcpPage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
     await purchasePage.clickOnProceedToPaymentButton(page);
     const paypalCreditButton = await ppcpPage.getPaymentButtonLocator(page, LABELS.PAYPAL_CREDIT_BUTTON);
     expect(paypalCreditButton).not.toBeVisible();
     await ppcpPage.clickOnCheckbox(page, 'Show Credit');
     await ppcpPage.waitForPaymentButtonsToBeLoaded(page);
     expect(paypalCreditButton).toBeVisible();
    });

    test('Paypal and venmo button border radius', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnPPCPDirectButton(page);
        await ppcpPage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await ppcpPage.waitForPaymentButtonsToBeLoaded(page);
        const borderRadius = '10px';
        await ppcpPage.fillPaymentButtonBorderRadius(page, 'paypal-radius', borderRadius);
        await page.keyboard.press('Enter');
        const paypalbutton = await ppcpPage.getPaymentButtonLocator(page, LABELS.PAYPAL_BUTTON);
        const paypalBorderRadius = await ppcpPage.getPaymentButtonBorderRadius(page, paypalbutton);
        expect(paypalBorderRadius).toBe(borderRadius);
        await ppcpPage.fillPaymentButtonBorderRadius(page, 'venmo-radius', borderRadius);
        await page.keyboard.press('Enter');
        const venmobutton = await ppcpPage.getPaymentButtonLocator(page, LABELS.VENMO_BUTTON);
        const venmoBorderRadius = await ppcpPage.getPaymentButtonBorderRadius(page, venmobutton);
        expect(venmoBorderRadius).toBe(borderRadius);
    });

    test('Verify payment options when country is changed to GB and DE', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnPPCPDirectButton(page);
        await ppcpPage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await ppcpPage.waitForPaymentButtonsToBeLoaded(page);
        const paypalButton = await ppcpPage.getPaymentButtonLocator(page, LABELS.PAYPAL_BUTTON);
        const venmoButton = await ppcpPage.getPaymentButtonLocator(page, LABELS.VENMO_BUTTON);
        const paypalPayLaterButton = await ppcpPage.getPaymentButtonLocator(page, LABELS.PAY_LATER_BUTTON);
        expect(paypalButton).toBeVisible();
        expect(venmoButton).toBeVisible();
        expect(paypalPayLaterButton).toBeVisible();
        await ppcpPage.clickOnCheckbox(page, 'GB');
        await ppcpPage.waitForPaymentButtonsToBeLoaded(page);
        expect(paypalButton).toBeVisible();
        expect(venmoButton).not.toBeVisible();
        expect(paypalPayLaterButton).not.toBeVisible();
        await ppcpPage.clickOnCheckbox(page, 'DE');
        await ppcpPage.waitForPaymentButtonsToBeLoaded(page);
        expect(paypalButton).toBeVisible();
        expect(venmoButton).not.toBeVisible();
        expect(paypalPayLaterButton).not.toBeVisible();
    });

    test('Verify button style color option', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnPPCPDirectButton(page);
        await ppcpPage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await ppcpPage.waitForPaymentButtonsToBeLoaded(page);
        await ppcpPage.clickOnCheckbox(page, 'Gold');
        const paypalButtonBackgroundColorGold = await ppcpPage.getPaymentButtonBackgroundColor(page, LABELS.PAYPAL_BUTTON);
        const paypalPayLaterButtonBackgroundColorGold = await ppcpPage.getPaymentButtonBackgroundColor(page, LABELS.PAY_LATER_BUTTON);
        const venmoButtonBackgroundColorGold = await ppcpPage.getPaymentButtonBackgroundColor(page, LABELS.VENMO_BUTTON);
        expect(paypalButtonBackgroundColorGold).toBe(TEST_DATA.PAYPAL_GOLD_BUTTON_COLOR);
        expect(paypalPayLaterButtonBackgroundColorGold).toBe(TEST_DATA.PAYPAL_LATER_GOLD_BUTTON_COLOR);
        expect(venmoButtonBackgroundColorGold).toBe(TEST_DATA.VENMO_BLUE_BUTTON_COLOR);
        await ppcpPage.clickOnCheckbox(page, 'Blue');
        
        const paypalButtonBackgroundColorBlue = await ppcpPage.getPaymentButtonBackgroundColor(page, LABELS.PAYPAL_BUTTON);
        const paypalPayLaterButtonBackgroundColorBlue = await ppcpPage.getPaymentButtonBackgroundColor(page, LABELS.PAY_LATER_BUTTON);
        const venmoButtonBackgroundColorBlue = await ppcpPage.getPaymentButtonBackgroundColor(page, LABELS.VENMO_BUTTON);
        expect(paypalButtonBackgroundColorBlue).toBe(TEST_DATA.PAYPAL_BLUE_BUTTON_COLOR);
        expect(paypalPayLaterButtonBackgroundColorBlue).toBe(TEST_DATA.PAYPAL_LATER_BLUE_BUTTON_COLOR);
        expect(venmoButtonBackgroundColorBlue).toBe(TEST_DATA.VENMO_BLUE_BUTTON_COLOR);
        await ppcpPage.clickOnCheckbox(page, 'White');
        
        const paypalButtonBackgroundColorWhite = await ppcpPage.getPaymentButtonBackgroundColor(page, LABELS.PAYPAL_BUTTON);
        const paypalPayLaterButtonBackgroundColorWhite = await ppcpPage.getPaymentButtonBackgroundColor(page, LABELS.PAY_LATER_BUTTON);
        const venmoButtonBackgroundColorWhite = await ppcpPage.getPaymentButtonBackgroundColor(page, LABELS.VENMO_BUTTON);
        expect(paypalButtonBackgroundColorWhite).toBe(TEST_DATA.PAYPAL_WHITE_BUTTON_COLOR);
        expect(paypalPayLaterButtonBackgroundColorWhite).toBe(TEST_DATA.PAYPAL_LATER_WHITE_BUTTON_COLOR);
        expect(venmoButtonBackgroundColorWhite).toBe(TEST_DATA.VENMO_BLUE_BUTTON_COLOR);
        await ppcpPage.clickOnCheckbox(page, 'Black');
        
        const paypalButtonBackgroundColorBlack = await ppcpPage.getPaymentButtonBackgroundColor(page, LABELS.PAYPAL_BUTTON);
        const paypalPayLaterButtonBackgroundColorBlack = await ppcpPage.getPaymentButtonBackgroundColor(page, LABELS.PAY_LATER_BUTTON);
        const venmoButtonBackgroundColorBlack = await ppcpPage.getPaymentButtonBackgroundColor(page, LABELS.VENMO_BUTTON);
        expect(paypalButtonBackgroundColorBlack).toBe(TEST_DATA.PAYPAL_BLACK_BUTTON_COLOR);
        expect(paypalPayLaterButtonBackgroundColorBlack).toBe(TEST_DATA.PAYPAL_LATER_BLACK_BUTTON_COLOR);
        expect(venmoButtonBackgroundColorBlack).toBe(TEST_DATA.VENMO_BLACK_BUTTON_COLOR);
    });

});

