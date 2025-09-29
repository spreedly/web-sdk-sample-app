declare const SpreedlyWebSDK: any;

// Character limits - using consistent 350 character limit for names and address
const COMBINED_NAME_CHAR_LIMIT = 350;
const SHIPPING_ADDRESS_CHAR_LIMIT = 350;

// Validation helper functions
function validateRequired(value: string, fieldLabel: string): string {
  if (!value || !value.trim()) {
    return `${fieldLabel} is required`;
  }
  return '';
}

function validateCharLimit(value: string, fieldLabel: string, limit: number): string {
  if (!value) {
    return '';
  }

  if (value.length > limit) {
    return `${fieldLabel} must be less than ${limit} characters`;
  }
  return '';
}

function validateCombinedNameCharLimit(firstName: string, lastName: string): string {
  const combinedLength = (firstName || '').length + (lastName || '').length;
  if (combinedLength > COMBINED_NAME_CHAR_LIMIT) {
    return `Max 350 characters are allowed`;
  }
  return '';
}

function validateMonth(month: string): string {
  if (!month.trim()) {
    return 'Month is required';
  }

  const monthNum = parseInt(month, 10);

  if (isNaN(monthNum)) {
    return 'Month must be a number';
  }

  if (monthNum < 1 || monthNum > 12) {
    return 'Month must be between 1 and 12';
  }

  return '';
}

function validateYear(year: string, allowExpiredDate = false): string {
  if (!year.trim()) {
    return 'Year is required';
  }

  const yearNum = parseInt(year, 10);

  if (isNaN(yearNum)) {
    return 'Year must be a number';
  }

  if (yearNum < 1000 || yearNum > 9999) {
    return 'Invalid year format';
  }

  const currentYear = new Date().getFullYear();

  if (yearNum < currentYear && !allowExpiredDate) {
    return 'Card has expired';
  }

  return '';
}

function displayFieldError(fieldId: string, message: string): void {
  const errorContainer = document.getElementById(`${fieldId}-error`);
  
  if (errorContainer) {
    errorContainer.textContent = message;
    errorContainer.classList.add('show');
  }
  
  // Add error class to input field(s) for visual feedback
  if (fieldId === 'expiry') {
    // Handle expiry fields - add error class to visible expiry inputs
    const monthEl = document.getElementById('expiry-month') as HTMLInputElement;
    const yearEl = document.getElementById('expiry-year') as HTMLInputElement;
    const mmYyEl = document.getElementById('expiry-mm-yy') as HTMLInputElement;
    
    if (twoDigitExpiryCheckedHF && mmYyEl) {
      mmYyEl.classList.add('error');
    } else {
      if (monthEl) monthEl.classList.add('error');
      if (yearEl) yearEl.classList.add('error');
    }
  } else if (fieldId === 'expiry-month') {
    // Handle individual month field
    const monthEl = document.getElementById('expiry-month') as HTMLInputElement;
    if (monthEl) monthEl.classList.add('error');
  } else if (fieldId === 'expiry-year') {
    // Handle individual year field
    const yearEl = document.getElementById('expiry-year') as HTMLInputElement;
    if (yearEl) yearEl.classList.add('error');
  } else {
    const inputElement = document.getElementById(fieldId) as HTMLInputElement;
    if (inputElement) {
      inputElement.classList.add('error');
    }
  }
}

/**
 * Displays a form-level error message using CSS classes
 * @param message - The error message to display
 */
function displayFormError(message: string): void {
  const errorContainer = document.getElementById('form-error');
  if (errorContainer) {
    errorContainer.textContent = message;
    errorContainer.classList.add('form-error-active');
  }
}

function clearFieldError(fieldId: string): void {
  const errorContainer = document.getElementById(`${fieldId}-error`);
  
  if (errorContainer) {
    errorContainer.classList.remove('show');
    errorContainer.textContent = '';
  }
  
  // Remove error class from input field(s)
  if (fieldId === 'expiry') {
    // Handle expiry fields - remove error class from all expiry inputs
    const monthEl = document.getElementById('expiry-month') as HTMLInputElement;
    const yearEl = document.getElementById('expiry-year') as HTMLInputElement;
    const mmYyEl = document.getElementById('expiry-mm-yy') as HTMLInputElement;
    
    if (monthEl) monthEl.classList.remove('error');
    if (yearEl) yearEl.classList.remove('error');
    if (mmYyEl) mmYyEl.classList.remove('error');
  } else if (fieldId === 'expiry-month') {
    // Handle individual month field
    const monthEl = document.getElementById('expiry-month') as HTMLInputElement;
    if (monthEl) monthEl.classList.remove('error');
  } else if (fieldId === 'expiry-year') {
    // Handle individual year field
    const yearEl = document.getElementById('expiry-year') as HTMLInputElement;
    if (yearEl) yearEl.classList.remove('error');
  } else {
    const inputElement = document.getElementById(fieldId) as HTMLInputElement;
    if (inputElement) {
      inputElement.classList.remove('error');
    }
  }
}

function clearAllErrors(): void {
  // Clear individual field errors
  const fieldIds = ['first-name', 'last-name', 'shipping-address1', 'expiry', 'expiry-month', 'expiry-year'];
  fieldIds.forEach(fieldId => clearFieldError(fieldId));
  
  // Clear form error
  const formErrorContainer = document.getElementById('form-error');
  if (formErrorContainer) {
    formErrorContainer.classList.remove('form-error-active');
    formErrorContainer.textContent = '';
  }
}

function clearErrors(): void {
  clearAllErrors();
}

const nonceParams = JSON.parse(
  window.sessionStorage.getItem("authParams") || "{}"
);
const sdk = new SpreedlyWebSDK({
  environment_key: nonceParams["env-key"],
  nonce: nonceParams.nonce,
  timestamp: nonceParams.timestamp,
  certificate_token: nonceParams.token,
  signature: nonceParams.signature,
});

let allowBlankNameCheckedHF = false;
let allowExpiredDateCheckedHF = false;
let twoDigitExpiryCheckedHF = false;

function syncHostedFieldCheckboxState(): void {
  const allowBlankNameEl = document.getElementById("allow_blank_name") as HTMLInputElement | null;
  const allowExpiredDateEl = document.getElementById("allow_expired_date") as HTMLInputElement | null;
  const twoDigitExpiryEl = document.getElementById("two_digit_expiry") as HTMLInputElement | null;

  allowBlankNameCheckedHF = !!allowBlankNameEl?.checked;
  allowExpiredDateCheckedHF = !!allowExpiredDateEl?.checked;
  twoDigitExpiryCheckedHF = !!twoDigitExpiryEl?.checked;
}

function formatMmYyInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function toggleExpiryInputs(): void {
  const twoDigitExpiryEl = document.getElementById("two_digit_expiry") as HTMLInputElement | null;
  const expiryFields = document.querySelector(".expiry-fields") as HTMLElement | null;
  const expirySingle = document.getElementById("expiry-single") as HTMLElement | null;
  const mmInput = document.getElementById("expiry-month") as HTMLInputElement | null;
  const yyyyInput = document.getElementById("expiry-year") as HTMLInputElement | null;
  const mmYyInput = document.getElementById("expiry-mm-yy") as HTMLInputElement | null;

  const useSingle = !!twoDigitExpiryEl?.checked;

  if (expiryFields && expirySingle) {
    if (useSingle) {
      // Prefill single input from split fields if available
      const mm = (mmInput?.value || '').slice(0, 2);
      const yy = (yyyyInput?.value || '').slice(-2);
      if (mmYyInput) mmYyInput.value = formatMmYyInput(`${mm}${yy}`);

      // Switch visibility
      expiryFields.style.display = "none";
      expirySingle.style.display = "block";

      // Update validation/interaction attributes
      // mmInput?.removeAttribute("required"); 
      // yyyyInput?.removeAttribute("required");
      mmInput?.setAttribute("disabled", "");
      yyyyInput?.setAttribute("disabled", "");

      if (mmYyInput) {
        mmYyInput.removeAttribute("disabled");
        // mmYyInput.setAttribute("required", "");
      }
    } else {
      // Prefill split fields from single input if available
      const val = mmYyInput?.value || '';
      const parts = val.split('/');
      if (mmInput && parts[0]) mmInput.value = parts[0].slice(0, 2);
      if (yyyyInput && parts[1]) yyyyInput.value = `20${parts[1].slice(0, 2)}`;

      // Switch visibility
      expiryFields.style.display = "flex";
      expirySingle.style.display = "none";

      // Update validation/interaction attributes
      // mmInput?.setAttribute("required", "");
      // yyyyInput?.setAttribute("required", "");
      mmInput?.removeAttribute("disabled");
      yyyyInput?.removeAttribute("disabled");

      if (mmYyInput) {
        mmYyInput.setAttribute("disabled", "");
        // mmYyInput.removeAttribute("required");
      }
    }
  }
}

function attachValidationListeners(): void {
  // No real-time validation - only validate on form submission
  // This function is kept for potential future use but doesn't add any listeners
}

function attachUIListeners(): void {
  const allowBlankNameEl = document.getElementById("allow_blank_name") as HTMLInputElement | null;
  const allowExpiredDateEl = document.getElementById("allow_expired_date") as HTMLInputElement | null;
  const twoDigitExpiryEl = document.getElementById("two_digit_expiry") as HTMLInputElement | null;
  const restartBtn = document.getElementById("restart-btn") as HTMLButtonElement | null;
  const mmYyInput = document.getElementById("expiry-mm-yy") as HTMLInputElement | null;

  const changeHandler = () => {
    syncHostedFieldCheckboxState();
    toggleExpiryInputs();
    // Clear errors when settings change
    clearErrors();
  };

  allowBlankNameEl?.addEventListener("change", changeHandler);
  allowExpiredDateEl?.addEventListener("change", changeHandler);
  twoDigitExpiryEl?.addEventListener("change", changeHandler);

  mmYyInput?.addEventListener('input', () => {
    mmYyInput.value = formatMmYyInput(mmYyInput.value);
  });

  restartBtn?.addEventListener("click", () => {
    window.location.href = "/";
  });

  changeHandler();
}

sdk.on("ready", () => {
  sdk.setPlaceholder("cvv", "***");
  sdk.setStyles("number", {
    borderRadius: "5px",
    paddingLeft: "8px",
    paddingRight: "8px",
    fontSize: "18px",
  });
  sdk.setStyles("cvv", {
    borderRadius: "5px",
    paddingLeft: "8px",
    paddingRight: "8px",
    fontSize: "18px",
  });
});

const tokenContainer2 = document.getElementById("token-container-message");

sdk.on("error", (error: any) => {
  sdk.close();
  if (typeof error === 'string') {
    tokenContainer2!.textContent = error;
  } else {
    tokenContainer2!.textContent = error.error;
  }
});
sdk.on("tokenGenerated", (token: any) => {
  sdk.close();
  tokenContainer2!.textContent = `Token: ${token.tokenResponse.token}`;
});
sdk.inAppElements({
  number: {
    containerId: "spreedly-number-input-container",
  },
  cvv: {
    containerId: "spreedly-cvv-input-container",
  },
});

function getExpiryValues(): { month: string; year: string } {
  if (twoDigitExpiryCheckedHF) {
    const mmYYInput = document.getElementById("expiry-mm-yy") as HTMLInputElement | null;
    const value = (mmYYInput?.value || "").trim();
    const [mmRaw, yyRaw] = value.split("/");
    const mm = (mmRaw || "").slice(0, 2);
    const yy = (yyRaw || "").slice(0, 2);
    const yyyy = yy.length === 2 ? `20${yy}` : yy;
    return { month: mm, year: yyyy };
  }
  const month = (document.getElementById("expiry-month") as HTMLInputElement)?.value || "";
  const year = (document.getElementById("expiry-year") as HTMLInputElement)?.value || "";
  return { month, year };
}

// Validation function types
type PaymentFormData = {
  month: string;
  year: string;
  firstName: string;
  lastName: string;
  shippingAddress1: string;
};

type ValidationOptions = {
  allowExpiredDate: boolean;
  allowBlankName: boolean;
};

/**
 * Validates required fields based on options (name fields and shipping address)
 * @param formData - The form data to validate
 * @param options - Validation options including allowBlankName
 * @returns true if there are validation errors, false otherwise
 */
function validateRequiredFields(formData: PaymentFormData, options: ValidationOptions): boolean {
  let hasErrors = false;

  // Validate name fields (if allow_blank_name is false)
  if (!options.allowBlankName) {
    const firstNameError = validateRequired(formData.firstName, 'First Name');
    if (firstNameError) {
      displayFieldError('first-name', firstNameError);
      hasErrors = true;
    }

    const lastNameError = validateRequired(formData.lastName, 'Last Name');
    if (lastNameError) {
      displayFieldError('last-name', lastNameError);
      hasErrors = true;
    }
  }

  // Validate shipping address (always required)
  const shippingRequiredError = validateRequired(formData.shippingAddress1, 'Shipping Address');
  if (shippingRequiredError) {
    displayFieldError('shipping-address1', shippingRequiredError);
    hasErrors = true;
  }

  return hasErrors;
}

/**
 * Validates character limits for all fields
 * @param formData - The form data to validate
 * @returns true if there are validation errors, false otherwise
 */
function validateCharacterLimits(formData: PaymentFormData): boolean {
  let hasErrors = false;

  // Validate combined name character limit
  if (formData.firstName || formData.lastName) {
    const combinedNameError = validateCombinedNameCharLimit(formData.firstName, formData.lastName);
    if (combinedNameError) {
      // Clear any existing required errors for names before showing char limit error
      clearFieldError('first-name');
      clearFieldError('last-name');
      displayFieldError('first-name', combinedNameError);
      displayFieldError('last-name', combinedNameError);
      hasErrors = true;
    }
  }

  // Validate shipping address character limit
  if (formData.shippingAddress1) {
    const shippingError = validateCharLimit(formData.shippingAddress1, 'Shipping Address', SHIPPING_ADDRESS_CHAR_LIMIT);
    if (shippingError) {
      // Clear required error before showing char limit error
      clearFieldError('shipping-address1');
      displayFieldError('shipping-address1', shippingError);
      hasErrors = true;
    }
  }

  return hasErrors;
}

/**
 * Validates expiry fields (required validation, format validation, and expiration)
 * Handles both separate MM/YYYY fields and single MM/YY field based on twoDigitExpiryCheckedHF
 * @param formData - The form data to validate
 * @param options - Validation options including allowExpiredDate
 * @returns true if there are validation errors, false otherwise
 */
function validateExpiryFields(formData: PaymentFormData, options: ValidationOptions): boolean {
  let hasErrors = false;

  // Validate expiry fields are required based on the current format
  if (twoDigitExpiryCheckedHF) {
    // Validate the single MM/YY field
    const mmYyInput = document.getElementById("expiry-mm-yy") as HTMLInputElement | null;
    const mmYyValue = (mmYyInput?.value || "").trim();
    
    const mmYyRequiredError = validateRequired(mmYyValue, 'Expiry date');
    if (mmYyRequiredError) {
      displayFieldError('expiry', mmYyRequiredError);
      hasErrors = true;
    }
  } else {
    // Validate separate month and year fields
    const monthRequiredError = validateRequired(formData.month, 'Month');
    if (monthRequiredError) {
      displayFieldError('expiry-month', monthRequiredError);
      hasErrors = true;
    }

    const yearRequiredError = validateRequired(formData.year, 'Year');
    if (yearRequiredError) {
      displayFieldError('expiry-year', yearRequiredError);
      hasErrors = true;
    }
  }

  // Validate format based on the current expiry format
  if (twoDigitExpiryCheckedHF) {
    // For MM/YY format, validate the parsed month and year values
    if (formData.month || formData.year) {
      const monthError = formData.month ? validateMonth(formData.month) : '';
      const yearError = formData.year ? validateYear(formData.year, options.allowExpiredDate) : '';
      
      if ((monthError && monthError !== 'Month is required') || (yearError && yearError !== 'Year is required')) {
        // Clear required error before showing format error
        clearFieldError('expiry');
        const formatError = monthError || yearError || 'Invalid expiry date format';
        displayFieldError('expiry', formatError);
        hasErrors = true;
      }
    }
  } else {
    // Validate separate month and year fields
    if (formData.month) {
      const monthError = validateMonth(formData.month);
      if (monthError && monthError !== 'Month is required') {
        // Clear required error before showing format error
        clearFieldError('expiry-month');
        displayFieldError('expiry-month', monthError);
        hasErrors = true;
      }
    }
    
    if (formData.year) {
      const yearError = validateYear(formData.year, options.allowExpiredDate);
      if (yearError && yearError !== 'Year is required') {
        // Clear required error before showing format error
        clearFieldError('expiry-year');
        displayFieldError('expiry-year', yearError);
        hasErrors = true;
      }
    }
  }
  
  // Validate expiration date (if both month and year are present and valid)
  if (formData.month && formData.year && !options.allowExpiredDate) {
    const monthError = validateMonth(formData.month);
    const yearError = validateYear(formData.year, true); // Allow expired for individual validation
    
    if (!monthError && !yearError) {
      // Both are valid format-wise, now check if expired
      const monthNum = parseInt(formData.month, 10);
      const yearNum = parseInt(formData.year, 10);
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      
      if (yearNum < currentYear || (yearNum === currentYear && monthNum < currentMonth)) {
        // Show expiry error based on current format
        if (twoDigitExpiryCheckedHF) {
          clearFieldError('expiry');
          displayFieldError('expiry', 'Card has expired');
        } else {
          clearFieldError('expiry-month');
          clearFieldError('expiry-year');
          displayFieldError('expiry-month', 'Card has expired');
          displayFieldError('expiry-year', 'Card has expired');
        }
        hasErrors = true;
      }
    }
  }

  return hasErrors;
}

/**
 * Main validation function that orchestrates all validation steps
 * @param formData - The form data to validate
 * @param options - Validation options
 * @returns true if validation passes (no errors), false if there are validation errors
 */
function validateFormData(formData: PaymentFormData, options: ValidationOptions): boolean {
  // Clear all errors first
  clearAllErrors();

  // Run validation steps in order of priority
  const requiredFieldsHaveErrors = validateRequiredFields(formData, options);
  const characterLimitsHaveErrors = validateCharacterLimits(formData);
  const expiryFieldsHaveErrors = validateExpiryFields(formData, options);

  // Return true if no errors were found
  return !(requiredFieldsHaveErrors || characterLimitsHaveErrors || expiryFieldsHaveErrors);
}

function handlePaymentFormSubmit(event: Event) {
  console.log("handlePaymentFormSubmit");
  event.preventDefault();
  syncHostedFieldCheckboxState();

  // Clear any previous errors
  clearErrors();

  const { month, year } = getExpiryValues();
  const firstName = (document.getElementById("first-name") as HTMLInputElement)?.value || '';
  const lastName = (document.getElementById("last-name") as HTMLInputElement)?.value || '';
  const shippingAddress1 = (document.getElementById("shipping-address1") as HTMLInputElement)?.value || '';

  // Validate form data
  const isValid = validateFormData(
    { month, year, firstName, lastName, shippingAddress1 },
    { 
      allowExpiredDate: allowExpiredDateCheckedHF, 
      allowBlankName: allowBlankNameCheckedHF 
    }
  );

  if (!isValid) {
    return;
  }

  // If validation passes, submit the form
  sdk.submit(
    {
      month,
      year,
      first_name: firstName,
      last_name: lastName,
      shipping_address1: shippingAddress1,
    },
    {
      metadata: {
        custom_field: "custom_value",
      },
      allow_expired_date: allowExpiredDateCheckedHF,
      allow_blank_name: allowBlankNameCheckedHF,
    }
  );
}

attachUIListeners();
attachValidationListeners();

