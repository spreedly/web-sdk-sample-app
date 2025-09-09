import { test, expect } from './fixtures';
import {
  // URLS,
  SELECTORS,
  PLACEHOLDERS,
  LABELS,
  TEST_DATA,
  HEADINGS,
  ERROR_SELECTORS,
  ERROR_MESSAGES,
  getValidTwoDigitYear,
  getExpiredYear,
} from "./test-constants";

test.describe("Two Digit Expiry Option", () => {
  test("should use MM/YY format in express checkout when two digit expiry is enabled", async ({
    page,
  }) => {
    // Enable the "two digit expiry" option
    const twoDigitExpiryCheckbox = page.getByTestId(SELECTORS.TWO_DIGIT_EXPIRY);
    await expect(twoDigitExpiryCheckbox).toBeVisible();
    await twoDigitExpiryCheckbox.check();
    await expect(twoDigitExpiryCheckbox).toBeChecked();

    // Click on express checkout button
    const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
    await expect(expressButton).toBeEnabled();
    await expressButton.click();

    // Wait for the payment iframe to load
    const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
    await expect(page.locator(SELECTORS.EXPRESS_IFRAME)).toBeVisible();

    // Verify the payment form is loaded
    const payWithCardTitle = iframe.locator(`h1:has-text("${HEADINGS.EXPRESS_TITLE}")`);
    await expect(payWithCardTitle).toBeVisible();

    // Check for MM/YY format field instead of separate month/year fields
    const mmyyField = iframe.locator('input[placeholder*="MM/YY"], input[placeholder*="MM / YY"], input[placeholder*="mm/yy"]');
    const monthField = iframe.locator('input[placeholder="MM"]');
    const yearField = iframe.locator('input[placeholder="YYYY"]');

    // Verify MM/YY field is present when two digit expiry is enabled
    await expect(mmyyField).toBeVisible();
    
    // Verify separate month/year fields are not present
    await expect(monthField).not.toBeVisible();
    await expect(yearField).not.toBeVisible();

    // Fill out the form with valid data
    await iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_FIRST_NAME).fill(TEST_DATA.FIRST_NAME);
    await iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_LAST_NAME).fill(TEST_DATA.LAST_NAME);
    await iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER).fill(TEST_DATA.CARD_NUMBER);
    await iframe.locator('input[placeholder="123"]').fill(TEST_DATA.CVV);
    await page.waitForTimeout(5000);
    // Fill MM/YY field with valid two digit year format
    const validMmyyValue = `${TEST_DATA.EXPIRY_MONTH}/${getValidTwoDigitYear()}`;
    await mmyyField.fill(validMmyyValue);
    // Verify the field accepts the MM/YY format
    await expect(mmyyField).toHaveValue(validMmyyValue);
    // Verify the Pay button is visible and enabled
    //const payButton = iframe.locator(SELECTORS.EXPRESS_PAY_BUTTON);
    const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
    await payButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    await expect(iframe.locator(ERROR_SELECTORS.CARD_EXPIRED_ICON)).not.toBeVisible();
  });

  test("should use MM/YY format in hosted fields when two digit expiry is enabled", async ({
    page,
  }) => {
     // Click on hosted fields button
    const hostedFieldsButton = page.getByTestId(SELECTORS.HOSTED_FIELDS_BUTTON);
    await expect(hostedFieldsButton).toBeEnabled();
    await hostedFieldsButton.click();
    // await expect(page).toHaveURL(URLS.HOSTED_FIELDS);

    // Enable the "two digit expiry" option
    const twoDigitExpiryCheckbox = page.getByTestId(SELECTORS.TWO_DIGIT_EXPIRY);
    await expect(twoDigitExpiryCheckbox).toBeVisible();
    await twoDigitExpiryCheckbox.check();
    await expect(twoDigitExpiryCheckbox).toBeChecked();

    // Check expiry field configuration
    const mmyyField = page.locator(SELECTORS.EXPIRY_MM_YY);
    const monthField = page.getByTestId(SELECTORS.EXPIRY_MONTH);
    const yearField = page.getByTestId(SELECTORS.EXPIRY_YEAR);
    const submitButton = page.getByRole("button", { name: SELECTORS.HOSTED_SUBMIT_BUTTON });

    // Verify MM/YY field is visible and enabled when two digit expiry is enabled
    await expect(mmyyField).toBeVisible();
    await expect(mmyyField).toBeEnabled();
    await expect(mmyyField).toHaveAttribute('required');
    await expect(mmyyField).toHaveAttribute('placeholder', 'MM/YY');
    await expect(mmyyField).toHaveAttribute('maxlength', '5');
    
    // Verify separate month/year fields are not visible
    await expect(monthField).not.toBeVisible();
    await expect(yearField).not.toBeVisible();
    
    // Fill out the form with valid data
    await page.getByLabel(LABELS.FIRST_NAME).fill(TEST_DATA.FIRST_NAME);
    await page.getByLabel(LABELS.LAST_NAME).fill(TEST_DATA.LAST_NAME);

    // Fill card number and CVV in iframes
    const cardNumberFrame = page.frameLocator(SELECTORS.HOSTED_CARD_IFRAME);
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).fill(TEST_DATA.CARD_NUMBER);

    const cvvFrame = page.frameLocator(SELECTORS.HOSTED_CVV_IFRAME);
    await cvvFrame.getByTestId(SELECTORS.HOSTED_CVV_FIELD).fill(TEST_DATA.CVV);

    // Fill MM/YY field with valid two digit year format
    const validMmyyValue = `${TEST_DATA.EXPIRY_MONTH}/${getValidTwoDigitYear()}`;
    await mmyyField.fill(validMmyyValue);
    // Verify the field accepts the MM/YY format
    await expect(mmyyField).toHaveValue(validMmyyValue);
    // Test with expired year to trigger validation
    await mmyyField.clear();
    const expiredTwoDigitYear = getExpiredYear().toString().slice(-2);
    await mmyyField.fill(`12/${expiredTwoDigitYear}`);
    
    await submitButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    
    // Verify "Card has expired" message appears
    const cardExpiredMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await expect(cardExpiredMessage).toBeVisible();
    await expect(cardExpiredMessage).toHaveText(ERROR_MESSAGES.CARD_EXPIRED);
  });

  test("should show validation error for invalid date in express checkout with two digit expiry", async ({
    page,
  }) => {
    // Enable the "two digit expiry" option
    const twoDigitExpiryCheckbox = page.getByTestId(SELECTORS.TWO_DIGIT_EXPIRY);
    await twoDigitExpiryCheckbox.check();

    // Click on express checkout button
    const expressButton = page.getByTestId(SELECTORS.EXPRESS_BUTTON);
    await expressButton.click();

    // Wait for the payment iframe to load
    const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
    await expect(page.locator(SELECTORS.EXPRESS_IFRAME)).toBeVisible();

    // Get the MM/YY field
    const mmyyField = iframe.locator('input[placeholder*="MM/YY"], input[placeholder*="MM / YY"], input[placeholder*="mm/yy"]');
    await expect(mmyyField).toBeVisible();

    // Fill out other required fields first
    await iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_FIRST_NAME).fill(TEST_DATA.FIRST_NAME);
    await iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_LAST_NAME).fill(TEST_DATA.LAST_NAME);
    await iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER).fill(TEST_DATA.CARD_NUMBER);
    await iframe.locator('input[placeholder="123"]').fill(TEST_DATA.CVV);

    // Test invalid month (13) - should trigger invalid month error
    await mmyyField.fill(`13/${getValidTwoDigitYear()}`);
    await expect(mmyyField).toHaveValue(`13/${getValidTwoDigitYear()}`);
    
    //const payButton = iframe.locator(SELECTORS.EXPRESS_PAY_BUTTON);
    const payButton = iframe.getByTestId(SELECTORS.EXPRESS_SUBMIT_BUTTON);
    await payButton.click();
    await page.waitForTimeout(2000);
    
    // Verify SVG error icon for invalid month (13)
    const invalidMonth13Icon = iframe.locator(ERROR_SELECTORS.INVALID_MONTH_ICON);
    await expect(invalidMonth13Icon).toBeVisible();
    await expect(invalidMonth13Icon).toHaveAttribute('aria-label', ERROR_MESSAGES.INVALID_MONTH);
    await expect(invalidMonth13Icon).toHaveClass(/MuiSvgIcon-colorError/);
    
    // Test invalid month (00) - should also trigger invalid month error
    await mmyyField.clear();
    await mmyyField.fill(`00/${getValidTwoDigitYear()}`);
    await expect(mmyyField).toHaveValue(`00/${getValidTwoDigitYear()}`);
    
    await payButton.click();
    await page.waitForTimeout(2000);
    
    // Verify SVG error icon for invalid month (00)
    const invalidMonth00Icon = iframe.locator(ERROR_SELECTORS.INVALID_MONTH_ICON);
    await expect(invalidMonth00Icon).toBeVisible();
    await expect(invalidMonth00Icon).toHaveAttribute('aria-label', ERROR_MESSAGES.INVALID_MONTH);
    await expect(invalidMonth00Icon).toHaveClass(/MuiSvgIcon-colorError/);

    // Test with expired year (past year) - should trigger expired card error
    const expiredTwoDigitYear = getExpiredYear().toString().slice(-2);
    await mmyyField.clear();
    await mmyyField.fill(`12/${expiredTwoDigitYear}`);
    await expect(mmyyField).toHaveValue(`12/${expiredTwoDigitYear}`);

    // Try to click Pay button to trigger validation
    await payButton.click();

    // Wait for error to appear and verify SVG error icon is visible for expired card
    await page.waitForTimeout(2000);
    const cardExpiredIcon = iframe.locator(ERROR_SELECTORS.CARD_EXPIRED_ICON);
    await expect(cardExpiredIcon).toBeVisible();
    await expect(cardExpiredIcon).toHaveAttribute('aria-label', ERROR_MESSAGES.CARD_EXPIRED);
    await expect(cardExpiredIcon).toHaveClass(/MuiSvgIcon-colorError/);


  });

  test("should show validation error for invalid date in hosted fields with two digit expiry", async ({
    page,
  }) => {
    // Click on hosted fields button
    const hostedFieldsButton = page.getByTestId(SELECTORS.HOSTED_FIELDS_BUTTON);
    await hostedFieldsButton.click();
    // await expect(page).toHaveURL(URLS.HOSTED_FIELDS);

    // Enable the "two digit expiry" option
    const twoDigitExpiryCheckbox = page.getByTestId(SELECTORS.TWO_DIGIT_EXPIRY);
    await twoDigitExpiryCheckbox.check();

    // Get the MM/YY field
    const mmyyField = page.getByTestId(SELECTORS.EXPIRY_MM_YY);
    await expect(mmyyField).toBeVisible();
    await expect(mmyyField).toBeEnabled();

    // Fill out other required fields first
    await page.getByLabel(LABELS.FIRST_NAME).fill(TEST_DATA.FIRST_NAME);
    await page.getByLabel(LABELS.LAST_NAME).fill(TEST_DATA.LAST_NAME);

    // Fill card number and CVV in iframes
    const cardNumberFrame = page.frameLocator(SELECTORS.HOSTED_CARD_IFRAME);
    await cardNumberFrame.getByTestId(SELECTORS.HOSTED_NUMBER_FIELD).fill(TEST_DATA.CARD_NUMBER);

    const cvvFrame = page.frameLocator(SELECTORS.HOSTED_CVV_IFRAME);
    await cvvFrame.getByTestId(SELECTORS.HOSTED_CVV_FIELD).fill(TEST_DATA.CVV);

    const submitButton = page.getByRole("button", { name: SELECTORS.HOSTED_SUBMIT_BUTTON });
    const tokenMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);

    // Test invalid month (13) - should trigger invalid month error
    await mmyyField.fill(`13/${getValidTwoDigitYear()}`);
    await expect(mmyyField).toHaveValue(`13/${getValidTwoDigitYear()}`);
    
    await submitButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    
    // Verify validation error message for invalid month (13)
    await expect(tokenMessage).toBeVisible();
    await expect(tokenMessage).toHaveText(ERROR_MESSAGES.INVALID_MONTH);
    await expect(tokenMessage).toHaveClass(/auth-title/);
    
    // Test invalid month (00) - should also trigger invalid month error
    await mmyyField.clear();
    await mmyyField.fill(`00/${getValidTwoDigitYear()}`);
    await expect(mmyyField).toHaveValue(`00/${getValidTwoDigitYear()}`);
    
    await submitButton.click();
    await page.waitForTimeout(2000);
    
    // Verify validation error message for invalid month (00)
    await expect(tokenMessage).toBeVisible();
    await expect(tokenMessage).toHaveText(ERROR_MESSAGES.INVALID_MONTH);
    await expect(tokenMessage).toHaveClass(/auth-title/);

    // Test expired year (past year) - should trigger expired card error
    const expiredTwoDigitYear = getExpiredYear().toString().slice(-2);
    await mmyyField.clear();
    await mmyyField.fill(`12/${expiredTwoDigitYear}`);
    await expect(mmyyField).toHaveValue(`12/${expiredTwoDigitYear}`);

    await submitButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    
    // Verify validation error message for expired card
    await expect(tokenMessage).toBeVisible();
    await expect(tokenMessage).toHaveText(ERROR_MESSAGES.CARD_EXPIRED);
    await expect(tokenMessage).toHaveClass(/auth-title/);

    // Test with valid date to ensure error clears
    await mmyyField.clear();
    await mmyyField.fill(`12/${getValidTwoDigitYear()}`);
    await expect(mmyyField).toHaveValue(`12/${getValidTwoDigitYear()}`);
    
    await submitButton.click();
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    
    // Verify that error message is not showing invalid month or expired card error
    if (await tokenMessage.isVisible()) {
      const messageText = await tokenMessage.textContent();
      expect(messageText).not.toBe(ERROR_MESSAGES.INVALID_MONTH);
      expect(messageText).not.toBe(ERROR_MESSAGES.CARD_EXPIRED);
    }
  });
});


