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
  debugEnvKey: () => document.getElementById('debug-env-key'),
  debugNonce: () => document.getElementById('debug-nonce'),
  debugTimestamp: () => document.getElementById('debug-timestamp'),
  debugStatus: () => document.getElementById('debug-status'),
};

// Initialization
async function init() {
  sdkType = SpreedlyUtils.getSDKType();
  
  elements.sdkBadge().textContent = SpreedlyUtils.getSDKDisplayName();
  
  const displayModeConfig = document.getElementById('config-display-mode');
  
  if (sdkType === 'express-checkout') {
    displayModeConfig?.classList.remove('hidden');
  } else {
    displayModeConfig?.classList.add('hidden');
  }
  
  // Set up config checkbox listeners on page load (so they work before SDK is ready)
  setupConfigCheckboxListeners();
  
  try {
    await loadAndInitializeSDK();
  } catch (error) {
    console.error('Failed to initialize:', error);
    showError('Failed to initialize SDK. Please refresh the page.');
  }
}

// Set up config checkbox listeners (called on page load)
function setupConfigCheckboxListeners() {
  document.getElementById('config-two-digit-expiry')?.addEventListener('change', function() {
    config.twoDigitExpiryYear = this.checked;
    if (isReady && sdkType === 'hosted-fields') {
      updateExpiryFieldDisplay();
      updateFormState();
    }
  });
  
  document.getElementById('config-allow-blank-name')?.addEventListener('change', function() {
    config.allowBlankName = this.checked;
    if (isReady && sdkType === 'hosted-fields') {
      updateNameFieldsRequired();
      updateFormState();
    }
  });
  
  document.getElementById('config-allow-blank-date')?.addEventListener('change', function() {
    config.allowBlankDate = this.checked;
    if (isReady && sdkType === 'hosted-fields') {
      updateDateFieldsRequired();
      updateFormState();
    }
  });
  
  document.getElementById('config-allow-expired-date')?.addEventListener('change', function() {
    config.allowExpiredDate = this.checked;
  });
}

// Sync config state from checkbox values (called when SDK becomes ready)
function syncConfigFromCheckboxes() {
  config.twoDigitExpiryYear = document.getElementById('config-two-digit-expiry')?.checked || false;
  config.allowBlankName = document.getElementById('config-allow-blank-name')?.checked || false;
  config.allowBlankDate = document.getElementById('config-allow-blank-date')?.checked || false;
  config.allowExpiredDate = document.getElementById('config-allow-expired-date')?.checked || false;
}

async function loadAndInitializeSDK() {
  updateDebugStatus('Loading SDK...');
  
  await new Promise((resolve, reject) => {
    SpreedlyUtils.loadSDKScript((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  
  updateDebugStatus('Fetching auth params...');
  
  const authParams = await SpreedlyUtils.fetchAuthParams();
  
  elements.debugEnvKey().textContent = authParams.environmentKey;
  elements.debugNonce().textContent = (authParams.nonce || '').substring(0, 20) + '...';
  elements.debugTimestamp().textContent = authParams.timestamp;
  
  updateDebugStatus('Initializing SDK...');
  
  if (sdkType === 'express-checkout') {
    await initializeExpressCheckout(authParams);
  } else {
    await initializeHostedFields(authParams);
  }
}

// Hosted Fields Initialization
async function initializeHostedFields(authParams) {
  storedAuthParams = authParams;
  
  sdk = new SpreedlyHostedFields({
    environment_key: authParams.environmentKey,
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.certificateToken,
    signature: authParams.signature,
  });
  
  hideLoading();
  elements.hostedFieldsOpenSection().classList.remove('hidden');
  updateDebugStatus('Ready - Click to open form');
  console.log('Hosted Fields SDK initialized, waiting for user to open form');
}

// Open Hosted Fields Form (called when button is clicked)
window.openHostedFieldsForm = function() {
  if (!sdk || !storedAuthParams) {
    showError('SDK not initialized. Please refresh the page.');
    return;
  }
  
  SpreedlyUtils.setButtonLoading('open-hosted-fields-btn', true, 'Loading...');

  // Set up event handlers
  sdk.on('ready', () => {
    isReady = true;
    
    setupHostedFieldsEventListeners();
    
    updateFormState();
    SpreedlyUtils.setButtonLoading('open-hosted-fields-btn', false);
    elements.hostedFieldsOpenSection().classList.add('hidden');
    elements.hostedFieldsForm().classList.remove('hidden');
    updateDebugStatus('Ready');
    console.log('Hosted fields ready');
  });
  
  sdk.on('tokenGenerated', (response) => {
    console.log('Token generated:', response);
    handleTokenSuccess({...response, shouldRetain: document.getElementById('retain-payment-method')?.checked || false});
  });
  
  sdk.on('error', (error) => {
    console.error('SDK error:', error);
    SpreedlyUtils.setButtonLoading('open-hosted-fields-btn', false);
    handleTokenError(error);
  });

  sdk.inAppElements({
    number: { containerId: 'card-number-field' },
    cvv: { containerId: 'cvv-field' },
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
  updateDebugStatus('Ready - Click to open form');
  console.log('Express checkout SDK initialized, waiting for user to open form');
}

// Open Express Checkout Form (called when button is clicked)
window.openExpressCheckoutForm = function() {
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
    updateDebugStatus(`Ready (${displayMode} mode)`);
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
    },
    submitParams: {
      metadata: {
        source: 'tokenize-flow-demo',
        timestamp: new Date().toISOString(),
      },
      allow_blank_date: config.allowBlankDate,
      allow_expired_date: config.allowExpiredDate,
      allow_blank_name: config.allowBlankName,
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
    expiryDateInput.addEventListener('input', function() {
      formatExpiryDate(this);
      updateFormState();
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
  };
  
  sdk.submit(formData, {
    metadata: {
      source: 'tokenize-flow-demo',
      timestamp: new Date().toISOString(),
    },
    allow_blank_date: config.allowBlankDate,
    allow_expired_date: config.allowExpiredDate,
    allow_blank_name: config.allowBlankName,
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
window.resetForm = function() {
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
      updateDebugStatus('Ready - Click to open form');
    }
  } else {
    // For Hosted Fields, show the "Open Payment Form" section again
    elements.hostedFieldsForm().classList.add('hidden');
    elements.hostedFieldsOpenSection().classList.remove('hidden');
    
    // Re-create SDK instance for a fresh form
    if (storedAuthParams) {
      sdk = new SpreedlyHostedFields({
        environment_key: storedAuthParams.environmentKey,
        nonce: storedAuthParams.nonce,
        timestamp: storedAuthParams.timestamp,
        certificate_token: storedAuthParams.certificateToken,
        signature: storedAuthParams.signature,
      });
      isReady = false;
      updateDebugStatus('Ready - Click to open form');
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
  // Use form-specific status for Hosted Fields, global status otherwise
  const statusEl = sdkType === 'hosted-fields' 
    ? elements.statusMessage() 
    : document.getElementById('global-status-message');
  
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status-message visible ${type}`;
  }
}

function hideStatus() {
  // Hide both status elements
  const formStatus = elements.statusMessage();
  const globalStatus = document.getElementById('global-status-message');
  
  if (formStatus) formStatus.className = 'status-message';
  if (globalStatus) globalStatus.className = 'status-message';
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

function updateDebugStatus(status) {
  elements.debugStatus().textContent = status;
}

// Start
document.addEventListener('DOMContentLoaded', init);

