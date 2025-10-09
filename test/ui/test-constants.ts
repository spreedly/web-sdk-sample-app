export const URLS = {
  BASE: "/"
} as const;

export const API_ENDPOINTS = {
  AUTH_PARAMS: "/api/auth/get-auth-params",
} as const;

export const SELECTORS = {
  // Checkboxes
  //ALLOW_BLANK_NAME: "#allow_blank_name",
  ALLOW_BLANK_NAME: "allow-blank-name",
  //TWO_DIGIT_EXPIRY: "#two_digit_expiry",
  TWO_DIGIT_EXPIRY: "two-digit-expiry",
  //ALLOW_EXPIRED_DATE: "#allow_expired_date",
  ALLOW_EXPIRED_DATE: "allow-expired-date",
  //OPEN_IN_EMBEDDED_MODE: "#open_in_embedded_mode",
  OPEN_IN_EMBEDDED_MODE: "open-in-embedded-mode",

  // Buttons
  EXPRESS_BUTTON: "btn-express",
  HOSTED_FIELDS_BUTTON: "btn-hosted-fields",
  RESTART_BUTTON: "btn-restart",

  // Express Checkout (inside iframe)
  EXPRESS_IFRAME: "iframe.checkout-plugin, iframe.checkout-plugin-small",
  EMBEDDED_IFRAME_CONTAINER: "#checkout-plugin-container iframe.checkout-plugin",
  // EXPRESS_PAY_BUTTON: 'button:has-text("Pay")',
  EXPIRY_MM_YY: 'input[placeholder="MM/YY"]',
  EXPRESS_SUBMIT_BUTTON: 'express-checkout-submit-btn',

  // Hosted Fields
  HOSTED_SUBMIT_BUTTON: "Submit Payment",
  HOSTED_CARD_IFRAME: 'iframe[src*="numberField.html"]',
  HOSTED_CVV_IFRAME: 'iframe[src*="cvvField.html"]',
  //HOSTED_CARD_INPUT: "#spreedly-hosted-number-input",
  //HOSTED_CVV_INPUT: "#spreedly-hosted-cvv-input",
  HOSTED_NUMBER_FIELD: "hosted-number-field",
  HOSTED_CVV_FIELD: "hosted-cvv-field",
  HOSTED_SHIPPING_ADDRESS_FIELD: "input-shipping-address",

  // Form Fields(hosted fields data-testid)
  EXPIRY_MONTH: "input-expiry-month",
  EXPIRY_YEAR: "input-expiry-year",

  EXPIRY_FIELDS: ".expiry-fields",
  EXPIRY_SINGLE: "#expiry-single",

  // Messages
  TOKEN_CONTAINER: "#token-container",
  TOKEN_CONTAINER_MESSAGE: "#token-container-message",
  CARD_EXPIRED_ERROR: "#expiry-error",
  EXPIRY_YEAR_ERROR: "#expiry-year-error",
  EXPIRY_MONTH_ERROR: "#expiry-month-error",
} as const;

export const PLACEHOLDERS = {
  // Express Checkout
  EXPRESS_FIRST_NAME: "Joe",
  EXPRESS_LAST_NAME: "Jones",
  EXPRESS_CARD_NUMBER: "1234 5678 9012 3456",
  EXPRESS_CVV: "123",
  EXPRESS_MONTH: "MM",
  EXPRESS_YEAR: "YYYY",

  // Hosted Fields
  HOSTED_FIRST_NAME: "Enter first name",
  HOSTED_LAST_NAME: "Enter last name",
};

export const LABELS = {
  FIRST_NAME: "First Name",
  LAST_NAME: "Last Name",
  SHIPPING_ADDRESS: "Shipping Address",
  CARD_NUMBER: "Card number",
  CVV_NUMBER: "CVV security code",
};

export const TEST_DATA = {
  // Payment Information
  CARD_NUMBER: "4111111111111111",
  INVALID_CARD_NUMBER: "4111111111111112",
  CARD_NUMBER_TOO_SHORT: "411111111111", // 12 digits
  CARD_NUMBER_TOO_LONG: "41111111111111111111", // 20 digits
  CARD_NUMBER_FORMATTED: "4111 1111 1111 1111",
  AMEX_CARD_NUMBER: "3782 822463 10005",
  CVV: "123",
  INVALID_CVV_LONG: "1234",
  INVALID_CVV_SHORT: "12",
  AMEX_CVV: "1234",
  EXPIRY_MONTH: "12",
  EXPIRY_YEAR_2_DIGIT: "25", // For MM/YY format
  EXPIRED_MONTH: "01",
  MM_YY_FORMAT: "12/25",
  // Personal Information
  FIRST_NAME: "John",
  LAST_NAME: "Doe",
  EMPTY_STRING: "",
  SHIPPING_ADDRESS: "123 Main St",
  // Timeout Values
  TIMEOUT_SHORT: 2000,
  TIMEOUT_LONG: 10000,
  STATUS_CODE_UNAUTHORIZED: 500,
  STATUS_CODE_INVALID_YEAR: 500,
  HIDDEN_CVV_VALUE: "XXX",
};

export const HEADINGS = {
  EXPRESS_TITLE: "Pay with Card",
  HOSTED_FIELDS_TITLE: "Hosted Fields Payment Demo",
  PERSONAL_INFO: "Personal Information",
  PAYMENT_DETAILS: "Payment Details",
};

export const ERROR_PATTERNS = {
  REQUIRED: "text=*required*",
  NAME_REQUIRED: "text=*name*required*",
  FIRST_NAME_REQUIRED: "text=*first*name*required*",
  LAST_NAME_REQUIRED: "text=*last*name*required*",
  FIRST_NAME_TEXT: "text=*first*name*",
  LAST_NAME_TEXT: "text=*last*name*",
  ERROR_TEXT: "text=*error*",
  ERROR_CLASSES: /error|invalid|warning/,
};

export const ERROR_MESSAGES = {
  CARD_EXPIRED: "Error: Card has expired",
  HOSTED_FIELDS_CARD_EXPIRED: "Card has expired",
  INVALID_MONTH: "Error: Month must be between 1 and 12",
  HOSTED_FIELDS_INVALID_MONTH: "Month must be between 1 and 12",
  INVALID_CARD_NUMBER: "Error: Invalid card number",
  HOSTED_FIELDS_INVALID_CARD_NUMBER: "Invalid card number",
  CARD_NUMBER_LENGTH: "Error: Card number must be between 13 and 19 digits",
  HOSTED_FIELDS_CARD_NUMBER_LENGTH: "Card number must be between 13 and 19 digits",
  INVALID_CVV: "Error: CVV must be 3 digits",
  HOSTED_FIELDS_INVALID_CVV: "CVV must be 3 digits",
  AMEX_INVALID_CVV: "Error: CVV must be 4 digits",
  HOSTED_FIELDS_AMEX_INVALID_CVV: "CVV must be 4 digits",
  ERROR_MESSAGE_UNAUTHORIZED: "Request failed with status code 401",
  ERROR_MESSAGE_INVALID_YEAR: "Request failed with status code 422"
};

export const ERROR_SELECTORS = {
  CARD_EXPIRED_ICON: `[aria-label="${ERROR_MESSAGES.CARD_EXPIRED}"]`,
  INVALID_MONTH_ICON: `[aria-label="${ERROR_MESSAGES.INVALID_MONTH}"]`,
  ERROR_ICON_GENERIC: '[data-testid="InfoOutlinedIcon"]',
  FIRST_NAME_REQUIRED_ICON: '[aria-label="Error: First Name is required"]',
  LAST_NAME_REQUIRED_ICON: '[aria-label="Error: Last Name is required"]',
  FIRST_NAME_REQUIRED_ICON_ALT: '[aria-label="First Name is required"]',
  LAST_NAME_REQUIRED_ICON_ALT: '[aria-label="Last Name is required"]',
  INVALID_CARD_NUMBER_ICON: `[aria-label="${ERROR_MESSAGES.INVALID_CARD_NUMBER}"]`,
  CARD_NUMBER_LENGTH_ICON: `[aria-label="${ERROR_MESSAGES.CARD_NUMBER_LENGTH}"]`,
  INVALID_CVV_ICON: `[aria-label="${ERROR_MESSAGES.INVALID_CVV}"]`,
  AMEX_INVALID_CVV_ICON: `[aria-label="${ERROR_MESSAGES.AMEX_INVALID_CVV}"]`,
};

export const CSS_PROPERTIES = {
  RED_BORDER: "rgb(255, 0, 0)",
  GREEN_TEXT: "rgb(0, 128, 0)",
};

export const CSS_CLASSES = {
  AUTH_TITLE: "auth-title",
};

// Helper Functions
export const getCurrentYear = (): number => {
  return new Date().getFullYear();
};

/**
 * Returns a valid year for testing (current year + 1)
 * Example usage: await expiryYearField.fill(getValidYearString());
 */
export const getValidYear = (): number => {
  return getCurrentYear() + 1;
};

export const getValidYearString = (): string => {
  return getValidYear().toString();
};

/**
 * Returns a valid two-digit year for testing (current year + 1)
 * Example usage: await mmyyField.fill(`12/${getValidTwoDigitYear()}`);
 */
export const getValidTwoDigitYear = (): string => {
  return getValidYear().toString().slice(-2);
};

/**
 * Returns an expired year for testing (current year - 1)
 * Example usage: await expiryYearField.fill(getExpiredYearString());
 * Use this to test expired date validation scenarios
 */
export const getExpiredYear = (): number => {
  return getCurrentYear() - 1;
};

export const getExpiredYearString = (): string => {
  return getExpiredYear().toString();
};

// Legacy functions (keeping for backward compatibility)
export const getNextYear = (): number => {
  return getValidYear();
};

export const getNextYearString = (): string => {
  return getValidYearString();
};

export const getInvalidYear =():number => {
  return getCurrentYear() + 21;
}

export const getInvalidYearString =():string => {
  return getInvalidYear().toString();
}

// Common test patterns
export const COMMON_PATTERNS = {
  CARD_NUMBER_REGEX: /4111/,
};

// Common test utilities
export const waitForAuthParams = async (page: any, maxRetries: number = 3, retryDelay: number = 2000) => {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}: Waiting for auth params...`);
      
      await page.waitForResponse(
        (response: any) =>
          response.url().includes(API_ENDPOINTS.AUTH_PARAMS) &&
          response.status() === 200,
        { timeout: 10000 } 
  
      );
      
      console.log(`Auth params received successfully on attempt ${attempt}`);
      return; 
      
    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${attempt} failed: ${lastError.message}`);
      
      if (attempt < maxRetries) {
        console.log(`Retrying in ${retryDelay}ms...`);
        console.log(`Refreshing page for attempt ${attempt + 1}...`);
        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(retryDelay);
      }
    }
  }
  throw new Error(`Failed to get auth params after ${maxRetries} attempts. Last error: ${lastError?.message}`);
};

