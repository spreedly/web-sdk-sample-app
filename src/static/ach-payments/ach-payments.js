/**
 * ACH Payments Flow — Spreedly Web SDK Demo (hosted secure fields)
 *
 * 1. Load the hosted-fields SDK bundle and fetch auth params from the backend
 * 2. Create a SpreedlyACH instance and mount the two secure iframes
 *    (routing + account) into container divs
 * 3. On `ready`, the buyer types the numbers straight into the iframes —
 *    they never touch this page. Name / account type / holder type are plain
 *    merchant inputs.
 * 4. Call ach.submit(formData) with only the non-sensitive fields
 * 5. Listen for `tokenGenerated` → POST to /api/v1/ach-purchase
 * 6. Render success/failure
 *
 * The routing and account numbers stay inside Spreedly-hosted iframes — the
 * secure-field model, same as card number/CVV. This is the modern replacement
 * for the deprecated setupACHPayment/submitACHPayment API, where the merchant
 * collected the numbers in its own inputs.
 */

let ach = null;

const elements = {
  loadingState: () => document.getElementById('loading-state'),
  paymentSection: () => document.getElementById('payment-section'),
  resultSection: () => document.getElementById('result-section'),
  achForm: () => document.getElementById('ach-form'),
  submitBtn: () => document.getElementById('submit-btn'),
  toggleAccountVisibility: () => document.getElementById('toggle-account-visibility'),
  resultTitle: () => document.getElementById('result-title'),
  resultDetails: () => document.getElementById('result-details'),
  resultIconSuccess: () => document.getElementById('result-icon-success'),
  resultIconError: () => document.getElementById('result-icon-error'),
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    await loadHostedFieldsSDK();

    if (typeof window.SpreedlyACH !== 'function') {
      hideLoading();
      elements.paymentSection().classList.remove('hidden');
      showError(
        'SpreedlyACH is not available in the loaded SDK bundle. The rc channel only ' +
          'carries it once the ACH hosted-fields branch is merged to the SDK’s main. ' +
          'Point shared/utils.js at a local SDK build to try it now.'
      );
      return;
    }

    await createAchInstanceAndMountFields();
    setupToggleMaskButton();
    setupSubmitHandler();
  } catch (error) {
    console.error('Failed to initialize ACH demo:', error);
    hideLoading();
    elements.paymentSection().classList.remove('hidden');
    showError('Failed to initialize. Please refresh the page.');
  }
}

/**
 * ACH secure fields live in the hosted-fields bundle only (v1), so this page
 * always loads that bundle regardless of the `?sdk=` query param the other
 * flows use.
 */
function loadHostedFieldsSDK() {
  return new Promise((resolve, reject) => {
    const src =
      window.location.hostname === 'localhost'
        ? 'http://localhost:5000/index.js'
        : 'https://core-test.spreedly.com/checkout/sdk/rc/index.js';
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load SDK from ${src}`));
    document.body.appendChild(script);
  });
}

async function createAchInstanceAndMountFields() {
  const authParams = await SpreedlyUtils.fetchAuthParams();

  ach = new window.SpreedlyACH({
    environment_key: authParams.environmentKey,
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.certificateToken,
    signature: authParams.signature,
  });

  ach.on('ready', () => {
    hideLoading();
    elements.paymentSection().classList.remove('hidden');
    elements.submitBtn().disabled = false;
    // Field customization, applied inside the iframes.
    ach.setPlaceholder('routing', '021000021');
    ach.setPlaceholder('account', 'Account number');
  });

  ach.on('tokenGenerated', async ({ token, last4 }) => {
    console.log('ACH payment method created:', { token, last4 });
    await runPurchase(token, last4);
  });

  ach.on('error', error => {
    console.error('ACH error:', error);
    renderError(error?.errors?.[0]?.message || error?.message || String(error) || 'ACH failed.');
    setSubmitting(false);
  });

  ach.on('validation', snapshot => {
    // Lengths + validity only — never the values.
    console.log('ACH validation:', snapshot);
  });

  ach.inAppElements({
    routing: { containerId: 'ach-routing-field' },
    account: { containerId: 'ach-account-field' },
  });
}

function setupToggleMaskButton() {
  const button = elements.toggleAccountVisibility();
  if (!button) return;
  let revealed = false;
  button.addEventListener('click', () => {
    ach.toggleMask();
    revealed = !revealed;
    button.textContent = revealed ? 'Hide' : 'Show';
  });
}

function setupSubmitHandler() {
  const form = elements.achForm();
  form.addEventListener('submit', e => {
    e.preventDefault();
    handleSubmit();
  });
}

function handleSubmit() {
  if (!ach) {
    renderError('SDK not initialized.');
    return;
  }

  const formData = SpreedlyUtils.getFormData('ach-form');

  setSubmitting(true);

  // Only the non-sensitive fields. The routing and account numbers are read
  // inside the account iframe — they are never collected on this page.
  ach.submit({
    firstName: (formData.firstName || '').trim(),
    lastName: (formData.lastName || '').trim(),
    bankName: (formData.bankName || '').trim() || undefined,
    bankAccountType: formData.bankAccountType,
    bankAccountHolderType: formData.bankAccountHolderType,
  });
  console.log('Waiting for tokenGenerated event...');
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
  btn.textContent = submitting ? 'Processing...' : 'Create payment method & run purchase';
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
  if (ach && typeof ach.resetFields === 'function') {
    ach.resetFields();
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
