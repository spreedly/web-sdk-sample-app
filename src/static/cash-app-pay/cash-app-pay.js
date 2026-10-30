/**
 * Cash App Pay Demo
 * Uses the SpreedlyCashAppPay standalone class with the merchant-loaded Pay Kit script.
 *
 * The page loads Pay Kit and supplies an empty #cash-app-pay-container; the SDK initializes Pay
 * Kit, renders the button and turns the shopper's approval into a payment method token.
 *
 * Mock: Spreedly Core's Cash App API isn't available yet, so the token and the purchase are
 * synthetic.
 */

const CONTAINER_ID = 'cash-app-pay-container';

// Sandbox Cash App Pay identifiers. Pay Kit accepts a merchantId or a brandId as the payment scope.
const CASH_APP_CLIENT_ID = 'CAS-CI_AFTERPAY';
const CASH_APP_BRAND_ID = 'BRAND_e44pamx63nr4b7ch15v1io5b5';

let cashAppInstance = null;
let lastToken = null;

const elements = {};

/** Initializes DOM element references */
function initElements() {
  elements.loadingState = document.getElementById('loading-state');
  elements.workspace = document.getElementById('cap-workspace');
  elements.errorState = document.getElementById('error-state');
  elements.errorMessage = document.getElementById('error-message');
  elements.amount = document.getElementById('cap-amount');
  elements.reference = document.getElementById('cap-reference');
  elements.btnLabel = document.getElementById('cap-btn-label');
  elements.btnTheme = document.getElementById('cap-btn-theme');
  elements.btnShape = document.getElementById('cap-btn-shape');
  elements.btnSize = document.getElementById('cap-btn-size');
  elements.btnWidth = document.getElementById('cap-btn-width');
  elements.container = document.getElementById(CONTAINER_ID);
  elements.resultCard = document.getElementById('result-card');
  elements.resultTitle = document.getElementById('result-title');
  elements.resultCashtag = document.getElementById('result-cashtag');
  elements.resultExpires = document.getElementById('result-expires');
  elements.resultToken = document.getElementById('result-token');
  elements.resultTransaction = document.getElementById('result-transaction');
  elements.purchaseBtn = document.getElementById('cap-purchase-btn');
  elements.newCheckoutBtn = document.getElementById('cap-new-checkout-btn');
  elements.eventLog = document.getElementById('event-log');
}

/** Appends a timestamped, escaped row to the event log */
function logEvent(message, type = '') {
  const entry = document.createElement('div');
  entry.className = `event-log-entry ${type}`.trim();
  const time = new Date().toLocaleTimeString();
  entry.innerHTML = `<span class="time">${time}</span> ${SpreedlyUtils.escapeHtml(message)}`;
  elements.eventLog.appendChild(entry);
  elements.eventLog.scrollTop = elements.eventLog.scrollHeight;
}

function showFatalError(message) {
  elements.loadingState.classList.add('hidden');
  elements.workspace.classList.add('hidden');
  elements.errorState.classList.remove('hidden');
  elements.errorMessage.textContent = message;
}

/** Order total in cents, or null when the field isn't a positive dollar amount */
function getAmountCents() {
  const value = Number.parseFloat(elements.amount.value);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value * 100);
}

function getReferenceId() {
  const value = elements.reference.value.trim();
  return value || undefined;
}

function getButtonOptions() {
  return {
    label: elements.btnLabel.value,
    shape: elements.btnShape.value,
    size: elements.btnSize.value,
    theme: elements.btnTheme.value,
    width: elements.btnWidth.value,
  };
}

/** This page, so a mobile shopper comes back here and the approval is picked up after setup() */
function getRedirectURL() {
  return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

/** Signed auth details are single-use per checkout, so every new instance fetches fresh ones */
async function fetchAuthDetails() {
  const params = await SpreedlyUtils.fetchAuthParams();
  return {
    certificate_token: params.certificateToken,
    environment_key: params.environmentKey,
    nonce: params.nonce,
    signature: params.signature,
    timestamp: String(params.timestamp),
  };
}

function resetResult() {
  lastToken = null;
  elements.resultCard.classList.add('hidden');
  elements.resultCard.classList.remove('success', 'error');
  elements.resultTitle.textContent = 'Payment method created';
  elements.resultCashtag.textContent = '—';
  elements.resultExpires.textContent = '—';
  elements.resultToken.textContent = '—';
  elements.resultTransaction.textContent = '—';
  elements.purchaseBtn.disabled = true;
}

function registerEvents(instance) {
  instance.on('cashAppReady', () => logEvent('cashAppReady', 'success'));

  instance.on('cashAppApproved', ({ cashtag, expiresAt }) => {
    logEvent(`cashAppApproved: ${cashtag || 'no cashtag'}`, 'success');
    elements.resultCard.classList.remove('hidden', 'error');
    elements.resultTitle.textContent = 'Approved — creating payment method…';
    elements.resultCashtag.textContent = cashtag || '—';
    elements.resultExpires.textContent = expiresAt || '—';
  });

  instance.on('cashAppTokenGenerated', ({ token, paymentMethod }) => {
    lastToken = token;
    logEvent(`cashAppTokenGenerated: ${token}${paymentMethod?.mock ? ' (mock)' : ''}`, 'success');
    elements.resultCard.classList.add('success');
    elements.resultTitle.textContent = 'Payment method created';
    elements.resultToken.textContent = token;
    elements.purchaseBtn.disabled = false;
    SpreedlyUtils.showStatus('status-message', 'Approved. Complete the purchase below.', 'success');
  });

  instance.on('cashAppDeclined', () => {
    logEvent('cashAppDeclined', 'error');
    SpreedlyUtils.showStatus('status-message', 'Declined in Cash App. Start a new checkout to try again.', 'error');
  });

  instance.on('cashAppDismissed', () => {
    logEvent('cashAppDismissed', 'info');
    SpreedlyUtils.showStatus('status-message', 'Cash App Pay was closed.', 'info');
  });

  instance.on('cashAppError', ({ code, message }) => {
    logEvent(`cashAppError ${code}: ${message}`, 'error');
    SpreedlyUtils.showStatus('status-message', `${code}: ${message}`, 'error');
  });
}

/** Destroys any current instance and starts a fresh checkout with the current controls */
async function mountCashAppPay() {
  if (cashAppInstance) {
    cashAppInstance.destroy();
    cashAppInstance = null;
  }
  elements.container.innerHTML = '';
  resetResult();
  SpreedlyUtils.hideStatus('status-message');

  let authDetails;
  try {
    authDetails = await fetchAuthDetails();
  } catch (error) {
    logEvent(`Auth params failed: ${error.message}`, 'error');
    SpreedlyUtils.showStatus('status-message', 'Could not fetch auth params.', 'error');
    return;
  }

  let instance;
  try {
    instance = new window.SpreedlyCashAppPay({
      authDetails,
      brandId: CASH_APP_BRAND_ID,
      button: getButtonOptions(),
      clientId: CASH_APP_CLIENT_ID,
      environment: 'sandbox',
      redirectURL: getRedirectURL(),
      referenceId: getReferenceId(),
      renderTarget: `#${CONTAINER_ID}`,
    });
  } catch (error) {
    logEvent(`Constructor threw: ${error.message}`, 'error');
    SpreedlyUtils.showStatus('status-message', error.message, 'error');
    return;
  }
  cashAppInstance = instance;
  // Before setup(): on a mobile redirect return the approval arrives right after it.
  registerEvents(instance);

  const { error: setupError } = await instance.setup();
  if (setupError || instance !== cashAppInstance) {
    return;
  }
  logEvent('setup() resolved', 'info');
  await beginCheckout();
}

async function beginCheckout() {
  const amount = getAmountCents();
  if (amount === null) {
    SpreedlyUtils.showStatus('status-message', 'Enter an order total greater than 0.', 'error');
    return;
  }
  const { error } = await cashAppInstance.beginCheckout({
    amount,
    currency: 'USD',
    referenceId: getReferenceId(),
  });
  if (!error) {
    logEvent(`beginCheckout({ amount: ${amount} })`, 'info');
  }
}

async function purchase() {
  if (!lastToken) return;
  const amount = getAmountCents();
  SpreedlyUtils.setButtonLoading('cap-purchase-btn', true);
  try {
    const { transaction } = await SpreedlyUtils.createCashAppPayPurchase({
      amount,
      paymentMethodToken: lastToken,
    });
    logEvent(`Purchase ${transaction.state}: ${transaction.token} (mock)`, 'success');
    elements.resultTransaction.textContent = `${transaction.token} · ${transaction.state}`;
    elements.resultTitle.textContent = `Paid ${SpreedlyUtils.formatCurrency(transaction.amount / 100)} (mock)`;
    SpreedlyUtils.showStatus('status-message', 'Mock purchase succeeded.', 'success');
  } catch (error) {
    const message = error?.error || error?.message || 'Purchase failed';
    logEvent(`Purchase failed: ${message}`, 'error');
    elements.resultCard.classList.add('error');
    SpreedlyUtils.showStatus('status-message', message, 'error');
    SpreedlyUtils.setButtonLoading('cap-purchase-btn', false);
    return;
  }
  SpreedlyUtils.setButtonLoading('cap-purchase-btn', false);
  elements.purchaseBtn.disabled = true;
}

function wireControls() {
  // Amount and reference update the open request in place.
  elements.amount.addEventListener('change', () => {
    if (cashAppInstance?.isInitialized()) beginCheckout();
  });
  elements.reference.addEventListener('change', () => {
    if (cashAppInstance?.isInitialized()) beginCheckout();
  });
  document.querySelectorAll('.cap-remount').forEach(control => {
    control.addEventListener('change', () => {
      logEvent('Button option changed — rebuilding', 'info');
      mountCashAppPay();
    });
  });
  elements.purchaseBtn.addEventListener('click', purchase);
  elements.newCheckoutBtn.addEventListener('click', () => {
    logEvent('New checkout', 'info');
    mountCashAppPay();
  });
  window.addEventListener('beforeunload', () => cashAppInstance?.destroy());
}

function init() {
  initElements();

  SpreedlyUtils.loadSDKScript(async loadError => {
    if (loadError) {
      showFatalError('Failed to load the Spreedly SDK.');
      return;
    }
    if (typeof window.SpreedlyCashAppPay !== 'function') {
      showFatalError(
        'This SDK build has no SpreedlyCashAppPay. Run the SDK locally (see the local-SDK toggle in shared/utils.js).'
      );
      return;
    }

    elements.loadingState.classList.add('hidden');
    elements.workspace.classList.remove('hidden');
    wireControls();
    await mountCashAppPay();
  });
}

document.addEventListener('DOMContentLoaded', init);
