/**
 * Tokenize Flow - Creates a payment method token from card details
 * Supports both Hosted Fields and Express Checkout SDKs
 */

// State
let sdk = null;
let isReady = false;
let sdkType = null; // Set after determining SDK type
let storedAuthParams = null; // Store auth params for deferred initialization

// Configuration state (only used for Hosted Fields)
const config = {
  allowBlankName: false,
  allowExpiredDate: false,
  allowBlankDate: false,
  twoDigitExpiryYear: false,
  eligibleForCardUpdater: false,
  ecExtraFields: [],
};

const EC_EXTRA_FIELD_KEYS = Object.freeze([
  'full_name',
  'email',
  'company',
  'phone_number',
  'address1',
  'address2',
  'city',
  'state',
  'zip',
  'country',
  'shipping_address1',
  'shipping_address2',
  'shipping_city',
  'shipping_state',
  'shipping_zip',
  'shipping_country',
  'shipping_phone_number',
]);

/** SDK instance that already has `validation` / `fieldStateChange` listeners registered. */
let hostedFieldsSdkDemoEventHandlersWiredFor = null;

/** SDK instance that already has SDK Configuration panel controls wired. */
let hostedFieldsConfigPanelWiredFor = null;

/** Tracks mask visibility state for the demo checkbox. */
let hostedFieldsMaskEnabled = false;

/** Tracks browser autocomplete state for the demo checkbox. */
let hostedFieldsAutocompleteEnabled = false;

const HOSTED_FIELDS_PLACEHOLDER_STYLES = {
  default: { color: '#9ca3af', fontWeight: '400', opacity: '1' },
  styled: { color: 'red', fontWeight: '400', opacity: '1' },
};

// DOM Elements
const elements = {
  sdkBadge: () => document.getElementById('sdk-badge'),
  loadingState: () => document.getElementById('loading-state'),
  hostedFieldsOpenSection: () => document.getElementById('hosted-fields-open-section'),
  hostedFieldsForm: () => document.getElementById('hosted-fields-form'),
  openHostedFieldsBtn: () => document.getElementById('open-hosted-fields-btn'),
  expressCheckoutOpenSection: () => document.getElementById('express-checkout-open-section'),
  expressCheckoutForm: () => document.getElementById('express-checkout-form'),
  openPaymentFormBtn: () => document.getElementById('open-payment-form-btn'),
  configPanel: () => document.getElementById('config-panel'),
  paymentForm: () => document.getElementById('payment-form'),
  submitBtn: () => document.getElementById('submit-btn'),
  statusMessage: () => document.getElementById('status-message'),
  resultSection: () => document.getElementById('result-section'),
  resultCard: () => document.getElementById('result-card'),
  resultIcon: () => document.getElementById('result-icon'),
  resultIconSuccess: () => document.getElementById('result-icon-success'),
  resultIconError: () => document.getElementById('result-icon-error'),
  resultTitle: () => document.getElementById('result-title'),
  resultDetails: () => document.getElementById('result-details'),
};

// Initialization
async function init() {
  // DEBUG: capture the SDK's window message listener so we can call it directly.
  window.__capturedMessageListeners = [];
  const __origAdd = window.addEventListener.bind(window);
  window.addEventListener = function (type, listener, opts) {
    if (type === 'message') {
      window.__capturedMessageListeners.push({ listener, opts });
    }
    return __origAdd(type, listener, opts);
  };

  sdkType = SpreedlyUtils.getSDKType();

  elements.sdkBadge().textContent = SpreedlyUtils.getSDKDisplayName();

  updateConfigPanelForSdkType();

  // Set up config checkbox listeners on page load (so they work before SDK is ready)
  setupConfigCheckboxListeners();

  try {
    await loadAndInitializeSDK();
  } catch (error) {
    console.error('Failed to initialize:', error);
    showError('Failed to initialize SDK. Please refresh the page.');
  }
}

/** Shows hosted-fields config/debug or express-checkout display mode based on SDK type. */
function updateConfigPanelForSdkType() {
  const displayModeConfig = document.getElementById('config-display-mode');
  const hostedFieldsOnlyPanel = document.getElementById('hosted-fields-only-panel');
  const expressCheckoutOnlyPanel = document.getElementById('express-checkout-only-panel');

  if (sdkType === 'express-checkout') {
    displayModeConfig?.classList.remove('hidden');
    hostedFieldsOnlyPanel?.classList.add('hidden');
    expressCheckoutOnlyPanel?.classList.remove('hidden');
    return;
  }

  displayModeConfig?.classList.add('hidden');
  hostedFieldsOnlyPanel?.classList.remove('hidden');
  expressCheckoutOnlyPanel?.classList.add('hidden');
}

// Set up config checkbox listeners (called on page load)
function setupConfigCheckboxListeners() {
  document.getElementById('config-two-digit-expiry')?.addEventListener('change', function () {
    config.twoDigitExpiryYear = this.checked;
    if (isReady && sdkType === 'hosted-fields') {
      updateExpiryFieldDisplay();
      updateFormState();
    }
  });

  document.getElementById('config-allow-blank-name')?.addEventListener('change', function () {
    config.allowBlankName = this.checked;
    if (isReady && sdkType === 'hosted-fields') {
      updateNameFieldsRequired();
      updateFormState();
    }
  });

  document.getElementById('config-allow-blank-date')?.addEventListener('change', function () {
    config.allowBlankDate = this.checked;
    if (isReady && sdkType === 'hosted-fields') {
      updateDateFieldsRequired();
      updateFormState();
    }
  });

  document.getElementById('config-allow-expired-date')?.addEventListener('change', function () {
    config.allowExpiredDate = this.checked;
  });

  document.getElementById('config-eligible-for-card-updater')?.addEventListener('change', function () {
    config.eligibleForCardUpdater = this.checked;
  });

  document.querySelectorAll('input[data-ec-field]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      syncEcExtraFieldsFromCheckboxes();
    });
  });
}

/**
 * Reads which of the legacy `setParam` parity fields are ticked in the Express
 * Checkout config panel. Each ticked entry corresponds to a key on
 * `uiConfig.cardPaymentFormFields`; the iframe will render an input for that field.
 */
function syncEcExtraFieldsFromCheckboxes() {
  config.ecExtraFields = EC_EXTRA_FIELD_KEYS.filter(
    (key) => document.getElementById(`ec-field-${key}`)?.checked
  );
}

/**
 * Default labels/placeholders for the legacy `setParam` parity fields, used to build
 * `uiConfig.cardPaymentFormFields` entries when the merchant ticks a field in the
 * Express Checkout config panel. Mirrors the SDK's own DEFAULT_LABELS / DEFAULT_PLACEHOLDERS.
 */
const EC_EXTRA_FIELD_DEFAULTS = Object.freeze({
  full_name:               { label: 'Full Name',           placeholder: 'Joe Jones' },
  email:                   { label: 'Email',               placeholder: 'joe@example.com' },
  company:                 { label: 'Company',             placeholder: 'Acme Inc' },
  phone_number:            { label: 'Phone',               placeholder: '5551234567' },
  address1:                { label: 'Address 1',           placeholder: '123 Main St' },
  address2:                { label: 'Address 2',           placeholder: 'Apt 4' },
  city:                    { label: 'City',                placeholder: 'New York' },
  state:                   { label: 'State',               placeholder: 'NY' },
  zip:                     { label: 'Zip',                 placeholder: '10001' },
  country:                 { label: 'Country',             placeholder: 'US' },
  shipping_address1:       { label: 'Shipping Address 1',  placeholder: '456 Park Ave' },
  shipping_address2:       { label: 'Shipping Address 2',  placeholder: 'Suite 9' },
  shipping_city:           { label: 'Shipping City',       placeholder: 'Boston' },
  shipping_state:          { label: 'Shipping State',      placeholder: 'MA' },
  shipping_zip:            { label: 'Shipping Zip',        placeholder: '02101' },
  shipping_country:        { label: 'Shipping Country',    placeholder: 'US' },
  shipping_phone_number:   { label: 'Shipping Phone',      placeholder: '5559876543' },
});

function buildEcExtraFieldsConfig(fieldKeys) {
  const out = {};
  fieldKeys.forEach((fieldName) => {
    const defaults = EC_EXTRA_FIELD_DEFAULTS[fieldName];
    if (!defaults) return;
    out[fieldName] = {
      fieldName,
      isRequired: false,
      label: defaults.label,
      placeholder: defaults.placeholder,
      size: 6,
      isMasked: false,
      styles: {},
    };
  });
  return out;
}

// Sync config state from checkbox values (called when SDK becomes ready)
function syncConfigFromCheckboxes() {
  config.twoDigitExpiryYear = document.getElementById('config-two-digit-expiry')?.checked || false;
  config.allowBlankName = document.getElementById('config-allow-blank-name')?.checked || false;
  config.allowBlankDate = document.getElementById('config-allow-blank-date')?.checked || false;
  config.allowExpiredDate = document.getElementById('config-allow-expired-date')?.checked || false;
  config.eligibleForCardUpdater = document.getElementById('config-eligible-for-card-updater')?.checked || false;
  syncEcExtraFieldsFromCheckboxes();
}

/** Clears demo panel output and resets SDK Configuration controls to defaults. */
function clearHostedFieldsDemoPanelUi() {
  const autocomplete = document.getElementById('hf-demo-autocomplete');
  const iin = document.getElementById('hf-demo-include-iin');
  const maskVisible = document.getElementById('hf-demo-mask-visible');
  const numberFormat = document.getElementById('hf-demo-number-format');
  const pre = document.getElementById('hf-demo-last-validation');
  const stylePlaceholders = document.getElementById('hf-demo-style-placeholders');

  if (pre) pre.textContent = '—';
  if (iin) iin.checked = false;
  if (maskVisible) maskVisible.checked = false;
  if (autocomplete) autocomplete.checked = false;
  if (numberFormat) numberFormat.value = 'prettyFormat';
  if (stylePlaceholders) stylePlaceholders.checked = false;
  hostedFieldsMaskEnabled = false;
  hostedFieldsAutocompleteEnabled = false;
}

/** Writes the latest `validation` event payload as formatted JSON into the demo panel. */
function updateHostedFieldsDemoLastValidation(payload) {
  const pre = document.getElementById('hf-demo-last-validation');
  if (!pre) return;
  pre.textContent = JSON.stringify(payload, null, 2);
}

/** Writes the latest `consoleError` event payload as formatted JSON into the demo panel. */
function updateHostedFieldsDemoLastConsoleError(payload) {
  const pre = document.getElementById('hf-demo-last-console-error');
  if (!pre) return;
  pre.textContent = JSON.stringify(payload, null, 2);
}

/**
 * Registers `validation` / `fieldStateChange` / `consoleError` once per SDK instance and binds demo panel controls.
 */
function setupHostedFieldsSdkDemoPanel(sdkInstance) {
  const includeIin = document.getElementById('hf-demo-include-iin');
  const validateBtn = document.getElementById('hf-demo-validate-btn');

  if (hostedFieldsSdkDemoEventHandlersWiredFor !== sdkInstance) {
    hostedFieldsSdkDemoEventHandlersWiredFor = sdkInstance;
    sdkInstance.on('validation', updateHostedFieldsDemoLastValidation);
    sdkInstance.on('fieldStateChange', console.log);
    sdkInstance.on('consoleError', (payload) => {
      console.warn('Hosted Fields consoleError:', payload);
      updateHostedFieldsDemoLastConsoleError(payload);
    });
    sdkInstance.setFieldStateReporting({ includeIin: false });
    if (includeIin) {
      includeIin.checked = false;
    }
  }

  if (validateBtn) {
    validateBtn.onclick = function handleHostedFieldsDemoValidateClick() {
      if (!sdk || sdk !== sdkInstance) return;
      syncConfigFromCheckboxes();
      sdkInstance.validate({
        allow_blank_name: config.allowBlankName,
        allow_expired_date: config.allowExpiredDate,
      });
    };
  }

  if (includeIin) {
    includeIin.onchange = function handleHostedFieldsDemoIncludeIinChange() {
      if (!sdk || sdk !== sdkInstance) return;
      sdkInstance.setFieldStateReporting({ includeIin: this.checked });
    };
  }

  setupHostedFieldsConfigPanel(sdkInstance);
}

/** Configures hosted field display defaults when fields are ready. */
function configureHostedFieldsOnReady(sdkInstance) {
  sdkInstance.setTitle('number', 'Credit card number');
  sdkInstance.setTitle('cvv', 'Security code');
  sdkInstance.setPlaceholderStyles(HOSTED_FIELDS_PLACEHOLDER_STYLES.default);
  sdkInstance.setNumberFormat('prettyFormat');
}

/** Wires SDK Configuration panel controls to hosted fields SDK methods. */
function setupHostedFieldsConfigPanel(sdkInstance) {
  if (hostedFieldsConfigPanelWiredFor === sdkInstance) {
    return;
  }
  hostedFieldsConfigPanelWiredFor = sdkInstance;

  const autocompleteCheckbox = document.getElementById('hf-demo-autocomplete');
  const destroyBtn = document.getElementById('hf-demo-destroy');
  const maskVisibleCheckbox = document.getElementById('hf-demo-mask-visible');
  const numberFormat = document.getElementById('hf-demo-number-format');
  const removeHandlersBtn = document.getElementById('hf-demo-remove-handlers');
  const stylePlaceholders = document.getElementById('hf-demo-style-placeholders');

  if (numberFormat) {
    numberFormat.onchange = function handleHostedFieldsNumberFormatChange() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      sdkInstance.setNumberFormat(this.value);
    };
  }

  if (maskVisibleCheckbox) {
    maskVisibleCheckbox.onchange = function handleHostedFieldsMaskVisibleChange() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      if (this.checked === hostedFieldsMaskEnabled) return;
      sdkInstance.toggleMask();
      hostedFieldsMaskEnabled = this.checked;
    };
  }

  if (stylePlaceholders) {
    stylePlaceholders.onchange = function handleHostedFieldsStylePlaceholdersChange() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      const styles = this.checked
        ? HOSTED_FIELDS_PLACEHOLDER_STYLES.styled
        : HOSTED_FIELDS_PLACEHOLDER_STYLES.default;
      sdkInstance.setPlaceholderStyles(styles);
    };
  }

  if (autocompleteCheckbox) {
    autocompleteCheckbox.onchange = function handleHostedFieldsAutocompleteChange() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      if (this.checked === hostedFieldsAutocompleteEnabled) return;
      sdkInstance.toggleAutoComplete();
      hostedFieldsAutocompleteEnabled = this.checked;
    };
  }

  if (removeHandlersBtn) {
    removeHandlersBtn.onclick = function handleHostedFieldsRemoveHandlersClick() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      sdkInstance.removeHandlers();
      showStatus(
        'Event handlers removed. Use Tokenize Another Card or Destroy SDK to start a new session.',
        'info',
      );
    };
  }

  if (destroyBtn) {
    destroyBtn.onclick = function handleHostedFieldsDestroyClick() {
      if (!sdk || sdk !== sdkInstance) return;
      destroyHostedFieldsInstance();
      elements.hostedFieldsForm().classList.add('hidden');
      elements.hostedFieldsOpenSection().classList.remove('hidden');
      hideStatus();
      showGlobalStatus('SDK destroyed. Open the payment form again to continue.', 'info');
    };
  }

  const inputModeSelect = document.getElementById('hf-demo-input-mode');
  if (inputModeSelect) {
    inputModeSelect.onchange = function handleHostedFieldsInputModeChange() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      const value = this.value;
      if (!value) return;
      sdkInstance.setInputMode('number', value);
      sdkInstance.setInputMode('cvv', value);
    };
  }

  const requiredCheckbox = document.getElementById('hf-demo-required');
  if (requiredCheckbox) {
    requiredCheckbox.onchange = function handleHostedFieldsRequiredChange() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      sdkInstance.setRequiredAttribute('number', this.checked);
      sdkInstance.setRequiredAttribute('cvv', this.checked);
    };
  }

  const resetFieldsBtn = document.getElementById('hf-demo-reset-fields');
  if (resetFieldsBtn) {
    resetFieldsBtn.onclick = function handleHostedFieldsResetFieldsClick() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      sdkInstance.resetFields();
      showStatus('Fields reset.', 'info');
    };
  }

  const reloadBtn = document.getElementById('hf-demo-reload');
  if (reloadBtn) {
    reloadBtn.onclick = function handleHostedFieldsReloadClick() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      sdkInstance.reload();
      showStatus('Reloading hosted field iframes…', 'info');
    };
  }

  const focusIframeBtn = document.getElementById('hf-demo-focus-iframe');
  if (focusIframeBtn) {
    focusIframeBtn.onclick = function handleHostedFieldsFocusIframeClick() {
      if (!sdk || sdk !== sdkInstance || !isReady) return;
      sdkInstance.transferFocus('iframe');
    };
  }

  const isLoadedBtn = document.getElementById('hf-demo-is-loaded');
  const isLoadedResult = document.getElementById('hf-demo-is-loaded-result');
  if (isLoadedBtn && isLoadedResult) {
    isLoadedBtn.onclick = function handleHostedFieldsIsLoadedClick() {
      // Probe the SDK instance this panel was wired against — even after destroy.
      // (We intentionally do NOT short-circuit on `sdk` being null, so merchants can see
      // isLoaded() flip to false post-destroy.)
      if (!sdkInstance || typeof sdkInstance.isLoaded !== 'function') {
        isLoadedResult.textContent = 'isLoaded() → SDK instance unavailable';
        return;
      }
      const loaded = Boolean(sdkInstance.isLoaded());
      isLoadedResult.textContent = `isLoaded() → ${loaded}`;
    };
  }
}

/** Registers core hosted fields SDK event handlers on a new instance. */
function registerHostedFieldsSdkHandlers(sdkInstance) {
  sdkInstance.on('close', (payload) => {
    console.log('SDK closed:', payload);
  });

  sdkInstance.on('ready', () => {
    isReady = true;

    sdkInstance.setLabel('number', 'Card Number');
    sdkInstance.setLabel('cvv', 'CVV');
    configureHostedFieldsOnReady(sdkInstance);

    const numberFormatSelect = document.getElementById('hf-demo-number-format');
    if (numberFormatSelect) numberFormatSelect.value = 'prettyFormat';

    setupHostedFieldsSdkDemoPanel(sdkInstance);
    setupHostedFieldsEventListeners();
    updateFormState();
    hideStatus();
    SpreedlyUtils.setButtonLoading('open-hosted-fields-btn', false);
    elements.hostedFieldsOpenSection().classList.add('hidden');
    elements.hostedFieldsForm().classList.remove('hidden');
    console.log('Hosted fields ready');
  });

  sdkInstance.on('tokenGenerated', (response) => {
    console.log('Token generated:', response);
    handleTokenSuccess({
      ...response,
      shouldRetain: document.getElementById('retain-payment-method')?.checked || false,
    });
  });

  sdkInstance.on('error', (error) => {
    console.error('SDK error:', error);
    SpreedlyUtils.setButtonLoading('open-hosted-fields-btn', false);
    handleTokenError(error);
  });
}

/** Creates a SpreedlyHostedFields instance and registers its event handlers. */
function createHostedFieldsSdk(authParams) {
  const sdkInstance = new SpreedlyHostedFields({
    certificate_token: authParams.certificateToken,
    environment_key: authParams.environmentKey,
    nonce: authParams.nonce,
    signature: authParams.signature,
    timestamp: authParams.timestamp,
  });

  hostedFieldsConfigPanelWiredFor = null;
  hostedFieldsSdkDemoEventHandlersWiredFor = null;
  registerHostedFieldsSdkHandlers(sdkInstance);

  return sdkInstance;
}

/** Removes handlers, destroys the SDK instance, and resets demo UI state. */
function destroyHostedFieldsInstance() {
  if (!sdk) {
    return;
  }

  sdk.removeHandlers();
  sdk.destroy();
  sdk = null;
  isReady = false;
  hostedFieldsConfigPanelWiredFor = null;
  hostedFieldsSdkDemoEventHandlersWiredFor = null;
  clearHostedFieldsDemoPanelUi();
}

async function loadAndInitializeSDK() {


  await new Promise((resolve, reject) => {
    SpreedlyUtils.loadSDKScript((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const authParams = await SpreedlyUtils.fetchAuthParams();

  if (sdkType === 'express-checkout') {
    await initializeExpressCheckout(authParams);
  } else {
    await initializeHostedFields(authParams);
  }
}

// Hosted Fields Initialization
async function initializeHostedFields(authParams) {
  storedAuthParams = authParams;
  sdk = createHostedFieldsSdk(authParams);

  hideLoading();
  elements.hostedFieldsOpenSection().classList.remove('hidden');
  console.log('Hosted Fields SDK initialized, waiting for user to open form');
}

// Open Hosted Fields Form (called when button is clicked)
window.openHostedFieldsForm = function () {
  hideStatus();

  if (!storedAuthParams) {
    showError('SDK not initialized. Please refresh the page.');
    return;
  }

  if (!sdk) {
    sdk = createHostedFieldsSdk(storedAuthParams);
  }

  SpreedlyUtils.setButtonLoading('open-hosted-fields-btn', true, 'Loading...');

  sdk.inAppElements({
    cvv: { containerId: 'cvv-field' },
    number: { containerId: 'card-number-field' },
  });
}

// Express Checkout Initialization
async function initializeExpressCheckout(authParams) {
  storedAuthParams = authParams;

  sdk = new SpreedlyExpressCheckout({
    environment_key: authParams.environmentKey,
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.certificateToken,
    signature: authParams.signature,
  });

  hideLoading();
  elements.expressCheckoutOpenSection().classList.remove('hidden');
  console.log('Express checkout SDK initialized, waiting for user to open form');
}

// Open Express Checkout Form (called when button is clicked)
window.openExpressCheckoutForm = function () {
  if (!sdk || !storedAuthParams) {
    showError('SDK not initialized. Please refresh the page.');
    return;
  }

  // Sync config state from checkboxes before building checkout config
  syncConfigFromCheckboxes();

  const displayMode = document.querySelector('input[name="display-mode"]:checked')?.value || 'embedded';

  SpreedlyUtils.setButtonLoading('open-payment-form-btn', true, 'Loading...');

  sdk.on('ready', () => {
    isReady = true;
    SpreedlyUtils.setButtonLoading('open-payment-form-btn', false);
    elements.expressCheckoutOpenSection().classList.add('hidden');
    elements.expressCheckoutForm().classList.remove('hidden');
    console.log('Express checkout ready');
  });

  sdk.on('tokenGenerated', (response) => {
    console.log('Token generated:', response);
    handleTokenSuccess(response);
  });

  sdk.on('error', (error) => {
    console.error('SDK error:', error);
    SpreedlyUtils.setButtonLoading('open-payment-form-btn', false);
    handleTokenError(error);
  });

  sdk.on('close', () => {
    console.log('Express checkout closed');
    if (displayMode === 'dialog') {
      elements.expressCheckoutForm().classList.add('hidden');
      elements.expressCheckoutOpenSection().classList.remove('hidden');
      showStatus('Checkout closed', 'info');
    }
  });

  const checkoutConfig = {
    uiConfig: {
      twoDigitExpiry: config.twoDigitExpiryYear,
      showSaveCardCheckbox: true,
      textConfig: {
        title: 'Payment Details',
        submitBtnText: 'Create Payment Method',
        processingText: 'Processing...',
      },
      styles: {
        button: {
          backgroundColor: '#0a0a0a',
          borderRadius: '8px',
          hover: {
            backgroundColor: '#262626',
          },
        },
      },
      ...(config.ecExtraFields.length > 0
        ? { cardPaymentFormFields: buildEcExtraFieldsConfig(config.ecExtraFields) }
        : {}),
    },
    submitParams: {
      metadata: {
        source: 'tokenize-flow-demo',
        timestamp: new Date().toISOString(),
      },
      allow_blank_date: config.allowBlankDate,
      allow_expired_date: config.allowExpiredDate,
      allow_blank_name: config.allowBlankName,
      ...(config.eligibleForCardUpdater ? { eligible_for_card_updater: true } : {}),
    }
  };

  if (displayMode === 'embedded') {
    checkoutConfig.parentContainerId = 'express-checkout-container';
  }

  sdk.expressCheckout(checkoutConfig);
}

// Event Listeners (Hosted Fields Only)
function setupHostedFieldsEventListeners() {
  const form = elements.paymentForm();
  if (form) {
    form.addEventListener('submit', handleFormSubmit);
  }

  const fieldIds = ['first_name', 'last_name', 'expiry_month', 'expiry_year', 'expiry_date'];
  fieldIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateFormState);
      el.addEventListener('change', updateFormState);
    }
  });

  const expiryDateInput = document.getElementById('expiry_date');
  if (expiryDateInput) {
    expiryDateInput.addEventListener('input', function () {
      formatExpiryDate(this);
      updateFormState();
    });
  }

  const hostedCardNumberLabel = document.getElementById('hosted-field-label-card-number');
  if (hostedCardNumberLabel && sdk) {
    hostedCardNumberLabel.addEventListener('click', () => {
      sdk.transferFocus('number');
    });
    hostedCardNumberLabel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        sdk.transferFocus('number');
      }
    });
  }

  const hostedCvvLabel = document.getElementById('hosted-field-label-cvv');
  if (hostedCvvLabel && sdk) {
    hostedCvvLabel.addEventListener('click', () => {
      sdk.transferFocus('cvv');
    });
    hostedCvvLabel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        sdk.transferFocus('cvv');
      }
    });
  }

  // Sync config state from checkboxes (in case user checked them before SDK was ready)
  syncConfigFromCheckboxes();

  // Apply initial config state to UI
  updateNameFieldsRequired();
  updateDateFieldsRequired();
  updateExpiryFieldDisplay();
}

// Update required attribute on name fields based on allowBlankName config
function updateNameFieldsRequired() {
  const firstNameInput = document.getElementById('first_name');
  const lastNameInput = document.getElementById('last_name');
  const firstNameLabel = document.querySelector('label[for="first_name"]');
  const lastNameLabel = document.querySelector('label[for="last_name"]');

  if (config.allowBlankName) {
    firstNameInput?.removeAttribute('required');
    lastNameInput?.removeAttribute('required');
    if (firstNameLabel) firstNameLabel.textContent = 'First Name (optional)';
    if (lastNameLabel) lastNameLabel.textContent = 'Last Name (optional)';
  } else {
    firstNameInput?.setAttribute('required', '');
    lastNameInput?.setAttribute('required', '');
    if (firstNameLabel) firstNameLabel.textContent = 'First Name';
    if (lastNameLabel) lastNameLabel.textContent = 'Last Name';
  }
}

// Update required attribute on date fields based on allowBlankDate config
function updateDateFieldsRequired() {
  const monthInput = document.getElementById('expiry_month');
  const yearInput = document.getElementById('expiry_year');
  const expiryDateInput = document.getElementById('expiry_date');
  const monthLabel = document.querySelector('label[for="expiry_month"]');
  const yearLabel = document.querySelector('label[for="expiry_year"]');
  const expiryDateLabel = document.querySelector('label[for="expiry_date"]');

  if (config.allowBlankDate) {
    monthInput?.removeAttribute('required');
    yearInput?.removeAttribute('required');
    expiryDateInput?.removeAttribute('required');
    if (monthLabel) monthLabel.textContent = 'Expiry Month (optional)';
    if (yearLabel) yearLabel.textContent = 'Expiry Year (optional)';
    if (expiryDateLabel) expiryDateLabel.textContent = 'Expiry Date (optional)';
  } else {
    // Don't set required on these - the JS validation handles it
    if (monthLabel) monthLabel.textContent = 'Expiry Month';
    if (yearLabel) yearLabel.textContent = 'Expiry Year';
    if (expiryDateLabel) expiryDateLabel.textContent = 'Expiry Date';
  }
}

/**
 * Reads the optional billing/shipping/eligible_for_card_updater inputs from the demo form.
 * Mirrors legacy `Spreedly.setParam(name, value)`: only includes fields the merchant actually filled in.
 * Empty strings are omitted so the SDK's soft-validation warning won't list "noise" keys.
 */
function collectOptionalSetParamFields() {
  const stringFieldIds = [
    'full_name',
    'company',
    'address1', 'address2', 'city', 'state', 'zip', 'country', 'phone_number',
    'shipping_address1', 'shipping_address2', 'shipping_city', 'shipping_state',
    'shipping_zip', 'shipping_country', 'shipping_phone_number',
  ];
  const out = {};
  stringFieldIds.forEach((id) => {
    const value = document.getElementById(id)?.value.trim();
    if (value) out[id] = value;
  });
  if (document.getElementById('eligible_for_card_updater')?.checked) {
    out.eligible_for_card_updater = true;
  }
  return out;
}

// Form Handling (Hosted Fields Only)
function handleFormSubmit(e) {
  e.preventDefault();

  // This is only called for Hosted Fields flow
  if (!isReady || elements.submitBtn().disabled) return;

  setLoading(true);
  showStatus('Creating payment method...', 'info');

  const expiry = getExpiryData();

  const formData = {
    first_name: document.getElementById('first_name')?.value.trim() || '',
    last_name: document.getElementById('last_name')?.value.trim() || '',
    month: expiry.month,
    year: expiry.year,
    email: document.getElementById('email')?.value.trim() || '',
    ...collectOptionalSetParamFields(),
  };

  sdk.submit(formData, {
    metadata: {
      source: 'tokenize-flow-demo',
      timestamp: new Date().toISOString(),
    },
    allow_blank_date: config.allowBlankDate,
    allow_expired_date: config.allowExpiredDate,
    allow_blank_name: config.allowBlankName,
    ...(config.eligibleForCardUpdater ? { eligible_for_card_updater: true } : {}),
  });
}

function updateFormState() {
  // Only applies to Hosted Fields - Express Checkout handles its own form state
  if (!isReady || sdkType !== 'hosted-fields') return;

  const firstName = document.getElementById('first_name')?.value.trim() || '';
  const lastName = document.getElementById('last_name')?.value.trim() || '';

  let expiryValid = false;

  if (config.allowBlankDate) {
    expiryValid = true;
  } else if (config.twoDigitExpiryYear) {
    const expiryDate = document.getElementById('expiry_date')?.value.trim() || '';
    expiryValid = /^\d{2}\/\d{2}$/.test(expiryDate);
  } else {
    const month = document.getElementById('expiry_month')?.value.trim() || '';
    const year = document.getElementById('expiry_year')?.value.trim() || '';
    expiryValid = month.length >= 1 && year.length >= 2;
  }

  const nameValid = config.allowBlankName || (firstName && lastName);
  const isValid = nameValid && expiryValid;

  elements.submitBtn().disabled = !isValid;
}

function getExpiryData() {
  if (config.twoDigitExpiryYear) {
    const expiryDate = document.getElementById('expiry_date')?.value.trim() || '';
    const parts = expiryDate.split('/');
    return {
      month: parts[0] || '',
      year: parts[1] ? '20' + parts[1] : ''
    };
  }
  return {
    month: document.getElementById('expiry_month')?.value.trim() || '',
    year: document.getElementById('expiry_year')?.value.trim() || ''
  };
}

function formatExpiryDate(input) {
  let value = input.value.replace(/\D/g, '');
  if (value.length >= 2) {
    value = value.substring(0, 2) + '/' + value.substring(2, 4);
  }
  input.value = value;
}

function updateExpiryFieldDisplay() {
  const separateFields = document.getElementById('expiry-separate-fields');
  const combinedField = document.getElementById('expiry-combined-field');

  if (config.twoDigitExpiryYear) {
    separateFields?.classList.add('hidden');
    combinedField?.classList.remove('hidden');
  } else {
    separateFields?.classList.remove('hidden');
    combinedField?.classList.add('hidden');
  }
}

// Response Handlers
async function handleTokenSuccess(response) {
  let retainedPaymentMethod
  if (response.shouldRetain) {
    retainedPaymentMethod = await SpreedlyUtils.retainPaymentMethod(response.tokenResponse.payment_method.token);
  }

  setLoading(false);
  hideStatus();

  const paymentMethod = retainedPaymentMethod?.transaction?.payment_method || response?.tokenResponse?.payment_method || {};
  const token = paymentMethod.token || 'Unknown';

  // Hide form, show result
  elements.hostedFieldsOpenSection()?.classList.add('hidden');
  elements.hostedFieldsForm()?.classList.add('hidden');
  elements.expressCheckoutOpenSection()?.classList.add('hidden');
  elements.expressCheckoutForm()?.classList.add('hidden');
  elements.resultSection().classList.remove('hidden');

  // Style result card
  elements.resultCard().classList.add('success');
  elements.resultCard().classList.remove('error');
  elements.resultIcon().classList.add('success');
  elements.resultIcon().classList.remove('error');
  elements.resultIconSuccess().classList.remove('hidden');
  elements.resultIconError().classList.add('hidden');
  elements.resultTitle().textContent = 'Payment Method Created';

  // All values below are interpolated into innerHTML and may originate from
  // API responses; HTML-escape every value to prevent XSS.
  const details = `
    <div class="result-row">
      <span class="result-label">Token</span>
      <span class="result-value">${SpreedlyUtils.escapeHtml(token)}</span>
    </div>
    <div class="result-row">
      <span class="result-label">Card Type</span>
      <span class="result-value">${SpreedlyUtils.escapeHtml(SpreedlyUtils.capitalizeFirst(paymentMethod.card_type) || '—')}</span>
    </div>
    <div class="result-row">
      <span class="result-label">Last Four</span>
      <span class="result-value">${SpreedlyUtils.escapeHtml(paymentMethod.last_four_digits || '—')}</span>
    </div>
    <div class="result-row">
      <span class="result-label">First Six</span>
      <span class="result-value">${SpreedlyUtils.escapeHtml(paymentMethod.first_six_digits || '—')}</span>
    </div>
    <div class="result-row">
      <span class="result-label">Expiry</span>
      <span class="result-value">${SpreedlyUtils.escapeHtml(SpreedlyUtils.formatExpiry(paymentMethod.month, paymentMethod.year))}</span>
    </div>
    <div class="result-row">
      <span class="result-label">Storage State</span>
      <span class="result-value">${SpreedlyUtils.escapeHtml(paymentMethod.storage_state || '—')}</span>
    </div>
  `;

  elements.resultDetails().innerHTML = details;

  console.log('Payment method created:', paymentMethod);
}

function handleTokenError(error) {
  setLoading(false);

  const message = error?.message || error?.errors?.[0]?.message || 'Tokenization failed. Please try again.';
  showStatus(message, 'error');

  console.error('Token error:', error);
}

// Reset Form
window.resetForm = function () {
  // Hide result, show appropriate form based on SDK type
  elements.resultSection().classList.add('hidden');

  if (sdkType === 'express-checkout') {
    // For Express Checkout, show the "Open Payment Form" section again
    elements.expressCheckoutForm().classList.add('hidden');
    elements.expressCheckoutOpenSection().classList.remove('hidden');

    // Re-create SDK instance for a fresh form
    if (storedAuthParams) {
      sdk = new SpreedlyExpressCheckout({
        environment_key: storedAuthParams.environmentKey,
        nonce: storedAuthParams.nonce,
        timestamp: storedAuthParams.timestamp,
        certificate_token: storedAuthParams.certificateToken,
        signature: storedAuthParams.signature,
      });
      isReady = false;
    }
  } else {
    // For Hosted Fields, show the "Open Payment Form" section again
    elements.hostedFieldsForm().classList.add('hidden');
    elements.hostedFieldsOpenSection().classList.remove('hidden');

    destroyHostedFieldsInstance();

    if (storedAuthParams) {
      sdk = createHostedFieldsSdk(storedAuthParams);
    }
  }

  hideStatus();
}

// UI Helpers
function hideLoading() {
  elements.loadingState().classList.add('hidden');
}

function setLoading(loading) {
  // Only applies to Hosted Fields - Express Checkout has no external submit button
  if (sdkType === 'hosted-fields') {
    SpreedlyUtils.setButtonLoading('submit-btn', loading);
  }
}

function showStatus(message, type) {
  const statusEl = sdkType === 'hosted-fields'
    ? elements.statusMessage()
    : document.getElementById('global-status-message');
  setStatusElement(statusEl, message, type);
}

/** Shows a status message outside the payment form (e.g. after SDK destroy). */
function showGlobalStatus(message, type) {
  setStatusElement(document.getElementById('global-status-message'), message, type);
}

/** Applies message and visibility classes to a status element. */
function setStatusElement(statusEl, message, type) {
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status-message visible ${type}`;
}

function hideStatus() {
  clearStatusElement(elements.statusMessage());
  clearStatusElement(document.getElementById('global-status-message'));
}

/** Hides a status element and clears any previous message. */
function clearStatusElement(statusEl) {
  if (!statusEl) return;
  statusEl.textContent = '';
  statusEl.className = 'status-message';
}

function showError(message) {
  hideLoading();

  // Show error using global status (visible before forms are shown)
  const globalStatus = document.getElementById('global-status-message');
  if (globalStatus) {
    globalStatus.textContent = message;
    globalStatus.className = 'status-message visible error';
  }
}

// Start
document.addEventListener('DOMContentLoaded', init);

