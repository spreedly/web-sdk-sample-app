/**
 * Braintree PayPal/Venmo Demo
 * Uses SpreedlyBraintree SDK class for PayPal and Venmo payments
 */

// State
let transactionToken = null;
let braintreeInstance = null;

// DOM Elements
const elements = {
  loadingState: null,
  paymentSection: null,
  errorState: null,
  errorMessage: null,
  amountInput: null,
  currencySelector: null,
  currencySymbol: null,
  paymentButtonsLoading: null,
  paymentButtonsContainer: null,
  resultCard: null,
  resultTitle: null,
  resultMessage: null,
  statusMessage: null,
  debugTransactionToken: null,
  debugState: null,
  debugStatus: null,
  debugNonce: null,
};

// Currency symbols
const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
};

/**
 * Initialize DOM element references
 */
function initElements() {
  elements.loadingState = document.getElementById('loading-state');
  elements.paymentSection = document.getElementById('payment-section');
  elements.errorState = document.getElementById('error-state');
  elements.errorMessage = document.getElementById('error-message');
  elements.amountInput = document.getElementById('amount-input');
  elements.currencySelector = document.getElementById('currency-selector');
  elements.currencySymbol = document.getElementById('currency-symbol');
  elements.paymentButtonsLoading = document.getElementById('payment-buttons-loading');
  elements.paymentButtonsContainer = document.getElementById('payment-buttons-container');
  elements.resultCard = document.getElementById('result-card');
  elements.resultTitle = document.getElementById('result-title');
  elements.resultMessage = document.getElementById('result-message');
  elements.statusMessage = document.getElementById('status-message');
  elements.debugTransactionToken = document.getElementById('debug-transaction-token');
  elements.debugState = document.getElementById('debug-state');
  elements.debugStatus = document.getElementById('debug-status');
  elements.debugNonce = document.getElementById('debug-nonce');
}

/**
 * Update debug panel
 */
function updateDebug(field, value) {
  const el = elements[`debug${field.charAt(0).toUpperCase() + field.slice(1)}`];
  if (el) el.textContent = value || '—';
}

/**
 * Show error state
 */
function showError(message) {
  elements.loadingState?.classList.add('hidden');
  elements.paymentSection?.classList.add('hidden');
  elements.errorState?.classList.remove('hidden');
  if (elements.errorMessage) elements.errorMessage.textContent = message;
  updateDebug('status', `Error: ${message}`);
}

/**
 * Show payment section
 */
function showPaymentSection() {
  elements.loadingState?.classList.add('hidden');
  elements.errorState?.classList.add('hidden');
  elements.paymentSection?.classList.remove('hidden');
}

/**
 * Show result card
 */
function showResult(isSuccess, title, message) {
  elements.resultCard?.classList.remove('hidden', 'success', 'error');
  elements.resultCard?.classList.add(isSuccess ? 'success' : 'error');
  if (elements.resultTitle) elements.resultTitle.textContent = title;
  if (elements.resultMessage) elements.resultMessage.textContent = message;
}

/**
 * Update status message
 */
function setStatus(message, type = 'info') {
  if (elements.statusMessage) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `status-message ${type}`;
  }
}

/**
 * Create pending Braintree purchase
 */
async function createPendingPurchase() {
  const amount = Math.round(parseFloat(elements.amountInput?.value || '10') * 100);
  const currencyCode = elements.currencySelector?.value || 'USD';

  // Get base URL for redirects
  const baseUrl = 'https://checkout-web-sample-app-049a3c617015.herokuapp.com';

  const response = await axios.post(`${API_BASE_URL}/braintree-purchase`, {
    amount,
    currency_code: currencyCode,
    payment_method_type: 'paypal',
    paypal_flow: 'checkout',
    redirect_url: `${baseUrl}/offsite-payments/handle_redirect.html`,
    callback_url: `${baseUrl}/api/v1/offsite-callback`,
  });

  return response.data;
}

/**
 * Confirm Braintree transaction with nonce
 */
async function confirmTransaction(state, nonce, payment_method_type) {
  const response = await axios.post(
    `${API_BASE_URL}/transactions/${transactionToken}/confirm`,
    {
      // For test purposes, to simulate a successful transaction,
      // If a nonce is not provided, we will set the state to Successful.
      state: !nonce ? 'Successful' : state,
      // For test purposes, to simulate a successful transaction,
      // we will use a fake nonce if one is not provided.
      nonce: nonce || 'fake-venmo-account-nonce',
      payment_method_type,
    }
  );
  return response.data;
}

/**
 * Load Spreedly SDK script
 */
async function loadSpreedlySDK() {
  await new Promise((resolve, reject) => {
    SpreedlyUtils.loadSDKScript((error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });

  // Verify SpreedlyBraintree is available
  if (typeof window.SpreedlyBraintree === 'undefined') {
    throw new Error('SpreedlyBraintree is not available. Make sure the SDK is properly loaded.');
  }
}

/**
 * Initialize Braintree via SDK
 */
async function initializeBraintree() {
  updateDebug('status', 'Initializing SpreedlyBraintree...');

  // Get auth params for environment key
  const authParams = await SpreedlyUtils.fetchAuthParams();

  // Create SpreedlyBraintree instance with BOTH PayPal and Venmo
  braintreeInstance = new window.SpreedlyBraintree({
    transactionToken,
    environmentKey: authParams.environmentKey,
    paymentElements: {
      paypal: 'paypal-button',
      venmo: 'venmo-button',
    },
    onPaymentResult: handlePaymentResult,
    onButtonAction: handleButtonAction,
    style: {
      paypal: {
        color: 'gold',
        shape: 'rect',
        height: 45,
      },
    },
  });

  // Mount the buttons
  const result = await braintreeInstance.mount();

  if (result.error) {
    throw new Error(result.error);
  }

  // Hide loading spinner and show buttons container
  elements.paymentButtonsLoading?.classList.add('hidden');
  elements.paymentButtonsContainer?.classList.remove('hidden');

  // Update status based on what was rendered
  const renderedButtons = [];
  if (result.paypalRendered) renderedButtons.push('PayPal');
  if (result.venmoRendered) renderedButtons.push('Venmo');

  if (renderedButtons.length > 0) {
    updateDebug('status', `${renderedButtons.join(' & ')} button(s) rendered`);
    setStatus(`${renderedButtons.join(' & ')} button(s) ready. Click to pay.`, 'success');
  } else {
    throw new Error('No payment buttons could be rendered');
  }
}

/**
 * Handle payment result callback
 */
async function handlePaymentResult(result) {
  updateDebug('status', `Payment ${result.state}`);

  try {
    setStatus('Confirming transaction...', 'info');
    await confirmTransaction(result.state, result.nonce, result.payment_method.payment_method_type);
    
    // Redirect to handle_redirect page to show transaction result
    window.location.href = `../handle_redirect.html?transaction_token=${transactionToken}`;
  } catch (error) {
    showResult(
      false,
      'Confirmation Failed',
      error.response?.data?.error || error.message
    );
    setStatus('Failed to confirm transaction', 'error');
  }
}

/**
 * Handle button action callback
 */
function handleButtonAction(action) {
  console.log('Button action:', action);
  if (action.state === 'Initiated') {
    updateDebug('status', 'Button initialized');
  } else if (action.state === 'Clicked') {
    updateDebug('status', 'Button clicked');
    setStatus('Opening payment window...', 'info');
  }
}

/**
 * Main initialization
 */
async function init() {
  initElements();
  updateDebug('status', 'Creating pending purchase...');

  try {
    // Load Spreedly SDK
    await loadSpreedlySDK();

    // Create pending purchase
    const purchaseResponse = await createPendingPurchase();

    console.log('Purchase response:', purchaseResponse);
    transactionToken = purchaseResponse.transaction.token;
    updateDebug('transactionToken', transactionToken);
    updateDebug('state', purchaseResponse.transaction.state);

    // Show payment section
    showPaymentSection();

    // Initialize Braintree SDK (renders both PayPal and Venmo)
    await initializeBraintree();
  } catch (error) {
    console.error('Initialization error:', error);
    showError(error.response?.data?.error || error.message);
  }
}

// Start initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
