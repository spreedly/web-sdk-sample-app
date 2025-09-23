import { test, expect } from './fixtures';
import { SELECTORS, HEADINGS,waitForAuthParams, URLS, PLACEHOLDERS, TEST_DATA, getExpiredYearString, getValidYearString, ERROR_PATTERNS, ERROR_SELECTORS, ERROR_MESSAGES } from "./test-constants";

test.describe("Open Embedded Mode", () => {
test("opens express checkout in embedded mode when checkbox is checked", async ({ page }) => {
  // Check the 'Open in Embedded mode' option
  await page.goto(URLS.BASE);
  await waitForAuthParams(page);
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
  const embeddedIframe = page.locator(SELECTORS.EMBEDDED_IFRAME_CONTAINER);
  await expect(embeddedIframe).toBeVisible();
  // Sanity check: verify content inside the iframe is loaded
  const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
  await expect(iframe.locator(`h1:has-text("${HEADINGS.EXPRESS_TITLE}")`)).toBeVisible();
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
  await expect(firstNameField).toHaveValue(TEST_DATA.FIRST_NAME);
  await expect(lastNameField).toHaveValue(TEST_DATA.LAST_NAME);
  await expect(cardNumberField).toHaveValue(TEST_DATA.CARD_NUMBER_FORMATTED);
  await expect(cvvField).toHaveValue(TEST_DATA.CVV);
  await expect(monthField).toHaveValue(TEST_DATA.EXPIRY_MONTH);
  await expect(yearField).toHaveValue(getValidYearString());
});

test("Allow blank option in open in embedded mode", async ({ page }) => {
  // Check the 'Open in Embedded mode' option
  await page.goto(URLS.BASE);
  await waitForAuthParams(page);
  const openEmbeddedModeCheckbox = page.getByTestId(SELECTORS.OPEN_IN_EMBEDDED_MODE);
  await expect(openEmbeddedModeCheckbox).toBeVisible();
  await openEmbeddedModeCheckbox.check();
  await expect(openEmbeddedModeCheckbox).toBeChecked();
  const allowBlankNameCheckbox = page.getByTestId(SELECTORS.ALLOW_BLANK_NAME);
  await expect(allowBlankNameCheckbox).toBeVisible();
  await allowBlankNameCheckbox.check();
  await expect(allowBlankNameCheckbox).toBeChecked();
  const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
  await expect(expressButton).toBeEnabled();
  await expressButton.click();
  const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
  await expect(iframe.locator(`h1:has-text("${HEADINGS.EXPRESS_TITLE}")`)).toBeVisible();
  const firstNameField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_FIRST_NAME);
  const lastNameField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_LAST_NAME);
  const cardNumberField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER);
  const cvvField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_CVV}"]`);
  const monthField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_MONTH}"]`);
  const yearField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_YEAR}"]`);
  await expect(cardNumberField).toBeVisible();
  await expect(cvvField).toBeVisible();
  await expect(monthField).toBeVisible();
  await expect(yearField).toBeVisible();
  await cardNumberField.fill(TEST_DATA.CARD_NUMBER);
  await cvvField.fill(TEST_DATA.CVV);
  await monthField.fill(TEST_DATA.EXPIRED_MONTH);
  await yearField.fill(getValidYearString());
  await expect(cardNumberField).toHaveValue(TEST_DATA.CARD_NUMBER_FORMATTED);
  await expect(cvvField).toHaveValue(TEST_DATA.CVV);
  await expect(monthField).toHaveValue(TEST_DATA.EXPIRED_MONTH);
  await expect(yearField).toHaveValue(getValidYearString());
  await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
  const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
  await payButton.click();
  await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
  const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
  await tokenMessage.waitFor({ state: 'visible' });
  await expect(iframe.locator(ERROR_PATTERNS.REQUIRED)).not.toBeVisible();
  await expect(iframe.locator(ERROR_PATTERNS.NAME_REQUIRED)).not.toBeVisible();
  await expect(iframe.locator(ERROR_PATTERNS.FIRST_NAME_TEXT)).not.toBeVisible();
  await expect(iframe.locator(ERROR_PATTERNS.LAST_NAME_TEXT)).not.toBeVisible();
  // Verify the name fields still have their placeholder text and no error state
  await expect(firstNameField).toHaveAttribute('placeholder', PLACEHOLDERS.EXPRESS_FIRST_NAME);
  await expect(lastNameField).toHaveAttribute('placeholder', PLACEHOLDERS.EXPRESS_LAST_NAME);
  await expect(tokenMessage).toBeVisible();
  const messageText = await tokenMessage.textContent();
  expect(messageText).toMatch(/Token/);
  expect(messageText).not.toMatch(/Error|Failed|Invalid|Declined/);
  });

  test("Allow expiry date option in open in embedded mode", async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    const openEmbeddedModeCheckbox = page.getByTestId(SELECTORS.OPEN_IN_EMBEDDED_MODE);
    await expect(openEmbeddedModeCheckbox).toBeVisible();
    await openEmbeddedModeCheckbox.check();
    await expect(openEmbeddedModeCheckbox).toBeChecked();
    const allowExpiredDateCheckbox = page.getByTestId(SELECTORS.ALLOW_EXPIRED_DATE);
    await expect(allowExpiredDateCheckbox).toBeVisible();
    await allowExpiredDateCheckbox.check();
    await expect(allowExpiredDateCheckbox).toBeChecked();
    const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
    await expect(expressButton).toBeEnabled();
    await expressButton.click();
    const iframeLocator = page.locator(SELECTORS.EXPRESS_IFRAME);
    await expect(iframeLocator).toBeVisible();
    const embeddedIframe = page.locator(SELECTORS.EMBEDDED_IFRAME_CONTAINER);
    await expect(embeddedIframe).toBeVisible();
    const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
    await expect(iframe.locator(`h1:has-text("${HEADINGS.EXPRESS_TITLE}")`)).toBeVisible();
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
    await monthField.fill(TEST_DATA.EXPIRED_MONTH);
    await yearField.fill(getExpiredYearString());
    await expect(firstNameField).toHaveValue(TEST_DATA.FIRST_NAME);
    await expect(lastNameField).toHaveValue(TEST_DATA.LAST_NAME);
    await expect(cardNumberField).toHaveValue(TEST_DATA.CARD_NUMBER_FORMATTED);
    await expect(cvvField).toHaveValue(TEST_DATA.CVV);
    await expect(monthField).toHaveValue(TEST_DATA.EXPIRED_MONTH);
    await expect(yearField).toHaveValue(getExpiredYearString());
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
    await payButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await tokenMessage.waitFor({ state: 'visible' });
    await expect(iframe.locator(ERROR_PATTERNS.REQUIRED)).not.toBeVisible();
    await expect(iframe.locator(ERROR_PATTERNS.NAME_REQUIRED)).not.toBeVisible();
    await expect(iframe.locator(ERROR_PATTERNS.FIRST_NAME_TEXT)).not.toBeVisible();
    await expect(iframe.locator(ERROR_PATTERNS.LAST_NAME_TEXT)).not.toBeVisible();
    // Verify the name fields still have their placeholder text and no error state
    await expect(firstNameField).toHaveAttribute('placeholder', PLACEHOLDERS.EXPRESS_FIRST_NAME);
    await expect(lastNameField).toHaveAttribute('placeholder', PLACEHOLDERS.EXPRESS_LAST_NAME);
    await expect(tokenMessage).toBeVisible();
    const messageText = await tokenMessage.textContent();
    expect(messageText).toMatch(/Token/);
    expect(messageText).not.toMatch(/Error|Failed|Invalid|Declined/);
  });

  test('cvv and card number validations in embedded mode', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    const openEmbeddedModeCheckbox = page.getByTestId(SELECTORS.OPEN_IN_EMBEDDED_MODE);
    await expect(openEmbeddedModeCheckbox).toBeVisible();
    await openEmbeddedModeCheckbox.check();
    await expect(openEmbeddedModeCheckbox).toBeChecked();
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
    await cardNumberField.fill(TEST_DATA.CARD_NUMBER_TOO_SHORT);
    await payButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    const cardNumberLengthIcon = iframe.locator(ERROR_SELECTORS.CARD_NUMBER_LENGTH_ICON);
    await expect(cardNumberLengthIcon).toBeVisible();
    await expect(cardNumberLengthIcon).toHaveAttribute('aria-label', ERROR_MESSAGES.CARD_NUMBER_LENGTH);
    await cardNumberField.fill(TEST_DATA.CARD_NUMBER);
    await cvvField.fill(TEST_DATA.INVALID_CVV_LONG);
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
  test('Embbeded mode AMEX card cvv validations', async ({ page }) => {
    await page.goto(URLS.BASE);
    await waitForAuthParams(page);
    const openEmbeddedModeCheckbox = page.getByTestId(SELECTORS.OPEN_IN_EMBEDDED_MODE);
    await expect(openEmbeddedModeCheckbox).toBeVisible();
    await openEmbeddedModeCheckbox.check();
    await expect(openEmbeddedModeCheckbox).toBeChecked();
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
    await payButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    const invalidCvvMessage = iframe.locator(ERROR_SELECTORS.AMEX_INVALID_CVV_ICON);
    await expect(invalidCvvMessage).toBeVisible();
    console.log(invalidCvvMessage.textContent());
    await expect(invalidCvvMessage).toHaveAttribute('aria-label', ERROR_MESSAGES.AMEX_INVALID_CVV);
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
});