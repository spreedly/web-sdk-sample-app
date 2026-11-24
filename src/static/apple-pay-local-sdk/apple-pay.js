/**
 * Apple Pay Demo
 *
 * Hosted Fields (?sdk=hosted-fields): the standalone SpreedlyApplePay class draws Apple's button
 * into #apple-pay-button-container.
 * Express Checkout (?sdk=express-checkout): expressCheckout({ applePay }) draws the same button in
 * a wallet row above the card form, embedded in the page or in Express Checkout's pop-up (dialog
 * mode, chosen in the config panel).
 *
 * The SDK loads from the SDK dev servers on the computer showing the page (`npm run dev` in
 * checkout-web-sdk), because Apple Pay isn't on the CDN yet. Use Chrome on that computer: it lets
 * an HTTPS page load http://localhost. ?sdk-source=cdn loads the CDN's rc channel instead, like the
 * other pages (`SpreedlyUtils.getSDKScriptUrl()`).
 *
 * Every API call goes to this server (same origin): merchant validation needs the Merchant
 * Identity Certificate, which only the server holds.
 */

const API = '/api/v1';
const BUTTON_CONTAINER_ID = 'apple-pay-button-container';
const EC_CONTAINER_ID = 'ec-container';
const STORE_LABEL = 'Spreedly Demo Store';

// Synthetic contact for the prefilled billing and shipping contacts.
const PREFILLED_CONTACT = {
  givenName: 'Ada',
  familyName: 'Example',
  emailAddress: 'ada@example.com',
  phoneNumber: '+1 555 0100',
  addressLines: ['100 Example Street'],
  locality: 'Springfield',
  administrativeArea: 'IL',
  postalCode: '62701',
  country: 'United States',
  countryCode: 'US',
};

// The SDK dev servers (checkout-web-sdk `npm run dev`). Fixed URLs only: the page address picks
// one of these, never supplies a script URL.
const LOCAL_SDK_URLS = {
  'hosted-fields': 'http://localhost:5000/index.js',
  'express-checkout': 'http://localhost:5173/express-checkout.js',
};

const params = new URLSearchParams(window.location.search);
const sdkType = SpreedlyUtils.getSDKType();
const sdkFromLocalhost = params.get('sdk-source') !== 'cdn';
const debugEnabled = params.get('debug') === '1';

const elements = {};
let applePay = null; // SpreedlyApplePay (Hosted Fields mode)
let expressCheckout = null; // SpreedlyExpressCheckout (Express Checkout mode)
let mountedPlacement = null; // 'embedded' or 'dialog': how the current Express Checkout was set up
let dialogOpen = false; // Express Checkout's pop-up is showing
let authAttempts = 0;
// The total given to Apple for the next tap, and the total of the sheet that's open. The page charges
// the open sheet's total, so the charge always matches what the shopper approved.
let nextTapTotal = null;
let openSheetTotal = null;
let merchantIdentifier = null; // from GET /api/v1/apple-pay/config
let environmentKey = null; // from GET /api/v1/auth/params; SpreedlyApplePay requires it
let mounting = Promise.resolve(); // redraws run one after another
const debugOnce = {}; // debug switches that fire on the first attempt only

// ── Page helpers ──────────────────────────────────────────────────────

function initElements() {
  [
    'amount',
    'update-total',
    'currency-label',
    'set-total-name',
    'sdk-config',
    'divider-group',
    'placement-group',
    'open-checkout',
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
    'sdk-source',
    'sdk-source-toggle',
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

const toAmount = value => (Math.round(value * 100) / 100).toFixed(2);

// ── SDK config panel ──────────────────────────────────────────────────

const field = name => elements['sdk-config'].querySelector(`[name="${name}"]`);

/** The checked radio's value, or '' for "Not sent" / "Off". */
const choice = name =>
  elements['sdk-config'].querySelector(`input[name="${name}"]:checked`)?.value || '';

const text = name => field(name).value.trim();

const ticked = name =>
  [...elements['sdk-config'].querySelectorAll(`input[name="${name}"]:checked`)].map(
    input => input.value
  );

const isTicked = name => field(name).checked;

/** 'a, b' → ['a', 'b'] */
const list = value =>
  value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

const currency = () => choice('currency-code');

/** 'a=1, b=2' → { a: '1', b: '2' } */
function parseMetadata(value) {
  const metadata = {};
  list(value).forEach(pair => {
    const [key, ...rest] = pair.split('=');
    if (!key.trim() || rest.length === 0) {
      throw new Error(`Metadata "${pair}" is not key=value.`);
    }
    metadata[key.trim()] = rest.join('=').trim();
  });
  return metadata;
}

const daysFromNow = days => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

// ── The amount the sheet shows ────────────────────────────────────────

/** The total for the next tap: the subtotal field, with the panel's total type. */
function computeTotal() {
  const subtotal = Number(elements.amount.value.trim()) || 0;
  const total = { label: STORE_LABEL, amount: toAmount(Math.max(subtotal, 0)) };
  if (choice('total-type')) {
    total.type = choice('total-type');
  }
  return total;
}

/**
 * The amount the page charges: the total of the sheet the shopper approved, never the amount field,
 * which can change while the sheet is open. A real store charges its own server-side order total.
 */
const chargeAmount = () => openSheetTotal ?? nextTapTotal;

const chargeMode = () => choice('charge-mode') || 'after-token';

/** Express Checkout only: 'embedded' (parentContainerId) or 'dialog' (the SDK's pop-up). */
const placement = () => (sdkType === 'express-checkout' && choice('ec-placement')) || 'embedded';

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

/**
 * Charges the Spreedly payment method on the test gateway. A declined charge comes back as HTTP 422
 * with `transaction.succeeded: false`: that's a decline, so it resolves rather than throws. Only a
 * failure where the charge may or may not have happened throws.
 */
async function purchase(token) {
  try {
    return await postJson('/simple-purchase', {
      payment_method_token: token,
      amount: toCents(chargeAmount()),
      currency_code: currency(),
    });
  } catch (error) {
    const transaction = error.data?.transaction;
    if (transaction && transaction.succeeded === false) {
      return { success: false, transaction };
    }
    throw error;
  }
}

/** processPayment: charge while the sheet is still open, so the sheet shows the real result. */
async function processPayment(result) {
  log('processPayment', { token: result.token, cardType: result.cardType });
  if (debugFiresOnce('failProcessPayment')) {
    // Like the store's server being down: nothing was charged, but the SDK can't know that (M40).
    log('processPayment throws (debug), before charging');
    throw new Error('Debug: processPayment failed before charging');
  }
  if (isDebug('slowPurchase')) {
    // Longer than Apple's 30 s limit, so Apple closes the sheet first (M26).
    await wait(40000);
  }
  if (debugFiresOnce('declinePurchase')) {
    // The message becomes the applePayError message, and the sheet shows it when it can.
    return { success: false, message: 'Declined by the bank (demo). Try another card.' };
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
  if (data.success === true) {
    return { success: true };
  }
  // A decline: the sheet stays open with the gateway's message so the shopper can try another card.
  return { success: false, message: data.transaction?.message };
}

// ── Apple Pay config and events ───────────────────────────────────────

/** The total the next tap opens with. */
function openingAmounts() {
  return { total: computeTotal() };
}

const BILLING_AGREEMENT = 'You agree to the Spreedly Demo Store terms for this payment.';

/** Fields every payment request shares. */
function paymentRequestBase(paymentDescription) {
  const request = { paymentDescription, managementURL: `${window.location.origin}/` };
  if (isTicked('billing-agreement')) {
    request.billingAgreement = BILLING_AGREEMENT;
  }
  if (isTicked('token-notifications')) {
    // No route answers here: Apple's notifications would fail.
    request.tokenNotificationURL = `${window.location.origin}${API}/apple-pay/token-notifications`;
  }
  return request;
}

function recurringPaymentRequest(amount) {
  const unit = field('interval-unit').value;
  const count = Number.parseInt(text('interval-count'), 10) || 1;
  const regularBilling = {
    label: 'Plan',
    amount,
    paymentTiming: 'recurring',
    recurringPaymentIntervalUnit: unit,
    recurringPaymentIntervalCount: count,
  };
  const request = { ...paymentRequestBase('Spreedly Demo Store plan'), regularBilling };
  let start = new Date();
  if (isTicked('recurring-trial')) {
    start = daysFromNow(30);
    request.trialBilling = {
      label: 'Free first month',
      amount: '0.00',
      paymentTiming: 'recurring',
      recurringPaymentIntervalUnit: 'month',
      recurringPaymentIntervalCount: 1,
      recurringPaymentEndDate: start,
    };
    regularBilling.recurringPaymentStartDate = start;
  }
  if (isTicked('recurring-end')) {
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    regularBilling.recurringPaymentEndDate = end;
  }
  return request;
}

function buttonOptions() {
  const button = {};
  const set = (key, value) => {
    if (value) {
      button[key] = value;
    }
  };
  set('type', choice('button-type'));
  set('style', choice('button-style'));
  set('locale', text('button-locale'));
  set('width', text('button-width'));
  set('height', text('button-height'));
  set('borderRadius', text('button-radius'));
  set('padding', text('button-padding'));
  set('boxSizing', field('button-box-sizing').value);
  return Object.keys(button).length ? button : undefined;
}

/** The SpreedlyApplePay config for the panel's settings. Throws on a setting it can't read. */
function buildApplePayConfig() {
  const amount = elements.amount.value.trim();
  const config = {
    merchantIdentifier,
    countryCode: choice('country-code'),
    currencyCode: currency(),
    ...openingAmounts(),
    onValidateMerchant: validateMerchant,
    getAuthDetails,
  };
  const button = buttonOptions();
  if (button) {
    config.button = button;
  }

  if (choice('networks') === 'custom') {
    config.supportedNetworks = list(text('networks-custom'));
  } else if (choice('networks')) {
    config.supportedNetworks = [choice('networks')];
  }
  if (choice('capabilities')) {
    config.merchantCapabilities = ['supports3DS', choice('capabilities')];
  }
  if (choice('card-countries') === 'custom') {
    config.supportedCountries = list(text('card-countries-custom'));
  }
  if (isTicked('check-credential-status')) {
    config.checkPaymentCredentialStatus = true;
  }

  const billingFields = ticked('billing-fields');
  if (billingFields.length) {
    config.requiredBillingContactFields = billingFields;
  }
  const shippingFields = ticked('shipping-fields');
  if (shippingFields.length) {
    config.requiredShippingContactFields = shippingFields;
  }
  ticked('prefill').forEach(name => {
    config[name] = { ...PREFILLED_CONTACT };
  });

  const paymentRequest = choice('payment-request');
  if (paymentRequest === 'recurring') {
    config.recurringPaymentRequest = recurringPaymentRequest(amount);
  }
  if (choice('shipping-type')) {
    config.shippingType = choice('shipping-type');
  }

  if (chargeMode() === 'process-payment') {
    config.processPayment = processPayment;
  }
  if (text('test-card')) {
    config.testCardNumber = text('test-card');
  }
  if (text('metadata')) {
    config.metadata = parseMetadata(text('metadata'));
  }
  nextTapTotal = config.total.amount;
  return config;
}

const EVENTS = [
  'applePayReady',
  'applePayUnavailable',
  'applePayButtonClicked',
  'applePayPaymentAuthorized',
  'applePayTokenGenerated',
  'applePayCancelled',
  'applePaySheetClosedEarly',
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
    const status = payload?.paymentCredentialStatus;
    setStatus(`Apple Pay is ready${status ? ` (${status})` : ''}. Tap the button.`, 'success');
  } else if (event === 'applePayUnavailable') {
    const seeLog = payload.reason === 'DEVELOPER_ERROR' ? ' See applePayError in the event log.' : '';
    setStatus(`Apple Pay is unavailable here (${payload.reason}).${seeLog}`, 'error');
  } else if (event === 'applePayButtonClicked') {
    authAttempts = 0;
    openSheetTotal = nextTapTotal;
    elements['result-card'].classList.add('hidden');
  } else if (event === 'applePayCancelled') {
    setStatus('The shopper closed the sheet.', 'info');
  } else if (event === 'applePaySheetClosedEarly') {
    // processPayment is still running: the charge may go through, so ask the shopper to wait.
    setStatus('Apple closed the sheet. Still confirming the payment; please don’t pay again.', 'info');
  } else if (event === 'applePayError') {
    setStatus(`${payload.code}: ${payload.message}`, 'error');
    if (PAYMENT_STATE_UNKNOWN.includes(payload.code)) {
      onPaymentStateUnknown(payload.code);
    }
  } else if (event === 'applePayTokenGenerated') {
    await onTokenGenerated(payload);
  }
}

// processPayment didn't finish: the charge may or may not have happened.
const PAYMENT_STATE_UNKNOWN = ['PAYMENT_PROCESSING_FAILED', 'PAYMENT_PROCESSING_TIMEOUT'];

/**
 * What a store does when processPayment didn't finish: don't let the shopper pay again, and check
 * the order before saying anything. This demo has no order records, so it stops at the message.
 */
function onPaymentStateUnknown(code) {
  // Deferred, as after success: the SDK finishes delivering this event first.
  setTimeout(closeDialog, 0);
  showResult(
    'Payment not confirmed',
    `${code}: the charge may or may not have gone through. A real store checks its order records ` +
      'before telling the shopper anything or letting them pay again.',
    'error'
  );
}

/** Whether Apple issued a merchant token (usable for later charges) or a device token. */
function describeTokenType(result) {
  return result.isMerchantToken
    ? `Merchant token ${result.merchantTokenIdentifier}.`
    : 'Device token (not a merchant token).';
}

async function onTokenGenerated(result) {
  // The SDK leaves its pop-up open after Apple Pay; the page closes it. Deferred so the SDK finishes
  // delivering this event before close() destroys the Apple Pay button.
  setTimeout(closeDialog, 0);
  const closedEarly = result.sheetClosedEarly ? ' (the sheet closed before the result)' : '';
  const tokenType = describeTokenType(result);
  if (chargeMode() === 'process-payment') {
    showResult(
      'Paid',
      `Charged inside the sheet${closedEarly}. Token ${result.token}. ${tokenType}`,
      'success'
    );
    return;
  }
  // Charge after the token: the sheet has already shown success.
  try {
    const data = await purchase(result.token);
    log('purchase (after the token)', { success: data.success, state: data.transaction?.state });
    showResult(
      data.success ? 'Paid' : 'Declined',
      `${data.transaction?.message || ''} Token ${result.token}. ${tokenType}`,
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
  // In dialog mode, close() only works while the pop-up is showing.
  if (expressCheckout && (mountedPlacement === 'embedded' || dialogOpen)) {
    expressCheckout.close(true);
  }
  expressCheckout = null;
  mountedPlacement = null;
  dialogOpen = false;
  elements['open-checkout'].classList.add('hidden');
  elements[EC_CONTAINER_ID].classList.add('hidden');
  document.getElementById(BUTTON_CONTAINER_ID).innerHTML = '';
  Object.keys(debugOnce).forEach(key => delete debugOnce[key]);
}

async function mountHostedFieldsMode() {
  if (typeof window.SpreedlyApplePay !== 'function') {
    setStatus(
      'This SDK build has no SpreedlyApplePay yet: Apple Pay reaches the CDN when the SDK releases it.',
      'error'
    );
    return;
  }
  try {
    const config = { environmentKey, ...buildApplePayConfig() };
    log('config', describeConfig(config));
    applePay = new window.SpreedlyApplePay(config);
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
  let config;
  try {
    config = buildApplePayConfig();
    if (placement() === 'embedded') {
      log('config', describeConfig(config));
    }
  } catch (error) {
    setStatus(`Config error: ${error.message}`, 'error');
    return;
  }
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
  // The shopper closed the pop-up with its close button.
  expressCheckout.on('close', () => {
    dialogOpen = false;
    log('close (the shopper closed the pop-up)');
  });
  applyDividerText();
  mountedPlacement = placement();
  if (mountedPlacement === 'dialog') {
    elements['open-checkout'].classList.remove('hidden');
    setStatus('Tap Checkout to open the payment form.', 'info');
    return;
  }
  elements[EC_CONTAINER_ID].classList.remove('hidden');
  expressCheckout.expressCheckout({ parentContainerId: EC_CONTAINER_ID, applePay: config });
}

/** Dialog mode: opens Express Checkout's pop-up with the panel's current settings. */
function openCheckoutDialog() {
  if (!expressCheckout || dialogOpen) {
    return;
  }
  let config;
  try {
    config = buildApplePayConfig();
    log('config', describeConfig(config));
  } catch (error) {
    setStatus(`Config error: ${error.message}`, 'error');
    return;
  }
  elements['result-card'].classList.add('hidden');
  log('expressCheckout() with no parentContainerId (pop-up)');
  dialogOpen = true;
  expressCheckout.expressCheckout({ applePay: config });
}

/** Closes Express Checkout's pop-up if it's showing (dialog mode only). */
function closeDialog() {
  if (expressCheckout && dialogOpen) {
    dialogOpen = false;
    expressCheckout.close();
    log('close() (the page closed the pop-up)');
  }
}

/** Express Checkout only: the text between the Apple Pay button and the card form. */
function applyDividerText() {
  const dividerText = text('divider-text');
  if (expressCheckout && dividerText) {
    expressCheckout.updateTextElement('walletDividerText', dividerText);
    log('updateTextElement', { walletDividerText: dividerText });
  }
}

/** The config as the event log shows it: functions by name only. */
function describeConfig(config) {
  return JSON.parse(
    JSON.stringify(config, (key, value) => (typeof value === 'function' ? `${key}()` : value))
  );
}

async function loadServerConfig() {
  const res = await fetch(`${API}/apple-pay/config`);
  const data = await res.json();
  merchantIdentifier = data.merchantIdentifier;
  log('server Apple Pay config', data);
  // The environment key only (not a secret). Express Checkout supplies its own.
  const auth = await fetch(`${API}/auth/params`).then(r => r.json()).catch(() => ({}));
  environmentKey = auth.environmentKey || null;
  if (!data.configured) {
    setStatus(
      'This server has no Apple Pay settings (APPLE_PAY_* env vars), so merchant validation will fail. See the README.',
      'error'
    );
  }
}

async function mount() {
  teardown();
  elements['result-card'].classList.add('hidden');
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

/** Redraws the button with the panel's settings, one redraw at a time. */
function remount() {
  mounting = mounting.then(() => mount().catch(error => setStatus(error.message, 'error')));
  return mounting;
}

/** Shows the settings for the chosen payment request. */
function syncPaymentRequest() {
  const request = choice('payment-request');
  elements['sdk-config'].querySelectorAll('[data-request]').forEach(sub => {
    const target = sub.dataset.request;
    sub.hidden = target === 'any' ? !request : target !== request;
  });
}

function onConfigChange(event) {
  const { name } = event.target;
  if (name === 'divider-text') {
    applyDividerText();
    return;
  }
  if (name === 'payment-request') {
    syncPaymentRequest();
  }
  if (name === 'currency-code') {
    elements['currency-label'].textContent = currency();
  }
  remount();
}

function updateTotal() {
  if (mountedPlacement === 'dialog' && !dialogOpen) {
    log('the pop-up opens with the new total');
    return;
  }
  const update = openingAmounts();
  try {
    if (applePay) {
      applePay.setTotal(update);
    } else if (expressCheckout) {
      expressCheckout.setApplePayTotal(update);
    }
    nextTapTotal = update.total.amount;
    log('total updated for the next tap', update.total);
  } catch (error) {
    setStatus(`Invalid total: ${error.message}`, 'error');
  }
}

// ── SDK loading ───────────────────────────────────────────────────────

function sdkScriptUrl() {
  if (sdkFromLocalhost) {
    return LOCAL_SDK_URLS[sdkType === 'express-checkout' ? 'express-checkout' : 'hosted-fields'];
  }
  return SpreedlyUtils.getSDKScriptUrl();
}

function loadSDK() {
  const url = sdkScriptUrl();
  log('loading SDK', { sdk: sdkType, source: sdkFromLocalhost ? 'localhost' : 'CDN', url });
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = resolve;
    script.onerror = () =>
      reject(
        new Error(
          sdkFromLocalhost
            ? `Could not load ${url}. Run \`npm run dev\` in checkout-web-sdk on this computer, and use Chrome.`
            : `Could not load ${url}.`
        )
      );
    document.body.appendChild(script);
  });
}

/** Shows where the SDK comes from, with a link that reloads the page with the other source. */
function showSdkSource() {
  elements['sdk-source'].textContent = sdkFromLocalhost
    ? 'this computer (localhost dev servers)'
    : 'the CDN (rc channel)';
  const other = new URLSearchParams(window.location.search);
  if (sdkFromLocalhost) {
    other.set('sdk-source', 'cdn');
  } else {
    other.delete('sdk-source');
  }
  const toggle = elements['sdk-source-toggle'];
  toggle.href = `?${other}`;
  toggle.textContent = sdkFromLocalhost ? 'Load from the CDN' : 'Load from localhost';
}

/** The cart total from the Apple Pay start page (?amount=), when it's a valid amount. */
function applyAmountFromStartPage() {
  const amount = params.get('amount');
  if (amount && /^\d+(\.\d{2})?$/.test(amount)) {
    elements.amount.value = amount;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initElements();
  applyAmountFromStartPage();
  const backParams = new URLSearchParams({ sdk: sdkType });
  if (!sdkFromLocalhost) {
    backParams.set('sdk-source', 'cdn');
  }
  document.getElementById('back-link').href = `../apple-pay/index.html?${backParams}`;
  showSdkSource();
  const surface = sdkType === 'express-checkout' ? 'Express Checkout' : 'Hosted Fields';
  elements['sdk-badge'].textContent = `Apple Pay · ${surface}`;
  elements['sdk-surface'].textContent =
    sdkType === 'express-checkout' ? 'expressCheckout({ applePay })' : 'SpreedlyApplePay';
  elements['set-total-name'].textContent =
    sdkType === 'express-checkout' ? 'setApplePayTotal()' : 'setTotal()';
  elements['divider-group'].hidden = sdkType !== 'express-checkout';
  elements['placement-group'].hidden = sdkType !== 'express-checkout';
  if (debugEnabled) {
    elements['debug-panel'].classList.remove('hidden');
  }
  syncPaymentRequest();

  elements['update-total'].addEventListener('click', updateTotal);
  elements['open-checkout'].addEventListener('click', openCheckoutDialog);
  elements['sdk-config'].addEventListener('change', onConfigChange);
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
  await remount();
});
