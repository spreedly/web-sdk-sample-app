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
     //await waitForAuthParams(page);
     const prod1 = page.locator(`.product-card[data-id="prod_1"] .quantity-btn`);
     await prod1.getByText(`+`).click();
     console.log('paypalUserId', paypalUserId);
     console.log('paypalUserPassword', paypalUserPassword);
     await purchasePage.clickOnProceedToPaymentButton(page);
     await page.locator('label.cfg-opt', {hasText: 'popup' }).locator('input').first().click();
     //await ppcpPage.clickOnPayPalButton(page);
     const paypalPopup = await helperFunctions.waitForPaypalPopupToBeVisible(page);
     await helperFunctions.loginToPaypal(paypalPopup, paypalUserId, paypalUserPassword);
    });


});