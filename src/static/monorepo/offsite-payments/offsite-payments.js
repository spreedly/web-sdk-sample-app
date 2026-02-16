/**
 * Offsite Payments Flow - Spreedly Web SDK Demo
 * 
 * This flow demonstrates offsite payment methods (PayPal, Stripe APM, test sprel)
 * using the SDK's setupOffsitePayment and submitOffsitePayment methods.
 * 
 * Flow:
 * 1. Load SDK and fetch auth params from backend
 * 2. Initialize SDK with auth params
 * 3. User selects payment method
 * 4. Call setupOffsitePayment with payment method type
 * 5. Call submitOffsitePayment - SDK makes API call
 * 6. Listen for offsiteTokenGenerated event to get the payment method token
 * 7. Use token for purchase API call
 */

// State
let sdk = null;
let sdkType = null;
let storedAuthParams = null;
let selectedPaymentMethodType = 'paypal';

// Payment method display names
const PAYMENT_METHOD_NAMES = {
  'paypal': 'PayPal',
  'stripe_payment_intent': 'Stripe APM',
  'sprel': 'Test Offsite (sprel)',
};

// DOM Elements
const elements = {
  loadingState: () => document.getElementById('loading-state'),
  paymentSection: () => document.getElementById('payment-section'),
  offsiteForm: () => document.getElementById('offsite-form'),
  submitBtn: () => document.getElementById('submit-btn'),
  statusMessage: () => document.getElementById('status-message'),
  debugEnvKey: () => document.getElementById('debug-env-key'),
  debugNonce: () => document.getElementById('debug-nonce'),
  debugTimestamp: () => document.getElementById('debug-timestamp'),
  debugStatus: () => document.getElementById('debug-status'),
};

// Initialization
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Set up payment method option listeners
  setupPaymentMethodListeners();
  
  try {
    // Load SDK script first
    updateDebugStatus('Loading SDK...');
    await loadSDKAsync();
    
    // Fetch auth params and initialize SDK
    await fetchAuthParamsAndInitSDK();
    
    // Set up submit button click handler
    setupSubmitHandler();
    
    hideLoading();
    elements.paymentSection().classList.remove('hidden');
    updateDebugStatus('Ready');
  } catch (error) {
    console.error('Failed to initialize:', error);
    showError('Failed to initialize. Please refresh the page.');
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
  updateDebugStatus('Fetching auth params...');
  
  const authParams = await SpreedlyUtils.fetchAuthParams();
  storedAuthParams = authParams;
  
  // Determine SDK type from URL parameter
  sdkType = SpreedlyUtils.getSDKType();
  
  // Initialize SDK based on type
  const authConfig = {
    environment_key: authParams.environmentKey,
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.certificateToken,
    signature: authParams.signature,
  };
  
  if (sdkType === 'express-checkout') {
    sdk = new SpreedlyExpressCheckout(authConfig);
  } else {
    sdk = new SpreedlyHostedFields(authConfig);
  }
  
  // Listen for offsite payment events
  sdk.on('offsiteTokenGenerated', (data) => {
    console.log('Offsite payment method created:', data);
    updateDebugStatus('Token generated!');
    
    let gateway = '';
    if (selectedPaymentMethodType === 'sprel') {
      gateway = 'spreedly';
    } else if (selectedPaymentMethodType === 'paypal') {
      gateway = 'paypal';
    }
   
    // Redirect to the completion page to create purchase
    window.location.href = `${window.location.origin}/monorepo/offsite-payments/transparent_redirect_complete.html?token=${data.token}&gateway=${gateway}`;
  });

  sdk.on('offsitePaymentError', (error) => {
    console.error('Offsite payment error:', error);
    showError(error.message || 'Failed to create payment method');
    
    // Re-enable button
    const submitBtn = elements.submitBtn();
    submitBtn.disabled = false;
    updateSubmitButton(selectedPaymentMethodType);
    updateDebugStatus('Error');
  });
  
  // Update debug panel
  elements.debugEnvKey().textContent = authParams.environmentKey;
  elements.debugNonce().textContent = (authParams.nonce || '').substring(0, 20) + '...';
  elements.debugTimestamp().textContent = authParams.timestamp;
  
  // Enable submit button
  elements.submitBtn().disabled = false;
  
  updateDebugStatus(`SDK initialized (${SpreedlyUtils.getSDKDisplayName()})`);
  console.log(`${SpreedlyUtils.getSDKDisplayName()} SDK initialized with auth params`);
}

function setupSubmitHandler() {
  const submitBtn = elements.submitBtn();
  
  // Prevent form submission (we handle it via SDK)
  const form = elements.offsiteForm();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSubmit();
  });
  
  // Also handle direct button click
  submitBtn.addEventListener('click', (e) => {
    e.preventDefault();
    handleSubmit();
  });
}

function handleSubmit() {
  if (!sdk) {
    showError('SDK not initialized');
    return;
  }
  
  const submitBtn = elements.submitBtn();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Processing...';
  updateDebugStatus('Creating payment method...');
  
  // Store amount and currency in sessionStorage for the completion page
  const amountInput = document.getElementById('amount-input');
  const currencySelector = document.getElementById('currency-selector');
  const amount = parseFloat(amountInput.value) * 100; // Convert to cents
  const currency = currencySelector.value;
  
  sessionStorage.setItem('offsite_payment_amount', amount.toString());
  sessionStorage.setItem('offsite_payment_currency', currency);
  sessionStorage.setItem('offsite_payment_method_type', selectedPaymentMethodType);
  
  console.log('Stored payment details in sessionStorage:', { amount, currency, paymentMethodType: selectedPaymentMethodType });
  
  try {
    // Setup offsite payment configuration
    sdk.setupOffsitePayment({
      paymentMethodType: selectedPaymentMethodType,
    });
    
    // Submit - SDK makes API call and emits offsiteTokenGenerated event on success
    sdk.submitOffsitePayment();
    
    console.log('Waiting for offsiteTokenGenerated event...');
  } catch (error) {
    console.error('Submit failed:', error);
    showError(error.message || 'Failed to create payment method');
    
    // Re-enable button
    submitBtn.disabled = false;
    updateSubmitButton(selectedPaymentMethodType);
    updateDebugStatus('Error');
  }
}

function setupPaymentMethodListeners() {
  document.querySelectorAll('.payment-method-option').forEach(option => {
    option.addEventListener('click', () => {
      const radio = option.querySelector('input[type="radio"]');
      radio.checked = true;
      
      // Update selected styling
      document.querySelectorAll('.payment-method-option').forEach(opt => {
        opt.classList.remove('selected');
      });
      option.classList.add('selected');
      
      // Update selected payment method type
      selectedPaymentMethodType = radio.value;
      
      // Update form submit button
      updateSubmitButton(radio.value);
    });
  });
}

function updateSubmitButton(paymentMethodType) {
  const submitBtn = elements.submitBtn();
  const displayName = PAYMENT_METHOD_NAMES[paymentMethodType] || paymentMethodType;
  
  // Update button text and value
  submitBtn.textContent = `Continue with ${displayName}`;
  submitBtn.value = paymentMethodType;
}

// Reset payment
window.resetPayment = function() {
  window.location.href = window.location.pathname;
};

// UI Helpers
function hideLoading() {
  elements.loadingState().classList.add('hidden');
}

function showError(message) {
  hideLoading();
  elements.paymentSection().classList.remove('hidden');
  SpreedlyUtils.showStatus('status-message', message, 'error');
  updateDebugStatus('Error');
}

function updateDebugStatus(status) {
  elements.debugStatus().textContent = status;
}
