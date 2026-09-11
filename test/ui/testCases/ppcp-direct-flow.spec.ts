import { test } from '../util/fixtures';
import { MONOREPO_URLS } from '../util/urls';
import { landingPage } from '../pages/landingPage';
import { tokenizePage } from '../pages/tokenizePage';
import { helperFunctions } from '../util/utils';
import { TEST_DATA, waitForAuthParams } from '../util/test-constants';
import { getValidYearString } from '../util/test-constants';
import { expect } from '../util/fixtures';
import { SELECTORS } from '../util/test-constants';
import { ERROR_MESSAGES } from '../util/test-constants';
import { purchasePage } from '../pages/3dsPage';
import { ppcpPage } from '../pages/ppcpPage';
import { paypalUserId, paypalUserPassword, venmoUserId, venmoUserPassword} from '../pages/ppcpPage';





test.describe('PPCP Payment flows', () => {
    test('PPCP paypal payment flow success', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnPPCPDirectButton(page);
        await ppcpPage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await ppcpPage.clickOnCheckbox(page, 'popup');
        const paypalPopup = await helperFunctions.waitForPaypalPopupToBeVisible(page, ppcpPage.clickOnPayPalButton);
        await helperFunctions.loginToPaypal(paypalPopup, paypalUserId, paypalUserPassword);
        await ppcpPage.clickOnPayPalCompletePurchaseButton(paypalPopup, SELECTORS.PAY_BUTTON_PAYPAL);
        // const orderStatus = await ppcpPage.verifyOrderStatus(page);
        // expect(orderStatus).toContain(TEST_DATA.ORDER_STATUS_SUCCESS);
    });

    test('PPCP payment flow failure', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnPPCPDirectButton(page);
        await ppcpPage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await ppcpPage.clickOnCheckbox(page, 'popup');
        const paypalPopup = await helperFunctions.waitForPaypalPopupToBeVisible(page, ppcpPage.clickOnPayPalButton);
        await helperFunctions.loginToPaypal(paypalPopup, paypalUserId, paypalUserPassword);
        await paypalPopup.close();
        const orderStatus = await ppcpPage.verifyOrderStatus(page);
        expect(orderStatus).toContain(TEST_DATA.ORDER_STATUS_CANCELLED);
    });

    test('PPCP paypal paylater payment flow success', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnPPCPDirectButton(page);
        await ppcpPage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await ppcpPage.clickOnCheckbox(page, 'popup');
        const paypalPopup = await helperFunctions.waitForPaypalPopupToBeVisible(page, ppcpPage.clickOnPayLaterButton);
        await helperFunctions.loginToPaypal(paypalPopup, paypalUserId, paypalUserPassword);
        const fundingOption = paypalPopup.locator('#hermione-container > div:nth-child(1) > main > div.PaymentOptions_container_1ELkE > section.PayWith_container_1uz6G > div:nth-child(4) > div:nth-child(2) > div > div.FundingInstrument_item_3lQ2z > div > div > label > span');
        await expect(fundingOption).toBeVisible();
        await fundingOption.click();
        await ppcpPage.clickOnPayPalCompletePurchaseButton(paypalPopup, SELECTORS.PAY_BUTTON_PAYPAL);
        // const orderStatus = await ppcpPage.verifyOrderStatus(page);
        // expect(orderStatus).toContain(TEST_DATA.ORDER_STATUS_SUCCESS);
    });

    test('PPCP paypal paylater payment flow failure', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnPPCPDirectButton(page);
        await ppcpPage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await ppcpPage.clickOnCheckbox(page, 'popup');
        const paypalPopup = await helperFunctions.waitForPaypalPopupToBeVisible(page, ppcpPage.clickOnPayLaterButton);
        await helperFunctions.loginToPaypal(paypalPopup, paypalUserId, paypalUserPassword);
        await paypalPopup.close();
        const orderStatus = await ppcpPage.verifyOrderStatus(page);
        expect(orderStatus).toContain(TEST_DATA.ORDER_STATUS_CANCELLED_PAYLATER);
    });

    test('PPCP venmo payment flow success', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnPPCPDirectButton(page);
        await ppcpPage.clickOnProductIncreaseButton(page, TEST_DATA.PRODUCT_ID_WIRELESS_HEADPHONE);
        await purchasePage.clickOnProceedToPaymentButton(page);
        await ppcpPage.clickOnCheckbox(page, 'popup');
        await ppcpPage.clickOnVenmoButton(page);
    });


});

