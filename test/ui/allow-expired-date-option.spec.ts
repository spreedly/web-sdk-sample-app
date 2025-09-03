import { test, expect } from "@playwright/test";
import {
  URLS,
  API_ENDPOINTS,
  SELECTORS,
  PLACEHOLDERS,
  LABELS,
  TEST_DATA,
  HEADINGS,
  ERROR_PATTERNS,
  ERROR_MESSAGES,
  CSS_PROPERTIES,
  getExpiredYearString,
} from "./test-constants";

test.describe("Allow Expired Date Option", () => {
  test("should allow expired date in express checkout when option is enabled", async ({
    page,
  }) => {
    // Navigate to the main page
    await page.goto(URLS.BASE);

    // Wait for auth params to be loaded
    await page.waitForResponse(
      (response) =>
        response.url().includes(API_ENDPOINTS.AUTH_PARAMS) &&
        response.status() === 200
    );

    // Enable the "allow expired date" option
    const allowExpiredDateCheckbox = page.locator(SELECTORS.ALLOW_EXPIRED_DATE);
    await expect(allowExpiredDateCheckbox).toBeVisible();
    await allowExpiredDateCheckbox.check();
    await expect(allowExpiredDateCheckbox).toBeChecked();

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

    // Verify all form fields are visible
    const firstNameField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_FIRST_NAME);
    const lastNameField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_LAST_NAME);
    const cardNumberField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER);
    const cvvField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_CVV}"]`);
    const monthField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_MONTH}"]`);
    const yearField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_YEAR}"]`);
    const payButton = iframe.locator(SELECTORS.EXPRESS_PAY_BUTTON);

    await expect(firstNameField).toBeVisible();
    await expect(lastNameField).toBeVisible();
    await expect(cardNumberField).toBeVisible();
    await expect(cvvField).toBeVisible();
    await expect(monthField).toBeVisible();
    await expect(yearField).toBeVisible();
    await expect(payButton).toBeVisible();

    // Fill payment details with expired date
    await firstNameField.fill(TEST_DATA.FIRST_NAME);
    await lastNameField.fill(TEST_DATA.LAST_NAME);
    await cardNumberField.fill(TEST_DATA.CARD_NUMBER);
    await cvvField.fill(TEST_DATA.CVV);
    await monthField.fill(TEST_DATA.EXPIRED_MONTH);
    await yearField.fill(getExpiredYearString()); // Use expired year

    // Verify fields are filled with expired date
    await expect(firstNameField).toHaveValue(TEST_DATA.FIRST_NAME);
    await expect(lastNameField).toHaveValue(TEST_DATA.LAST_NAME);
    await expect(cardNumberField).toHaveValue(TEST_DATA.CARD_NUMBER_FORMATTED);
    await expect(cvvField).toHaveValue(TEST_DATA.CVV);
    await expect(monthField).toHaveValue(TEST_DATA.EXPIRED_MONTH);
    await expect(yearField).toHaveValue(getExpiredYearString());
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    // Click the pay button
    await payButton.click();
    // Wait a moment for any potential validation to occur
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    // Verify there are no warning messages or error states for expired date
    // Check that no error styling or validation messages appear
    const monthContainer = monthField.locator('..');
    const yearContainer = yearField.locator('..');
    // Verify no error classes are applied to date fields
    await expect(monthContainer).not.toHaveClass(ERROR_PATTERNS.ERROR_CLASSES);
    await expect(yearContainer).not.toHaveClass(ERROR_PATTERNS.ERROR_CLASSES);
    
    // Verify no validation error messages are visible for expired date
    await expect(iframe.locator('text=*expired*')).not.toBeVisible();
    await expect(iframe.locator('text=*invalid*date*')).not.toBeVisible();
    await expect(iframe.locator('text=*expir*')).not.toBeVisible();
    
    // Verify the fields don't have red borders or error styling
    await expect(monthField).not.toHaveCSS('border-color', CSS_PROPERTIES.RED_BORDER);
    await expect(yearField).not.toHaveCSS('border-color', CSS_PROPERTIES.RED_BORDER);
  });

  test("should show warning in express checkout when expired date option is disabled", async ({
    page,
  }) => {
    // Navigate to the main page
    await page.goto(URLS.BASE);

    // Wait for auth params to be loaded
    await page.waitForResponse(
      (response) =>
        response.url().includes(API_ENDPOINTS.AUTH_PARAMS) &&
        response.status() === 200
    );

    // Ensure the "allow expired date" option is unchecked (default state)
    const allowExpiredDateCheckbox = page.locator(SELECTORS.ALLOW_EXPIRED_DATE);
    await expect(allowExpiredDateCheckbox).toBeVisible();
    await expect(allowExpiredDateCheckbox).not.toBeChecked();

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

    // Verify all form fields are visible
    const firstNameField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_FIRST_NAME);
    const lastNameField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_LAST_NAME);
    const cardNumberField = iframe.getByPlaceholder(PLACEHOLDERS.EXPRESS_CARD_NUMBER);
    const cvvField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_CVV}"]`);
    const monthField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_MONTH}"]`);
    const yearField = iframe.locator(`input[placeholder="${PLACEHOLDERS.EXPRESS_YEAR}"]`);
    const payButton = iframe.locator(SELECTORS.EXPRESS_PAY_BUTTON);

    await expect(firstNameField).toBeVisible();
    await expect(lastNameField).toBeVisible();
    await expect(cardNumberField).toBeVisible();
    await expect(cvvField).toBeVisible();
    await expect(monthField).toBeVisible();
    await expect(yearField).toBeVisible();
    await expect(payButton).toBeVisible();

    // Fill payment details with expired date
    await firstNameField.fill(TEST_DATA.FIRST_NAME);
    await lastNameField.fill(TEST_DATA.LAST_NAME);
    await cardNumberField.fill(TEST_DATA.CARD_NUMBER);
    await cvvField.fill(TEST_DATA.CVV);
    await monthField.fill(TEST_DATA.EXPIRED_MONTH);
    await yearField.fill(getExpiredYearString()); // Use expired year

    // Verify fields are filled with expired date
    await expect(firstNameField).toHaveValue(TEST_DATA.FIRST_NAME);
    await expect(lastNameField).toHaveValue(TEST_DATA.LAST_NAME);
    await expect(cardNumberField).toHaveValue(TEST_DATA.CARD_NUMBER_FORMATTED);
    await expect(cvvField).toHaveValue(TEST_DATA.CVV);
    await expect(monthField).toHaveValue(TEST_DATA.EXPIRED_MONTH);
    await expect(yearField).toHaveValue(getExpiredYearString());
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    // Click the pay button
    await payButton.click();
    // Wait a moment for any potential validation to occur
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    
    // Validate that expired date validation is triggered
    // The system shows "Card has expired" error messages for expired dates
    // There should be 2 error icons (one for month, one for year) since both are expired
    await expect(iframe.locator(`[aria-label="${ERROR_MESSAGES.CARD_EXPIRED}"]`)).toHaveCount(2)
    await expect(iframe.locator(`[aria-label="${ERROR_MESSAGES.CARD_EXPIRED}"]`).first()).toBeVisible()
    
    // Validate that the expiry month and year fields are marked as invalid
    // Material-UI uses aria-invalid attribute instead of error CSS classes
    const expiryMonthInput = monthField;
    const expiryYearInput = yearField;
    
    await expect(expiryMonthInput).toHaveAttribute('aria-invalid', 'true');
    await expect(expiryYearInput).toHaveAttribute('aria-invalid', 'true');
    
  });

  test("should allow expired date in hosted fields when option is enabled", async ({
    page,
  }) => {
    // Navigate to the main page
    await page.goto(URLS.BASE);

    // Wait for auth params to be loaded
    await page.waitForResponse(
      (response) =>
        response.url().includes(API_ENDPOINTS.AUTH_PARAMS) &&
        response.status() === 200
    );

    // Click on hosted fields button first
    const hostedFieldsButton = page.getByTestId(SELECTORS.HOSTED_FIELDS_BUTTON);
    await expect(hostedFieldsButton).toBeEnabled();
    await hostedFieldsButton.click();

    // Verify we're on the hosted fields page
    await expect(page).toHaveURL(URLS.HOSTED_FIELDS);
    await expect(page.locator(`h2:has-text("${HEADINGS.HOSTED_FIELDS_TITLE}")`)).toBeVisible();

    // Now enable the "allow expired date" option on the hosted fields page
    const allowExpiredDateCheckbox = page.locator(SELECTORS.ALLOW_EXPIRED_DATE);
    await expect(allowExpiredDateCheckbox).toBeVisible();
    await allowExpiredDateCheckbox.check();
    await expect(allowExpiredDateCheckbox).toBeChecked();

    // Verify form sections are visible
    await expect(page.locator(`h3:has-text("${HEADINGS.PERSONAL_INFO}")`)).toBeVisible();
    await expect(page.locator(`h3:has-text("${HEADINGS.PAYMENT_DETAILS}")`)).toBeVisible();

    // Get the form fields
    const firstNameField = page.getByLabel(LABELS.FIRST_NAME);
    const lastNameField = page.getByLabel(LABELS.LAST_NAME);
    const expiryMonthField = page.locator(SELECTORS.EXPIRY_MONTH);
    const expiryYearField = page.locator(SELECTORS.EXPIRY_YEAR);
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

    // Fill payment details with expired date
    await firstNameField.fill(TEST_DATA.FIRST_NAME);
    await lastNameField.fill(TEST_DATA.LAST_NAME);
    await cardNumberFrame.locator(SELECTORS.HOSTED_CARD_INPUT).fill(TEST_DATA.CARD_NUMBER);
    await cvvFrame.locator(SELECTORS.HOSTED_CVV_INPUT).fill(TEST_DATA.CVV);
    await expiryMonthField.fill(TEST_DATA.EXPIRED_MONTH);
    await expiryYearField.fill(getExpiredYearString()); // Use expired year

    // Verify all fields are filled with expired date
    await expect(firstNameField).toHaveValue(TEST_DATA.FIRST_NAME);
    await expect(lastNameField).toHaveValue(TEST_DATA.LAST_NAME);
    await expect(cardNumberFrame.getByRole("textbox", { name: LABELS.CARD_NUMBER })).toHaveValue(/4111/);
    await expect(cvvFrame.getByRole("textbox", { name: LABELS.CVV_NUMBER })).toHaveValue(TEST_DATA.CVV);
    await expect(expiryMonthField).toHaveValue(TEST_DATA.EXPIRED_MONTH);
    await expect(expiryYearField).toHaveValue(getExpiredYearString());

    // Wait before clicking submit
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);

    // Click the submit payment button
    await submitButton.click();

    // Wait for any potential validation to occur
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    // Verify there are no warning messages or error states for expired date
    // Check that no error styling or validation messages appear
    const monthContainer = expiryMonthField.locator('..');
    const yearContainer = expiryYearField.locator('..');
    
    // Verify no error classes are applied to date fields
    await expect(monthContainer).not.toHaveClass(ERROR_PATTERNS.ERROR_CLASSES);
    await expect(yearContainer).not.toHaveClass(ERROR_PATTERNS.ERROR_CLASSES);
    
    // Verify no validation error messages are visible for expired date
    await expect(page.locator('text=*expired*')).not.toBeVisible();
    await expect(page.locator('text=*invalid*date*')).not.toBeVisible();
    await expect(page.locator('text=*expir*')).not.toBeVisible();
    
    // Verify the fields don't have red borders or error styling
    await expect(expiryMonthField).not.toHaveCSS('border-color', CSS_PROPERTIES.RED_BORDER);
    await expect(expiryYearField).not.toHaveCSS('border-color', CSS_PROPERTIES.RED_BORDER);
  });

  test("should show warning in hosted fields when expired date option is disabled", async ({
    page,
  }) => {
    // Navigate to the main page
    await page.goto(URLS.BASE);

    // Wait for auth params to be loaded
    await page.waitForResponse(
      (response) =>
        response.url().includes(API_ENDPOINTS.AUTH_PARAMS) &&
        response.status() === 200
    );

    // Click on hosted fields button first
    const hostedFieldsButton = page.getByTestId(SELECTORS.HOSTED_FIELDS_BUTTON);
    await expect(hostedFieldsButton).toBeEnabled();
    await hostedFieldsButton.click();

    // Verify we're on the hosted fields page
    await expect(page).toHaveURL(URLS.HOSTED_FIELDS);
    await expect(page.locator(`h2:has-text("${HEADINGS.HOSTED_FIELDS_TITLE}")`)).toBeVisible();

    // Ensure the "allow expired date" option is unchecked (default state)
    const allowExpiredDateCheckbox = page.locator(SELECTORS.ALLOW_EXPIRED_DATE);
    await expect(allowExpiredDateCheckbox).toBeVisible();
    await expect(allowExpiredDateCheckbox).not.toBeChecked();

    // Verify form sections are visible
    await expect(page.locator(`h3:has-text("${HEADINGS.PERSONAL_INFO}")`)).toBeVisible();
    await expect(page.locator(`h3:has-text("${HEADINGS.PAYMENT_DETAILS}")`)).toBeVisible();

    // Get the form fields
    const firstNameField = page.getByLabel(LABELS.FIRST_NAME);
    const lastNameField = page.getByLabel(LABELS.LAST_NAME);
    const expiryMonthField = page.locator(SELECTORS.EXPIRY_MONTH);
    const expiryYearField = page.locator(SELECTORS.EXPIRY_YEAR);
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

    // Fill payment details with expired date
    await firstNameField.fill(TEST_DATA.FIRST_NAME);
    await lastNameField.fill(TEST_DATA.LAST_NAME);
    await cardNumberFrame.locator(SELECTORS.HOSTED_CARD_INPUT).fill(TEST_DATA.CARD_NUMBER);
    await cvvFrame.locator(SELECTORS.HOSTED_CVV_INPUT).fill(TEST_DATA.CVV);
    await expiryMonthField.fill(TEST_DATA.EXPIRED_MONTH);
    await expiryYearField.fill(getExpiredYearString()); // Use expired year

    // Verify all fields are filled with expired date
    await expect(firstNameField).toHaveValue(TEST_DATA.FIRST_NAME);
    await expect(lastNameField).toHaveValue(TEST_DATA.LAST_NAME);
    await expect(cardNumberFrame.getByRole("textbox", { name: LABELS.CARD_NUMBER })).toHaveValue(/4111/);
    await expect(cvvFrame.getByRole("textbox", { name: LABELS.CVV_NUMBER })).toHaveValue(TEST_DATA.CVV);
    await expect(expiryMonthField).toHaveValue(TEST_DATA.EXPIRED_MONTH);
    await expect(expiryYearField).toHaveValue(getExpiredYearString());

    // Wait before clicking submit
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);

    // Click the submit payment button
    await submitButton.click();

    // Wait for any potential validation to occur
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    // Verify that validation errors or warnings appear for expired date
    // Check for the specific "Card has expired" message that appears in hosted fields
    const expiredCardMessage = page.locator(SELECTORS.TOKEN_CONTAINER_MESSAGE);
    await expect(expiredCardMessage).toBeVisible();
    await expect(expiredCardMessage).toHaveText(ERROR_MESSAGES.CARD_EXPIRED);
  });
});
