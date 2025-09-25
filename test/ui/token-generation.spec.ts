import { test, expect } from './fixtures';
import { Page } from '@playwright/test';
import {
  URLS,
  SELECTORS,
  PLACEHOLDERS,
  LABELS,
  TEST_DATA,
  HEADINGS,
  getValidYearString,
  getExpiredYearString,
  waitForAuthParams,
} from './test-constants';

async function fillExpressCheckoutForm(page: Page, FIRST_NAME : string, LAST_NAME:string, CARD_NUMBER:string, CVV:string, EXPIRY_MONTH:string, YEAR:string) {
  const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
  await expect(page.locator(SELECTORS.EXPRESS_IFRAME)).toBeVisible();
  const firstNameField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_FIRST_NAME);
  const lastNameField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_LAST_NAME);
  const cardNumberField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER);
  const cvvField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_CVV}"]`);
  const monthField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_MONTH}"]`);
  const yearField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_YEAR}"]`);
  await firstNameField.fill(FIRST_NAME);
  await lastNameField.fill(LAST_NAME);
  await cardNumberField.fill(CARD_NUMBER);
  await cvvField.fill(CVV);
  await monthField.fill(EXPIRY_MONTH);
  await yearField.fill(YEAR);
}

function requestPayloadData(apiRequestPayload: any) {
  const firstNameInRequest = apiRequestPayload.payment_method.credit_card.first_name;
  const lastNameInRequest = apiRequestPayload.payment_method.credit_card.last_name;
  const cardNumberInRequest = apiRequestPayload.payment_method.credit_card.number;
  const cvvInRequest = apiRequestPayload.payment_method.credit_card.verification_value;
  const monthInRequest = apiRequestPayload.payment_method.credit_card.month;
  const yearInRequest = apiRequestPayload.payment_method.credit_card.year;
  return { firstNameInRequest, lastNameInRequest, cardNumberInRequest, cvvInRequest, monthInRequest, yearInRequest };
}

async function tokenGenerationScenarioToHave(page: Page, apiResponse: any) {
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
}

test.describe('Token Generation', () => {
  test('should generate token and validate API response structure in express checkout', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
    await expect(expressButton).toBeEnabled();
    await expressButton.click();

    const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
    await expect(page.locator(SELECTORS.EXPRESS_IFRAME)).toBeVisible();

    const payWithCardTitle = iframe.locator(`h1:has-text("${HEADINGS.EXPRESS_TITLE}")`);
    await expect(payWithCardTitle).toBeVisible();

    const firstNameField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_FIRST_NAME);
    const lastNameField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_LAST_NAME);
    const cardNumberField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER);
    const cvvField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_CVV}"]`);
    const monthField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_MONTH}"]`);
    const yearField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_YEAR}"]`);

    await firstNameField.fill(TEST_DATA.FIRST_NAME);
    await lastNameField.fill(TEST_DATA.LAST_NAME);
    await cardNumberField.fill(TEST_DATA.CARD_NUMBER);
    await cvvField.fill(TEST_DATA.CVV);
    await monthField.fill(TEST_DATA.EXPIRY_MONTH);
    await yearField.fill(getValidYearString());

    const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
    await expect(payButton).toBeEnabled();

    let apiResponse: any = null;
    let responseStatus: number | null = null;
    let apiRequestPayload: any = null;

    page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        try {
          apiRequestPayload = request.postDataJSON();
        } catch (error) {
          console.log('Request payload is not JSON or empty');
        }
      }
    });

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
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
    await payButton.click();
    const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await tokenMessage.waitFor({ state: 'visible' });
    //DTO Mapping
    if (apiRequestPayload) {
      const { firstNameInRequest, lastNameInRequest, cardNumberInRequest, cvvInRequest, monthInRequest, yearInRequest } = requestPayloadData(apiRequestPayload);
      await expect(firstNameInRequest).toBe(TEST_DATA.FIRST_NAME);
      await expect(lastNameInRequest).toBe(TEST_DATA.LAST_NAME);
      await expect(cardNumberInRequest).toBe(TEST_DATA.CARD_NUMBER);
      await expect(cvvInRequest).toBe(TEST_DATA.CVV);
      await expect(monthInRequest).toBe(TEST_DATA.EXPIRY_MONTH);
      await expect(yearInRequest).toBe(getValidYearString());
    } else {
      console.log('API Request Payload was not captured');
    }
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);
    expect(apiResponse).toBeDefined();
    expect(apiResponse).not.toBeNull();
    if (apiResponse) {
      const paymentMethod = await tokenGenerationScenarioToHave(page, apiResponse);
      expect(apiResponse.transaction.succeeded).toBe(true);
      expect(apiResponse.transaction.state).toBe('succeeded');
      expect(apiResponse.transaction.message).toMatch(/Succeeded|Success/i);
      expect(apiResponse.transaction.transaction_type).toBe('AddPaymentMethod');
      expect(paymentMethod.last_four_digits).toBe(TEST_DATA.CARD_NUMBER.slice(-4));
      expect(paymentMethod.first_six_digits).toBe(TEST_DATA.CARD_NUMBER.slice(0, 6));
      expect(paymentMethod.card_type).toBe('visa');
      expect(paymentMethod.first_name).toBe(TEST_DATA.FIRST_NAME);
      expect(paymentMethod.last_name).toBe(TEST_DATA.LAST_NAME);
      expect(paymentMethod.month).toBe(parseInt(TEST_DATA.EXPIRY_MONTH));
      expect(paymentMethod.test).toBe(true);
      expect(paymentMethod.payment_method_type).toBe('credit_card');
      expect(paymentMethod.issuer_identification_number).toBe(TEST_DATA.CARD_NUMBER.slice(0, 8));
      expect(paymentMethod.eligible_for_card_updater).toBe(true);
      expect(paymentMethod.managed).toBe(true);
      expect(paymentMethod.number).toMatch(new RegExp(`XXXX-XXXX-XXXX-${TEST_DATA.CARD_NUMBER.slice(-4)}`));
      expect(paymentMethod.verification_value).toBe(TEST_DATA.HIDDEN_CVV_VALUE);
      expect(paymentMethod.errors).toEqual([]);
    }
    await expect(tokenMessage).toBeVisible();
    const messageText = await tokenMessage.textContent();
    expect(messageText).toMatch(/Token/);
    expect(messageText).not.toMatch(/Error|Failed|Invalid|Declined/);
  });

  test('should generate token in hosted fields and validate API response', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    const hostedFieldsButton = page.getByTestId(SELECTORS.HOSTED_FIELDS_BUTTON);
    await expect(hostedFieldsButton).toBeEnabled();
    await hostedFieldsButton.click();
    await expect(page.locator(`h2:has-text("${HEADINGS.HOSTED_FIELDS_TITLE}")`)).toBeVisible();
    const cardNumberIframe = page.locator(SELECTORS.HOSTED_CARD_IFRAME);
    const cvvIframe = page.locator(SELECTORS.HOSTED_CVV_IFRAME);
    await expect(cardNumberIframe).toBeVisible();
    await expect(cvvIframe).toBeVisible();
    const cardNumberFrame = page.frameLocator(SELECTORS.HOSTED_CARD_IFRAME);
    const cvvFrame = page.frameLocator(SELECTORS.HOSTED_CVV_IFRAME);
    await page.getByLabel(LABELS.FIRST_NAME).fill(TEST_DATA.FIRST_NAME);
    await page.getByLabel(LABELS.LAST_NAME).fill(TEST_DATA.LAST_NAME);
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).fill(TEST_DATA.CARD_NUMBER_FORMATTED);
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    await cvvFrame.getByTestId(SELECTORS.HOSTED_CVV_FIELD).fill(TEST_DATA.CVV);

    const expiryMonthField = page.getByTestId(SELECTORS.EXPIRY_MONTH);
    const expiryYearField = page.getByTestId(SELECTORS.EXPIRY_YEAR);
    await expiryMonthField.fill(TEST_DATA.EXPIRY_MONTH);
    await expiryYearField.fill(getValidYearString());

    const submitButton = page.getByRole("button", { name: SELECTORS.HOSTED_SUBMIT_BUTTON });
    await expect(submitButton).toBeEnabled();

    let apiResponse: any = null;
    let responseStatus: number | null = null;
    let apiRequestPayload: any = null;

    page.on('response', async (response) => {
      const url = response.url();
      // Check if this is a token generation API call - based on actual request URL
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        responseStatus = response.status();
        try {
          apiResponse = await response.json();
          console.log('Hosted Fields API Request URL:', url);
          console.log('Hosted Fields API Response Status:', responseStatus);
        } catch (error) {
          console.log('Response is not JSON or empty');
        }
      }
    });
    page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        try {
          apiRequestPayload = request.postDataJSON();
        } catch (error) {
          console.log('Request payload is not JSON or empty');
        }
      }
    });
    await submitButton.click();
    const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await tokenMessage.waitFor({ state: 'visible' });

    //DTO Mapping
    if (apiRequestPayload) {
      const { firstNameInRequest, lastNameInRequest, cardNumberInRequest, cvvInRequest, monthInRequest, yearInRequest } = requestPayloadData(apiRequestPayload);
      await expect(firstNameInRequest).toBe(TEST_DATA.FIRST_NAME);
      await expect(lastNameInRequest).toBe(TEST_DATA.LAST_NAME);
      await expect(cardNumberInRequest).toBe(TEST_DATA.CARD_NUMBER);
      await expect(cvvInRequest).toBe(TEST_DATA.CVV);
      await expect(monthInRequest).toBe(TEST_DATA.EXPIRY_MONTH);
      await expect(yearInRequest).toBe(getValidYearString());
    } else {
      console.log('API Request Payload was not captured');
    }
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);
    expect(apiResponse).toBeDefined();
    expect(apiResponse).not.toBeNull();
    if (apiResponse) {
      const paymentMethod = await tokenGenerationScenarioToHave(page, apiResponse);
      expect(apiResponse.transaction.succeeded).toBe(true);
      expect(apiResponse.transaction.state).toBe('succeeded');
      expect(apiResponse.transaction.message).toMatch(/Succeeded|Success/i);
      expect(apiResponse.transaction.transaction_type).toBe('AddPaymentMethod');
      expect(paymentMethod.last_four_digits).toBe(TEST_DATA.CARD_NUMBER.slice(-4));
      expect(paymentMethod.first_six_digits).toBe(TEST_DATA.CARD_NUMBER.slice(0, 6));
      expect(paymentMethod.card_type).toBe('visa');
      expect(paymentMethod.first_name).toBe(TEST_DATA.FIRST_NAME);
      expect(paymentMethod.last_name).toBe(TEST_DATA.LAST_NAME);
      expect(paymentMethod.month).toBe(parseInt(TEST_DATA.EXPIRY_MONTH));
      expect(paymentMethod.test).toBe(true);
      expect(paymentMethod.payment_method_type).toBe('credit_card');
      expect(paymentMethod.issuer_identification_number).toBe(TEST_DATA.CARD_NUMBER.slice(0, 8));
      expect(paymentMethod.eligible_for_card_updater).toBe(true);
      expect(paymentMethod.managed).toBe(true);
      expect(paymentMethod.number).toMatch(new RegExp(`XXXX-XXXX-XXXX-${TEST_DATA.CARD_NUMBER.slice(-4)}`));
      expect(paymentMethod.verification_value).toBe(TEST_DATA.HIDDEN_CVV_VALUE);
      expect(paymentMethod.errors).toEqual([]);
    }
    await expect(tokenMessage).toBeVisible();
    const messageText = await tokenMessage.textContent();
    expect(messageText).toMatch(/Token/);
    expect(messageText).not.toMatch(/Error|Failed|Invalid|Declined/);
  });

  test('should generate token in express checkout embedded mode and validate API response', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    const openEmbeddedModeCheckbox = page.getByTestId(SELECTORS.OPEN_IN_EMBEDDED_MODE);
    await expect(openEmbeddedModeCheckbox).toBeVisible();
    await openEmbeddedModeCheckbox.check();
    await expect(openEmbeddedModeCheckbox).toBeChecked();
    const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
    await expect(expressButton).toBeEnabled();
    await expressButton.click();
  
    const iframeLocator = page.locator(SELECTORS.EXPRESS_IFRAME);
    await expect(iframeLocator).toBeVisible();
  
    const embeddedContainer = page.locator(SELECTORS.EMBEDDED_IFRAME_CONTAINER);
    await expect(embeddedContainer).toBeVisible();

    const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
    
    await page.waitForTimeout(2000);
    
    const firstNameField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_FIRST_NAME);
    const lastNameField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_LAST_NAME);
    const cardNumberField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER);
    const cvvField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_CVV}"]`);
    const monthField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_MONTH}"]`);
    const yearField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_YEAR}"]`);

    await expect(firstNameField).toBeVisible();
    await expect(lastNameField).toBeVisible();
    await expect(cardNumberField).toBeVisible();
    await expect(cvvField).toBeVisible();
    await expect(monthField).toBeVisible();
    await expect(yearField).toBeVisible();

    await firstNameField.fill(TEST_DATA.FIRST_NAME);
    await lastNameField.fill(TEST_DATA.LAST_NAME);
    await cardNumberField.fill(TEST_DATA.CARD_NUMBER);
    await cvvField.fill(TEST_DATA.CVV);
    await monthField.fill(TEST_DATA.EXPIRY_MONTH);
    await yearField.fill(getValidYearString());
    const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
    await expect(payButton).toBeEnabled();

    let apiResponse: any = null;
    let responseStatus: number | null = null;
    let apiRequestPayload: any = null;
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
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
    page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        try {
          apiRequestPayload = request.postDataJSON();
        } catch (error) {
          console.log('Request payload is not JSON or empty');
        }
      }
    });
    await payButton.click();
    const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await tokenMessage.waitFor({ state: 'visible' });
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);
    expect(apiResponse).toBeDefined();
    expect(apiResponse).not.toBeNull();
    //DTO Mapping
    if (apiRequestPayload) {
      const { firstNameInRequest, lastNameInRequest, cardNumberInRequest, cvvInRequest, monthInRequest, yearInRequest } = requestPayloadData(apiRequestPayload);
      await expect(firstNameInRequest).toBe(TEST_DATA.FIRST_NAME);
      await expect(lastNameInRequest).toBe(TEST_DATA.LAST_NAME);
      await expect(cardNumberInRequest).toBe(TEST_DATA.CARD_NUMBER);
      await expect(cvvInRequest).toBe(TEST_DATA.CVV);
      await expect(monthInRequest).toBe(TEST_DATA.EXPIRY_MONTH);
      await expect(yearInRequest).toBe(getValidYearString());
    } else {
      console.log('API Request Payload was not captured');
    }
    if (apiResponse) {
      const paymentMethod = await tokenGenerationScenarioToHave(page, apiResponse);
      expect(apiResponse.transaction.succeeded).toBe(true);
      expect(apiResponse.transaction.state).toBe('succeeded');
      expect(apiResponse.transaction.message).toMatch(/Succeeded|Success/i);
      expect(apiResponse.transaction.transaction_type).toBe('AddPaymentMethod');
      expect(paymentMethod.last_four_digits).toBe(TEST_DATA.CARD_NUMBER.slice(-4));
      expect(paymentMethod.first_six_digits).toBe(TEST_DATA.CARD_NUMBER.slice(0, 6));
      expect(paymentMethod.card_type).toBe('visa');
      expect(paymentMethod.first_name).toBe(TEST_DATA.FIRST_NAME);
      expect(paymentMethod.last_name).toBe(TEST_DATA.LAST_NAME);
      expect(paymentMethod.month).toBe(parseInt(TEST_DATA.EXPIRY_MONTH));
      expect(paymentMethod.test).toBe(true);
      expect(paymentMethod.payment_method_type).toBe('credit_card');
      expect(paymentMethod.issuer_identification_number).toBe(TEST_DATA.CARD_NUMBER.slice(0, 8));
      expect(paymentMethod.eligible_for_card_updater).toBe(true);
      expect(paymentMethod.managed).toBe(true);
      expect(paymentMethod.number).toMatch(new RegExp(`XXXX-XXXX-XXXX-${TEST_DATA.CARD_NUMBER.slice(-4)}`));
      expect(paymentMethod.verification_value).toBe(TEST_DATA.HIDDEN_CVV_VALUE);
      expect(paymentMethod.bin_metadata.card_brand).toBe('VISA');
      expect(paymentMethod.errors).toEqual([]);
    }
    await expect(tokenMessage).toBeVisible();
    const messageText = await tokenMessage.textContent();
    expect(messageText).toMatch(/Token/);
    expect(messageText).not.toMatch(/Error|Failed|Invalid|Declined/);
})

test('should generate token in express checkout with allow expired date option and allow blank name option', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    const allowBlankNameCheckbox = page.getByTestId(SELECTORS.ALLOW_BLANK_NAME);
    await expect(allowBlankNameCheckbox).toBeVisible();
    await allowBlankNameCheckbox.check();
    await expect(allowBlankNameCheckbox).toBeChecked();
    const allowExpiredDateCheckbox = page.getByTestId(SELECTORS.ALLOW_EXPIRED_DATE);
    await expect(allowExpiredDateCheckbox).toBeVisible();
    await allowExpiredDateCheckbox.check();
    await expect(allowExpiredDateCheckbox).toBeChecked();
    const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
    await expect(expressButton).toBeEnabled();
    await expressButton.click();
    const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
    await expect(page.locator(SELECTORS.EXPRESS_IFRAME)).toBeVisible();
    const payWithCardTitle = iframe.locator(`h1:has-text("${HEADINGS.EXPRESS_TITLE}")`);
    await expect(payWithCardTitle).toBeVisible();
    const cardNumberField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER);
    const cvvField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_CVV}"]`);
    const monthField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_MONTH}"]`);
    const yearField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_YEAR}"]`);
    await cardNumberField.fill(TEST_DATA.CARD_NUMBER);
    await cvvField.fill(TEST_DATA.CVV);
    await monthField.fill(TEST_DATA.EXPIRY_MONTH);
    await yearField.fill(getExpiredYearString());
    const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
    await expect(payButton).toBeEnabled();
    let apiResponse: any = null;
    let responseStatus: number | null = null;
    let apiRequestPayload: any = null;

    page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        try {
          apiRequestPayload = request.postDataJSON();
        } catch (error) {
          console.log('Request payload is not JSON or empty');
        }
      }
    });
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
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
    await payButton.click();
    const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await tokenMessage.waitFor({ state: 'visible' });
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);
    expect(apiResponse).toBeDefined();
    expect(apiResponse).not.toBeNull();

    //DTO Mapping
    if (apiRequestPayload) {
      const { firstNameInRequest, lastNameInRequest, cardNumberInRequest, cvvInRequest, monthInRequest, yearInRequest } = requestPayloadData(apiRequestPayload);
      await expect(firstNameInRequest).toBe(TEST_DATA.EMPTY_STRING);
      await expect(lastNameInRequest).toBe(TEST_DATA.EMPTY_STRING);
      await expect(cardNumberInRequest).toBe(TEST_DATA.CARD_NUMBER);
      await expect(cvvInRequest).toBe(TEST_DATA.CVV);
      await expect(monthInRequest).toBe(TEST_DATA.EXPIRY_MONTH);
      await expect(yearInRequest).toBe(getExpiredYearString());
    } else {
      console.log('API Request Payload was not captured');
    }

    if (apiResponse) {
      const paymentMethod = await tokenGenerationScenarioToHave(page, apiResponse);
      expect(apiResponse.transaction.succeeded).toBe(true);
      expect(apiResponse.transaction.state).toBe('succeeded');
      expect(apiResponse.transaction.message).toMatch(/Succeeded|Success/i);
      expect(apiResponse.transaction.transaction_type).toBe('AddPaymentMethod');
      expect(paymentMethod.first_name).toBe(TEST_DATA.EMPTY_STRING);
      expect(paymentMethod.last_name).toBe(TEST_DATA.EMPTY_STRING);
      expect(paymentMethod.last_four_digits).toBe(TEST_DATA.CARD_NUMBER.slice(-4));
      expect(paymentMethod.first_six_digits).toBe(TEST_DATA.CARD_NUMBER.slice(0, 6));
      expect(paymentMethod.card_type).toBe('visa');
      expect(paymentMethod.month).toBe(parseInt(TEST_DATA.EXPIRY_MONTH));
      expect(paymentMethod.year).toBe(parseInt(getExpiredYearString()));
      expect(paymentMethod.test).toBe(true);
      expect(paymentMethod.payment_method_type).toBe('credit_card');
      expect(paymentMethod.issuer_identification_number).toBe(TEST_DATA.CARD_NUMBER.slice(0, 8));
      expect(paymentMethod.eligible_for_card_updater).toBe(true);
      expect(paymentMethod.managed).toBe(true);
      expect(paymentMethod.number).toMatch(new RegExp(`XXXX-XXXX-XXXX-${TEST_DATA.CARD_NUMBER.slice(-4)}`));
      expect(paymentMethod.verification_value).toBe('XXX');
      expect(paymentMethod.bin_metadata.card_brand).toBe('VISA');
      expect(paymentMethod.errors).toEqual([]);
    }
    await expect(tokenMessage).toBeVisible();
    
    const messageText = await tokenMessage.textContent();
    expect(messageText).toMatch(/Token/);
    expect(messageText).not.toMatch(/Error|Failed|Invalid|Declined/);
})

test('should generate token and validate API response structure in hosted fields with allow expired date option and allow blank name option', async ({ page }) => {
  await page.goto(URLS.BASE);
  await waitForAuthParams(page);
  const hostedFieldsButton = page.getByTestId(SELECTORS.HOSTED_FIELDS_BUTTON);
    await expect(hostedFieldsButton).toBeEnabled();
    await hostedFieldsButton.click();
    await expect(page.locator(`h2:has-text("${HEADINGS.HOSTED_FIELDS_TITLE}")`)).toBeVisible();
    const allowBlankNameCheckbox = page.getByTestId(SELECTORS.ALLOW_BLANK_NAME);
    await expect(allowBlankNameCheckbox).toBeVisible();
    await allowBlankNameCheckbox.check();
    await expect(allowBlankNameCheckbox).toBeChecked();
    const allowExpiredDateCheckbox = page.getByTestId(SELECTORS.ALLOW_EXPIRED_DATE);
    await expect(allowExpiredDateCheckbox).toBeVisible();
    await allowExpiredDateCheckbox.check();
    await expect(allowExpiredDateCheckbox).toBeChecked();
    const expiryMonthField = page.getByTestId(SELECTORS.EXPIRY_MONTH);
    const expiryYearField = page.getByTestId(SELECTORS.EXPIRY_YEAR);
    const submitButton = page.getByRole("button", { name: SELECTORS.HOSTED_SUBMIT_BUTTON });
    await expect(expiryMonthField).toBeVisible();
    await expect(expiryYearField).toBeVisible();
    await expect(submitButton).toBeVisible();
    const cardNumberIframe = page.locator(SELECTORS.HOSTED_CARD_IFRAME);
    const cvvIframe = page.locator(SELECTORS.HOSTED_CVV_IFRAME);
    await expect(cardNumberIframe).toBeVisible();
    await expect(cvvIframe).toBeVisible();
    const cardNumberFrame = page.frameLocator(SELECTORS.HOSTED_CARD_IFRAME);
    const cvvFrame = page.frameLocator(SELECTORS.HOSTED_CVV_IFRAME);
    await expect(cardNumberFrame.getByRole("textbox", { name: LABELS.CARD_NUMBER })).toBeVisible();
    await expect(cvvFrame.getByRole("textbox", { name: LABELS.CVV_NUMBER })).toBeVisible();
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).fill(TEST_DATA.CARD_NUMBER_FORMATTED);
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    await cvvFrame.getByTestId(SELECTORS.HOSTED_CVV_FIELD).fill(TEST_DATA.CVV);
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    await expiryMonthField.fill(TEST_DATA.EXPIRY_MONTH);
    await expiryYearField.fill(getExpiredYearString());
    let apiResponse: any = null;
    let responseStatus: number | null = null;
    let apiRequestPayload: any = null;
    // Listen for API responses
    page.on('response', async (response) => {
      const url = response.url();
      // Check if this is a token generation API call - based on actual request URL
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        responseStatus = response.status();
        try {
          apiResponse = await response.json();
          console.log('Hosted Fields API Request URL:', url);
          console.log('Hosted Fields API Response Status:', responseStatus);
        } catch (error) {
          console.log('Response is not JSON or empty');
        }
      }
    });
    page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        try {
          apiRequestPayload = request.postDataJSON();
        } catch (error) {
          console.log('Request payload is not JSON or empty');
        }
      }
    });
    await page.waitForTimeout(TEST_DATA.TIMEOUT_LONG);
    await submitButton.click();
    const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await tokenMessage.waitFor({ state: 'visible' });
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);

    expect(apiResponse).toBeDefined();
    expect(apiResponse).not.toBeNull();

    //DTO Mapping
    if (apiRequestPayload) {
      const { firstNameInRequest, lastNameInRequest, cardNumberInRequest, cvvInRequest, monthInRequest, yearInRequest } = requestPayloadData(apiRequestPayload);
      await expect(firstNameInRequest).toBe(TEST_DATA.EMPTY_STRING);
      await expect(lastNameInRequest).toBe(TEST_DATA.EMPTY_STRING);
      await expect(cardNumberInRequest).toBe(TEST_DATA.CARD_NUMBER);
      await expect(cvvInRequest).toBe(TEST_DATA.CVV);
      await expect(monthInRequest).toBe(TEST_DATA.EXPIRY_MONTH);
      await expect(yearInRequest).toBe(getExpiredYearString());
    } else {
      console.log('API Request Payload was not captured');
    }

    if (apiResponse) {
      const paymentMethod = await tokenGenerationScenarioToHave(page, apiResponse);
      expect(apiResponse.transaction.succeeded).toBe(true);
      expect(apiResponse.transaction.state).toBe('succeeded');
      expect(apiResponse.transaction.message).toMatch(/Succeeded|Success/i);
      expect(apiResponse.transaction.transaction_type).toBe('AddPaymentMethod');
      expect(paymentMethod.first_name).toBe(TEST_DATA.EMPTY_STRING);
      expect(paymentMethod.last_name).toBe(TEST_DATA.EMPTY_STRING);
      expect(paymentMethod.last_four_digits).toBe(TEST_DATA.CARD_NUMBER.slice(-4));
      expect(paymentMethod.first_six_digits).toBe(TEST_DATA.CARD_NUMBER.slice(0, 6));
      expect(paymentMethod.card_type).toBe('visa');
      expect(paymentMethod.month).toBe(parseInt(TEST_DATA.EXPIRY_MONTH));
      expect(paymentMethod.year).toBe(parseInt(getExpiredYearString()));
      expect(paymentMethod.test).toBe(true);
      expect(paymentMethod.payment_method_type).toBe('credit_card');
      expect(paymentMethod.issuer_identification_number).toBe(TEST_DATA.CARD_NUMBER.slice(0, 8));
      expect(paymentMethod.eligible_for_card_updater).toBe(true);
      expect(paymentMethod.managed).toBe(true);
      expect(paymentMethod.number).toMatch(new RegExp(`XXXX-XXXX-XXXX-${TEST_DATA.CARD_NUMBER.slice(-4)}`));
      expect(paymentMethod.verification_value).toBe(TEST_DATA.HIDDEN_CVV_VALUE);
      expect(paymentMethod.errors).toEqual([]);
    }
    await expect(tokenMessage).toBeVisible();
    
    const messageText = await tokenMessage.textContent();
    expect(messageText).toMatch(/Token/);
    expect(messageText).not.toMatch(/Error|Failed|Invalid|Declined/);
});

test('should generate token and validate API response structure in express checkout embedded mode with allow expired date option and allow blank name option', async ({ page }) => {
  await page.goto(URLS.BASE);
  await waitForAuthParams(page);// Step 2: Click on express checkout
  const openEmbeddedModeCheckbox = page.getByTestId(SELECTORS.OPEN_IN_EMBEDDED_MODE);
  await expect(openEmbeddedModeCheckbox).toBeVisible();
  await openEmbeddedModeCheckbox.check();
  await expect(openEmbeddedModeCheckbox).toBeChecked();
  const allowBlankNameCheckbox = page.getByTestId(SELECTORS.ALLOW_BLANK_NAME);
  await expect(allowBlankNameCheckbox).toBeVisible();
  await allowBlankNameCheckbox.check();
  await expect(allowBlankNameCheckbox).toBeChecked();
  const allowExpiredDateCheckbox = page.getByTestId(SELECTORS.ALLOW_EXPIRED_DATE);
  await expect(allowExpiredDateCheckbox).toBeVisible();
  await allowExpiredDateCheckbox.check();
  await expect(allowExpiredDateCheckbox).toBeChecked();
  const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
  await expect(expressButton).toBeEnabled();
  await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
  await expressButton.click();
  const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
  await expect(page.locator(SELECTORS.EXPRESS_IFRAME)).toBeVisible();
  const cardNumberField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER);
    const cvvField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_CVV}"]`);
    const monthField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_MONTH}"]`);
    const yearField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_YEAR}"]`);
    await cardNumberField.fill(TEST_DATA.CARD_NUMBER);
    await cvvField.fill(TEST_DATA.CVV);
    await monthField.fill(TEST_DATA.EXPIRY_MONTH);
    await yearField.fill(getExpiredYearString());
    const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
    await expect(payButton).toBeEnabled();
    let apiResponse: any = null;
    let responseStatus: number | null = null;
    let apiRequestPayload: any = null;
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
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
    page.on('request', async (request) => {
      const url = request.url();
      if (url.includes('/v1/payment_methods/restricted.json') || url.includes('/v1/payment_methods')) {
        try {
          apiRequestPayload = request.postDataJSON();
        } catch (error) {
          console.log('Request payload is not JSON or empty');
        }
      }
    });
    await payButton.click();
    const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await tokenMessage.waitFor({ state: 'visible' });
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);
    expect(apiResponse).toBeDefined();
    expect(apiResponse).not.toBeNull();

    //DTO Mapping
    if (apiRequestPayload) {
      const { firstNameInRequest, lastNameInRequest, cardNumberInRequest, cvvInRequest, monthInRequest, yearInRequest } = requestPayloadData(apiRequestPayload);
      await expect(firstNameInRequest).toBe(TEST_DATA.EMPTY_STRING);
      await expect(lastNameInRequest).toBe(TEST_DATA.EMPTY_STRING);
      await expect(cardNumberInRequest).toBe(TEST_DATA.CARD_NUMBER);
      await expect(cvvInRequest).toBe(TEST_DATA.CVV);
      await expect(monthInRequest).toBe(TEST_DATA.EXPIRY_MONTH);
      await expect(yearInRequest).toBe(getExpiredYearString());
    } else {
      console.log('API Request Payload was not captured');
    }
    if (apiResponse) {
      const paymentMethod = await tokenGenerationScenarioToHave(page, apiResponse);
      expect(apiResponse.transaction.succeeded).toBe(true);
      expect(apiResponse.transaction.state).toBe('succeeded');
      expect(apiResponse.transaction.message).toMatch(/Succeeded|Success/i);
      expect(apiResponse.transaction.transaction_type).toBe('AddPaymentMethod');

      expect(paymentMethod.first_name).toBe(TEST_DATA.EMPTY_STRING);
      expect(paymentMethod.last_name).toBe(TEST_DATA.EMPTY_STRING);

      expect(paymentMethod.last_four_digits).toBe(TEST_DATA.CARD_NUMBER.slice(-4));
      expect(paymentMethod.first_six_digits).toBe(TEST_DATA.CARD_NUMBER.slice(0, 6));
      expect(paymentMethod.card_type).toBe('visa');
      expect(paymentMethod.month).toBe(parseInt(TEST_DATA.EXPIRY_MONTH));
      expect(paymentMethod.year).toBe(parseInt(getExpiredYearString()));
      expect(paymentMethod.test).toBe(true);
      expect(paymentMethod.payment_method_type).toBe('credit_card');
      expect(paymentMethod.issuer_identification_number).toBe(TEST_DATA.CARD_NUMBER.slice(0, 8));
      expect(paymentMethod.eligible_for_card_updater).toBe(true);
      expect(paymentMethod.managed).toBe(true);
      expect(paymentMethod.number).toMatch(new RegExp(`XXXX-XXXX-XXXX-${TEST_DATA.CARD_NUMBER.slice(-4)}`));
      expect(paymentMethod.verification_value).toBe(TEST_DATA.HIDDEN_CVV_VALUE);
      expect(paymentMethod.bin_metadata.card_brand).toBe('VISA');

      expect(paymentMethod.errors).toEqual([]);
    }
    await expect(tokenMessage).toBeVisible();
    const messageText = await tokenMessage.textContent();
    expect(messageText).toMatch(/Token/);
    expect(messageText).not.toMatch(/Error|Failed|Invalid|Declined/);
})
})





