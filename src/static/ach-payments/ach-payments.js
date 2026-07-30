/**
 * ACH Payments Flow — Spreedly Web SDK Demo
 *
 * 1. Load SDK and fetch auth params from backend
 * 2. Initialize the SDK with auth params
 * 3. User fills in bank-account details
 * 4. Call setupACHPayment(config) → submitACHPayment()
 * 5. Listen for achTokenGenerated → POST to /api/v1/ach-purchase
 * 6. Render success/failure
 *
 * Note: ACH does NOT use hosted-fields or express-checkout iframes. The
 * merchant collects the values in their own form and passes them to the
 * SDK via the public API. We still load the SpreedlyHostedFields class
 * here because it is the entry point that exposes setupACHPayment.
 */

let sdk = null;

const elements = {
  loadingState: () => document.getElementById('loading-state'),
  paymentSection: () => document.getElementById('payment-section'),
  resultSection: () => document.getElementById('result-section'),
  achForm: () => document.getElementById('ach-form'),
  submitBtn: () => document.getElementById('submit-btn'),
  toggleAccountVisibility: () => document.getElementById('toggle-account-visibility'),
  accountInput: () => document.getElementById('ach-account'),
  resultTitle: () => document.getElementById('result-title'),
  resultDetails: () => document.getElementById('result-details'),
  resultIconSuccess: () => document.getElementById('result-icon-success'),
  resultIconError: () => document.getElementById('result-icon-error'),
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  setupAccountVisibilityToggle();

  try {
    await loadSDKAsync();
    await fetchAuthParamsAndInitSDK();
    setupSubmitHandler();
    hideLoading();
    elements.paymentSection().classList.remove('hidden');
  } catch (error) {
    console.error('Failed to initialize ACH demo:', error);
    showError('Failed to initialize. Please refresh the page.');
  }
}

function loadSDKAsync() {
  return new Promise((resolve, reject) => {
    SpreedlyUtils.loadSDKScript(error => (error ? reject(error) : resolve()));
  });
}

async function fetchAuthParamsAndInitSDK() {
  const authParams = await SpreedlyUtils.fetchAuthParams();

  const authConfig = {
    environment_key: authParams.environmentKey,
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.certificateToken,
    signature: authParams.signature,
  };

  // Either SDK class works for ACH since the methods live on the shared
  // SpreedlyWebSDK base. Pick based on the ?sdk= query param for parity
  // with the other demo flows.
  const sdkType = SpreedlyUtils.getSDKType();
  if (sdkType === 'express-checkout') {
    sdk = new SpreedlyExpressCheckout(authConfig);
  } else {
    sdk = new SpreedlyHostedFields(authConfig);
  }

  sdk.on('achTokenGenerated', async ({ token, last4 }) => {
    console.log('ACH payment method created:', { token, last4 });
    await runPurchase(token, last4);
  });

  sdk.on('achPaymentError', error => {
    console.error('ACH payment error:', error);
    renderError(error?.errors?.[0]?.message || 'Failed to create ACH payment method.');
    setSubmitting(false);
  });

  elements.submitBtn().disabled = false;
}

function setupSubmitHandler() {
  const form = elements.achForm();
  form.addEventListener('submit', e => {
    e.preventDefault();
    handleSubmit();
  });
}

function setupAccountVisibilityToggle() {
  const button = elements.toggleAccountVisibility();
  const input = elements.accountInput();
  if (!button || !input) return;
  button.addEventListener('click', () => {
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    button.textContent = showing ? 'Show' : 'Hide';
  });
}

function handleSubmit() {
  if (!sdk) {
    renderError('SDK not initialized.');
    return;
  }

  const formData = SpreedlyUtils.getFormData('ach-form');

  // Build the config exactly as the SDK expects (camelCase).
  const config = {
    bankRoutingNumber: (formData.bankRoutingNumber || '').trim(),
    bankAccountNumber: (formData.bankAccountNumber || '').trim(),
    firstName: (formData.firstName || '').trim(),
    lastName: (formData.lastName || '').trim(),
    bankName: (formData.bankName || '').trim() || undefined,
    bankAccountType: formData.bankAccountType,
    bankAccountHolderType: formData.bankAccountHolderType,
  };

  setSubmitting(true);

  try {
    sdk.setupACHPayment(config);
    sdk.submitACHPayment();
    console.log('Waiting for achTokenGenerated event...');
  } catch (error) {
    console.error('ACH submit failed:', error);
    renderError(error.message || 'Failed to set up ACH payment.');
    setSubmitting(false);
  }
}

async function runPurchase(paymentMethodToken, last4) {
  try {
    // Fixed $10 USD for the demo.
    const amount = 1000;
    const currency = 'USD';

    const result = await SpreedlyUtils.createAchPurchase(paymentMethodToken, amount, currency);
    if (result?.success && result?.transaction) {
      renderSuccess({
        paymentMethodToken,
        last4,
        transactionToken: result.transaction.token,
        amount,
        currency,
      });
    } else {
      renderError(
        result?.transaction?.response?.message ||
          result?.transaction?.message ||
          'Gateway purchase did not succeed.'
      );
    }
  } catch (error) {
    console.error('Purchase request failed:', error);
    const message = error?.response?.data?.error || error?.message || 'Purchase request failed.';
    renderError(message);
  } finally {
    setSubmitting(false);
  }
}

function setSubmitting(submitting) {
  const btn = elements.submitBtn();
  btn.disabled = submitting;
  btn.textContent = submitting
    ? 'Processing...'
    : 'Create payment method & run purchase';
}

function renderSuccess({ paymentMethodToken, last4, transactionToken, amount, currency }) {
  hideLoading();
  elements.paymentSection().classList.add('hidden');
  elements.resultSection().classList.remove('hidden');
  elements.resultIconSuccess().classList.remove('hidden');
  elements.resultIconError().classList.add('hidden');
  elements.resultTitle().textContent = 'Purchase succeeded';

  const escape = SpreedlyUtils.escapeHtml;
  elements.resultDetails().innerHTML = `
    <div class="result-row"><span>Payment method token</span><code>${escape(paymentMethodToken)}</code></div>
    ${last4 ? `<div class="result-row"><span>Account</span><code>•••• ${escape(last4)}</code></div>` : ''}
    <div class="result-row"><span>Transaction token</span><code>${escape(transactionToken)}</code></div>
    <div class="result-row"><span>Amount</span><code>${SpreedlyUtils.formatCurrency(amount / 100, currency)}</code></div>
  `;
}

function renderError(message) {
  hideLoading();
  elements.paymentSection().classList.remove('hidden');
  elements.resultSection().classList.remove('hidden');
  elements.resultIconSuccess().classList.add('hidden');
  elements.resultIconError().classList.remove('hidden');
  elements.resultTitle().textContent = 'Something went wrong';
  elements.resultDetails().innerHTML = `<div class="result-row"><span>Error</span><span>${SpreedlyUtils.escapeHtml(message)}</span></div>`;
  SpreedlyUtils.showStatus('status-message', message, 'error');
}

window.resetAchFlow = function () {
  if (sdk && typeof sdk.clearACHPayment === 'function') {
    sdk.clearACHPayment();
  }
  window.location.href = window.location.pathname + window.location.search;
};

function hideLoading() {
  const loading = elements.loadingState();
  if (loading) loading.classList.add('hidden');
}

function showError(message) {
  hideLoading();
  elements.paymentSection().classList.remove('hidden');
  SpreedlyUtils.showStatus('status-message', message, 'error');
}
