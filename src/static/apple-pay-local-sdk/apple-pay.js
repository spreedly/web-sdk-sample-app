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
const STORE_LABEL = 'Spreedly Demo Store';

// Synthetic delivery options, coupon codes and surcharge for the "In the sheet" settings.
const SHIPPING_METHODS = [
  { label: 'Standard', detail: 'Arrives in 5-7 days', amount: '0.00', identifier: 'standard' },
  { label: 'Express', detail: 'Arrives tomorrow', amount: '9.00', identifier: 'express' },
];
const VALID_COUPON = 'SAVE10';
const EXPIRED_COUPON = 'EXPIRED';
const CREDIT_SURCHARGE = 0.5;

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
    'payment-request',
    'delivery-options',
    'shipping-type',
    'coupons',
    'coupon-code',
    'order-details',
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

const toAmount = value => (Math.round(value * 100) / 100).toFixed(2);

// ── The order the sheet shows (this page's "server") ──────────────────

/** What the shopper picked in the sheet during the current tap. Reset on every tap. */
const sheet = { shipping: null, creditSurcharge: false, coupon: '' };

const normalizeCoupon = code => (code || '').trim().toUpperCase();

/**
 * Back to the state the sheet opens with. This page assumes Apple opens the sheet on the first
 * delivery option; Apple's docs don't say, so device test M27 records which one it is.
 */
function resetSheet() {
  sheet.shipping = elements['delivery-options'].checked ? SHIPPING_METHODS[0] : null;
  sheet.creditSurcharge = false;
  const startCoupon = elements.coupons.checked ? normalizeCoupon(elements['coupon-code'].value) : '';
  sheet.coupon = startCoupon === VALID_COUPON ? startCoupon : '';
}

/** The total and line items for the current sheet state. */
function computeOrder() {
  const subtotal = Number(elements.amount.value.trim()) || 0;
  const lineItems = [];
  let total = subtotal;
  if (sheet.shipping || sheet.creditSurcharge || sheet.coupon) {
    lineItems.push({ label: 'Subtotal', amount: toAmount(subtotal) });
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
  return { total: { label: STORE_LABEL, amount: toAmount(Math.max(total, 0)) }, lineItems };
}

/** The amount the page charges: what the sheet last showed, or the plain total. */
function chargeAmount() {
  const sheetFeatures = elements['delivery-options'].checked || elements.coupons.checked;
  return sheetFeatures ? computeOrder().total.amount : elements.amount.value.trim();
}

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
    amount: toCents(chargeAmount()),
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
  if (data.success === true && elements['order-details'].checked) {
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
      contact.countryCode && contact.countryCode.toLowerCase() !== 'us'
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
  const sheetFeatures = elements['delivery-options'].checked || elements.coupons.checked;
  if (!sheetFeatures) {
    return { total: { label: STORE_LABEL, amount: elements.amount.value.trim() } };
  }
  const { total, lineItems } = computeOrder();
  return lineItems.length ? { total, lineItems } : { total };
}

const nextMonth = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date;
};

function buildApplePayConfig() {
  const amount = elements.amount.value.trim();
  const config = {
    merchantIdentifier,
    countryCode: 'US',
    currencyCode: CURRENCY,
    ...openingAmounts(),
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
  if (elements['delivery-options'].checked) {
    config.shippingMethods = SHIPPING_METHODS;
    config.shippingType = elements['shipping-type'].value;
    // The address lets onShippingContactSelected price delivery.
    config.requiredShippingContactFields = [
      ...new Set([...(config.requiredShippingContactFields || []), 'postalAddress']),
    ];
    config.onShippingMethodSelected = sheetCallbacks.onShippingMethodSelected;
    config.onShippingContactSelected = sheetCallbacks.onShippingContactSelected;
    config.onPaymentMethodSelected = sheetCallbacks.onPaymentMethodSelected;
  }
  if (elements.coupons.checked) {
    config.supportsCouponCode = true;
    const startCoupon = elements['coupon-code'].value.trim();
    if (startCoupon) {
      config.couponCode = startCoupon;
    }
    config.onCouponCodeChanged = sheetCallbacks.onCouponCodeChanged;
  }
  const paymentRequest = elements['payment-request'].value;
  if (paymentRequest === 'automaticReload') {
    config.automaticReloadPaymentRequest = {
      paymentDescription: 'Spreedly demo card top-up',
      automaticReloadBilling: {
        label: 'Top-up',
        amount,
        paymentTiming: 'automaticReload',
        automaticReloadPaymentThresholdAmount: '5.00',
      },
      managementURL: `${window.location.origin}/`,
    };
  }
  if (paymentRequest === 'deferred') {
    config.deferredPaymentRequest = {
      paymentDescription: 'Spreedly demo booking',
      deferredBilling: {
        label: 'Booking',
        amount,
        paymentTiming: 'deferred',
        deferredPaymentDate: nextMonth(),
      },
      managementURL: `${window.location.origin}/`,
    };
  }
  if (paymentRequest === 'recurring') {
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
