import { test, expect } from './fixtures';
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

test.describe('Token Generation', () => {
  test('should generate token and validate API response structure', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    // Step 2: Click on express checkout
    const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
    await expect(expressButton).toBeEnabled();
    await expressButton.click();

    // Wait for the payment iframe to load
    const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
    await expect(page.locator(SELECTORS.EXPRESS_IFRAME)).toBeVisible();

    // Verify the payment form is loaded
    const payWithCardTitle = iframe.locator(`h1:has-text("${HEADINGS.EXPRESS_TITLE}")`);
    await expect(payWithCardTitle).toBeVisible();

    // Step 3: Enter all valid details
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

    // Step 4: Click on pay and capture API response
    const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
    await expect(payButton).toBeEnabled();

    // Set up response interception
    let apiResponse: any = null;
    let responseStatus: number | null = null;

    // Listen for API responses
    page.on('response', async (response) => {
      const url = response.url();
      // Check if this is a token generation API call - based on actual request URL
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

    // Click pay button
    await payButton.click();

    // Wait for API response
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);

    // Step 5: Verify API response status codes (200 or 204)
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);

    // Step 6: Take the response JSON in a variable
    expect(apiResponse).toBeDefined();
    expect(apiResponse).not.toBeNull();

    // Step 7: Parse JSON and do validation
    if (apiResponse) {
      // Validate transaction structure
      expect(apiResponse).toHaveProperty('transaction');
      expect(apiResponse.transaction).toHaveProperty('token');
      expect(apiResponse.transaction).toHaveProperty('succeeded');
      expect(apiResponse.transaction).toHaveProperty('state');
      expect(apiResponse.transaction).toHaveProperty('message');
      expect(apiResponse.transaction).toHaveProperty('transaction_type');
      expect(apiResponse.transaction).toHaveProperty('payment_method');

      // Validate transaction success
      expect(apiResponse.transaction.succeeded).toBe(true);
      expect(apiResponse.transaction.state).toBe('succeeded');
      expect(apiResponse.transaction.message).toMatch(/Succeeded|Success/i);
      expect(apiResponse.transaction.transaction_type).toBe('AddPaymentMethod');

      // Validate payment method structure
      const paymentMethod = apiResponse.transaction.payment_method;
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

      // Validate payment method values
      expect(paymentMethod.last_four_digits).toBe(TEST_DATA.CARD_NUMBER.slice(-4));
      expect(paymentMethod.first_six_digits).toBe(TEST_DATA.CARD_NUMBER.slice(0, 6));
      expect(paymentMethod.card_type).toBe('visa');
      expect(paymentMethod.first_name).toBe(TEST_DATA.FIRST_NAME);
      expect(paymentMethod.last_name).toBe(TEST_DATA.LAST_NAME);
      expect(paymentMethod.month).toBe(parseInt(TEST_DATA.EXPIRY_MONTH));
      expect(paymentMethod.test).toBe(true);
      expect(paymentMethod.payment_method_type).toBe('credit_card');
      
      // Validate additional fields from actual response
      expect(paymentMethod).toHaveProperty('storage_state');
      expect(paymentMethod).toHaveProperty('eligible_for_card_updater');
      expect(paymentMethod).toHaveProperty('issuer_identification_number');
      expect(paymentMethod).toHaveProperty('managed');
      expect(paymentMethod).toHaveProperty('fingerprint');
      expect(paymentMethod.issuer_identification_number).toBe(TEST_DATA.CARD_NUMBER.slice(0, 8));
      expect(paymentMethod.eligible_for_card_updater).toBe(true);
      expect(paymentMethod.managed).toBe(true);

      // Validate card number masking
      expect(paymentMethod).toHaveProperty('number');
      expect(paymentMethod.number).toMatch(/XXXX-XXXX-XXXX-1111/);

      // Validate CVV masking
      expect(paymentMethod).toHaveProperty('verification_value');
      expect(paymentMethod.verification_value).toBe('XXX');

      // Validate BIN metadata if present
      if (paymentMethod.bin_metadata) {
        expect(paymentMethod.bin_metadata).toHaveProperty('card_brand');
        expect(paymentMethod.bin_metadata).toHaveProperty('issuing_bank');
        expect(paymentMethod.bin_metadata).toHaveProperty('card_type');
        expect(paymentMethod.bin_metadata.card_brand).toBe('VISA');
      }

      // Validate timestamps
      expect(paymentMethod).toHaveProperty('created_at');
      expect(paymentMethod).toHaveProperty('updated_at');
      expect(apiResponse.transaction).toHaveProperty('created_at');
      expect(apiResponse.transaction).toHaveProperty('updated_at');

      // Validate no errors
      expect(paymentMethod.errors).toEqual([]);
    }
    const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await expect(tokenMessage).toBeVisible();
    
    const messageText = await tokenMessage.textContent();
    expect(messageText).toMatch(/Token/);
    expect(messageText).not.toMatch(/Error|Failed|Invalid|Declined/);
  });

  test('should generate token in hosted fields and validate API response', async ({ page }) => {

    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    // Step 2: Click on hosted fields
    const hostedFieldsButton = page.getByTestId(SELECTORS.HOSTED_FIELDS_BUTTON);
    await expect(hostedFieldsButton).toBeEnabled();
    await hostedFieldsButton.click();
    // await expect(page).toHaveURL(URLS.HOSTED_FIELDS);

    // Verify hosted fields page is loaded
    await expect(page.locator(`h2:has-text("${HEADINGS.HOSTED_FIELDS_TITLE}")`)).toBeVisible();

    // Wait for hosted fields iframes to load
    const cardNumberIframe = page.locator(SELECTORS.HOSTED_CARD_IFRAME);
    const cvvIframe = page.locator(SELECTORS.HOSTED_CVV_IFRAME);
    await expect(cardNumberIframe).toBeVisible();
    await expect(cvvIframe).toBeVisible();

    // Get frame locators for hosted fields
    const cardNumberFrame = page.frameLocator(SELECTORS.HOSTED_CARD_IFRAME);
    const cvvFrame = page.frameLocator(SELECTORS.HOSTED_CVV_IFRAME);

    // Step 3: Enter all valid details
    await page.getByLabel(LABELS.FIRST_NAME).fill(TEST_DATA.FIRST_NAME);
    await page.getByLabel(LABELS.LAST_NAME).fill(TEST_DATA.LAST_NAME);

    // Fill card number and CVV in iframes
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).fill(TEST_DATA.CARD_NUMBER);
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    await cvvFrame.getByTestId(SELECTORS.HOSTED_CVV_FIELD).fill(TEST_DATA.CVV);

    // Fill expiry fields
    const expiryMonthField = page.getByTestId(SELECTORS.EXPIRY_MONTH);
    const expiryYearField = page.getByTestId(SELECTORS.EXPIRY_YEAR);
    await expiryMonthField.fill(TEST_DATA.EXPIRY_MONTH);
    await expiryYearField.fill(getValidYearString());

    // Step 4: Click submit and capture API response
    const submitButton = page.getByRole("button", { name: SELECTORS.HOSTED_SUBMIT_BUTTON });
    await expect(submitButton).toBeEnabled();

    // Set up response interception
    let apiResponse: any = null;
    let responseStatus: number | null = null;

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

    // Click submit button
    await submitButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);

    // Wait for API response
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);

    // Step 5: Verify API response status codes (200 or 204)
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);

    // Step 6: Take the response JSON in a variable
    expect(apiResponse).toBeDefined();
    expect(apiResponse).not.toBeNull();

    // Step 7: Parse JSON and do validation
    if (apiResponse) {
      // Validate transaction structure
      expect(apiResponse).toHaveProperty('transaction');
      expect(apiResponse.transaction).toHaveProperty('token');
      expect(apiResponse.transaction).toHaveProperty('succeeded');
      expect(apiResponse.transaction).toHaveProperty('state');
      expect(apiResponse.transaction).toHaveProperty('message');
      expect(apiResponse.transaction).toHaveProperty('transaction_type');
      expect(apiResponse.transaction).toHaveProperty('payment_method');

      // Validate transaction success
      expect(apiResponse.transaction.succeeded).toBe(true);
      expect(apiResponse.transaction.state).toBe('succeeded');
      expect(apiResponse.transaction.message).toMatch(/Succeeded|Success/i);
      expect(apiResponse.transaction.transaction_type).toBe('AddPaymentMethod');

      // Validate payment method structure
      const paymentMethod = apiResponse.transaction.payment_method;
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

      // Validate payment method values
      expect(paymentMethod.last_four_digits).toBe(TEST_DATA.CARD_NUMBER.slice(-4));
      expect(paymentMethod.first_six_digits).toBe(TEST_DATA.CARD_NUMBER.slice(0, 6));
      expect(paymentMethod.card_type).toBe('visa');
      expect(paymentMethod.first_name).toBe(TEST_DATA.FIRST_NAME);
      expect(paymentMethod.last_name).toBe(TEST_DATA.LAST_NAME);
      expect(paymentMethod.month).toBe(parseInt(TEST_DATA.EXPIRY_MONTH));
      expect(paymentMethod.test).toBe(true);
      expect(paymentMethod.payment_method_type).toBe('credit_card');
      
      // Validate additional fields from actual response
      expect(paymentMethod).toHaveProperty('storage_state');
      expect(paymentMethod).toHaveProperty('eligible_for_card_updater');
      expect(paymentMethod).toHaveProperty('issuer_identification_number');
      expect(paymentMethod).toHaveProperty('managed');
      expect(paymentMethod).toHaveProperty('fingerprint');
      expect(paymentMethod.issuer_identification_number).toBe(TEST_DATA.CARD_NUMBER.slice(0, 8));
      expect(paymentMethod.eligible_for_card_updater).toBe(true);
      expect(paymentMethod.managed).toBe(true);

      // Validate card number masking
      expect(paymentMethod).toHaveProperty('number');
      expect(paymentMethod.number).toMatch(/XXXX-XXXX-XXXX-1111/);

      // Validate CVV masking
      expect(paymentMethod).toHaveProperty('verification_value');
      expect(paymentMethod.verification_value).toBe('XXX');

      // Validate no errors
      expect(paymentMethod.errors).toEqual([]);
    }

    // Verify UI shows success message
    const tokenContainer = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await expect(tokenContainer).toBeVisible();
    
    const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await expect(tokenMessage).toBeVisible();
    
    const messageText = await tokenMessage.textContent();
    expect(messageText).toMatch(/Token/);
    expect(messageText).not.toMatch(/Error|Failed|Invalid|Declined/);
  });

  test('should generate token in express checkout embedded mode and validate API response', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);// Step 2: Click on express checkout
    const openEmbeddedModeCheckbox = page.getByTestId(SELECTORS.OPEN_IN_EMBEDDED_MODE);
    await expect(openEmbeddedModeCheckbox).toBeVisible();
    await openEmbeddedModeCheckbox.check();
    await expect(openEmbeddedModeCheckbox).toBeChecked();
  
    // Click on express checkout button
    const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
    await expect(expressButton).toBeEnabled();
    await expressButton.click();
  
    // Verify the payment iframe is visible
    const iframeLocator = page.locator(SELECTORS.EXPRESS_IFRAME);
    await expect(iframeLocator).toBeVisible();
  
    // Verify the iframe is embedded inside the container
    const embeddedContainer = page.locator(SELECTORS.EMBEDDED_IFRAME_CONTAINER);
    await expect(embeddedContainer).toBeVisible();

    // Get the iframe locator for embedded mode
    const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
    
    // Wait for the iframe content to load
    await page.waitForTimeout(2000);
    
    // Step 3: Enter all valid details
    const firstNameField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_FIRST_NAME);
    const lastNameField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_LAST_NAME);
    const cardNumberField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER);
    const cvvField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_CVV}"]`);
    const monthField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_MONTH}"]`);
    const yearField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_YEAR}"]`);

    // Wait for form fields to be visible in embedded mode
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

    // Set up response interception
    let apiResponse: any = null;
    let responseStatus: number | null = null;

    // Listen for API responses
    page.on('response', async (response) => {
      const url = response.url();
      // Check if this is a token generation API call - based on actual request URL
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

    // Click pay button
    await payButton.click();

    // Wait for API response
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);

    // Step 5: Verify API response status codes (200 or 204)
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);

    // Step 6: Take the response JSON in a variable
    expect(apiResponse).toBeDefined();
    expect(apiResponse).not.toBeNull();

    // Step 7: Parse JSON and do validation
    if (apiResponse) {
      // Validate transaction structure
      expect(apiResponse).toHaveProperty('transaction');
      expect(apiResponse.transaction).toHaveProperty('token');
      expect(apiResponse.transaction).toHaveProperty('succeeded');
      expect(apiResponse.transaction).toHaveProperty('state');
      expect(apiResponse.transaction).toHaveProperty('message');
      expect(apiResponse.transaction).toHaveProperty('transaction_type');
      expect(apiResponse.transaction).toHaveProperty('payment_method');

      // Validate transaction success
      expect(apiResponse.transaction.succeeded).toBe(true);
      expect(apiResponse.transaction.state).toBe('succeeded');
      expect(apiResponse.transaction.message).toMatch(/Succeeded|Success/i);
      expect(apiResponse.transaction.transaction_type).toBe('AddPaymentMethod');

      // Validate payment method structure
      const paymentMethod = apiResponse.transaction.payment_method;
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

      // Validate payment method values
      expect(paymentMethod.last_four_digits).toBe(TEST_DATA.CARD_NUMBER.slice(-4));
      expect(paymentMethod.first_six_digits).toBe(TEST_DATA.CARD_NUMBER.slice(0, 6));
      expect(paymentMethod.card_type).toBe('visa');
      expect(paymentMethod.first_name).toBe(TEST_DATA.FIRST_NAME);
      expect(paymentMethod.last_name).toBe(TEST_DATA.LAST_NAME);
      expect(paymentMethod.month).toBe(parseInt(TEST_DATA.EXPIRY_MONTH));
      expect(paymentMethod.test).toBe(true);
      expect(paymentMethod.payment_method_type).toBe('credit_card');
      
      // Validate additional fields from actual response
      expect(paymentMethod).toHaveProperty('storage_state');
      expect(paymentMethod).toHaveProperty('eligible_for_card_updater');
      expect(paymentMethod).toHaveProperty('issuer_identification_number');
      expect(paymentMethod).toHaveProperty('managed');
      expect(paymentMethod).toHaveProperty('fingerprint');
      expect(paymentMethod.issuer_identification_number).toBe(TEST_DATA.CARD_NUMBER.slice(0, 8));
      expect(paymentMethod.eligible_for_card_updater).toBe(true);
      expect(paymentMethod.managed).toBe(true);

      // Validate card number masking
      expect(paymentMethod).toHaveProperty('number');
      expect(paymentMethod.number).toMatch(/XXXX-XXXX-XXXX-1111/);

      // Validate CVV masking
      expect(paymentMethod).toHaveProperty('verification_value');
      expect(paymentMethod.verification_value).toBe('XXX');

      // Validate BIN metadata if present
      if (paymentMethod.bin_metadata) {
        expect(paymentMethod.bin_metadata).toHaveProperty('card_brand');
        expect(paymentMethod.bin_metadata).toHaveProperty('issuing_bank');
        expect(paymentMethod.bin_metadata).toHaveProperty('card_type');
        expect(paymentMethod.bin_metadata.card_brand).toBe('VISA');
      }

      // Validate timestamps
      expect(paymentMethod).toHaveProperty('created_at');
      expect(paymentMethod).toHaveProperty('updated_at');
      expect(apiResponse.transaction).toHaveProperty('created_at');
      expect(apiResponse.transaction).toHaveProperty('updated_at');

      // Validate no errors
      expect(paymentMethod.errors).toEqual([]);
    }
    const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
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

    // Verify the payment form is loaded
    const payWithCardTitle = iframe.locator(`h1:has-text("${HEADINGS.EXPRESS_TITLE}")`);
    await expect(payWithCardTitle).toBeVisible();

    // Step 3: Enter all valid details
    const cardNumberField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER);
    const cvvField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_CVV}"]`);
    const monthField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_MONTH}"]`);
    const yearField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_YEAR}"]`);
    await cardNumberField.fill(TEST_DATA.CARD_NUMBER);
    await cvvField.fill(TEST_DATA.CVV);
    await monthField.fill(TEST_DATA.EXPIRY_MONTH);
    await yearField.fill(getExpiredYearString());

    // Step 4: Click on pay and capture API response
    const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
    await expect(payButton).toBeEnabled();

    // Set up response interception
    let apiResponse: any = null;
    let responseStatus: number | null = null;

    // Listen for API responses
    page.on('response', async (response) => {
      const url = response.url();
      // Check if this is a token generation API call - based on actual request URL
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

    // Click pay button
    await payButton.click();

    // Wait for API response
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);

    // Step 5: Verify API response status codes (200 or 204)
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);

    // Step 6: Take the response JSON in a variable
    expect(apiResponse).toBeDefined();
    expect(apiResponse).not.toBeNull();

    // Step 7: Parse JSON and do validation
    if (apiResponse) {
      // Validate transaction structure
      expect(apiResponse).toHaveProperty('transaction');
      expect(apiResponse.transaction).toHaveProperty('token');
      expect(apiResponse.transaction).toHaveProperty('succeeded');
      expect(apiResponse.transaction).toHaveProperty('state');
      expect(apiResponse.transaction).toHaveProperty('message');
      expect(apiResponse.transaction).toHaveProperty('transaction_type');
      expect(apiResponse.transaction).toHaveProperty('payment_method');

      // Validate transaction success
      expect(apiResponse.transaction.succeeded).toBe(true);
      expect(apiResponse.transaction.state).toBe('succeeded');
      expect(apiResponse.transaction.message).toMatch(/Succeeded|Success/i);
      expect(apiResponse.transaction.transaction_type).toBe('AddPaymentMethod');

      // Validate payment method structure
      const paymentMethod = apiResponse.transaction.payment_method;
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

      // Validate payment method values
      expect(paymentMethod.last_four_digits).toBe(TEST_DATA.CARD_NUMBER.slice(-4));
      expect(paymentMethod.first_six_digits).toBe(TEST_DATA.CARD_NUMBER.slice(0, 6));
      expect(paymentMethod.card_type).toBe('visa');
      expect(paymentMethod.month).toBe(parseInt(TEST_DATA.EXPIRY_MONTH));
      expect(paymentMethod.test).toBe(true);
      expect(paymentMethod.payment_method_type).toBe('credit_card');
      
      // Validate additional fields from actual response
      expect(paymentMethod).toHaveProperty('storage_state');
      expect(paymentMethod).toHaveProperty('eligible_for_card_updater');
      expect(paymentMethod).toHaveProperty('issuer_identification_number');
      expect(paymentMethod).toHaveProperty('managed');
      expect(paymentMethod).toHaveProperty('fingerprint');
      expect(paymentMethod.issuer_identification_number).toBe(TEST_DATA.CARD_NUMBER.slice(0, 8));
      expect(paymentMethod.eligible_for_card_updater).toBe(true);
      expect(paymentMethod.managed).toBe(true);

      // Validate card number masking
      expect(paymentMethod).toHaveProperty('number');
      expect(paymentMethod.number).toMatch(/XXXX-XXXX-XXXX-1111/);

      // Validate CVV masking
      expect(paymentMethod).toHaveProperty('verification_value');
      expect(paymentMethod.verification_value).toBe('XXX');

      // Validate BIN metadata if present
      if (paymentMethod.bin_metadata) {
        expect(paymentMethod.bin_metadata).toHaveProperty('card_brand');
        expect(paymentMethod.bin_metadata).toHaveProperty('issuing_bank');
        expect(paymentMethod.bin_metadata).toHaveProperty('card_type');
        expect(paymentMethod.bin_metadata.card_brand).toBe('VISA');
      }

      // Validate timestamps
      expect(paymentMethod).toHaveProperty('created_at');
      expect(paymentMethod).toHaveProperty('updated_at');
      expect(apiResponse.transaction).toHaveProperty('created_at');
      expect(apiResponse.transaction).toHaveProperty('updated_at');

      // Validate no errors
      expect(paymentMethod.errors).toEqual([]);
    }
    const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await expect(tokenMessage).toBeVisible();
    
    const messageText = await tokenMessage.textContent();
    expect(messageText).toMatch(/Token/);
    expect(messageText).not.toMatch(/Error|Failed|Invalid|Declined/);
})
  });




