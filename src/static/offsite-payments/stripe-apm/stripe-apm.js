/**
 * Stripe APM Flow - Spreedly Web SDK Demo
 * 
 * This flow demonstrates Stripe Alternative Payment Methods using
 * the SDK's SpreedlyStripeAPM class.
 * 
 * Flow:
 * 1. Load Spreedly SDK (exposes SpreedlyStripeAPM)
 * 2. Create pending purchase on Spreedly backend
 * 3. Get client_secret from response
 * 4. Initialize SpreedlyStripeAPM with config
 * 5. Mount Stripe Payment Element
 * 6. User selects payment method and submits
 * 7. User is redirected to complete payment
 */

// State
let stripeAPM = null;
let transactionToken = null;
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51T1N7JDWwvL2jfwiHgQ7xLqMHbLqhyQMLRwGpvHVsEHzKwbE75W4F5VcYNGQSfR9yIsjGdGm5oQnntSeQvW9lvfb00WkyYZctJ';

// DOM Elements
const elements = {
  loadingState: () => document.getElementById('loading-state'),
  paymentSection: () => document.getElementById('payment-section'),
  errorState: () => document.getElementById('error-state'),
  errorMessage: () => document.getElementById('error-message'),
  paymentElementContainer: () => document.getElementById('payment-element-container'),
  submitBtn: () => document.getElementById('submit-btn'),
  statusMessage: () => document.getElementById('status-message'),
  amountInput: () => document.getElementById('amount-input'),
  currencySelector: () => document.getElementById('currency-selector'),
  debugTransactionToken: () => document.getElementById('debug-transaction-token'),
  debugState: () => document.getElementById('debug-state'),
  debugStatus: () => document.getElementById('debug-status'),
};

// Initialization - handle both cases: script loaded before or after DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM is already ready (script at bottom of body)
  init();
}

async function init() {
  updateDebugStatus('Loading Spreedly SDK...');
  
  try {
    // Load Spreedly SDK first (this exposes SpreedlyStripeAPM globally)
    await loadSpreedlySDK();
    
    updateDebugStatus('Creating pending transaction...');
    
    // Create pending purchase to get client_secret
    const pendingPurchase = await createPendingPurchase();
    
    
    transactionToken = pendingPurchase.transaction.token;
    
    // Update debug info
    elements.debugTransactionToken().textContent = transactionToken;
    elements.debugState().textContent = pendingPurchase.transaction.state;
    updateDebugStatus('Pending transaction created');
    
    // Initialize SpreedlyStripeAPM
    await initializeStripeAPM(pendingPurchase);
    
    // Show payment section
    hideLoading();
    elements.paymentSection().classList.remove('hidden');
    
    // Set up submit handler
    setupSubmitHandler();
    
    updateDebugStatus('Ready');
  } catch (error) {
    console.error('Failed to initialize:', error);
    showError(error.message || 'Failed to initialize. Please refresh the page.');
  }
}

async function createPendingPurchase() {
  // Read amount and currency from URL query params (passed from offsite-payments page)
  // Fall back to form inputs or defaults if not provided
  const urlParams = new URLSearchParams(window.location.search);
  const amountFromUrl = urlParams.get('amount');
  const currencyFromUrl = urlParams.get('currency');
  
  const amount = amountFromUrl 
    ? parseInt(amountFromUrl, 10) 
    : Math.round(parseFloat(elements.amountInput()?.value || '10.00') * 100);
  const currency = currencyFromUrl || elements.currencySelector()?.value || 'EUR';
  
  console.log('Creating pending purchase with:', { amount, currency });
  
  // Configure redirect URLs
  // Use production URL for Stripe redirects (Stripe requires public URLs)
  // For local testing, deploy changes first or use ngrok
  const baseUrl = 'https://checkout-web-sample-app-049a3c617015.herokuapp.com' || window.location.origin;
  const redirectUrl = `${baseUrl}/offsite-payments/handle_redirect.html`;
  const callbackUrl = `${baseUrl}/api/v1/offsite-callback`;
  
  const response = await axios.post(`${API_BASE_URL}/stripe-apm-purchase`, {
    amount,
    currency_code: currency,
    apm_types: ['ideal', 'bancontact', 'eps', 'p24', 'sepa_debit'],
    redirect_url: redirectUrl,
    callback_url: callbackUrl,
  });
  
  return response.data;
}

async function initializeStripeAPM(pendingPurchase) {
  updateDebugStatus('Initializing Stripe APM...');

  // Prepare the container
  const container = elements.paymentElementContainer();
  container.classList.remove('loading');
  container.innerHTML = '<div id="payment-element"></div>';

  const config = {
    publishableKey: STRIPE_PUBLISHABLE_KEY,
    clientSecret: pendingPurchase.transaction.gateway_specific_response_fields.stripe_payment_intents.client_secret,
    transactionToken: pendingPurchase.transaction.token,
    paymentElement: 'payment-element',
    appearance: {
      theme: 'stripe',
      variables: {
        colorPrimary: '#0a0a0a',
      },
    },
  };

  stripeAPM = new SpreedlyStripeAPM(config);
  
  // Mount the Payment Element
  const mountResult = stripeAPM.mount();
  
  if (mountResult.error) {
    throw new Error(mountResult.error);
  }
  
  // Enable submit button
  elements.submitBtn().disabled = false;
  
  updateDebugStatus('Payment Element mounted');
}


function setupSubmitHandler() {
  const submitBtn = elements.submitBtn();
  
  submitBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    await handleSubmit();
  });
}

async function handleSubmit() {
  if (!stripeAPM) {
    showStatusMessage('Payment not initialized', 'error');
    return;
  }
  
  const submitBtn = elements.submitBtn();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Processing...';
  updateDebugStatus('Confirming payment...');
  
  try {
    const result = await stripeAPM.confirmPayment();
    
    if (result.error) {
      showStatusMessage(result.error, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Pay Now';
      updateDebugStatus('Error');
    }
    // If no error, user has been redirected
  } catch (error) {
    console.error('Payment confirmation failed:', error);
    showStatusMessage(error.message || 'Payment failed', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Pay Now';
    updateDebugStatus('Error');
  }
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

// Load Spreedly SDK (returns a promise)
function loadSpreedlySDK() {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (typeof SpreedlyStripeAPM !== 'undefined') {
      console.log('SpreedlyStripeAPM already available');
      resolve();
      return;
    }
    
    // Use loadSDKScript from utils.js
    if (typeof loadSDKScript === 'function') {
      loadSDKScript((error) => {
        if (error) {
          reject(error);
        } else if (typeof SpreedlyStripeAPM !== 'undefined') {
          console.log('SpreedlyStripeAPM loaded from SDK');
          resolve();
        } else {
          reject(new Error('SDK loaded but SpreedlyStripeAPM not available'));
        }
      });
    } else {
      reject(new Error('loadSDKScript not available - ensure utils.js is loaded'));
    }
  });
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (stripeAPM) {
    stripeAPM.destroy();
  }
});
