/**
 * Offsite Payments Flow - Spreedly Web SDK Demo
 * 
 * This flow demonstrates offsite payment methods (PayPal, Stripe APM, test sprel)
 * using Spreedly's transparent redirect form.
 * 
 * Flow:
 * 1. Fetch auth params from backend
 * 2. User selects payment method and submits form
 * 3. Form POSTs directly to Spreedly with auth params
 * 4. Spreedly creates payment method and redirects back with token
 * 5. Token can be used for purchase API call
 */

// State
let storedAuthParams = null;

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
  
   // Set up form submit handler to store amount before submission
  setupFormSubmitHandler();
  
  try {
    await fetchAndPopulateAuthParams();
    
    hideLoading();
    elements.paymentSection().classList.remove('hidden');
    updateDebugStatus('Ready');
  } catch (error) {
    console.error('Failed to initialize:', error);
    showError('Failed to load auth parameters. Please refresh the page.');
  }
}

function setupFormSubmitHandler() {
  const form = elements.offsiteForm();
  form.addEventListener('submit', function() {
    // Store amount and currency in sessionStorage for the redirect page
    const amountInput = document.getElementById('amount-input');
    const currencySelector = document.getElementById('currency-selector');
    
    const amount = parseFloat(amountInput.value) * 100; // Convert to cents
    const currency = currencySelector.value;
    const paymentMethodType = elements.submitBtn().value;
    
    sessionStorage.setItem('offsite_payment_amount', amount.toString());
    sessionStorage.setItem('offsite_payment_currency', currency);
    sessionStorage.setItem('offsite_payment_method_type', paymentMethodType);
    
    console.log('Stored payment details in sessionStorage:', { amount, currency, paymentMethodType });
  });
}

async function fetchAndPopulateAuthParams() {
  updateDebugStatus('Fetching auth params...');
  
  const authParams = await SpreedlyUtils.fetchAuthParams();
  storedAuthParams = authParams;
  
  // Populate form hidden fields
  // Redirect to transparent_redirect_complete.html after Spreedly processes the form
  const baseUrl = window.location.origin;
  const redirectUrl = `${baseUrl}/monorepo/offsite-payments/transparent_redirect_complete.html`;
  
  document.getElementById('form-redirect-url').value = redirectUrl;
  document.getElementById('form-environment-key').value = authParams.environmentKey;
  document.getElementById('form-nonce').value = authParams.nonce;
  document.getElementById('form-timestamp').value = authParams.timestamp;
  document.getElementById('form-certificate-token').value = authParams.certificateToken;
  document.getElementById('form-signature').value = authParams.signature;
  
  // Update debug panel
  elements.debugEnvKey().textContent = authParams.environmentKey;
  elements.debugNonce().textContent = (authParams.nonce || '').substring(0, 20) + '...';
  elements.debugTimestamp().textContent = authParams.timestamp;
  
  // Enable submit button
  elements.submitBtn().disabled = false;
  
  updateDebugStatus('Auth params loaded');
  console.log('Auth params populated in form');
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
}

function updateDebugStatus(status) {
  elements.debugStatus().textContent = status;
}
