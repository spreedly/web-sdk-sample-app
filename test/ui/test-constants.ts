export const URLS = {
    BASE: "http://localhost:3000/",
    HOSTED_FIELDS: "http://localhost:3000/hostedFields.html",
  } as const;
  
  export const API_ENDPOINTS = {
    AUTH_PARAMS: "/api/auth/get-auth-params",
  } as const;
  
  export const SELECTORS = {
    // Checkboxes
    ALLOW_BLANK_NAME: "#allow_blank_name",
    TWO_DIGIT_EXPIRY: "#two_digit_expiry",
    ALLOW_EXPIRED_DATE: "#allow_expired_date",
    OPEN_IN_EMBEDDED_MODE: "#open_in_embedded_mode",
    
    // Buttons
    EXPRESS_BUTTON: "btn-express",
    HOSTED_FIELDS_BUTTON: "btn-hosted-fields",
    RESTART_BUTTON: "btn-restart",
    
    // Express Checkout (inside iframe)
    EXPRESS_IFRAME: "iframe.checkout-plugin",
    EXPRESS_PAY_BUTTON: 'button:has-text("Pay")',
    EXPIRY_MM_YY: 'input[placeholder="MM/YY"]',
    
    // Hosted Fields
    HOSTED_SUBMIT_BUTTON: "Submit Payment",
    HOSTED_CARD_IFRAME: 'iframe[src*="numberField.html"]',
    HOSTED_CVV_IFRAME: 'iframe[src*="cvvField.html"]',
    HOSTED_CARD_INPUT: "#spreedly-hosted-number-input",
    HOSTED_CVV_INPUT: "#spreedly-hosted-cvv-input",
    
    // Form Fields
    EXPIRY_MONTH: "#expiry-month",
    EXPIRY_YEAR: "#expiry-year",
    EXPIRY_FIELDS: ".expiry-fields",
    EXPIRY_SINGLE: "#expiry-single",
    
    // Messages
    TOKEN_CONTAINER_MESSAGE: "#token-container-message",
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
  } as const;
  
  export const LABELS = {
    FIRST_NAME: "First Name",
    LAST_NAME: "Last Name",
    SHIPPING_ADDRESS: "Shipping Address",
    CARD_NUMBER: "card number",
    CVV_NUMBER: "cvv number",
  } as const;
  
  export const TEST_DATA = {
    // Payment Information
    CARD_NUMBER: "4111111111111111",
    CARD_NUMBER_FORMATTED: "4111 1111 1111 1111",
    CVV: "123",
    EXPIRY_MONTH: "12",
    EXPIRY_YEAR_2_DIGIT: "25", // For MM/YY format
    EXPIRED_MONTH: "01",
    MM_YY_FORMAT: "12/25",
    
    // Personal Information
    FIRST_NAME: "John",
    LAST_NAME: "Doe",
    
    // Timeout Values
    TIMEOUT_SHORT: 2000
  } as const;
  
  export const HEADINGS = {
    EXPRESS_TITLE: "Pay with Card",
    HOSTED_FIELDS_TITLE: "Hosted Fields Payment Demo",
    PERSONAL_INFO: "Personal Information",
    PAYMENT_DETAILS: "Payment Details",
  } as const;
  
  export const ERROR_PATTERNS = {
    REQUIRED: "text=*required*",
    NAME_REQUIRED: "text=*name*required*",
    FIRST_NAME_REQUIRED: "text=*first*name*required*",
    LAST_NAME_REQUIRED: "text=*last*name*required*",
    FIRST_NAME_TEXT: "text=*first*name*",
    LAST_NAME_TEXT: "text=*last*name*",
    ERROR_TEXT: "text=*error*",
    ERROR_CLASSES: /error|invalid|warning/,
  } as const;
  
  export const ERROR_MESSAGES = {
    CARD_EXPIRED: "Card has expired",
    INVALID_MONTH: "Month must be between 1 and 12",
  } as const;
  
  export const ERROR_SELECTORS = {
    CARD_EXPIRED_ICON: '[data-testid="InfoOutlinedIcon"][aria-label="Card has expired"]',
    INVALID_MONTH_ICON: '[data-testid="InfoOutlinedIcon"][aria-label="Month must be between 1 and 12"]',
    ERROR_ICON_GENERIC: '[data-testid="InfoOutlinedIcon"]',
  } as const;
  
  export const CSS_PROPERTIES = {
    RED_BORDER: "rgb(255, 0, 0)",
    GREEN_TEXT: "rgb(0, 128, 0)",
  } as const;
  
  export const CSS_CLASSES = {
    AUTH_TITLE: "auth-title",
  } as const;
  
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
  
  // Common test patterns
  export const COMMON_PATTERNS = {
    CARD_NUMBER_REGEX: /4111/,
  } as const;