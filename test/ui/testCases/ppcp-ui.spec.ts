import { expect, test } from '../util/fixtures';
import { MONOREPO_URLS } from '../util/urls';
import { landingPage } from '../pages/landingPage';
import { purchasePage } from '../pages/3dsPage';
import { ppcpPage } from '../pages/ppcpPage';
import { LABELS } from '../util/test-constants';





test.describe('PPCP UI tests', () => {
    test('PPCP show credit checkbox and paypal credit button', async ({ page }) => {
     await page.goto(MONOREPO_URLS.BASE);
     await landingPage.clickOnPPCPDirectButton(page);
     //await waitForAuthParams(page);
     const prod1 = page.locator(`.product-card[data-id="prod_1"] .quantity-btn`);
     await prod1.getByText(`+`).click();
     await purchasePage.clickOnProceedToPaymentButton(page);
     const paypalCreditButton = page.getByRole('button', {
        name: LABELS.PAYPAL_CREDIT_BUTTON
      });
     expect(paypalCreditButton).not.toBeVisible();
     await ppcpPage.clickOnCheckbox(page, 'Show credit');
     await page.getByText('Loading payment buttons...').waitFor({ state: 'hidden', timeout: 5000 });
     expect(paypalCreditButton).toBeVisible();
    });

    test.only('Paypal and venmo button border radius', async ({ page }) => {
        await page.goto(MONOREPO_URLS.BASE);
        await landingPage.clickOnPPCPDirectButton(page);
        const prod1 = page.locator(`.product-card[data-id="prod_1"] .quantity-btn`);
        await prod1.getByText(`+`).click();
        await purchasePage.clickOnProceedToPaymentButton(page);
        await page.getByText('Loading payment buttons...').waitFor({ state: 'hidden', timeout: 5000 });
        const paypalrad = page.locator('input[name="paypal-radius"]')
        await paypalrad.fill('10px');
        await page.keyboard.press('Enter');
        const paypalbutton = page.getByRole('button', {
            name: LABELS.PAYPAL_BUTTON
          });
        const borderRadius = await paypalbutton.evaluate((el) =>
            getComputedStyle(el).borderRadius
          );
        await console.log(borderRadius);
        
          expect(borderRadius).toBe('10px');
    });


});