import { landingPage } from '../pages/landingPage';
import { tokenizePage } from '../pages/tokenizePage';
import { test, expect } from '../util/fixtures';
import { MONOREPO_URLS } from '../util/urls';
import { ERROR_MESSAGES, ERROR_SELECTORS, getValidYearString, SELECTORS } from '../util/test-constants';
import {
  TEST_DATA,
  waitForAuthParams,
} from '../util/test-constants';
import { helperFunctions } from '../util/utils';

test.describe('Card Number and CVV Validation', () => {
  test('shows validation for invalid card in express checkout', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnExpressCheckoutButton(page);
    await landingPage.clickOnTokenizeButton(page);
    await waitForAuthParams(page);
    await tokenizePage.clickOnOpenPaymentFormButtonExpressCheckout(page);
    await helperFunctions.fillExpressCheckoutForm(page, TEST_DATA.INVALID_CARD_NUMBER, {
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      cvv: TEST_DATA.CVV,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await helperFunctions.verifyFormFieldsExpressCheckout(page, TEST_DATA.INVALID_CARD_NUMBER, {
      cvv: TEST_DATA.CVV,
      firstName: TEST_DATA.FIRST_NAME,
      lastName: TEST_DATA.LAST_NAME,
      expiryMonth: TEST_DATA.EXPIRY_MONTH,
      expiryYear: getValidYearString(),
    });
    await expect(await helperFunctions.getExpressCheckoutCardNumberField(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.frameLocator(SELECTORS.EXPRESS_IFRAME).locator(`[aria-label="${ERROR_MESSAGES.INVALID_CARD_NUMBER}"]`).first()).toBeVisible()
  });

  test('shows validation for invalid card in hosted fields', async ({ page }) => {
      

    })

  test('shows validation for too-short card number in express checkout', async ({ page }) => {
    
  });

  test('Shows validation for too short card number in hosted fields', async ({ page }) => {
    
  });

  test('CVV validation for express checkout', async ({ page }) => {
   
  });

  test('CVV validation for hosted fields', async ({ page }) => {
   
  });

  test('CVV validation for express checkout with AMEX', async ({ page }) => {
    
  });


  test('CVV validation for hosted fields with AMEX', async ({ page }) => {
   
   }); 
});
