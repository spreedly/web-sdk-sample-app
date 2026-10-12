/**
 * ACH Payments Flow — Spreedly Web SDK Demo (hosted secure fields)
 *
 * 1. Load the hosted-fields SDK bundle and fetch auth params from the backend
 * 2. Create a SpreedlyACHFields instance and mount the two secure iframes
 *    (routing + account) into container divs
 * 3. On `ready`, the buyer types the numbers straight into the iframes —
 *    they never touch this page. Name / account type / holder type are plain
 *    merchant inputs.
 * 4. Call ach.submit(formData) with only the non-sensitive fields (Spreedly's names, like
 *    the card submit())
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
    // ?sdk=express-checkout → the prebuilt SpreedlyACHForm (ach-form.js).
    if (SpreedlyUtils.getSDKType() === 'express-checkout') {
      await initACHForm();
      return;
    }

    await loadHostedFieldsSDK();

    if (typeof window.SpreedlyACHFields !== 'function') {
      hideLoading();
      elements.paymentSection().classList.remove('hidden');
      showError(
        'SpreedlyACHFields is not available in the loaded SDK bundle. The rc channel only ' +
          'carries it once the ACH hosted-fields branch is merged to the SDK’s main. ' +
          'Point shared/utils.js at a local SDK build to try it now.'
      );
      return;
    }

    await createAchInstanceAndMountFields();
    setupToggleMaskButton();
    setupSubmitHandler();
    setupFieldsPanel(); // ach-fields-panel.js
  } catch (error) {
    console.error('Failed to initialize ACH demo:', error);
    hideLoading();
    elements.paymentSection().classList.remove('hidden');
    showError('Failed to initialize. Please refresh the page.');
  }
}

/**
 * SpreedlyACHFields lives in the hosted-fields bundle only. The `?sdk=express-checkout`
 * mode uses SpreedlyACHForm from the Express Checkout bundle instead (ach-form.js).
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

  ach = new window.SpreedlyACHFields({
    environment_key: authParams.environmentKey,
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.certificateToken,
    signature: authParams.signature,
  });

  ach.on('ready', () => {
    hideLoading();
    elements.paymentSection().classList.remove('hidden');
    // Placeholders and styles (matching the page's own inputs: same font family, size and
    // color — web fonts like DM Sans can't load inside the iframe, so the next font in the
    // list is used), mask state and submit gating, all from the config panel.
    onHfReady(); // ach-fields-panel.js
  });

  // Focus ring: the iframe holds the focus, so mirror it onto the container the way the
  // page's inputs get their :focus border.
  ach.on('fieldStateChange', ({ field, focused }) => {
    const container = document.getElementById(
      field === 'routing' ? 'ach-routing-field' : 'ach-account-field'
    );
    container?.classList.toggle('focused', focused);
  });
  ach.on('fieldStateChange', onHfFieldState); // config panel: gating + event log

  ach.on('tokenGenerated', async ({ tokenResponse }) => {
    const { token, account_number_display_digits: last4 } = tokenResponse.payment_method;
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
    onHfValidation(snapshot); // config panel
  });

  ach.inAppElements({
    routing: { containerId: 'ach-routing-field' },
    account: { containerId: 'ach-account-field' },
  });
}

function setupToggleMaskButton() {
  const button = elements.toggleAccountVisibility();
  if (!button) return;
  // Shares its state with the config panel's "Mask account number" checkbox.
  button.addEventListener('click', () => setHfMasked(!hfPanel.masked));
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
    first_name: (formData.firstName || '').trim(),
    last_name: (formData.lastName || '').trim(),
    bank_name: (formData.bankName || '').trim() || undefined,
    bank_account_type: formData.bankAccountType,
    bank_account_holder_type: formData.bankAccountHolderType,
  });
  console.log('Waiting for tokenGenerated event...');
}

async function runPurchase(paymentMethodToken, last4, storageState) {
  try {
    // Fixed $10 USD for the demo.
    const amount = 1000;
    const currency = 'USD';

    const result = await SpreedlyUtils.createAchPurchase(paymentMethodToken, amount, currency);
    if (result?.success && result?.transaction) {
      renderSuccess({
        paymentMethodToken,
        last4,
        storageState,
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
  btn.textContent = submitting ? 'Processing...' : 'Create payment method & run purchase';
  if (typeof hfPanel === 'undefined') {
    btn.disabled = submitting;
    return;
  }
  hfPanel.submitting = submitting;
  updateHfSubmitEnabled(); // names filled + both secure fields valid
}

function renderSuccess({ paymentMethodToken, last4, storageState, transactionToken, amount, currency }) {
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
    ${storageState ? `<div class="result-row"><span>Storage</span><code>${escape(storageState)}</code></div>` : ''}
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
  SpreedlyUtils.showStatus(statusMessageId(), message, 'error');
}

window.resetAchFlow = function () {
  if (ach && typeof ach.resetFields === 'function') {
    ach.resetFields();
  }
  window.location.href = window.location.pathname + window.location.search;
};

/** The Hosted Fields card holds `status-message`; the Express Checkout mode has its own. */
function statusMessageId() {
  return SpreedlyUtils.getSDKType() === 'express-checkout' ? 'ec-status-message' : 'status-message';
}

function hideLoading() {
  const loading = elements.loadingState();
  if (loading) loading.classList.add('hidden');
}

function showError(message) {
  hideLoading();
  elements.paymentSection().classList.remove('hidden');
  SpreedlyUtils.showStatus(statusMessageId(), message, 'error');
}
