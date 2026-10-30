/**
 * Apple Pay Demo
 *
 * Hosted Fields (?sdk=hosted-fields): the standalone SpreedlyApplePay class draws Apple's button
 * into #apple-pay-button-container.
 * Express Checkout (?sdk=express-checkout): expressCheckout({ applePay }) draws the same button in
 * a wallet row above the card form.
 *
 * The SDK loads from a build running on your own machine (`npm run dev` in checkout-web-sdk), so
 * an SDK branch can be tested on this registered domain before it reaches the CDN. Use Chrome on
 * that machine: it lets this HTTPS page load scripts from http://localhost.
 *
 * Every API call goes to this server (same origin): merchant validation needs the Merchant
 * Identity Certificate, which only the server holds.
 */

const API = '/api/v1';
const CURRENCY = 'USD';
const BUTTON_CONTAINER_ID = 'apple-pay-button-container';
const EC_CONTAINER_ID = 'ec-container';

// Local SDK dev servers (checkout-web-sdk `npm run dev`). Fixed localhost URLs only: never take a
// script URL from the page address.
const LOCAL_SDK_URLS = {
  'hosted-fields': 'http://localhost:5000/index.js',
  'express-checkout': 'http://localhost:5173/express-checkout.js',
};

const params = new URLSearchParams(window.location.search);
const sdkType = SpreedlyUtils.getSDKType();
const debugEnabled = params.get('debug') === '1';

const elements = {};
let applePay = null; // SpreedlyApplePay (Hosted Fields mode)
let expressCheckout = null; // SpreedlyExpressCheckout (Express Checkout mode)
let authAttempts = 0;
let merchantIdentifier = null; // from GET /api/v1/apple-pay/config
const debugOnce = {}; // debug switches that fire on the first attempt only

// ── Page helpers ──────────────────────────────────────────────────────

function initElements() {
  [
    'amount',
    'update-total',
    'button-type',
    'button-style',
    'button-locale',
    'test-card',
    'require-contacts',
    'recurring',
    'apply-settings',
    'ec-container',
    'status-message',
    'result-card',
    'result-title',
    'result-message',
    'debug-panel',
    'destroy-button',
    'event-log',
    'sdk-badge',
    'sdk-surface',
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

/** True the first time a "once" debug switch is checked, false after that until it's reset. */
function debugFiresOnce(name) {
  if (!isDebug(name) || debugOnce[name]) {
    return false;
  }
  debugOnce[name] = true;
  return true;
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Converts '10.00' to 1000 for Spreedly's purchase API. */
const toCents = amount => Math.round(Number(amount) * 100);

function chargeMode() {
  return document.querySelector('input[name="charge-mode"]:checked')?.value || 'after-token';
}

// ── Server calls (same origin) ────────────────────────────────────────

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

/** onValidateMerchant: this server asks Apple for a merchant session over mutual TLS. */
async function validateMerchant({ validationURL }) {
  log('onValidateMerchant', { validationURL });
  if (isDebug('slowValidation')) {
    await wait(25000);
  }
  if (isDebug('failValidation')) {
    throw new Error('Debug: merchant validation failed');
  }
  // The server ignores validationURL and calls Apple's fixed host.
  return postJson('/apple-pay/validate', { validationURL });
}

/** getAuthDetails: fresh, server-signed Spreedly auth for every attempt (a nonce works once). */
async function getAuthDetails() {
  authAttempts += 1;
  log(`getAuthDetails (attempt ${authAttempts})`);
  if (isDebug('slowAuth')) {
    await wait(8000);
  }
  if (debugFiresOnce('failFirstAuth')) {
    throw new Error('Debug: the first getAuthDetails failed');
  }
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

/** Charges the Spreedly payment method on the test gateway. */
async function purchase(token) {
  return postJson('/simple-purchase', {
    payment_method_token: token,
    amount: toCents(elements.amount.value),
    currency_code: CURRENCY,
  });
}

/** processPayment: charge while the sheet is still open, so the sheet shows the real result. */
async function processPayment(result) {
  log('processPayment', { token: result.token, cardType: result.cardType });
  if (isDebug('slowPurchase')) {
    await wait(20000);
  }
  if (debugFiresOnce('declinePurchase')) {
    return { success: false };
  }
  if (debugFiresOnce('addressUnserviceable')) {
    return {
      success: false,
      errors: [
        {
          code: 'addressUnserviceable',
          contactField: 'postalAddress',
          message: 'We can’t ship to this address',
        },
      ],
    };
  }
  const data = await purchase(result.token);
  log('purchase (inside the sheet)', { success: data.success, state: data.transaction?.state });
  return { success: data.success === true };
}

// ── Apple Pay config and events ───────────────────────────────────────

function buildApplePayConfig() {
  const amount = elements.amount.value.trim();
  const config = {
    merchantIdentifier,
    countryCode: 'US',
    currencyCode: CURRENCY,
    total: { label: 'Spreedly Demo Store', amount },
    onValidateMerchant: validateMerchant,
    getAuthDetails,
    button: {
      type: elements['button-type'].value,
      style: elements['button-style'].value,
      locale: elements['button-locale'].value.trim() || undefined,
    },
    metadata: { demo: 'apple-pay' },
  };
  const testCard = elements['test-card'].value.trim();
  if (testCard) {
    config.testCardNumber = testCard;
  }
  if (elements['require-contacts'].checked) {
    config.requiredBillingContactFields = ['name', 'postalAddress'];
    config.requiredShippingContactFields = ['email', 'phone'];
  }
  if (elements.recurring.checked) {
    config.recurringPaymentRequest = {
      paymentDescription: 'Spreedly demo monthly plan',
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
  if (chargeMode() === 'process-payment') {
    config.processPayment = processPayment;
  }
  return config;
}

const EVENTS = [
  'applePayReady',
  'applePayUnavailable',
  'applePayButtonClicked',
  'applePayPaymentAuthorized',
  'applePayTokenGenerated',
  'applePayCancelled',
  'applePayError',
];

function listen(target) {
  EVENTS.forEach(event => target.on(event, payload => handleEvent(event, payload)));
}

async function handleEvent(event, payload) {
  // Logged without the payment method object, which carries nothing the demo needs to show.
  const { paymentMethod, ...shown } = payload || {};
  log(event, Object.keys(shown).length ? shown : undefined);

  if (event === 'applePayReady') {
    setStatus('Apple Pay is ready. Tap the button.', 'success');
  } else if (event === 'applePayUnavailable') {
    setStatus(`Apple Pay is unavailable here (${payload.reason}).`, 'error');
  } else if (event === 'applePayButtonClicked') {
    authAttempts = 0;
    elements['result-card'].classList.add('hidden');
  } else if (event === 'applePayCancelled') {
    setStatus('The shopper closed the sheet.', 'info');
  } else if (event === 'applePayError') {
    setStatus(`${payload.code}: ${payload.message}`, 'error');
  } else if (event === 'applePayTokenGenerated') {
    await onTokenGenerated(payload);
  }
}

async function onTokenGenerated(result) {
  const closedEarly = result.sheetClosedEarly ? ' (the sheet closed before the result)' : '';
  if (chargeMode() === 'process-payment') {
    showResult('Paid', `Charged inside the sheet${closedEarly}. Token ${result.token}.`, 'success');
    return;
  }
  // Charge after the token: the sheet has already shown success.
  try {
    const data = await purchase(result.token);
    log('purchase (after the token)', { success: data.success, state: data.transaction?.state });
    showResult(
      data.success ? 'Paid' : 'Declined',
      `${data.transaction?.message || ''} Token ${result.token}.`,
      data.success ? 'success' : 'error'
    );
  } catch (error) {
    showResult('Purchase failed', error.message, 'error');
  }
}

// ── Mounting ──────────────────────────────────────────────────────────

function teardown() {
  applePay?.destroy();
  applePay = null;
  expressCheckout?.close(true);
  expressCheckout = null;
  document.getElementById(BUTTON_CONTAINER_ID).innerHTML = '';
  Object.keys(debugOnce).forEach(key => delete debugOnce[key]);
}

async function mountHostedFieldsMode() {
  if (typeof window.SpreedlyApplePay !== 'function') {
    setStatus(
      'This SDK build has no SpreedlyApplePay. Run an SDK build with Apple Pay locally (npm run dev in checkout-web-sdk).',
      'error'
    );
    return;
  }
  try {
    applePay = new window.SpreedlyApplePay(buildApplePayConfig());
  } catch (error) {
    setStatus(`Config error: ${error.message}`, 'error');
    return;
  }
  listen(applePay);
  const { error } = await applePay.mount(BUTTON_CONTAINER_ID);
  if (error) {
    log('mount() returned an error', { error });
  }
}

async function mountExpressCheckoutMode() {
  if (typeof window.SpreedlyExpressCheckout !== 'function') {
    setStatus('Express Checkout did not load.', 'error');
    return;
  }
  elements[EC_CONTAINER_ID].classList.remove('hidden');
  try {
    // Express Checkout's own auth is used for cards only; Apple Pay gets fresh auth per attempt.
    expressCheckout = new window.SpreedlyExpressCheckout(await getAuthDetails());
  } catch (error) {
    setStatus(`Could not start Express Checkout: ${error.message}`, 'error');
    return;
  }
  authAttempts = 0;
  listen(expressCheckout);
  expressCheckout.on('tokenGenerated', payload =>
    log('tokenGenerated (card form)', { token: payload?.payment_method?.token })
  );
  expressCheckout.expressCheckout({
    parentContainerId: EC_CONTAINER_ID,
    applePay: buildApplePayConfig(),
  });
}

async function loadServerConfig() {
  const res = await fetch(`${API}/apple-pay/config`);
  const data = await res.json();
  merchantIdentifier = data.merchantIdentifier;
  log('server Apple Pay config', data);
  if (!data.configured) {
    setStatus(
      'This server has no Apple Pay settings (APPLE_PAY_* env vars), so merchant validation will fail. See the README.',
      'error'
    );
  }
}

async function mount() {
  teardown();
  if (!merchantIdentifier) {
    setStatus('No Apple Merchant ID: set APPLE_PAY_MERCHANT_ID on this server.', 'error');
    return;
  }
  if (window.ApplePayWebOptions?.set) {
    window.ApplePayWebOptions.set({ environment: 'sandbox' }); // sandbox banner in non-Safari browsers
  }
  setStatus('Checking whether Apple Pay can be offered…', 'info');
  if (sdkType === 'express-checkout') {
    await mountExpressCheckoutMode();
  } else {
    await mountHostedFieldsMode();
  }
}

function updateTotal() {
  const update = { total: { label: 'Spreedly Demo Store', amount: elements.amount.value.trim() } };
  try {
    if (applePay) {
      applePay.setTotal(update);
    } else if (expressCheckout) {
      expressCheckout.setApplePayTotal(update);
    }
    log('total updated for the next tap', update.total);
  } catch (error) {
    setStatus(`Invalid total: ${error.message}`, 'error');
  }
}

// ── SDK loading ───────────────────────────────────────────────────────

function loadSDK() {
  const url = LOCAL_SDK_URLS[sdkType];
  log('loading SDK', { sdk: sdkType, url });
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${url}. Is the SDK running locally (npm run dev in checkout-web-sdk)?`));
    document.body.appendChild(script);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  initElements();
  const surface = sdkType === 'express-checkout' ? 'Express Checkout' : 'Hosted Fields';
  elements['sdk-badge'].textContent = `Apple Pay · ${surface}`;
  elements['sdk-surface'].textContent =
    sdkType === 'express-checkout' ? 'expressCheckout({ applePay })' : 'SpreedlyApplePay';
  if (debugEnabled) {
    elements['debug-panel'].classList.remove('hidden');
  }

  elements['update-total'].addEventListener('click', updateTotal);
  elements['apply-settings'].addEventListener('click', mount);
  elements['destroy-button'].addEventListener('click', () => {
    log('destroy() (debug)');
    teardown();
  });

  try {
    await Promise.all([loadServerConfig(), loadSDK()]);
  } catch (error) {
    setStatus(error.message, 'error');
    return;
  }
  await mount();
});
