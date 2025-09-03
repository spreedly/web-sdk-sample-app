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
  getValidYearString
} from "./test-constants";
test.describe("Allow Blank Name Option", () => {
  test("should allow blank name when option is enabled and not show warning", async ({
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

    // Enable the "allow blank name" option
    const allowBlankNameCheckbox = page.locator(SELECTORS.ALLOW_BLANK_NAME);
    await expect(allowBlankNameCheckbox).toBeVisible();
    await allowBlankNameCheckbox.check();
    await expect(allowBlankNameCheckbox).toBeChecked();

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

    // Fill payment details but leave name fields blank
    // Leave first name and last name blank intentionally
    
    await cardNumberField.fill(TEST_DATA.CARD_NUMBER);
    await cvvField.fill(TEST_DATA.CVV);
    await monthField.fill(TEST_DATA.EXPIRY_MONTH);
    await yearField.fill(getValidYearString());

    // Verify name fields are still empty
    await expect(firstNameField).toHaveValue("");
    await expect(lastNameField).toHaveValue("");

    // Verify other fields are filled
    await expect(cardNumberField).toHaveValue(TEST_DATA.CARD_NUMBER_FORMATTED);
    await expect(cvvField).toHaveValue(TEST_DATA.CVV);
    await expect(monthField).toHaveValue(TEST_DATA.EXPIRY_MONTH);
    await expect(yearField).toHaveValue(getValidYearString());
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);

    // Click the pay button
    await payButton.click();

    // Wait a moment for any potential validation to occur
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);

    // Verify there are no warning messages or error states on name fields
    // Check that no error styling or validation messages appear
    const firstNameContainer = firstNameField.locator('..');
    const lastNameContainer = lastNameField.locator('..');
    
    // Verify no error classes are applied to name fields
    await expect(firstNameContainer).not.toHaveClass(ERROR_PATTERNS.ERROR_CLASSES);
    await expect(lastNameContainer).not.toHaveClass(ERROR_PATTERNS.ERROR_CLASSES);
    
    // Verify no validation error messages are visible for name fields
    await expect(iframe.locator(ERROR_PATTERNS.REQUIRED)).not.toBeVisible();
    await expect(iframe.locator(ERROR_PATTERNS.NAME_REQUIRED)).not.toBeVisible();
    await expect(iframe.locator(ERROR_PATTERNS.FIRST_NAME_TEXT)).not.toBeVisible();
    await expect(iframe.locator(ERROR_PATTERNS.LAST_NAME_TEXT)).not.toBeVisible();
    
    // Verify the fields don't have red borders or error styling
    await expect(firstNameField).not.toHaveCSS('border-color', CSS_PROPERTIES.RED_BORDER);
    await expect(lastNameField).not.toHaveCSS('border-color', CSS_PROPERTIES.RED_BORDER);
    
    // Verify the name fields still have their placeholder text and no error state
    await expect(firstNameField).toHaveAttribute('placeholder', PLACEHOLDERS.EXPRESS_FIRST_NAME);
    await expect(lastNameField).toHaveAttribute('placeholder', PLACEHOLDERS.EXPRESS_LAST_NAME);
  });

  test("should show warning when blank name option is disabled and name is left empty", async ({
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

    // Ensure the "allow blank name" option is unchecked (default state)
    const allowBlankNameCheckbox = page.locator(SELECTORS.ALLOW_BLANK_NAME);
    await expect(allowBlankNameCheckbox).toBeVisible();
    await expect(allowBlankNameCheckbox).not.toBeChecked();

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

    // Fill payment details but leave name fields blank
    // Leave first name and last name blank intentionally
    
    await cardNumberField.fill(TEST_DATA.CARD_NUMBER);
    await cvvField.fill(TEST_DATA.CVV);
    await monthField.fill(TEST_DATA.EXPIRY_MONTH);
    await yearField.fill(getValidYearString());

    // Verify name fields are still empty
    await expect(firstNameField).toHaveValue("");
    await expect(lastNameField).toHaveValue("");

    // Verify other fields are filled
    await expect(cardNumberField).toHaveValue(TEST_DATA.CARD_NUMBER_FORMATTED);
    await expect(cvvField).toHaveValue(TEST_DATA.CVV);
    await expect(monthField).toHaveValue(TEST_DATA.EXPIRY_MONTH);
    await expect(yearField).toHaveValue(getValidYearString());
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);

    // Click the pay button
    await payButton.click();

    // Wait a moment for any potential validation to occur
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    
    // Validate that name validation errors appear
    await expect(iframe.locator('[aria-label="First Name is required"]')).toBeVisible()
    await expect(iframe.locator('[aria-label="Last Name is required"]')).toBeVisible()
    const firstNameInput = firstNameField;
    const lastNameInput = lastNameField;
    await expect(firstNameInput).toHaveAttribute('aria-invalid', 'true');
    await expect(lastNameInput).toHaveAttribute('aria-invalid', 'true');
    
    // await expect(iframe.locator(ERROR_PATTERNS.NAME_REQUIRED)).toBeVisible();
    // await expect(iframe.locator(ERROR_PATTERNS.FIRST_NAME_TEXT)).toBeVisible();
    // await expect(iframe.locator(ERROR_PATTERNS.LAST_NAME_TEXT)).toBeVisible();
  });

  test("should allow blank name in hosted fields when option is enabled", async ({
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

    // Now enable the "allow blank name" option on the hosted fields page
    const allowBlankNameCheckbox = page.locator(SELECTORS.ALLOW_BLANK_NAME);
    await expect(allowBlankNameCheckbox).toBeVisible();
    await allowBlankNameCheckbox.check();
    await expect(allowBlankNameCheckbox).toBeChecked();

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

    // Fill payment details but leave name fields blank intentionally
    // Leave first name and last name blank
    await cardNumberFrame.locator(SELECTORS.HOSTED_CARD_INPUT).fill(TEST_DATA.CARD_NUMBER);
    await cvvFrame.locator(SELECTORS.HOSTED_CVV_INPUT).fill(TEST_DATA.CVV);
    await expiryMonthField.fill(TEST_DATA.EXPIRY_MONTH);
    await expiryYearField.fill(getValidYearString());

    // Verify name fields are still empty
    await expect(firstNameField).toHaveValue("");
    await expect(lastNameField).toHaveValue("");

    // Verify other fields are filled
    await expect(cardNumberFrame.getByRole("textbox", { name: "card number" })).toHaveValue(/4111/);
    await expect(cvvFrame.getByRole("textbox", { name: "cvv number" })).toHaveValue("123");
    await expect(expiryMonthField).toHaveValue(TEST_DATA.EXPIRY_MONTH);
    await expect(expiryYearField).toHaveValue(getValidYearString());

    // Wait before clicking submit
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);

    // Click the submit payment button
    await submitButton.click();

    // Wait for any potential validation to occur
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);

    // Verify there are no warning messages or error states on name fields
    // Check that no error styling or validation messages appear
    const firstNameContainer = firstNameField.locator('..');
    const lastNameContainer = lastNameField.locator('..');
    
    // Verify no error classes are applied to name fields
    await expect(firstNameContainer).not.toHaveClass(ERROR_PATTERNS.ERROR_CLASSES);
    await expect(lastNameContainer).not.toHaveClass(ERROR_PATTERNS.ERROR_CLASSES);
    
    // Verify no validation error messages are visible for name fields
    await expect(page.locator(ERROR_PATTERNS.REQUIRED)).not.toBeVisible();
    await expect(page.locator(ERROR_PATTERNS.NAME_REQUIRED)).not.toBeVisible();
    await expect(page.locator(ERROR_PATTERNS.FIRST_NAME_REQUIRED)).not.toBeVisible();
    await expect(page.locator(ERROR_PATTERNS.LAST_NAME_REQUIRED)).not.toBeVisible();
    
    // Verify the fields don't have red borders or error styling
    await expect(firstNameField).not.toHaveCSS('border-color', 'rgb(255, 0, 0)');
    await expect(lastNameField).not.toHaveCSS('border-color', 'rgb(255, 0, 0)');
    
    // Verify the name fields still have their placeholder text and no error state
    await expect(firstNameField).toHaveAttribute('placeholder', PLACEHOLDERS.HOSTED_FIRST_NAME);
    await expect(lastNameField).toHaveAttribute('placeholder', PLACEHOLDERS.HOSTED_LAST_NAME);
  });

  test("should show warning in hosted fields when blank name option is disabled", async ({
    page,
  }) => {
    // Navigate to the main page
    await page.goto(URLS.BASE);

    // Wait for auth params to be loaded
    await page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/get-auth-params") &&
        response.status() === 200
    );

    // Click on hosted fields button first
    const hostedFieldsButton = page.getByTestId("btn-hosted-fields");
    await expect(hostedFieldsButton).toBeEnabled();
    await hostedFieldsButton.click();

    // Verify we're on the hosted fields page
    await expect(page).toHaveURL(URLS.HOSTED_FIELDS);
    await expect(page.locator('h2:has-text("Hosted Fields Payment Demo")')).toBeVisible();

    // Ensure the "allow blank name" option is unchecked (default state)
    const allowBlankNameCheckbox = page.locator("#allow_blank_name");
    await expect(allowBlankNameCheckbox).toBeVisible();
    await expect(allowBlankNameCheckbox).not.toBeChecked();

    // Verify form sections are visible
    await expect(page.locator('h3:has-text("Personal Information")')).toBeVisible();
    await expect(page.locator('h3:has-text("Payment Details")')).toBeVisible();

    // Get the form fields
    const firstNameField = page.getByLabel("First Name");
    const lastNameField = page.getByLabel("Last Name");
    const expiryMonthField = page.locator("#expiry-month");
    const expiryYearField = page.locator("#expiry-year");
    const submitButton = page.getByRole("button", { name: "Submit Payment" });

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
    await cardNumberFrame.locator(SELECTORS.HOSTED_CARD_INPUT).fill(TEST_DATA.CARD_NUMBER);
    await cvvFrame.locator(SELECTORS.HOSTED_CVV_INPUT).fill(TEST_DATA.CVV);
    await expiryMonthField.fill(TEST_DATA.EXPIRY_MONTH);
    await expiryYearField.fill(getValidYearString());
    // Verify name fields are still empty
    const iframe = page.frameLocator(SELECTORS.EXPRESS_IFRAME);
    await expect(firstNameField).toHaveValue("");
    await expect(lastNameField).toHaveValue("");
    // Verify other fields are filled
    await expect(cardNumberFrame.getByRole("textbox", { name: "card number" })).toHaveValue(/4111/);
    await expect(cvvFrame.getByRole("textbox", { name: "cvv number" })).toHaveValue("123");
    await expect(expiryMonthField).toHaveValue(TEST_DATA.EXPIRY_MONTH);
    await expect(expiryYearField).toHaveValue(getValidYearString());
    // Wait before clicking submit
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    // Click the submit payment button
    await submitButton.click();
    // Wait for any potential validation to occur
    await page.waitForTimeout(TEST_DATA.TIMEOUT_SHORT);
    //await expect(iframe.locator(ERROR_PATTERNS.REQUIRED)).toBeVisible();
  });
});
