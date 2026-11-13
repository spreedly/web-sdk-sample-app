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
const BUTTON_CONTAINER_ID = 'apple-pay-button-container';
const EC_CONTAINER_ID = 'ec-container';
const STORE_LABEL = 'Spreedly Demo Store';

// Synthetic delivery options, coupon codes, surcharge and line items for the SDK config panel.
const SHIPPING_METHODS = [
  { label: 'Standard', detail: 'Arrives in 5-7 days', amount: '0.00', identifier: 'standard' },
  { label: 'Express', detail: 'Arrives tomorrow', amount: '9.00', identifier: 'express' },
];
// Days from today for each option's delivery dates (dateComponentsRange).
const DELIVERY_DAYS = { standard: [5, 7], express: [1, 1] };
const VALID_COUPON = 'SAVE10';
const EXPIRED_COUPON = 'EXPIRED';
const CREDIT_SURCHARGE = 0.5;
const TAX_RATE = 0.08;
const PENDING_TIP = { label: 'Tip (added later)', amount: '2.00', type: 'pending' };
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
    'order-details-on',
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
const deliveryOn = () => choice('delivery') !== '';
const couponsOn = () => choice('coupons') === 'on';

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

// Apple's ApplePayDateComponents members are years, months (1-based) and days.
const dateComponents = date => ({
  years: date.getFullYear(),
  months: date.getMonth() + 1,
  days: date.getDate(),
});

function shippingMethods() {
  if (choice('delivery') !== 'dates') {
    return SHIPPING_METHODS;
  }
  return SHIPPING_METHODS.map(method => {
    const [start, end] = DELIVERY_DAYS[method.identifier];
    return {
      ...method,
      dateComponentsRange: {
        startDateComponents: dateComponents(daysFromNow(start)),
        endDateComponents: dateComponents(daysFromNow(end)),
      },
    };
  });
}

// ── The order the sheet shows (this page's "server") ──────────────────

/** What the shopper picked in the sheet during the current tap. Reset on every tap. */
const sheet = { shipping: null, creditSurcharge: false, coupon: '' };

const normalizeCoupon = code => (code || '').trim().toUpperCase();

/**
 * Back to the state the sheet opens with. This page assumes Apple opens the sheet on the first
 * delivery option; Apple's docs don't say, so device test M27 records which one it is.
 */
function resetSheet() {
  sheet.shipping = deliveryOn() ? SHIPPING_METHODS[0] : null;
  sheet.creditSurcharge = false;
  const startCoupon = couponsOn() ? normalizeCoupon(text('coupon-code')) : '';
  sheet.coupon = startCoupon === VALID_COUPON ? startCoupon : '';
}

/** The total and line items for the current sheet state and line item settings. */
function computeOrder() {
  const subtotal = Number(elements.amount.value.trim()) || 0;
  const extraLines = ticked('line-items');
  const lineItems = [];
  let total = subtotal;
  if (sheet.shipping || sheet.creditSurcharge || sheet.coupon || extraLines.length) {
    lineItems.push({ label: 'Subtotal', amount: toAmount(subtotal) });
  }
  if (extraLines.includes('tax')) {
    const tax = subtotal * TAX_RATE;
    lineItems.push({ label: 'Tax', amount: toAmount(tax), type: 'final' });
    total += tax;
  }
  if (extraLines.includes('pending')) {
    // Pending: the sheet shows "pending", and the page doesn't charge it.
    lineItems.push({ ...PENDING_TIP });
  }
  if (sheet.shipping) {
    lineItems.push({ label: sheet.shipping.label, amount: sheet.shipping.amount });
    total += Number(sheet.shipping.amount);
  }
  if (sheet.creditSurcharge) {
    lineItems.push({ label: 'Credit card surcharge', amount: toAmount(CREDIT_SURCHARGE) });
    total += CREDIT_SURCHARGE;
  }
  if (sheet.coupon === VALID_COUPON) {
    const discount = -subtotal * 0.1;
    lineItems.push({ label: `Coupon ${VALID_COUPON}`, amount: toAmount(discount) });
    total += discount;
  }
  const totalItem = { label: STORE_LABEL, amount: toAmount(Math.max(total, 0)) };
  if (choice('total-type')) {
    totalItem.type = choice('total-type');
  }
  return { total: totalItem, lineItems };
}

/** The amount the page charges: what the sheet last showed. */
const chargeAmount = () => computeOrder().total.amount;

const chargeMode = () => choice('charge-mode') || 'after-token';

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
    amount: toCents(chargeAmount()),
    currency_code: currency(),
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
  if (data.success === true && choice('order-details') === 'on') {
    // Synthetic order details. With no Wallet Orders web service here, Wallet can't fetch the order.
    const orderDetails = {
      orderTypeIdentifier: 'order.com.spreedly.example',
      orderIdentifier: `demo-${Date.now()}`,
      webServiceURL: `${window.location.origin}/wallet-orders`,
      authenticationToken: crypto.randomUUID(),
    };
    log('processPayment returns orderDetails', { orderIdentifier: orderDetails.orderIdentifier });
    return { success: true, orderDetails };
  }
  return { success: data.success === true };
}

// ── Sheet callbacks ───────────────────────────────────────────────────

/** Applies one change from the sheet and returns the new amounts, plus any sheet errors. */
async function answerSheet(name, input, change) {
  log(name, input);
  if (debugFiresOnce('failSheetCallback')) {
    throw new Error(`Debug: ${name} failed`);
  }
  const errors = change();
  const update = computeOrder();
  if (errors) {
    update.errors = errors;
  }
  log(`${name}: new total`, { total: update.total.amount, errors: errors?.map(error => error.code) });
  return update;
}

const sheetCallbacks = {
  onShippingMethodSelected: method =>
    answerSheet('onShippingMethodSelected', { identifier: method.identifier }, () => {
      sheet.shipping = method;
    }),

  // Apple sends a redacted contact before approval: enough to price delivery.
  onShippingContactSelected: contact =>
    answerSheet('onShippingContactSelected', contact, () =>
      deliveryOn() && contact.countryCode && contact.countryCode.toLowerCase() !== 'us'
        ? [
            {
              code: 'addressUnserviceable',
              contactField: 'postalAddress',
              message: 'This demo store only delivers in the US.',
            },
          ]
        : undefined
    ),

  onPaymentMethodSelected: paymentMethod =>
    answerSheet('onPaymentMethodSelected', paymentMethod, () => {
      sheet.creditSurcharge = paymentMethod.paymentMethodType === 'credit';
    }),

  onCouponCodeChanged: couponCode =>
    answerSheet('onCouponCodeChanged', { couponCode }, () => {
      const code = normalizeCoupon(couponCode);
      sheet.coupon = code === VALID_COUPON ? code : '';
      if (!code || code === VALID_COUPON) {
        return undefined;
      }
      return [
        code === EXPIRED_COUPON
          ? { code: 'couponCodeExpired', message: 'This code has expired.' }
          : { code: 'couponCodeInvalid', message: `Try ${VALID_COUPON}.` },
      ];
    }),
};

// ── Apple Pay config and events ───────────────────────────────────────

/** The total and line items the next tap opens with. */
function openingAmounts() {
  resetSheet();
  const { total, lineItems } = computeOrder();
  return lineItems.length ? { total, lineItems } : { total };
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

function automaticReloadPaymentRequest(amount) {
  return {
    ...paymentRequestBase('Spreedly Demo Store card top-up'),
    automaticReloadBilling: {
      label: 'Top-up',
      amount,
      paymentTiming: 'automaticReload',
      automaticReloadPaymentThresholdAmount: text('reload-threshold'),
    },
  };
}

function deferredPaymentRequest(amount) {
  const days = Number.parseInt(text('deferred-days'), 10) || 30;
  const deferredPaymentDate = daysFromNow(days);
  const request = {
    ...paymentRequestBase('Spreedly Demo Store booking'),
    deferredBilling: { label: 'Booking', amount, paymentTiming: 'deferred', deferredPaymentDate },
  };
  if (isTicked('free-cancellation')) {
    request.freeCancellationDate = daysFromNow(days - 1);
    request.freeCancellationDateTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
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
  } else if (paymentRequest === 'automaticReload') {
    config.automaticReloadPaymentRequest = automaticReloadPaymentRequest(amount);
  } else if (paymentRequest === 'deferred') {
    config.deferredPaymentRequest = deferredPaymentRequest(amount);
  }

  if (deliveryOn()) {
    config.shippingMethods = shippingMethods();
  }
  if (choice('shipping-type')) {
    config.shippingType = choice('shipping-type');
  }
  if (couponsOn()) {
    config.supportsCouponCode = true;
    if (text('coupon-code')) {
      config.couponCode = text('coupon-code');
    }
  }
  ticked('callbacks').forEach(name => {
    config[name] = sheetCallbacks[name];
  });

  if (chargeMode() === 'process-payment') {
    config.processPayment = processPayment;
  }
  if (text('test-card')) {
    config.testCardNumber = text('test-card');
  }
  if (text('metadata')) {
    config.metadata = parseMetadata(text('metadata'));
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
    const seeLog = payload.reason === 'DEVELOPER_ERROR' ? ' See applePayError in the event log.' : '';
    setStatus(`Apple Pay is unavailable here (${payload.reason}).${seeLog}`, 'error');
  } else if (event === 'applePayButtonClicked') {
    authAttempts = 0;
    resetSheet();
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
    const config = buildApplePayConfig();
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
  elements[EC_CONTAINER_ID].classList.remove('hidden');
  let config;
  try {
    config = buildApplePayConfig();
    log('config', describeConfig(config));
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
  applyDividerText();
  expressCheckout.expressCheckout({ parentContainerId: EC_CONTAINER_ID, applePay: config });
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

/** Order details come back from processPayment, so they need that charge mode. */
function syncOrderDetails() {
  const allowed = chargeMode() === 'process-payment';
  const input = elements['order-details-on'].querySelector('input');
  input.disabled = !allowed;
  elements['order-details-on'].classList.toggle('disabled', !allowed);
  if (!allowed && input.checked) {
    field('order-details').checked = true;
  }
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
  if (name === 'charge-mode') {
    syncOrderDetails();
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
  const update = openingAmounts();
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
  elements['set-total-name'].textContent =
    sdkType === 'express-checkout' ? 'setApplePayTotal()' : 'setTotal()';
  elements['divider-group'].hidden = sdkType !== 'express-checkout';
  if (debugEnabled) {
    elements['debug-panel'].classList.remove('hidden');
  }
  syncOrderDetails();
  syncPaymentRequest();

  elements['update-total'].addEventListener('click', updateTotal);
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
