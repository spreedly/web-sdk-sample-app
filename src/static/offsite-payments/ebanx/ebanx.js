/**
 * EBANX Local Payment Methods Flow - Spreedly Web SDK Demo
 * 
 * This flow demonstrates EBANX local payment methods (Oxxo, Boleto, Pix, etc.)
 * using the SDK's setupOffsitePayment and submitOffsitePayment methods.
 * 
 * Flow:
 * 1. Load SDK and fetch auth params
 * 2. Initialize SDK with auth params
 * 3. User selects payment method
 * 4. Call setupOffsitePayment with payment method config
 * 5. Call submitOffsitePayment - SDK makes API call
 * 6. Listen for offsiteTokenGenerated event to get the payment method token
 * 7. Use token to create purchase transaction via createPurchase API
 * 8. Redirect to payment provider
 */

// State
let sdk = null;
let storedAuthParams = null;
let selectedPaymentMethod = 'oxxo';

// Payment method configurations with demo data
const PAYMENT_METHOD_CONFIGS = {
  oxxo: {
    payment_method_type: 'oxxo',
    email: 'test@test.com',
    full_name: 'Manuela E. Beyer Rocabado',
    country: 'MX',
    zip: '48822',
    address1: 'Oyono, 882',
    city: 'Hermosillo',
    state: 'Sonora',
    phone_number: '(040) 577-7687',
    default_currency: 'MXN',
  },
  boleto_bancario: {
    payment_method_type: 'boleto_bancario',
    email: 'test@test.com',
    full_name: 'Ana Santos Araujo',
    document_id: '853.513.468-93',
    country: 'BR',
    zip: '12345',
    address1: 'Rua E, 1040',
    city: 'Maracanaú',
    state: 'CE',
    phone_number: '8522847035',
    default_currency: 'BRL',
  },
  pix: {
    payment_method_type: 'pix',
    email: 'test@test.com',
    full_name: 'Ana Santos Araujo',
    document_id: '853.513.468-93',
    country: 'BR',
    zip: '12345',
    address1: 'Rua E, 1040',
    city: 'Maracanaú',
    state: 'CE',
    phone_number: '8522847035',
    default_currency: 'BRL',
  },
  nupay: {
    payment_method_type: 'nupay',
    email: 'ana.araujo@example.com',
    full_name: 'Ana Santos Araujo',
    document_id: '853.513.468-93',
    country: 'BR',
    phone_number: '8522847035',
    default_currency: 'BRL',
  },
};

// Display names for payment methods
const PAYMENT_METHOD_NAMES = {
  oxxo: 'Oxxo',
  boleto_bancario: 'Boleto Bancário',
  pix: 'Pix',
  nupay: 'NuPay',
};

// DOM Elements
const elements = {
  loadingState: () => document.getElementById('loading-state'),
  paymentSection: () => document.getElementById('payment-section'),
  errorState: () => document.getElementById('error-state'),
  errorMessage: () => document.getElementById('error-message'),
  paymentMethodSelect: () => document.getElementById('payment-method-select'),
  amountInput: () => document.getElementById('amount-input'),
  currencySelector: () => document.getElementById('currency-selector'),
  currencySymbol: () => document.getElementById('currency-symbol'),
  jsonPreviewContent: () => document.getElementById('json-preview-content'),
  submitBtn: () => document.getElementById('submit-btn'),
  statusMessage: () => document.getElementById('status-message'),
  debugEnvKey: () => document.getElementById('debug-env-key'),
  debugPaymentMethod: () => document.getElementById('debug-payment-method'),
  debugStatus: () => document.getElementById('debug-status'),
};

// Initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function init() {
  updateDebugStatus('Loading SDK...');
  
  try {
    // Load SDK script first
    await loadSDKAsync();
    
    updateDebugStatus('Fetching auth params...');
    
    // Fetch auth params and initialize SDK
    await fetchAuthParamsAndInitSDK();
    
    // Setup event listeners
    setupEventListeners();
    
    // Read URL params for amount/currency
    readUrlParams();
    
    // Update JSON preview
    updateJsonPreview();
    
    // Show payment section
    hideLoading();
    elements.paymentSection().classList.remove('hidden');
    elements.submitBtn().disabled = false;
    
    updateDebugStatus('Ready');
  } catch (error) {
    console.error('Failed to initialize:', error);
    showError(error.message || 'Failed to initialize. Please refresh the page.');
  }
}

// Load SDK script as a promise
function loadSDKAsync() {
  return new Promise((resolve, reject) => {
    SpreedlyUtils.loadSDKScript((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

async function fetchAuthParamsAndInitSDK() {
  const authParams = await SpreedlyUtils.fetchAuthParams();
  storedAuthParams = authParams;
  
  // Determine SDK type from URL parameter
  const sdkType = SpreedlyUtils.getSDKType();
  
  // Initialize SDK based on type
  const authConfig = {
    environment_key: authParams.environmentKey,
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.certificateToken,
    signature: authParams.signature,
  };
  
  elements.debugEnvKey().textContent = authParams.environmentKey?.substring(0, 10) + '...';
  
  updateDebugStatus('Initializing SDK...');
  
  if (sdkType === 'express-checkout' && typeof SpreedlyExpressCheckout !== 'undefined') {
    sdk = new SpreedlyExpressCheckout(authConfig);
  } else if (typeof SpreedlyHostedFields !== 'undefined') {
    sdk = new SpreedlyHostedFields(authConfig);
  } else {
    throw new Error('SDK not loaded properly');
  }
  
  // Listen for SDK events
  sdk.on('ready', () => {
    console.log('SDK ready');
  });
  
  sdk.on('error', (error) => {
    console.error('SDK error:', error);
    showStatusMessage('SDK error: ' + (error.message || error), 'error');
  });
  
  // Listen for offsite payment events
  sdk.on('offsiteTokenGenerated', handleOffsiteTokenGenerated);
  sdk.on('offsitePaymentError', handleOffsitePaymentError);
}

function setupEventListeners() {
  // Payment method selector change
  const paymentMethodSelect = elements.paymentMethodSelect();
  paymentMethodSelect.addEventListener('change', (e) => {
    selectedPaymentMethod = e.target.value;
    updateJsonPreview();
    updateSubmitButton();
    updateDefaultCurrency();
    elements.debugPaymentMethod().textContent = selectedPaymentMethod;
  });
  
  // Currency selector change
  const currencySelector = elements.currencySelector();
  currencySelector.addEventListener('change', updateCurrencySymbol);
  
  // Submit button click
  const submitBtn = elements.submitBtn();
  submitBtn.addEventListener('click', handleSubmit);
}

function updateDefaultCurrency() {
  const config = PAYMENT_METHOD_CONFIGS[selectedPaymentMethod];
  if (config?.default_currency) {
    elements.currencySelector().value = config.default_currency;
    updateCurrencySymbol();
  }
}

function readUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const amountFromUrl = urlParams.get('amount');
  const currencyFromUrl = urlParams.get('currency');
  
  if (amountFromUrl) {
    // URL amount is in cents, convert to dollars for display
    const amountInDollars = parseInt(amountFromUrl, 10) / 100;
    elements.amountInput().value = amountInDollars.toFixed(2);
  }
  
  if (currencyFromUrl) {
    const currencySelector = elements.currencySelector();
    // Check if the currency exists in options
    const optionExists = Array.from(currencySelector.options).some(opt => opt.value === currencyFromUrl);
    if (optionExists) {
      currencySelector.value = currencyFromUrl;
    }
  }
  
  updateCurrencySymbol();
}

function updateCurrencySymbol() {
  const currency = elements.currencySelector().value;
  const symbols = {
    MXN: '$',
    BRL: 'R$',
  };
  elements.currencySymbol().textContent = symbols[currency] || '$';
}

function updateJsonPreview() {
  const config = PAYMENT_METHOD_CONFIGS[selectedPaymentMethod];
  if (!config) return;
  
  const jsonPreview = elements.jsonPreviewContent();
  
  // Build the highlighted JSON, excluding internal fields
  let html = `{
  <span class="json-key">"payment_method"</span>: {`;
  
  // Filter out internal fields like default_currency
  const entries = Object.entries(config).filter(([key]) => key !== 'default_currency');
  entries.forEach(([key, value], index) => {
    const comma = index < entries.length - 1 ? ',' : '';
    html += `
    <span class="json-key">"${key}"</span>: <span class="json-string">"${value}"</span>${comma}`;
  });
  
  html += `
  }
}`;
  
  jsonPreview.innerHTML = html;
}

function updateSubmitButton() {
  const btn = elements.submitBtn();
  const name = PAYMENT_METHOD_NAMES[selectedPaymentMethod] || selectedPaymentMethod;
  btn.textContent = `Pay with ${name}`;
}

async function handleSubmit() {
  if (!sdk) {
    showStatusMessage('SDK not initialized', 'error');
    return;
  }
  
  const submitBtn = elements.submitBtn();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Processing...';
  updateDebugStatus('Creating payment method...');
  
  // Store payment details in sessionStorage for the completion page
  const amount = Math.round(parseFloat(elements.amountInput().value) * 100);
  const currency = elements.currencySelector().value;
  
  sessionStorage.setItem('offsite_payment_amount', amount.toString());
  sessionStorage.setItem('offsite_payment_currency', currency);
  sessionStorage.setItem('offsite_payment_method_type', selectedPaymentMethod);
  
  try {
    // Get the payment method config
    const config = PAYMENT_METHOD_CONFIGS[selectedPaymentMethod];
    
    // Setup offsite payment - include all fields, SDK will use what's provided
    sdk.setupOffsitePayment({
      paymentMethodType: config.payment_method_type,
      email: config.email,
      fullName: config.full_name,
      documentId: config.document_id,
      country: config.country,
      zip: config.zip,
      address1: config.address1,
      city: config.city,
      state: config.state,
      phoneNumber: config.phone_number,
    });
    
    // Submit offsite payment (this triggers the API call)
    sdk.submitOffsitePayment();
    
  } catch (error) {
    console.error('Error setting up payment:', error);
    showStatusMessage(error.message || 'Failed to setup payment', 'error');
    submitBtn.disabled = false;
    updateSubmitButton();
    updateDebugStatus('Error');
  }
}

async function handleOffsiteTokenGenerated(data) {
  console.log('Payment method token generated:', data);
  updateDebugStatus('Payment method created, creating purchase...');
  
  const paymentMethodToken = data.token;
  
  if (!paymentMethodToken) {
    showStatusMessage('No payment method token received', 'error');
    resetSubmitButton();
    return;
  }
  
  try {
    // Get amount and currency
    const amount = Math.round(parseFloat(elements.amountInput().value) * 100);
    const currency = elements.currencySelector().value;
    
    // Configure URLs
    const isLocalhost = window.location.hostname === 'localhost';
    const productionUrl = 'https://checkout-web-sample-app-049a3c617015.herokuapp.com';
    const baseUrl = isLocalhost ? productionUrl : window.location.origin;
    const redirectUrl = `${baseUrl}/offsite-payments/handle_redirect.html`;
    const callbackUrl = `${baseUrl}/api/v1/offsite-callback`;
    
    // Create purchase transaction
    const purchaseResponse = await axios.post('/api/v1/create-purchase', {
      gateway: 'ebanx',
      transaction: {
        payment_method_token: paymentMethodToken,
        amount: amount,
        currency_code: currency,
        redirect_url: redirectUrl,
        callback_url: callbackUrl,
        // gateway_specific_fields: {
        //   ebanx: {}
        // }
      }
    });
    
    console.log('Purchase response:', purchaseResponse.data);
    
    const transaction = purchaseResponse.data?.transaction;
    
    if (transaction?.checkout_url) {
      updateDebugStatus('Redirecting to payment provider...');
      // Store transaction token for the completion page
      sessionStorage.setItem('transaction_token', transaction.token);
      // Redirect to the payment provider
      window.location.href = transaction.checkout_url;
    } else if (transaction?.state === 'succeeded') {
      showStatusMessage('Payment completed successfully!', 'success');
      updateDebugStatus('Completed');
    } else {
      throw new Error('No checkout URL in response. Transaction state: ' + (transaction?.state || 'unknown'));
    }
  } catch (error) {
    console.error('Error creating purchase:', error);
    const errorMessage = error.response?.data?.errors?.[0]?.message || 
                         error.response?.data?.error || 
                         error.message || 
                         'Failed to create purchase';
    showStatusMessage(errorMessage, 'error');
    resetSubmitButton();
    updateDebugStatus('Error');
  }
}

function handleOffsitePaymentError(error) {
  console.error('Offsite payment error:', error);
  showStatusMessage(error.message || 'Payment method creation failed', 'error');
  resetSubmitButton();
  updateDebugStatus('Error');
}

function resetSubmitButton() {
  const submitBtn = elements.submitBtn();
  submitBtn.disabled = false;
  updateSubmitButton();
}

// UI Helpers
function hideLoading() {
  elements.loadingState().classList.add('hidden');
}

function showError(message) {
  hideLoading();
  elements.paymentSection().classList.add('hidden');
  elements.errorState().classList.remove('hidden');
  elements.errorMessage().textContent = message;
  updateDebugStatus('Error');
}

function showStatusMessage(message, type = 'info') {
  const statusEl = elements.statusMessage();
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  statusEl.classList.remove('hidden');
}

function updateDebugStatus(status) {
  elements.debugStatus().textContent = status;
}
