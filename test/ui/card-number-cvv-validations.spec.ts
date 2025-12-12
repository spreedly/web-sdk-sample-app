import { test, expect } from './fixtures';
import {
  URLS,
  SELECTORS,
  PLACEHOLDERS,
  LABELS,
  TEST_DATA,
  HEADINGS,
  getValidYearString,
  ERROR_MESSAGES,
  waitForAuthParams,
  ERROR_SELECTORS,
} from './test-constants';

test.describe('Card Number and CVV Validation', () => {
  test('shows validation for invalid card in express checkout', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
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
    const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
    // Fill invalid card number and otherwise valid data
    await cardNumberField.fill(TEST_DATA.INVALID_CARD_NUMBER);
    await cvvField.fill(TEST_DATA.CVV);
    await monthField.fill(TEST_DATA.EXPIRY_MONTH);
    await yearField.fill(getValidYearString());
    await payButton.click();
    // Expect card number field to be marked invalid
    await expect(cardNumberField).toHaveAttribute('aria-invalid', 'true');
    await page.waitForTimeout(2000);
    const invalidCardIcon = iframe.locator(ERROR_SELECTORS.INVALID_CARD_NUMBER_ICON);
    await expect(invalidCardIcon).toBeVisible();
    console.log(invalidCardIcon.textContent());
    await expect(invalidCardIcon).toHaveAttribute('aria-label', ERROR_MESSAGES.INVALID_CARD_NUMBER);

  });

  test('shows validation for invalid card in hosted fields', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    const hostedFieldsButton = page.getByTestId(SELECTORS.HOSTED_FIELDS_BUTTON);
    await expect(hostedFieldsButton).toBeEnabled();
    await hostedFieldsButton.click();
    //await expect(page).toHaveURL(URLS.);
    await expect(page.locator(`h2:has-text("${HEADINGS.HOSTED_FIELDS_TITLE}")`)).toBeVisible();
    const firstNameField = page.getByLabel(LABELS.FIRST_NAME);
    const lastNameField = page.getByLabel(LABELS.LAST_NAME);
    const shippingAddressField = page.getByTestId(SELECTORS.HOSTED_SHIPPING_ADDRESS_FIELD);
    const expiryMonthField = page.getByTestId(SELECTORS.EXPIRY_MONTH);
    const expiryYearField = page.getByTestId(SELECTORS.EXPIRY_YEAR);
    const submitButton = page.getByRole("button", { name: SELECTORS.HOSTED_SUBMIT_BUTTON });

    // Verify name fields and submit button are visible
    await expect(firstNameField).toBeVisible();
    await expect(lastNameField).toBeVisible();
    await expect(expiryMonthField).toBeVisible();
    await expect(expiryYearField).toBeVisible();
    await expect(submitButton).toBeVisible();
    // Wait for hosted fields iframes to load
    const cardNumberIframe = page.locator(SELECTORS.HOSTED_CARD_IFRAME);
    const cvvIframe = page.locator(SELECTORS.HOSTED_CVV_IFRAME);
    await expect(cardNumberIframe).toBeVisible();
    await expect(cvvIframe).toBeVisible();
    // Get frame locators for hosted fields
    const cardNumberFrame = page.frameLocator(SELECTORS.HOSTED_CARD_IFRAME);
    const cvvFrame = page.frameLocator(SELECTORS.HOSTED_CVV_IFRAME);
    // Wait for the hosted field inputs to be ready
    await expect(cardNumberFrame.getByRole("textbox", { name: LABELS.CARD_NUMBER })).toBeVisible();
    await expect(cvvFrame.getByRole("textbox", { name: LABELS.CVV_NUMBER })).toBeVisible();
    // Fill payment details but leave name fields blank intentionally
    // Leave first name and last name blank
    await firstNameField.fill(TEST_DATA.FIRST_NAME);
    await lastNameField.fill(TEST_DATA.LAST_NAME);
    await shippingAddressField.fill(TEST_DATA.SHIPPING_ADDRESS);
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).fill(TEST_DATA.INVALID_CARD_NUMBER);
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    await cvvFrame.getByTestId(SELECTORS.HOSTED_CVV_FIELD).fill(TEST_DATA.CVV);
    await expiryMonthField.fill(TEST_DATA.EXPIRY_MONTH);
    await expiryYearField.fill(getValidYearString());
    await submitButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);

    const invalidCardMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await expect(invalidCardMessage).toBeVisible();
    console.log(invalidCardMessage.textContent());
    await expect(invalidCardMessage).toContainText(ERROR_MESSAGES.HOSTED_FIELDS_INVALID_CARD_NUMBER);

    })

  test('shows validation for too-short card number in express checkout', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
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
    const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
    // Fill invalid card number and otherwise valid data
    await cardNumberField.fill(TEST_DATA.CARD_NUMBER_TOO_SHORT);
    await cvvField.fill(TEST_DATA.CVV);
    await monthField.fill(TEST_DATA.EXPIRY_MONTH);
    await yearField.fill(getValidYearString());
    await payButton.click();
    // Too short
    await cardNumberField.fill(TEST_DATA.CARD_NUMBER_TOO_SHORT);
    await payButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    await expect(cardNumberField).toHaveAttribute('aria-invalid', 'true');
    const cardNumberLengthIcon = iframe.locator(ERROR_SELECTORS.INVALID_CARD_NUMBER_ICON);
    await expect(cardNumberLengthIcon).toBeVisible();
    await expect(cardNumberLengthIcon).toHaveAttribute('aria-label', ERROR_MESSAGES.INVALID_CARD_NUMBER);
  });

  test('Shows validation for too short card number in hosted fields', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    const hostedFieldsButton = page.getByTestId(SELECTORS.HOSTED_FIELDS_BUTTON);
    await expect(hostedFieldsButton).toBeEnabled();
    await hostedFieldsButton.click();
    await expect(page.locator(`h2:has-text("${HEADINGS.HOSTED_FIELDS_TITLE}")`)).toBeVisible();
    const firstNameField = page.getByLabel(LABELS.FIRST_NAME);
    const lastNameField = page.getByLabel(LABELS.LAST_NAME);
    const shippingAddressField = page.getByTestId(SELECTORS.HOSTED_SHIPPING_ADDRESS_FIELD);
    const expiryMonthField = page.getByTestId(SELECTORS.EXPIRY_MONTH);
    const expiryYearField = page.getByTestId(SELECTORS.EXPIRY_YEAR);
    const submitButton = page.getByRole("button", { name: SELECTORS.HOSTED_SUBMIT_BUTTON });
    // Verify name fields and submit button are visible
    await expect(firstNameField).toBeVisible();
    await expect(lastNameField).toBeVisible();
    await expect(expiryMonthField).toBeVisible();
    await expect(expiryYearField).toBeVisible();
    await expect(submitButton).toBeVisible();
    // Wait for hosted fields iframes to load
    const cardNumberIframe = page.locator(SELECTORS.HOSTED_CARD_IFRAME);
    const cvvIframe = page.locator(SELECTORS.HOSTED_CVV_IFRAME);
    await expect(cardNumberIframe).toBeVisible();
    await expect(cvvIframe).toBeVisible();
    // Get frame locators for hosted fields
    const cardNumberFrame = page.frameLocator(SELECTORS.HOSTED_CARD_IFRAME);
    const cvvFrame = page.frameLocator(SELECTORS.HOSTED_CVV_IFRAME);
    // Wait for the hosted field inputs to be ready
    await expect(cardNumberFrame.getByRole("textbox", { name: LABELS.CARD_NUMBER })).toBeVisible();
    await expect(cvvFrame.getByRole("textbox", { name: LABELS.CVV_NUMBER })).toBeVisible();
    await firstNameField.fill(TEST_DATA.FIRST_NAME);
    await lastNameField.fill(TEST_DATA.LAST_NAME);
    await shippingAddressField.fill(TEST_DATA.SHIPPING_ADDRESS);
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).fill(TEST_DATA.CARD_NUMBER_TOO_SHORT);
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    await cvvFrame.getByTestId(SELECTORS.HOSTED_CVV_FIELD).fill(TEST_DATA.CVV);
    await expiryMonthField.fill(TEST_DATA.EXPIRY_MONTH);
    await expiryYearField.fill(getValidYearString());
    await submitButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    const invalidCardMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await expect(invalidCardMessage).toBeVisible();
    await expect(invalidCardMessage).toContainText(ERROR_MESSAGES.HOSTED_FIELDS_CARD_NUMBER_LENGTH);
  });

  test('CVV validation for express checkout', async ({ page }) => {
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
    const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
    await firstNameField.fill(TEST_DATA.FIRST_NAME);
    await lastNameField.fill(TEST_DATA.LAST_NAME);
    await cardNumberField.fill(TEST_DATA.CARD_NUMBER);
    await cvvField.fill(TEST_DATA.INVALID_CVV_LONG);
    await monthField.fill(TEST_DATA.EXPIRY_MONTH);
    await yearField.fill(getValidYearString());
    await payButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    const invalidCvvMessage = iframe.locator(ERROR_SELECTORS.INVALID_CVV_ICON);
    await expect(invalidCvvMessage).toBeVisible();
    console.log(invalidCvvMessage.textContent());
    await expect(invalidCvvMessage).toHaveAttribute('aria-label', ERROR_MESSAGES.INVALID_CVV);
    await cvvField.clear();
    await cvvField.fill(TEST_DATA.INVALID_CVV_SHORT);
    await payButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    await expect(invalidCvvMessage).toBeVisible();
    console.log(invalidCvvMessage.textContent());
    await expect(invalidCvvMessage).toHaveAttribute('aria-label', ERROR_MESSAGES.INVALID_CVV);
  });

  test('CVV validation for hosted fields', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    const hostedFieldsButton = page.getByTestId(SELECTORS.HOSTED_FIELDS_BUTTON);
    await expect(hostedFieldsButton).toBeEnabled();
    await hostedFieldsButton.click();
    await expect(page.locator(`h2:has-text("${HEADINGS.HOSTED_FIELDS_TITLE}")`)).toBeVisible();
    const firstNameField = page.getByLabel(LABELS.FIRST_NAME);
    const lastNameField = page.getByLabel(LABELS.LAST_NAME);
    const shippingAddressField = page.getByTestId(SELECTORS.HOSTED_SHIPPING_ADDRESS_FIELD);
    const expiryMonthField = page.getByTestId(SELECTORS.EXPIRY_MONTH);
    const expiryYearField = page.getByTestId(SELECTORS.EXPIRY_YEAR);
    const submitButton = page.getByRole("button", { name: SELECTORS.HOSTED_SUBMIT_BUTTON });
    // Verify name fields and submit button are visible
    await expect(firstNameField).toBeVisible();
    await expect(lastNameField).toBeVisible();
    await expect(expiryMonthField).toBeVisible();
    await expect(expiryYearField).toBeVisible();
    await expect(submitButton).toBeVisible();
    // Wait for hosted fields iframes to load
    const cardNumberIframe = page.locator(SELECTORS.HOSTED_CARD_IFRAME);
    const cvvIframe = page.locator(SELECTORS.HOSTED_CVV_IFRAME);
    await expect(cardNumberIframe).toBeVisible();
    await expect(cvvIframe).toBeVisible();
    // Get frame locators for hosted fields
    const cardNumberFrame = page.frameLocator(SELECTORS.HOSTED_CARD_IFRAME);
    const cvvFrame = page.frameLocator(SELECTORS.HOSTED_CVV_IFRAME);
    // Wait for the hosted field inputs to be ready
    await expect(cardNumberFrame.getByRole("textbox", { name: LABELS.CARD_NUMBER })).toBeVisible();
    await expect(cvvFrame.getByRole("textbox", { name: LABELS.CVV_NUMBER })).toBeVisible();
    await firstNameField.fill(TEST_DATA.FIRST_NAME);
    await lastNameField.fill(TEST_DATA.LAST_NAME);
    await shippingAddressField.fill(TEST_DATA.SHIPPING_ADDRESS);
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).fill(TEST_DATA.CARD_NUMBER);
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    await cvvFrame.getByTestId(SELECTORS.HOSTED_CVV_FIELD).fill(TEST_DATA.INVALID_CVV_LONG);
    await expiryMonthField.fill(TEST_DATA.EXPIRY_MONTH);
    await expiryYearField.fill(getValidYearString());
    await submitButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    const invalidCVVMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await expect(invalidCVVMessage).toBeVisible();
    await expect(invalidCVVMessage).toContainText(ERROR_MESSAGES.HOSTED_FIELDS_INVALID_CVV);
    await cvvFrame.getByTestId(SELECTORS.HOSTED_CVV_FIELD).clear();
    await cvvFrame.getByTestId(SELECTORS.HOSTED_CVV_FIELD).fill(TEST_DATA.INVALID_CVV_SHORT);
    await submitButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    await expect(invalidCVVMessage).toBeVisible();
    await expect(invalidCVVMessage).toContainText(ERROR_MESSAGES.HOSTED_FIELDS_INVALID_CVV);
    await cvvFrame.getByTestId(SELECTORS.HOSTED_CVV_FIELD).clear();
    await cvvFrame.getByTestId(SELECTORS.HOSTED_CVV_FIELD).fill(TEST_DATA.INVALID_CVV_SHORT);
    await submitButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    await expect(invalidCVVMessage).toBeVisible();
    await expect(invalidCVVMessage).toContainText(ERROR_MESSAGES.HOSTED_FIELDS_INVALID_CVV);
  });

  test('CVV validation for express checkout with AMEX', async ({ page }) => {
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
    const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
    await firstNameField.fill(TEST_DATA.FIRST_NAME);
    await lastNameField.fill(TEST_DATA.LAST_NAME);
    await cardNumberField.fill(TEST_DATA.AMEX_CARD_NUMBER);
    await cvvField.fill(TEST_DATA.CVV);
    await monthField.fill(TEST_DATA.EXPIRY_MONTH);
    await yearField.fill(getValidYearString());
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    const invalidCvvMessage = iframe.locator(ERROR_SELECTORS.AMEX_INVALID_CVV_ICON);
    await expect(invalidCvvMessage).not.toBeVisible();
    await cvvField.clear();
    await cvvField.fill(TEST_DATA.AMEX_CVV);
    let apiResponse: any = null;
    let responseStatus: number | null = null;
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
    await payButton.click();
    const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await tokenMessage.waitFor({ state: 'visible' });
    await expect(invalidCvvMessage).not.toBeVisible();
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);
    await expect(tokenMessage).toContainText('Token');
  });


  test('CVV validation for hosted fields with AMEX', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    const hostedFieldsButton = page.getByTestId(SELECTORS.HOSTED_FIELDS_BUTTON);
    await expect(hostedFieldsButton).toBeEnabled();
    await hostedFieldsButton.click();
    await expect(page.locator(`h2:has-text("${HEADINGS.HOSTED_FIELDS_TITLE}")`)).toBeVisible();
    const firstNameField = page.getByLabel(LABELS.FIRST_NAME);
    const lastNameField = page.getByLabel(LABELS.LAST_NAME);
    const expiryMonthField = page.getByTestId(SELECTORS.EXPIRY_MONTH);
    const shippingAddressField = page.getByTestId(SELECTORS.HOSTED_SHIPPING_ADDRESS_FIELD);
    const expiryYearField = page.getByTestId(SELECTORS.EXPIRY_YEAR);
    const submitButton = page.getByRole("button", { name: SELECTORS.HOSTED_SUBMIT_BUTTON });
    await expect(firstNameField).toBeVisible();
    await expect(lastNameField).toBeVisible();
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
    await firstNameField.fill(TEST_DATA.FIRST_NAME);
    await lastNameField.fill(TEST_DATA.LAST_NAME);
    await shippingAddressField.fill(TEST_DATA.SHIPPING_ADDRESS);
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).fill(TEST_DATA.AMEX_CARD_NUMBER);
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    await cvvFrame.getByTestId(SELECTORS.HOSTED_CVV_FIELD).fill(TEST_DATA.CVV);
    await expiryMonthField.fill(TEST_DATA.EXPIRY_MONTH);
    await expiryYearField.fill(getValidYearString());
    await submitButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    const invalidCVVMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await expect(invalidCVVMessage).toBeVisible();
    await expect(invalidCVVMessage).toContainText(ERROR_MESSAGES.HOSTED_FIELDS_AMEX_INVALID_CVV);
    await cvvFrame.getByTestId(SELECTORS.HOSTED_CVV_FIELD).clear();
    await cvvFrame.getByTestId(SELECTORS.HOSTED_CVV_FIELD).fill(TEST_DATA.AMEX_CVV);
    let apiResponse: any = null;
    let responseStatus: number | null = null;
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
    await submitButton.click();
    const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await tokenMessage.waitFor({ state: 'visible' });
    await expect(invalidCVVMessage).not.toContainText(ERROR_MESSAGES.HOSTED_FIELDS_AMEX_INVALID_CVV);
    expect(responseStatus).toBeDefined();
    expect([200, 204]).toContain(responseStatus);

    
    await expect(tokenMessage).toContainText('Token');
   }); 
});
