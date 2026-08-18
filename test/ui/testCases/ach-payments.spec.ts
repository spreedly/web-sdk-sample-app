import { test, expect } from '../util/fixtures';
import { landingPage } from '../pages/landingPage';
import { helperFunctions } from '../util/utils';
import { MONOREPO_URLS } from '../util/urls';
import {
  TEST_DATA,
  waitForAuthParams,
} from '../util/test-constants';
import { achPage } from '../pages/achPage';
import { ERROR_MESSAGES } from '../util/test-constants';

test.describe('ACH Payments', () => {
  test('should process ACH payment with checking account type', async ({
    page,
  }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnACHPaymentsButton(page);
    await waitForAuthParams(page);
    await helperFunctions.fillACHFieldsForm(page, {
      accountNumber: TEST_DATA.ACH_ACCOUNT_NUMBER,
      routingNumber: TEST_DATA.ACH_ROUTING_NUMBER,
      firstName: TEST_DATA.ACH_FIRST_NAME,
      lastName: TEST_DATA.ACH_LAST_NAME,
      bankName: TEST_DATA.ACH_BANK_NAME,
    });

    let apiResponse: any = null;
    let responseStatus: number | null = null;
    let apiRequestPayload: any = null;

    page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('/v1/ach-purchase')) {
        try {
          apiRequestPayload = request.postDataJSON();
        } catch (error) {
          console.log('Request payload is not JSON or empty');
        }
      }
    });
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/v1/ach-purchase')) {
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

    await helperFunctions.clickOnHostedFieldsSubmitButton(page);
    await helperFunctions.waitForResultCardToBeVisible(page);

    expect(apiResponse).toBeDefined();
    expect(apiResponse).not.toBeNull();
    expect(responseStatus).toBe(200);
    expect(apiRequestPayload).toBeDefined();
    expect(apiRequestPayload.amount).toBe(1000);
    expect(apiRequestPayload.currency_code).toBe('USD');
    expect(apiRequestPayload.payment_method_token).toBeTruthy();

    expect(apiResponse.success).toBe(true);
    expect(apiResponse.transaction).toBeDefined();
    expect(apiResponse.transaction.succeeded).toBe(true);
    expect(apiResponse.transaction.state).toBe('succeeded');
    expect(apiResponse.transaction.transaction_type).toBe('Purchase');
    expect(apiResponse.transaction.amount).toBe(1000);
    expect(apiResponse.transaction.currency_code).toBe('USD');

    const paymentMethod = apiResponse.transaction.payment_method;
    expect(paymentMethod).toBeDefined();

    expect(paymentMethod.account_type).toBe('checking');
    expect(paymentMethod.account_holder_type).toBe('personal');
    expect(paymentMethod.first_name).toBe(TEST_DATA.ACH_FIRST_NAME);
    expect(paymentMethod.last_name).toBe(TEST_DATA.ACH_LAST_NAME);

    const expectedAccountLast4 = TEST_DATA.ACH_ACCOUNT_NUMBER.slice(-4);
    const expectedRoutingFirst3 = TEST_DATA.ACH_ROUTING_NUMBER.slice(0, 3);
    expect(paymentMethod.account_number_display_digits).toBe(expectedAccountLast4);
    expect(paymentMethod.routing_number_display_digits).toBe(expectedRoutingFirst3);
    expect(paymentMethod.account_number).toBe(`*${expectedAccountLast4}`);
    expect(paymentMethod.routing_number).toBe(`${expectedRoutingFirst3}*`);
  });

  test('should process ACH payment with invalid routing number', async ({
    page,
  }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnACHPaymentsButton(page);
    await waitForAuthParams(page);
    await helperFunctions.fillACHFieldsForm(page, {
      accountNumber: TEST_DATA.ACH_ACCOUNT_NUMBER,
      routingNumber: TEST_DATA.ACH_ROUTING_NUMBER_INVALID,
      firstName: TEST_DATA.ACH_FIRST_NAME,
      lastName: TEST_DATA.ACH_LAST_NAME,
      bankName: TEST_DATA.ACH_BANK_NAME,
    });
    await helperFunctions.clickOnHostedFieldsSubmitButton(page);
    const errorMessage = await achPage.getErrorMessage(page);
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveText(ERROR_MESSAGES.ACH_INVALID_ROUTING_NUMBER);
  });

  test('should process ACH payment with invalid account number', async ({
    page,
  }) => {
    await page.goto(MONOREPO_URLS.BASE);
    await landingPage.clickOnACHPaymentsButton(page);
    await waitForAuthParams(page);
    await helperFunctions.fillACHFieldsForm(page, {
      accountNumber: TEST_DATA.ACH_ACCOUNT_NUMBER_INVALID,
      routingNumber: TEST_DATA.ACH_ROUTING_NUMBER,
      firstName: TEST_DATA.ACH_FIRST_NAME,
      lastName: TEST_DATA.ACH_LAST_NAME,
      bankName: TEST_DATA.ACH_BANK_NAME,
    });
    await helperFunctions.clickOnHostedFieldsSubmitButton(page);
    const errorMessage = await achPage.getErrorMessage(page);
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveText(ERROR_MESSAGES.ACH_INVALID_ACCOUNT_NUMBER);
  });

});

