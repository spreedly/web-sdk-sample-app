import { test, expect } from '../util/fixtures';
import { landingPage } from '../pages/landingPage';
import { SELECTORS } from '../util/test-constants';
import { MONOREPO_URLS } from '../util/urls';
import { authorizationPage, paymentPage, redirectResultPage } from '../pages/offsitePaymentsPage';
import { TEST_DATA, waitForAuthParams } from '../util/test-constants';

test.describe('offsite payments flow', () => {

  // test('offsite payments flow for hosted fields PayPal success case', async ({ page }) => {
  //   await page.goto(MONOREPO_URLS.BASE);
  //   await landingPage.clickOnExpressCheckoutButton(page);
  //   await landingPage.clickOnOffsitePaymentsButton(page);
  //   await waitForAuthParams(page);
  //   await page.locator(SELECTORS.PAYPAL_BUTTON).first().click();
  //   await page.locator(SELECTORS.HOSTED_SUBMIT_BUTTON).click();
  //   await expect(page.getByPlaceholder('Email or mobile number')).toBeVisible({ timeout: 10000 });
  //   await page.getByPlaceholder('Email or mobile number').fill('.example.com');
  //   await page.locator('#btnNext').click();
  //   await page.getByPlaceholder('Password').fill('');
  //   const paypalPasswordSubmit = page
  //     .locator('#btnLogin')
  //     .or(page.locator('button[type="submit"][value="submitPassword"]'));
  //   await expect(paypalPasswordSubmit).toBeEnabled();
  //   await paypalPasswordSubmit.click();
  //   await expect(page.getByTestId('submit-button-initial')).toBeVisible();
  //   await page.getByTestId('submit-button-initial').click();
  //   const redirectResultPageType = await redirectResultPage.getRedirectResultPageType(page);
  //   expect(redirectResultPageType).toBe('success');
  // })

  test('offsite payments flow for hosted fields Stripe APM SEPA Debit', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnOffsitePaymentsButton(page);
    await waitForAuthParams(page);
    await paymentPage.selectOffsitePaymentMethod(page, 'Stripe APM');
    await paymentPage.clickSubmitButton(page);
    await paymentPage.selectStripeMethod(page, 'sepa_debit');
    await paymentPage.fillPaymentForm(page, TEST_DATA.STRIPE_APM_NAME, TEST_DATA.STRIPE_APM_IBAN, TEST_DATA.STRIPE_APM_EMAIL, TEST_DATA.STRIPE_APM_SEPA_COUNTRY, TEST_DATA.SHIPPING_ADDRESS, TEST_DATA.STRIPE_APM_CITY, TEST_DATA.STRIPE_APM_SEPA_COUNTRY_STATE, TEST_DATA.STRIPE_APM_ZIP, );
    await paymentPage.clickSubmitButton(page);
    await redirectResultPage.waitForRedirectResultPage(page);
    const redirectResultPageType = await redirectResultPage.getRedirectResultPageType(page);
    //expect(redirectResultPageType).toBe('success');
    expect(['success', 'processing']).toContain(redirectResultPageType);
    await redirectResultPage.verifyTransactionDetails(page, 'Stripe APM', 'stripe_payment_intents', ['succeeded', 'processing']);
  })

  // test('offsite payments flow for hosted fields Stripe APM SEPA Debit deny case', async ({ page }) => {
  //   await page.goto(MONOREPO_URLS.BASE);
  //   await landingPage.clickOnOffsitePaymentsButton(page);
  //   await waitForAuthParams(page);
  //   await paymentPage.selectOffsitePaymentMethod(page, 'Stripe APM');
  //   await paymentPage.clickSubmitButton(page);
  //   await paymentPage.selectStripeMethod(page, 'sepa_debit');
  //   await paymentPage.fillPaymentForm(page, TEST_DATA.STRIPE_APM_NAME, TEST_DATA.STRIPE_APM_IBAN, TEST_DATA.STRIPE_APM_EMAIL, TEST_DATA.STRIPE_APM_SEPA_COUNTRY, TEST_DATA.SHIPPING_ADDRESS, TEST_DATA.STRIPE_APM_CITY, TEST_DATA.STRIPE_APM_SEPA_COUNTRY_STATE, TEST_DATA.STRIPE_APM_ZIP, );
  //   await paymentPage.clickSubmitButton(page);
  //   await expect(page.locator(SELECTORS.DENY_BUTTON)).toBeVisible();
  //   await authorizationPage.clickOnDenyButton(page);
  //   await redirectResultPage.waitForRedirectResultPage(page);
  //   const redirectResultPageType = await redirectResultPage.getRedirectResultPageType(page);
  //   expect(redirectResultPageType).toBe('failed');
  //   await redirectResultPage.verifyTransactionDetails(page, 'Stripe APM', 'stripe_payment_intents', 'failed');
  // })

  test('offsite payments flow for hosted fields Stripe APM iDEAL Wero authorize case', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnOffsitePaymentsButton(page);
    await waitForAuthParams(page);
    await paymentPage.selectOffsitePaymentMethod(page, 'Stripe APM');
    await paymentPage.clickSubmitButton(page);
    await paymentPage.selectStripeMethod(page, 'ideal');
    await paymentPage.fillPaymentForm(page, TEST_DATA.STRIPE_APM_NAME)
    await paymentPage.clickSubmitButton(page);
    await expect(page.locator(SELECTORS.AUTHORIZE_BUTTON)).toBeVisible();
    await authorizationPage.clickOnAuthorizeButton(page);
    const redirectResultPageType = await redirectResultPage.getRedirectResultPageType(page);
    expect(redirectResultPageType).toBe('success');
    await redirectResultPage.verifyTransactionDetails(page, 'Stripe APM', 'stripe_payment_intents', 'succeeded');
  })

  test('offsite payments flow for hosted fields Stripe APM iDEAL Wero deny case', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnOffsitePaymentsButton(page);
    await waitForAuthParams(page);
    await paymentPage.selectOffsitePaymentMethod(page, 'Stripe APM');
    await paymentPage.clickSubmitButton(page);
    await paymentPage.selectStripeMethod(page, 'ideal');
    await paymentPage.fillPaymentForm(page, TEST_DATA.STRIPE_APM_NAME)
    await paymentPage.clickSubmitButton(page);
    await expect(page.locator(SELECTORS.DENY_BUTTON)).toBeVisible();
    await authorizationPage.clickOnDenyButton(page);
    const redirectResultPageType = await redirectResultPage.getRedirectResultPageType(page);
    expect(['failed', 'pending']).toContain(redirectResultPageType);
    await redirectResultPage.verifyTransactionDetails(page, 'Stripe APM', 'stripe_payment_intents', ['failed', 'pending']);
  })

  test('offsite payments flow for hosted fields Stripe APM Bancontact authorize case', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnOffsitePaymentsButton(page);
    await waitForAuthParams(page);
    await paymentPage.selectOffsitePaymentMethod(page, 'Stripe APM');
    await paymentPage.clickSubmitButton(page);
    await paymentPage.selectStripeMethod(page, 'bancontact');
    await paymentPage.fillPaymentForm(page, TEST_DATA.STRIPE_APM_NAME)
    await paymentPage.clickSubmitButton(page);
    await expect(page.locator(SELECTORS.AUTHORIZE_BUTTON)).toBeVisible();
    await authorizationPage.clickOnAuthorizeButton(page);
    const redirectResultPageType = await redirectResultPage.getRedirectResultPageType(page);
    await expect(redirectResultPageType).toBe('success');
    await redirectResultPage.verifyTransactionDetails(page, 'Stripe APM', 'stripe_payment_intents', 'succeeded');
  })

  test('offsite payments flow for hosted fields Stripe APM Bancontact deny case', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnOffsitePaymentsButton(page);
    await waitForAuthParams(page);
    await paymentPage.selectOffsitePaymentMethod(page, 'Stripe APM');
    await paymentPage.clickSubmitButton(page);
    await paymentPage.selectStripeMethod(page, 'bancontact');
    await paymentPage.fillPaymentForm(page, TEST_DATA.STRIPE_APM_NAME)
    await paymentPage.clickSubmitButton(page);
    await expect(page.locator(SELECTORS.DENY_BUTTON)).toBeVisible();
    await authorizationPage.clickOnDenyButton(page);
    const redirectResultPageType = await redirectResultPage.getRedirectResultPageType(page);
    expect(['failed', 'pending']).toContain(redirectResultPageType);
    await redirectResultPage.verifyTransactionDetails(page, 'Stripe APM', 'stripe_payment_intents', ['failed', 'pending']);
  })

  test('offsite payments flow for hosted fields Stripe APM EPS authorize case', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnOffsitePaymentsButton(page);
    await waitForAuthParams(page);
    await paymentPage.selectOffsitePaymentMethod(page, 'Stripe APM');
    await paymentPage.clickSubmitButton(page);
    await paymentPage.selectAdditionalPaymentMethod(page, 'EPS');
    await paymentPage.fillPaymentForm(page, TEST_DATA.STRIPE_APM_NAME,undefined,undefined,undefined,undefined,undefined,   
      undefined,undefined,TEST_DATA.STRIPE_APM_BANK_NAME_EPS);
    await paymentPage.clickSubmitButton(page);
    await expect(page.locator(SELECTORS.AUTHORIZE_BUTTON)).toBeVisible();
    await authorizationPage.clickOnAuthorizeButton(page);
    const redirectResultPageType = await redirectResultPage.getRedirectResultPageType(page);
    await expect(redirectResultPageType).toBe('success');
    await redirectResultPage.verifyTransactionDetails(page, 'Stripe APM', 'stripe_payment_intents', 'succeeded');
  })

  test('offsite payments flow for hosted fields Stripe APM EPS deny case', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnOffsitePaymentsButton(page);
    await waitForAuthParams(page);
    await paymentPage.selectOffsitePaymentMethod(page, 'Stripe APM');
    await paymentPage.clickSubmitButton(page);
    await paymentPage.selectAdditionalPaymentMethod(page, 'EPS');
    await paymentPage.fillPaymentForm(page, TEST_DATA.STRIPE_APM_NAME,undefined,undefined,undefined,undefined,undefined,   
      undefined,undefined,TEST_DATA.STRIPE_APM_BANK_NAME_EPS);
    await paymentPage.clickSubmitButton(page);
    await expect(page.locator(SELECTORS.DENY_BUTTON)).toBeVisible();
    await authorizationPage.clickOnDenyButton(page);
    const redirectResultPageType = await redirectResultPage.getRedirectResultPageType(page);
    expect(['failed', 'pending']).toContain(redirectResultPageType);
    await redirectResultPage.verifyTransactionDetails(page, 'Stripe APM', 'stripe_payment_intents', ['failed', 'pending']);
  })

  test('offsite payments flow for hosted fields Stripe APM Przelewy24 authorize case', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnOffsitePaymentsButton(page);
    await waitForAuthParams(page);
    await paymentPage.selectOffsitePaymentMethod(page, 'Stripe APM');
    await paymentPage.clickSubmitButton(page);
    await paymentPage.selectStripeMethod(page, 'p24');
    await paymentPage.fillPaymentForm(page, TEST_DATA.STRIPE_APM_NAME,undefined,TEST_DATA.STRIPE_APM_EMAIL,undefined,undefined,undefined,   
      undefined,undefined,TEST_DATA.STRIPE_APM_BANK_NAME_PRZELEWY24);
    await page.waitForTimeout(5000);
    await paymentPage.clickSubmitButton(page);
    await page.waitForTimeout(10000);
    await expect(page.locator(SELECTORS.AUTHORIZE_BUTTON)).toBeVisible();
    await authorizationPage.clickOnAuthorizeButton(page);
    const redirectResultPageType = await redirectResultPage.getRedirectResultPageType(page);
    await expect(redirectResultPageType).toBe('success');
    await redirectResultPage.verifyTransactionDetails(page, 'Stripe APM', 'stripe_payment_intents', 'succeeded');
  })

  test('offsite payments flow for hosted fields Stripe APM Przelewy24 deny case', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnOffsitePaymentsButton(page);
    await waitForAuthParams(page);
    await paymentPage.selectOffsitePaymentMethod(page, 'Stripe APM');
    await paymentPage.clickSubmitButton(page);
    await paymentPage.selectStripeMethod(page, 'p24');
    await paymentPage.fillPaymentForm(page, TEST_DATA.STRIPE_APM_NAME,undefined,TEST_DATA.STRIPE_APM_EMAIL,undefined,undefined,undefined,   
      undefined,undefined,TEST_DATA.STRIPE_APM_BANK_NAME_PRZELEWY24);
    await paymentPage.clickSubmitButton(page);
    await expect(page.locator(SELECTORS.DENY_BUTTON)).toBeVisible();
    await authorizationPage.clickOnDenyButton(page);
    const redirectResultPageType = await redirectResultPage.getRedirectResultPageType(page);
    expect(['failed', 'pending']).toContain(redirectResultPageType);
    await redirectResultPage.verifyTransactionDetails(page, 'Stripe APM', 'stripe_payment_intents', ['failed', 'pending']);
  })

  test('offsite payments flow for hosted fields ebanx oxxo', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnOffsitePaymentsButton(page);
    await waitForAuthParams(page);
    await paymentPage.selectOffsitePaymentMethod(page, 'EBANX');
    await paymentPage.clickSubmitButton(page);
    await paymentPage.selectEbanxPaymentMethod(page, 'oxxo');
    await paymentPage.clickSubmitButton(page);
    await expect(page.locator(SELECTORS.EBANX_OXXO_REDIRECT_PAGE_IMAGE)).toBeVisible();
    await expect(page.locator('h1:has-text("BOLETA EBANX")')).toBeVisible();
  })

  test('offsite payments flow for hosted fields ebanx boleto bancario', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnOffsitePaymentsButton(page);
    await waitForAuthParams(page);
    await paymentPage.selectOffsitePaymentMethod(page, 'EBANX');
    await paymentPage.clickSubmitButton(page);
    await paymentPage.selectEbanxPaymentMethod(page, 'boleto_bancario');
    await paymentPage.clickSubmitButton(page);
    const redirectPageImage = await page.locator(SELECTORS.EBANX_BOLETO_BANCARIO_REDIRECT_PAGE_IMAGE).last();
    await expect(redirectPageImage).toBeVisible();
    const redirectPageTitle = await page.locator('h3:has-text("Banco Itaú S.A. | 341-7"),h3:has-text("Itaú Bank SA | 341-7")').last();
    await expect(redirectPageTitle).toBeVisible();
  })

  test('offsite payments flow for hosted fields ebanx pix', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnOffsitePaymentsButton(page);
    await waitForAuthParams(page);
    await paymentPage.selectOffsitePaymentMethod(page, 'EBANX');
    await paymentPage.clickSubmitButton(page);
    await paymentPage.selectEbanxPaymentMethod(page, 'pix');
    await paymentPage.clickSubmitButton(page);
    await expect(page.locator(SELECTORS.EBANX_PIX_REDIRECT_PAGE_IMAGE)).toBeVisible();
    await expect(page.locator('h2:has-text("Código Pix gerado!"),h2:has-text("Pix code generated!")')).toBeVisible();
  })

  test('offsite payments flow for hosted fields ebanx nupay authorize case yes case', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnOffsitePaymentsButton(page);
    await waitForAuthParams(page);
    await paymentPage.selectOffsitePaymentMethod(page, 'EBANX');
    await paymentPage.clickSubmitButton(page);
    await paymentPage.selectEbanxPaymentMethod(page, 'nupay');
    await paymentPage.clickSubmitButton(page);
    await authorizationPage.clickOnNupayAuthorizeYesButton(page);
    const redirectResultPageType = await redirectResultPage.getRedirectResultPageType(page);
    await expect(redirectResultPageType).toBe('success');
    await redirectResultPage.verifyTransactionDetails(page, 'NuPay (EBANX)', 'ebanx', 'succeeded');
  })

  test('offsite payments flow for hosted fields ebanx nupay authorize case no case', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnOffsitePaymentsButton(page);
    await waitForAuthParams(page);
    await paymentPage.selectOffsitePaymentMethod(page, 'EBANX');
    await paymentPage.clickSubmitButton(page);
    await paymentPage.selectEbanxPaymentMethod(page, 'nupay');
    await paymentPage.clickSubmitButton(page);
    await authorizationPage.clickOnNupayAuthorizeNoButton(page);
    const redirectResultPageType = await redirectResultPage.getRedirectResultPageType(page);
    expect(['failed', 'pending']).toContain(redirectResultPageType);
    await redirectResultPage.verifyTransactionDetails(page, 'NuPay (EBANX)', 'ebanx', 'gateway_processing_failed');
  })

  test('offsite payments flow for hosted fields ebanx nupay authorize case pending case', async ({ page }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnOffsitePaymentsButton(page);
    await waitForAuthParams(page);
    await paymentPage.selectOffsitePaymentMethod(page, 'EBANX');
    await paymentPage.clickSubmitButton(page);
    await paymentPage.selectEbanxPaymentMethod(page, 'nupay');
    await paymentPage.clickSubmitButton(page);
    await authorizationPage.clickOnNupayAuthorizePendingButton(page);
    const redirectResultPageType = await redirectResultPage.getRedirectResultPageType(page);
    await expect(redirectResultPageType).toBe('pending');
    await redirectResultPage.verifyTransactionDetails(page, 'NuPay (EBANX)', 'ebanx', 'gateway_processing_pending');
  })
 
})