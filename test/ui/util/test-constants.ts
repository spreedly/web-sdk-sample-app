export const URLS = {
  BASE: "/"
} as const;

export const API_ENDPOINTS = {
  AUTH_PARAMS: "/api/v1/auth/params",
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
  RETAIN_PAYMENT_OPTION: "retain-payment-method",
  SAVE_PAYMENT_METHOD_OPTION: "[data-testid='save-card-checkbox'] input",
  // Buttons
  EXPRESS_BUTTON: "btn-express",
  HOSTED_FIELDS_BUTTON: "btn-hosted-fields",
  RESTART_BUTTON: "btn-restart",

  // Express Checkout (inside iframe)
  EXPRESS_IFRAME: "iframe[title='Spreedly Secure Payment Form']",
  EMBEDDED_IFRAME_CONTAINER: "#checkout-plugin-container iframe.checkout-plugin",
  RECACHE_IFRAME: ".checkout-plugin-recache",
  // EXPRESS_PAY_BUTTON: 'button:has-text("Pay")',
  EXPIRY_MM_YY: 'input[placeholder="MM/YY"]',
  CLOSE_PAYMENT_FORM: 'button[aria-label="Close payment form"]',
  EXPRESS_SUBMIT_BUTTON: 'express-checkout-submit-btn',

  // Hosted Fields
  HOSTED_SUBMIT_BUTTON: "#submit-btn",
  HOSTED_CARD_IFRAME: 'iframe[src*="numberField.html"]',
  HOSTED_CVV_IFRAME: 'iframe[src*="cvvField.html"]',
  //HOSTED_CARD_INPUT: "#spreedly-hosted-number-input",
  //HOSTED_CVV_INPUT: "#spreedly-hosted-cvv-input",
  HOSTED_NUMBER_FIELD: "#spreedly-hosted-number-input",
  HOSTED_CVV_FIELD: "#spreedly-hosted-cvv-input",
  HOSTED_SHIPPING_ADDRESS_FIELD: "input-shipping-address",

  // Form Fields(hosted fields data-testid)
  EXPIRY_MONTH: "#expiry_month, #month",
  EXPIRY_YEAR: "#expiry_year, #year",

  EXPIRY_FIELDS: ".expiry-fields",
  EXPIRY_SINGLE: "#expiry-single",

  // Messages
  TOKEN_CONTAINER: "#token-container",
  TOKEN_CONTAINER_MESSAGE: "#token-container-message",
  CARD_EXPIRED_ERROR: "#expiry-error",
  EXPIRY_YEAR_ERROR: "#expiry-year-error",
  EXPIRY_MONTH_ERROR: "#expiry-month-error",
  tokenizationFailedMessage: '#status-message',


  BIN_CARD_LABEL:".MuiChip-label",
  SAVE_CARD_CONTENT:".saved-card-content",
  USE_CARD_BUTTON:".saved-card-use-button",
  SAVED_CARD_CHECKMARK:".saved-card-checkmark",
  RECACHE_TILE:"#payment-form-title",
  THREE_DS_BUTTON: "[data-flow='purchase-with-3ds']",
  EXPRESS_CHECKOUT_BUTTON: '.sdk-option-title:has-text("Express Checkout")',
  TOKENIZE_BUTTON: '[data-flow="tokenize"]',
  ADD_PRODUCT: '.product-card[data-product-id="prod_1"] .quantity-btn.increase-qty',
  NEW_CARD_BUTTON: '[data-tab="new"]',
  SAVED_CARD_BUTTON: '[data-tab="saved"]',
  THREE_DS2_PAY_BUTTON: ".btn-text",
  THREE_DS2_AUTHENTICATING_TEXT: '.btn-text:has-text("Authenticating...")',
  THREE_DS2_BUTTON_TEXT: '.btn-text',
  THREE_DS_GATEWAY_SPECIFIC_ACS_SIMULATOR_IFRAME: 'iframe.challenge-iframe',
  THREE_DS_GATEWAY_SPECIFIC_BUTTON: '[data-flow="purchase-with-3ds-gateway-specific"]',
  THREE_DS_GATEWAY_SPECIFIC_ACS_SIMULATOR_FORM: 'h2:has-text("Spreedly ACS Simulator")',
  THREE_DS_GATEWAY_SPECIFIC_ACS_SIMULATOR_ALLOW_BUTTON: 'input[value="Allow"]',
  THREE_DS_GATEWAY_SPECIFIC_ACS_SIMULATOR_DENY_BUTTON: 'input[value="Deny"]',
  STRIPE_APM_FRAME_LOCATOR: '.__PrivateStripeElement iframe',
  OFFSITE_PAYMENTS_BUTTON: '[data-flow="offsite-payments"]',
  PAYPAL_BUTTON: '.payment-method-name:has-text("PayPal")',
  STRIPE_APM_BUTTON: '.payment-method-name:has-text("Stripe APM")',
  STRIPE_APM_ADDRESS_FIELD: '#payment-addressLine1Input',
  STRIPE_APM_CITY_FIELD: '#payment-localityInput',
  STRIPE_APM_ZIP_FIELD: '#payment-postalCodeInput',
  STRIPE_APM_COUNTRY_SELECTOR: '#payment-countryInput',
  STRIPE_APM_COUNTRY_STATE_FIELD: '#payment-administrativeAreaInput',
  STRIPE_APM_BANK_FIELD: '#payment-bankInput',
  AUTHORIZE_BUTTON: 'a[data-testid="authorize-test-payment-button"]',
  DENY_BUTTON: 'a[data-testid="fail-test-payment-button"]',
  REDIRECT_TITLE: '#redirect-title',
  ADDITIONAL_PAYMENT_METHOD_DROP_DOWN: '.p-AdditionalPaymentMethods-menu',
  STRIPE_APM_EMAIL_FIELD: '#payment-emailInput',
  EBANX_PAYMENT_METHOD_DROP_DOWN: '#payment-method-select',
  EBANX_OXXO_REDIRECT_PAGE_IMAGE: '.oxxo-logo-img',
  EBANX_BOLETO_BANCARIO_REDIRECT_PAGE_IMAGE: 'img[src*="logo_ebanx"]',
  EBANX_PIX_REDIRECT_PAGE_IMAGE: 'img.voucher-header__logo[alt="Pix"]',
  EBANX_PIX_REDIRECT_QR_CODE_IMAGE: 'img.qrc-code-img[alt="QR Code"]',
  EBANX_NUPAY_REDIRECT_PAGE_IMAGE: 'p.nupay img[alt="NuPay"]',
  NUPAY_TEST_ENVIRONMENT_SIMULATOR: 'h2:has-text("Test Environment Simulator")',
  NUPAY_AUTHORIZE_YES_BUTTON: 'a:has-text("Authorized = YES")',
  NUPAY_AUTHORIZE_NO_BUTTON: 'a:has-text("Authorized = NO")',
  NUPAY_AUTHORIZE_PENDING_BUTTON: 'a:has-text("Leave Pending")',
} as const;

export const THREE_DS_SELECTORS = {
  productsGrid: '#products-grid',
  wirelessHeadphoneCard: '.product-card[data-product-id="prod_1"]',
  wirelessHeadphoneIncreaseButton: '.product-card[data-product-id="prod_1"] .quantity-btn.increase-qty',
  smartWatchCard: '.product-card[data-product-id="prod_2"]',
  laptopStandCard: '.product-card[data-product-id="prod_3"]',
  quantityControl: '.quantity-control',
  increaseQtyButton: '.quantity-btn.increase-qty',
  decreaseQtyButton: '.quantity-btn.decrease-qty',
  quantityInput: '.quantity-input',
  PROCEED_TO_PAYMENT_BUTTON: '#proceed-to-payment',
  // 3DS Challenge Form Selectors
  CHALLENGE_IFRAME: 'iframe.challenge-iframe, iframe#challenge-iframe',
  CHALLENGE_FORM: 'form#mainForm',
  CHALLENGE_CODE_SECTION: '.code-section',
  CHALLENGE_OTP_INPUT: 'input[type="text"], input[type="number"], input[name*="code"], input[name*="otp"], input[name*="pin"]',
  CHALLENGE_OTP_LABEL: 'label:has-text("Enter the code")',
  CHALLENGE_ACTIONS_FOOTER: '.actions-footer',
  CHALLENGE_PAY_BUTTON: 'button:has-text("Pay"), button[type="submit"]:has-text("Pay")',
  CHALLENGE_CANCEL_BUTTON: 'button:has-text("Cancel")',
  CHALLENGE_WHITELIST_CHECKBOX: 'input[type="checkbox"]',
  CHALLENGE_OVERLAY: '#challenge-overlay',
  // 3DS Success Page Selectors
  RESULT_SECTION: '#result-section',
  RESULT_TITLE: '.result-title',
  RESULT_TITLE_SUCCESS: '.result-title:has-text("3DS Payment Successful!")',
  RESULT_MESSAGE: '.result-message',
  RESULT_DETAILS: '.result-details',
  RESULT_DETAIL_ROW: '.result-detail-row',
  RESULT_DETAIL_LABEL: '.result-detail-label',
  RESULT_DETAIL_VALUE: '.result-detail-value',
  RESULT_ICON_SUCCESS: '.result-icon.success',
  RESULT_ICON_ERROR: '.result-icon.error',
  RESULT_TITLE_ERROR: '.result-title:has-text("Payment Failed")',
  RESULT_TITLE_PENDING: '.result-title:has-text("Payment Pending")',
  MAKE_ANOTHER_PURCHASE_BUTTON: 'button:has-text("Make Another Purchase")',
  TRY_AGAIN_BUTTON: 'button:has-text("Try Again")',
  START_OVER_BUTTON: 'button:has-text("Start Over")',
}

export const PLACEHOLDERS = {
  // Express Checkout
  EXPRESS_FIRST_NAME: "Joe",
  EXPRESS_LAST_NAME: "Jones",
  EXPRESS_CARD_NUMBER: "1234 5678 9012 3456",
  EXPRESS_CVV: "123",
  RECACHE_CVV: "•••",
  EXPRESS_MONTH: "MM",
  EXPRESS_YEAR: "YYYY",

  // Hosted Fields
  HOSTED_FIRST_NAME: "Enter first name",
  HOSTED_LAST_NAME: "Enter last name",

  // stripe apm
  STRIPE_APM_IBAN: "DE00 0000 0000 0000 0000 00",
  STRIPE_APM_NAME: "First and last name",
  STRIPE_APM_EMAIL: "you@example.com",
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
  MASKED_CARD_NUMBER:"•••• •••• •••• 1111",
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
  CARD_LAST_FOUR_DIGITS_VISA: "1111",
  CARD_FIRST_SIX_DIGITS_VISA: "411111",
  CACHED_STORAGE_STATE: "cached",
  BLANK_DATE_RESULT_CARD: "00/",
  PRODUCT_ID_WIRELESS_HEADPHONE: "prod_1",
  PRODUCT_ID_SMART_WATCH: "prod_2",
  PRODUCT_ID_LAPTOP_STAND: "prod_3",
  THREE_DS2_CHALLENGE_FLOW_CARD_NUMBER: "5111 2200 0000 0009",
  THREE_DS2_FRUCTIONLESS_SUCCESS_CARD_NUMBER: "5222 2200 0000 0005",
  THREE_DS2_FRUCTIONLESS_FAILURE_CARD_NUMBER: "5248 4811 1120 0179",
  THREE_DS2_CHALLENGE_FLOW_SUCCESS_PIN: "1234",
  THREE_DS2_CHALLENGE_FLOW_FAILED_PIN: "4567",
  THREE_DS2_GATEWAY_SPECIFIC_VALID_CARD_NUMBER: "4556 7610 2998 3886",
  THREE_DS2_GATEWAY_SPECIFIC_INVALID_CARD_NUMBER: "4024 0071 0193 4890",
  STRIPE_APM_IBAN: "IE64 IRCE 9205 0112 3456 78",
  STRIPE_APM_NAME: "John Doe",
  STRIPE_APM_EMAIL: "john.doe@example.com",
  STRIPE_APM_CITY: "Dublin",
  STRIPE_APM_ZIP: "d02af30",
  STRIPE_APM_SEPA_COUNTRY: "IE",
  STRIPE_APM_SEPA_COUNTRY_STATE: "Dublin",
  STRIPE_APM_BANK_NAME_EPS: "Bank Austria",
  STRIPE_APM_BANK_NAME_PRZELEWY24: "alior_bank"
};

export const HEADINGS = {
  RESULT_TITLE_SUCCESS: "Payment Method Created",
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
  FIRST_NAME_REQUIRED_EXPRESS_CHECKOUT: "Error: First Name is required",
  LAST_NAME_REQUIRED_EXPRESS_CHECKOUT: "Error: Last Name is required",
  YEAR_REQUIRED_EXPRESS_CHECKOUT: "Error: Year is required",
  MONTH_REQUIRED_EXPRESS_CHECKOUT: "Error: Month is required",
  INVALID_MONTH: "Error: Month must be between 1 and 12",
  HOSTED_FIELDS_INVALID_MONTH: "Month must be between 1 and 12",
  INVALID_CARD_NUMBER: "Error: Please enter a valid card number",
  HOSTED_FIELDS_INVALID_CARD_NUMBER: "Invalid card number",
  CARD_NUMBER_LENGTH: "Error: Card number must be between 13 and 19 digits",
  HOSTED_FIELDS_CARD_NUMBER_LENGTH: "Card number must be between 13 and 19 digits",
  INVALID_CVV: "Error: Please enter a valid CVV",
  HOSTED_FIELDS_INVALID_CVV: "Please enter a valid CVV",
  AMEX_INVALID_CVV: "Error: CVV must be 4 digits",
  HOSTED_FIELDS_AMEX_INVALID_CVV: "CVV must be 4 digits",
  ERROR_MESSAGE_UNAUTHORIZED: "Request failed with status code 401",
  ERROR_MESSAGE_INVALID_YEAR: "Request failed with status code 422",
  TOKENIZATION_FAILED_MESSAGE: "Tokenization failed. Please try again."
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

export const getMaskedCardNumber =(cardNumber:string):RegExp=>{
  return new RegExp(`•••• •••• •••• ${cardNumber.slice(-4)}`);
}

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


