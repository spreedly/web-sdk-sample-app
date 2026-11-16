/**
 * Headless Apple Pay demo
 *
 * This page runs Apple's sheet with its own Apple Pay JS code, as a merchant with an existing
 * Apple Pay integration would: it draws Apple's button, creates the ApplePaySession, validates the
 * merchant and completes the payment itself. The Spreedly SDK does one thing: turn Apple's approved
 * payment into a Spreedly payment method, with SpreedlyApplePay.tokenize(). It draws nothing and
 * never touches the session.
 *
 * The SDK loads from a build running on your own machine (`npm run dev` in checkout-web-sdk), as on
 * the local-SDK Apple Pay page. Use Chrome on that machine: it lets this HTTPS page load scripts
 * from http://localhost. Every API call goes to this server (same origin).
 */

const API = '/api/v1';
const STORE_LABEL = 'Spreedly Demo Store';

// Local SDK dev servers (checkout-web-sdk `npm run dev`). Fixed localhost URLs only: never take a
// script URL from the page address.
const LOCAL_SDK_URLS = {
  'hosted-fields': 'http://localhost:5000/index.js',
  'express-checkout': 'http://localhost:5173/express-checkout.js',
};

const sdkType = SpreedlyUtils.getSDKType();
const params = new URLSearchParams(window.location.search);
const debugEnabled = params.get('debug') === '1';

const elements = {};
let merchantIdentifier = null; // from GET /api/v1/apple-pay/config
let approvals = 0; // approvals in the current sheet
const debugOnce = {}; // debug switches that fire on the first approval only

// ── Page helpers ──────────────────────────────────────────────────────

function initElements() {
  [
    'amount',
    'button-slot',
    'status-message',
    'result-card',
    'result-title',
    'result-message',
    'event-log',
    'sdk-badge',
    'debug-panel',
    'contacts',
    'recurring',
    'test-card',
    'metadata',
  ].forEach(id => {
    elements[id] = document.getElementById(id);
  });
}

function log(label, data) {
  const time = new Date().toISOString().slice(11, 19);
  const text = data === undefined ? '' : `\n${JSON.stringify(data, null, 2)}`;
  elements['event-log'].textContent = `[${time}] ${label}${text}\n\n${elements['event-log'].textContent}`;
}

function setStatus(message, type = 'info') {
  const el = elements['status-message'];
  el.textContent = message;
  el.className = `status-message visible ${type}`;
}

function showResult(title, message, type) {
  elements['result-card'].className = `result-card ${type}`;
  elements['result-title'].textContent = title;
  elements['result-message'].textContent = message;
}

const isDebug = name =>
  debugEnabled && document.querySelector(`[data-debug="${name}"]`)?.checked === true;

/** True the first time a "once" debug switch is checked in a sheet, false after that. */
function debugFiresOnce(name) {
  if (!isDebug(name) || debugOnce[name]) {
    return false;
  }
  debugOnce[name] = true;
  return true;
}

const toCents = amount => Math.round(Number(amount) * 100);

async function postJson(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(`${path} answered ${res.status}`);
    error.data = data;
    throw error;
  }
  return data;
}

/** `key=value, key=value` from the metadata field, or undefined when blank. */
function parseMetadata(value) {
  const pairs = value
    .split(',')
    .map(pair => pair.trim())
    .filter(Boolean)
    .map(pair => pair.split('=').map(part => part.trim()));
  return pairs.length ? Object.fromEntries(pairs) : undefined;
}

// ── The merchant's own Apple Pay code ─────────────────────────────────

/** Built synchronously from the form: Apple needs begin() inside the click, with nothing awaited. */
function buildPaymentRequest() {
  const amount = elements.amount.value.trim();
  const request = {
    countryCode: 'US',
    currencyCode: 'USD',
    total: { label: STORE_LABEL, amount },
    supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
    merchantCapabilities: ['supports3DS'],
  };
  if (elements.contacts.checked) {
    request.requiredBillingContactFields = ['postalAddress', 'name'];
    request.requiredShippingContactFields = ['email', 'phone'];
  }
  if (elements.recurring.checked) {
    request.recurringPaymentRequest = {
      paymentDescription: 'Demo monthly plan',
      regularBilling: {
        label: 'Monthly plan',
        amount,
        paymentTiming: 'recurring',
        recurringPaymentIntervalUnit: 'month',
        recurringPaymentIntervalCount: 1,
      },
      managementURL: `${window.location.origin}/`,
    };
  }
  return request;
}

/** Fresh signed Spreedly auth from this server. Spreedly accepts each nonce once. */
async function getFreshSpreedlyAuth() {
  const res = await fetch(`${API}/auth/params`);
  if (!res.ok) {
    throw new Error(`auth/params answered ${res.status}`);
  }
  const p = await res.json();
  return {
    environment_key: p.environmentKey,
    certificate_token: p.certificateToken,
    nonce: p.nonce,
    signature: p.signature,
    timestamp: String(p.timestamp),
  };
}

/** Whether Apple issued a merchant token (usable for later charges) or a device token. */
function describeTokenType(result) {
  return result.isMerchantToken
    ? `Merchant token ${result.merchantTokenIdentifier}.`
    : 'Device token (not a merchant token).';
}

/**
 * Runs inside onpaymentauthorized: tokenize with the SDK, then charge on the server. Returns the
 * status for Apple's completePayment.
 */
async function tokenizeAndCharge(payment) {
  approvals += 1;
  let authDetails;
  try {
    authDetails = await getFreshSpreedlyAuth(); // new auth for every approval, retries included
  } catch (error) {
    log('getFreshSpreedlyAuth failed', { message: error.message });
    setStatus('Could not get Spreedly auth. Try again.', 'error');
    return ApplePaySession.STATUS_FAILURE;
  }
  if (debugFiresOnce('missingNonce')) {
    delete authDetails.nonce; // shows DEVELOPER_ERROR; nothing reaches Spreedly
  }

  const testCardNumber = elements['test-card'].value.trim();
  const metadata = parseMetadata(elements.metadata.value);
  const { result, error } = await SpreedlyApplePay.tokenize({
    payment,
    authDetails,
    ...(testCardNumber ? { testCardNumber } : {}),
    ...(metadata ? { metadata } : {}),
  });

  if (error) {
    log(`tokenize() error (approval ${approvals})`, error);
    setStatus(`${error.code}: ${error.message} The shopper can try again in the sheet.`, 'error');
    return ApplePaySession.STATUS_FAILURE;
  }
  // Logged without the payment method object, which carries nothing the demo needs to show.
  const { paymentMethod, ...shown } = result;
  log(`tokenize() result (approval ${approvals})`, shown);

  if (debugFiresOnce('declinePurchase')) {
    log('purchase declined (debug)', { token: result.token });
    setStatus('The charge was declined (debug). The shopper can try again in the sheet.', 'error');
    return ApplePaySession.STATUS_FAILURE;
  }

  try {
    const data = await postJson('/simple-purchase', {
      payment_method_token: result.token,
      amount: toCents(elements.amount.value.trim()),
      currency_code: 'USD',
    });
    log('purchase', { success: data.success, state: data.transaction?.state });
    setStatus(
      data.success ? 'Payment complete.' : 'The charge was declined. The shopper can try again in the sheet.',
      data.success ? 'success' : 'error'
    );
    showResult(
      data.success ? 'Paid' : 'Declined',
      `${data.transaction?.message || ''} Token ${result.token}. ${describeTokenType(result)}`,
      data.success ? 'success' : 'error'
    );
    return data.success ? ApplePaySession.STATUS_SUCCESS : ApplePaySession.STATUS_FAILURE;
  } catch (purchaseError) {
    log('purchase failed', { message: purchaseError.message });
    showResult('Purchase failed', purchaseError.message, 'error');
    return ApplePaySession.STATUS_FAILURE;
  }
}

function onTap() {
  const request = buildPaymentRequest();
  const version = ApplePaySession.supportsVersion(14) ? 14 : 3;
  let session;
  try {
    session = new ApplePaySession(version, request);
  } catch (error) {
    log('ApplePaySession could not start', { message: error.message });
    setStatus(error.message, 'error');
    return;
  }
  approvals = 0;
  Object.keys(debugOnce).forEach(key => delete debugOnce[key]);
  elements['result-card'].classList.add('hidden');

  session.onvalidatemerchant = async event => {
    log('onvalidatemerchant', { validationURL: event.validationURL });
    try {
      // The server ignores validationURL and calls Apple's fixed host.
      session.completeMerchantValidation(
        await postJson('/apple-pay/validate', { validationURL: event.validationURL })
      );
    } catch (error) {
      log('merchant validation failed', { message: error.message });
      setStatus('Merchant validation failed. See the event log.', 'error');
      session.abort();
    }
  };

  session.onpaymentauthorized = async event => {
    log('onpaymentauthorized', { card: event.payment.token.paymentMethod?.displayName });
    session.completePayment({ status: await tokenizeAndCharge(event.payment) });
  };

  session.oncancel = () => {
    log('oncancel');
    setStatus('The sheet closed.', 'info');
  };

  session.begin();
  log('session.begin()', { version, request });
  setStatus('Sheet open.', 'info');
}

// ── Page setup ────────────────────────────────────────────────────────

/** The merchant's own checks before drawing Apple's button. */
async function drawButton() {
  if (window.ApplePayWebOptions?.set) {
    window.ApplePayWebOptions.set({ environment: 'sandbox' }); // sandbox banner in non-Safari browsers
  }
  if (!window.ApplePaySession || !customElements.get('apple-pay-button')) {
    setStatus("Apple's Apple Pay script didn't load, or this browser can't use it.", 'error');
    return;
  }
  if (window.location.protocol !== 'https:' || !ApplePaySession.canMakePayments()) {
    setStatus('Apple Pay is unavailable here: it needs HTTPS and a device that supports it.', 'error');
    return;
  }
  const button = document.createElement('apple-pay-button');
  button.setAttribute('buttonstyle', 'black');
  button.setAttribute('type', 'plain');
  button.setAttribute('locale', 'en-US');
  button.addEventListener('click', onTap);
  elements['button-slot'].replaceChildren(button);
  setStatus('Apple Pay is ready. Tap the button.', 'success');
}

async function loadServerConfig() {
  const res = await fetch(`${API}/apple-pay/config`);
  const data = await res.json();
  merchantIdentifier = data.merchantIdentifier;
  log('server Apple Pay config', data);
}

function loadSDK() {
  const url = LOCAL_SDK_URLS[sdkType] || LOCAL_SDK_URLS['hosted-fields'];
  log('loading SDK', { sdk: sdkType, url });
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = () =>
      reject(new Error(`Could not load ${url}. Is the SDK running locally (npm run dev in checkout-web-sdk)?`));
    document.body.appendChild(script);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initElements();
  // The cart total from the Apple Pay start page, when it's a valid amount.
  const amount = params.get('amount');
  if (amount && /^\d+(\.\d{2})?$/.test(amount)) {
    elements.amount.value = amount;
  }
  document.getElementById('back-link').href = `../apple-pay/index.html?sdk=${encodeURIComponent(sdkType)}`;
  elements['sdk-badge'].textContent = `Apple Pay headless · ${
    sdkType === 'express-checkout' ? 'Express Checkout' : 'Hosted Fields'
  } bundle`;
  if (debugEnabled) {
    elements['debug-panel'].classList.remove('hidden');
  }

  try {
    await Promise.all([loadServerConfig(), loadSDK()]);
  } catch (error) {
    setStatus(error.message, 'error');
    return;
  }
  if (typeof window.SpreedlyApplePay?.tokenize !== 'function') {
    setStatus('This SDK build has no SpreedlyApplePay.tokenize(). Run an SDK branch that has it.', 'error');
    return;
  }
  if (!merchantIdentifier) {
    setStatus('No Apple Merchant ID: set APPLE_PAY_MERCHANT_ID on this server.', 'error');
    return;
  }
  // Apple's script defines <apple-pay-button>; give it up to 10 s, as the SDK does.
  await Promise.race([
    customElements.whenDefined('apple-pay-button'),
    new Promise(resolve => setTimeout(resolve, 10000)),
  ]);
  await drawButton();
});
