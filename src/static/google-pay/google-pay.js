/**
 * Google Pay demo — standalone SpreedlyGooglePay, from either SDK bundle (?sdk=).
 *
 * The page (the "merchant") loads Google's pay.js and signs auth params server-side. The SDK owns
 * everything Google-shaped and emits a Spreedly payment method token plus googlePayType, which
 * decides the purchase: TOKENIZED_CARD already carries authentication and goes straight to
 * /simple-purchase; NON_TOKENIZED_CARD goes through a 3DS purchase and SpreedlyThreeDSLifecycle
 * (Spreedly's "tokenize first, then branch on google_pay_type" option).
 *
 * With the Express Checkout bundle, the page hands the same config to SpreedlyExpressCheckout's
 * `googlePay` option by default, which draws the button above its card form; the Placement control
 * switches back to the standalone button. Cards entered in that form arrive on `tokenGenerated` and
 * take the same purchase path.
 */

const CONTAINER_ID = 'google-pay-button-container';
const EC_CONTAINER_ID = 'gp-express-checkout-container';
const EC_DIALOG_ID = 'gp-ec-dialog';
const EC_DIALOG_CONTAINER_ID = 'gp-ec-dialog-container';

// Same values the 3DS demo pages use.
const THREE_DS = {
  browserSize: '04', // 600x400px challenge window
  acceptHeader: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

const DEMO = {
  merchantName: 'Spreedly Demo',
  currencyCode: 'USD',
  countryCode: 'US',
  // Synthetic shipping options for the onPaymentDataChange demo.
  shippingOptions: [
    { id: 'standard', label: 'Standard (free)', description: '5–7 business days', cost: 0 },
    { id: 'express', label: 'Express ($10.00)', description: '1–2 business days', cost: 10 },
  ],
  shippingCountries: ['US'],
  // Synthetic promo code for the OFFER demo: 10% off the subtotal.
  promoCode: 'SAVE10',
  promoRate: 0.1,
};

// What the sheet currently shows, so shipping and promo updates compose.
const sheetState = { shippingCost: 0, redemptionCodes: [] };

let googlePay = null;
let checkout = null;
let authDetails = null;
let lastResult = null;
let lifecycle = null;

const $ = id => document.getElementById(id);

function logEvent(message, type = 'info') {
  const log = $('event-log');
  if (!log) return;
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const entry = document.createElement('div');
  entry.className = `event-log-entry ${type}`;
  entry.innerHTML = `<span class="time">[${time}]</span> ${SpreedlyUtils.escapeHtml(message)}`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

function setStatus(message, type = 'info') {
  const el = $('status-message');
  el.textContent = message;
  el.className = `status-message visible ${type}`;
}

function clearStatus() {
  $('status-message').className = 'status-message';
}

function showFatal(message) {
  $('loading-state').classList.add('hidden');
  $('gp-workspace').classList.add('hidden');
  $('error-state').classList.remove('hidden');
  $('error-message').textContent = message;
}

// ── Config from the page controls ─────────────────────────────────────────────

function orderTotal() {
  const value = parseFloat($('gp-amount').value);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function discountFor(subtotal) {
  // Rounded to cents so the DISCOUNT line and the total agree.
  return sheetState.redemptionCodes.includes(DEMO.promoCode)
    ? Math.round(subtotal * DEMO.promoRate * 100) / 100
    : 0;
}

function transactionInfo() {
  const subtotal = orderTotal();
  const discount = discountFor(subtotal);
  const shippingCost = sheetState.shippingCost;
  return {
    totalPrice: (subtotal - discount + shippingCost).toFixed(2),
    currencyCode: DEMO.currencyCode,
    countryCode: DEMO.countryCode,
    totalPriceStatus: 'FINAL',
    totalPriceLabel: 'Total',
    checkoutOption: $('gp-checkout-option').value,
    // Synthetic attempt id — Google uses it for troubleshooting.
    transactionId: `demo-${Date.now()}`,
    displayItems: [
      { label: 'Subtotal', type: 'SUBTOTAL', price: subtotal.toFixed(2) },
      ...(discount
        ? [{ label: `Promo ${DEMO.promoCode}`, type: 'DISCOUNT', price: (-discount).toFixed(2) }]
        : []),
      ...($('gp-shipping').checked
        ? [{ label: 'Shipping', type: 'SHIPPING_OPTION', price: shippingCost.toFixed(2) }]
        : []),
    ],
  };
}

/** Merchant business logic: Google asks, the page answers with data, the SDK builds the update. */
function onPaymentDataChange({ trigger, shippingAddress, shippingOptionId, redemptionCodes }) {
  logEvent(
    `onPaymentDataChange: ${trigger}` +
      `${shippingOptionId ? ` (${shippingOptionId})` : ''}` +
      `${redemptionCodes?.length ? ` codes=${redemptionCodes.join(',')}` : ''}`
  );

  if (shippingAddress && !DEMO.shippingCountries.includes(shippingAddress.countryCode)) {
    return {
      error: { reason: 'SHIPPING_ADDRESS_UNSERVICEABLE', message: 'This demo ships to the US only.' },
    };
  }

  if (Array.isArray(redemptionCodes)) {
    const codes = redemptionCodes.map(code => code.trim().toUpperCase());
    if (trigger === 'OFFER' && codes.some(code => code !== DEMO.promoCode)) {
      return { error: { reason: 'OFFER_INVALID', message: `Try ${DEMO.promoCode} in this demo.` } };
    }
    sheetState.redemptionCodes = codes;
  }

  if ($('gp-shipping').checked) {
    const option =
      DEMO.shippingOptions.find(candidate => candidate.id === shippingOptionId) ||
      DEMO.shippingOptions[0];
    sheetState.shippingCost = option.cost;
  }

  const offerInfo = $('gp-promo').checked
    ? {
        offers: sheetState.redemptionCodes.map(code => ({
          redemptionCode: code,
          description: `${DEMO.promoRate * 100}% off (synthetic)`,
        })),
      }
    : undefined;

  return {
    transactionInfo: transactionInfo(),
    ...(offerInfo ? { offerInfo } : {}),
  };
}

function readConfig() {
  const allowedAuthMethods = [
    ...($('gp-auth-pan').checked ? ['PAN_ONLY'] : []),
    ...($('gp-auth-cryptogram').checked ? ['CRYPTOGRAM_3DS'] : []),
  ];
  const allowedCardNetworks = Array.from(document.querySelectorAll('.gp-network:checked')).map(
    input => input.value
  );
  const shipping = $('gp-shipping').checked;
  const promo = $('gp-promo').checked;
  const testCardNumber = $('gp-test-card').value.trim();
  sheetState.shippingCost = 0;
  sheetState.redemptionCodes = [];

  return {
    environment: 'TEST',
    authDetails,
    merchantInfo: { merchantName: DEMO.merchantName },
    transactionInfo: transactionInfo(),
    allowedAuthMethods,
    allowedCardNetworks,
    ...($('gp-no-prepaid').checked ? { allowPrepaidCards: false } : {}),
    ...($('gp-no-credit').checked ? { allowCreditCards: false } : {}),
    ...($('gp-assurance').checked ? { assuranceDetailsRequired: true } : {}),
    billingAddressRequired: $('gp-billing').checked,
    billingAddressParameters: { format: 'FULL' },
    emailRequired: $('gp-email').checked,
    ...(shipping
      ? {
          shippingAddressRequired: true,
          shippingAddressParameters: { allowedCountryCodes: DEMO.shippingCountries },
          shippingOptionRequired: true,
          shippingOptionParameters: {
            defaultSelectedOptionId: DEMO.shippingOptions[0].id,
            shippingOptions: DEMO.shippingOptions.map(({ id, label, description }) => ({
              id,
              label,
              description,
            })),
          },
        }
      : {}),
    // Explicit intents: PAYMENT_AUTHORIZATION is always added by the SDK.
    ...(shipping || promo
      ? {
          callbackIntents: [
            ...(shipping ? ['SHIPPING_ADDRESS', 'SHIPPING_OPTION'] : []),
            ...(promo ? ['OFFER'] : []),
          ],
          onPaymentDataChange,
        }
      : {}),
    button: {
      buttonColor: $('gp-btn-color').value,
      buttonType: $('gp-btn-type').value,
      buttonSizeMode: $('gp-btn-size').value,
      buttonRadius: Number($('gp-btn-radius').value) || 0,
    },
    ...(testCardNumber ? { testCardNumber } : {}),
  };
}

// ── Config snippet ────────────────────────────────────────────────────────────

const AUTH_DETAILS_PLACEHOLDER =
  '<signed by your server: environment_key, certificate_token, nonce, signature, timestamp>';

let snippet = null;

/** Shows the call the page made, as a merchant would write it. Functions print by name. */
function showConfigSnippet(config, template) {
  const copy = JSON.parse(
    JSON.stringify(config, (key, value) => (typeof value === 'function' ? `[Function ${key}]` : value))
  );
  if (copy.authDetails) copy.authDetails = AUTH_DETAILS_PLACEHOLDER;
  snippet = { config: copy, template };
  renderConfigSnippet();
}

function renderConfigSnippet() {
  $('gp-config-snippet').textContent = snippet
    ? snippet.template(JSON.stringify(snippet.config, null, 2))
    : '';
  $('gp-copy-config').disabled = !snippet;
}

let copyResetTimer = null;

function setCopyState(copied, message) {
  $('gp-copy-icon').classList.toggle('hidden', copied);
  $('gp-copied-icon').classList.toggle('hidden', !copied);
  $('gp-copy-config').setAttribute('aria-label', copied ? 'Copied' : 'Copy config');
  $('gp-copy-config').title = copied ? 'Copied' : 'Copy config';
  $('gp-copy-status').textContent = message;
}

// For browsers and embedded views that refuse the async Clipboard API.
function copyWithSelection(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  $('gp-copy-config').focus();
  return copied;
}

async function copyConfigSnippet() {
  const text = $('gp-config-snippet').textContent;
  if (!text) return;
  let copied;
  try {
    await navigator.clipboard.writeText(text);
    copied = true;
  } catch {
    copied = copyWithSelection(text);
  }
  if (!copied) {
    logEvent('Copy failed: the browser blocked clipboard access', 'error');
    setCopyState(false, 'Copy failed');
    return;
  }
  setCopyState(true, 'Config copied to the clipboard');
  clearTimeout(copyResetTimer);
  copyResetTimer = setTimeout(() => setCopyState(false, ''), 1500);
}

// ── SpreedlyGooglePay lifecycle ───────────────────────────────────────────────

function registerEvents(instance) {
  instance.on('googlePayReady', () => {
    $('gp-fallback').classList.add('hidden');
    logEvent('googlePayReady — button drawn', 'success');
  });

  instance.on('googlePayUnavailable', ({ reason }) => {
    $('gp-fallback-reason').textContent = reason;
    $('gp-fallback').classList.remove('hidden');
    logEvent(`googlePayUnavailable — ${reason}`, 'error');
  });

  instance.on('googlePayButtonClicked', () => {
    clearStatus();
    logEvent('googlePayButtonClicked — sheet opening');
  });

  instance.on('googlePayPaymentAuthorized', ({ cardNetwork, last4 }) => {
    logEvent(`googlePayPaymentAuthorized — ${cardNetwork || 'card'} •••• ${last4 || '????'}, tokenizing`);
  });

  instance.on('googlePayTokenGenerated', async result => {
    lastResult = result;
    logEvent(`googlePayTokenGenerated — ${result.googlePayType || 'type unknown'}`, 'success');
    await retainIfRequested(result);
    showTokenResult(result);
  });

  instance.on('googlePayCancelled', () => {
    logEvent('googlePayCancelled — shopper closed the sheet');
  });

  instance.on('googlePayError', ({ code, message, details }) => {
    logEvent(`googlePayError — ${code}: ${message}`, 'error');
    if (details) {
      logEvent(`details: ${JSON.stringify(details)}`, 'error');
    }
    setStatus(`${code}: ${message}`, 'error');
  });
}

// The SDK creates payment methods cached (Core ignores `retained` on the browser's
// certificate-auth request), so retain from the server, as the card demos do.
async function retainIfRequested(result) {
  if (!$('gp-retain').checked || result.paymentMethod?.storage_state === 'retained') {
    return;
  }
  try {
    const retained = await SpreedlyUtils.retainPaymentMethod(result.token);
    const paymentMethod = retained?.transaction?.payment_method;
    if (paymentMethod) {
      result.paymentMethod = { ...result.paymentMethod, ...paymentMethod };
    }
    logEvent(`Payment method retained — ${result.paymentMethod?.storage_state}`, 'success');
  } catch (error) {
    logEvent(`Retain failed: ${error.message}`, 'error');
    setStatus('The payment method could not be retained.', 'error');
  }
}

function placement() {
  return document.querySelector('input[name="gp-placement"]:checked')?.value || 'standalone';
}

function ecDisplay() {
  return document.querySelector('input[name="gp-ec-display"]:checked')?.value || 'embedded';
}

function payButtonText() {
  return `Pay $${orderTotal().toFixed(2)}`;
}

function teardown() {
  googlePay?.destroy();
  googlePay = null;
  checkout?.close(true);
  checkout = null;
  $(EC_DIALOG_ID).classList.add('hidden');
}

function showPlacement() {
  const inForm = placement() === 'express-checkout';
  const embedded = ecDisplay() === 'embedded';
  $(CONTAINER_ID).classList.toggle('hidden', inForm);
  $(EC_CONTAINER_ID).classList.toggle('hidden', !inForm || !embedded);
  $('gp-ec-open-btn').classList.toggle('hidden', !inForm || embedded);
  $('gp-ec-display-row').classList.toggle('hidden', !inForm);
}

function applyTransactionInfo() {
  const info = transactionInfo();
  googlePay?.setTransactionInfo(info);
  if (checkout) {
    checkout.setGooglePayTransactionInfo(info);
    checkout.updateTextElement('submitBtnText', payButtonText());
  }
  if (snippet) {
    (snippet.config.googlePay || snippet.config).transactionInfo = info;
    if (snippet.config.uiConfig) {
      snippet.config.uiConfig.textConfig.submitBtnText = payButtonText();
    }
    renderConfigSnippet();
  }
}

async function mountGooglePay() {
  teardown();
  $(CONTAINER_ID).innerHTML = '';
  $('gp-fallback').classList.add('hidden');
  clearStatus();
  showPlacement();
  snippet = null;
  renderConfigSnippet();

  if (placement() === 'express-checkout') {
    mountExpressCheckout();
    return;
  }

  try {
    const conf = readConfig();
    showConfigSnippet(
      conf,
      json => `const googlePay = new SpreedlyGooglePay(${json});\nawait googlePay.mount('${CONTAINER_ID}');`
    );
    googlePay = new window.SpreedlyGooglePay(conf);
  } catch (error) {
    // Configuration mistakes throw synchronously from the constructor.
    logEvent(`Config error: ${error.message}`, 'error');
    setStatus(error.message, 'error');
    return;
  }

  registerEvents(googlePay);
  const { error } = await googlePay.mount(CONTAINER_ID);
  if (error) {
    logEvent(`mount(): ${error}`, 'error');
  }
}

// ── Express Checkout placement ────────────────────────────────────────────────

/** Express Checkout owns the Google Pay instance; its googlePay* events match the standalone class. */
function mountExpressCheckout() {
  checkout = new window.SpreedlyExpressCheckout(authDetails);
  if (typeof checkout.setGooglePayTransactionInfo !== 'function') {
    checkout = null;
    setStatus(
      'This Express Checkout build has no googlePay option yet. Run checkout-web-sdk locally — ' +
        'see docs/google-pay/DEMO_GUIDE.md.',
      'error'
    );
    return;
  }

  registerEvents(checkout);
  checkout.on('googlePayTokenGenerated', closeDialog);
  checkout.on('tokenGenerated', onCardToken);
  checkout.on('ready', () => logEvent('Express Checkout form ready'));
  checkout.on('error', error => {
    logEvent(`Express Checkout error: ${JSON.stringify(error)}`, 'error');
  });

  if (ecDisplay() === 'embedded') {
    openExpressCheckout();
  } else {
    showExpressCheckoutSnippet(expressCheckoutOptions());
  }
}

function expressCheckoutOptions() {
  const googlePayConfig = readConfig();
  delete googlePayConfig.authDetails;
  return {
    parentContainerId: ecDisplay() === 'dialog' ? EC_DIALOG_CONTAINER_ID : EC_CONTAINER_ID,
    uiConfig: { textConfig: { title: 'Payment details', submitBtnText: payButtonText() } },
    googlePay: googlePayConfig,
  };
}

function showExpressCheckoutSnippet(options) {
  showConfigSnippet(
    options,
    json => `const checkout = new SpreedlyExpressCheckout(authDetails);\ncheckout.expressCheckout(${json});`
  );
}

/**
 * Both displays mount the form in embedded mode. "Merchant dialog" opens the page's own dialog
 * first, so the wallet row and the form share one card instead of using the SDK's dialog mode.
 */
function openExpressCheckout() {
  if (!checkout) return;
  if (ecDisplay() === 'dialog') {
    $(EC_DIALOG_ID).classList.remove('hidden');
    logEvent('Merchant dialog opened');
  }
  const options = expressCheckoutOptions();
  showExpressCheckoutSnippet(options);
  checkout.expressCheckout(options);
}

/** Closing the page's dialog also closes the form, which destroys its Google Pay button. */
function closeDialog() {
  if ($(EC_DIALOG_ID).classList.contains('hidden')) return;
  checkout?.close();
  $(EC_DIALOG_ID).classList.add('hidden');
  logEvent('Merchant dialog closed');
}

/** A card entered in the Express Checkout form: same result card and purchase as Google Pay. */
async function onCardToken(response) {
  const paymentMethod = response?.tokenResponse?.payment_method;
  if (!paymentMethod?.token) return;
  lastResult = {
    source: 'card',
    token: paymentMethod.token,
    cardNetwork: paymentMethod.card_type,
    last4: paymentMethod.last_four_digits,
    paymentMethod,
  };
  logEvent(
    `tokenGenerated — card ${paymentMethod.card_type || ''} •••• ${paymentMethod.last_four_digits || '????'}`,
    'success'
  );
  closeDialog();
  await retainIfRequested(lastResult);
  showTokenResult(lastResult);
}

// ── Result + purchase ─────────────────────────────────────────────────────────

function guidanceFor({ source, googlePayType }) {
  if (source === 'card') {
    return 'Card from the Express Checkout form: the purchase follows the 3DS setting below.';
  }
  if (googlePayType === 'TOKENIZED_CARD') {
    return 'TOKENIZED_CARD: the device token already carries authentication — do NOT send attempt_3dsecure.';
  }
  if (googlePayType === 'NON_TOKENIZED_CARD') {
    return 'NON_TOKENIZED_CARD: a PAN-only card — your server may need to step up with 3DS depending on region and gateway.';
  }
  return 'google_pay_type was not returned — check the Spreedly response.';
}

function showTokenResult(result) {
  const escape = SpreedlyUtils.escapeHtml;
  const rows = [
    ['Payment method token', result.token],
    ['googlePayType', result.googlePayType || '—'],
    ['Card', `${result.cardNetwork || '—'} •••• ${result.last4 || '—'}`],
    ['Storage state', result.paymentMethod?.storage_state || '—'],
    ...(result.cardFundingSource ? [['Funding source', result.cardFundingSource]] : []),
    ...(result.assuranceDetails
      ? [
          [
            'Assurance',
            `accountVerified=${result.assuranceDetails.accountVerified}, ` +
              `cardHolderAuthenticated=${result.assuranceDetails.cardHolderAuthenticated}`,
          ],
        ]
      : []),
    ...(result.email ? [['Email', result.email]] : []),
    ...(result.shippingAddress
      ? [['Ship to', [result.shippingAddress.locality, result.shippingAddress.countryCode].filter(Boolean).join(', ')]]
      : []),
  ];

  $('result-card').className = 'result-card success';
  $('result-title').textContent = 'Payment method created';
  $('result-body').innerHTML = `
    <dl class="result-grid">
      ${rows.map(([label, value]) => `<dt>${escape(label)}</dt><dd>${escape(value)}</dd>`).join('')}
    </dl>
    <p class="guidance">${escape(guidanceFor(result))}</p>`;
  $('gp-purchase-btn').classList.remove('hidden');
  $('gp-purchase-btn').disabled = false;
  $('gp-new-checkout-btn').classList.remove('hidden');
}

function threeDSMode() {
  return document.querySelector('input[name="gp-3ds-mode"]:checked')?.value || 'global';
}

function threeDSScenario() {
  return document.querySelector('input[name="gp-3ds-scenario"]:checked')?.value || 'challenge';
}

function threeDSForEveryCard() {
  return document.querySelector('input[name="gp-3ds-when"]:checked')?.value === 'always';
}

/** Appends the transaction outcome under the payment method details. */
function showPurchaseResult(success, transaction, fallbackMessage) {
  const escape = SpreedlyUtils.escapeHtml;
  const tx = transaction?.transaction || transaction || {};
  // A 3DS lifecycle status may carry the token only on its gateway response, as the 3DS demo reads it.
  const token = tx.token || tx.response?.token;
  $('result-card').className = `result-card ${success ? 'success' : 'error'}`;
  $('result-title').textContent = success ? 'Purchase succeeded' : 'Purchase failed';
  $('result-body').insertAdjacentHTML(
    'beforeend',
    `<dl class="result-grid"><dt>Transaction</dt><dd>${escape(token || '—')}</dd>` +
      `<dt>State</dt><dd>${escape(tx.state || (success ? 'succeeded' : 'failed'))}</dd>` +
      `<dt>Message</dt><dd>${escape(tx.message || fallbackMessage || '—')}</dd>` +
      (tx.warning ? `<dt>Warning</dt><dd>${escape(tx.warning)}</dd>` : '') +
      '</dl>'
  );
  logEvent(
    `Purchase ${success ? 'succeeded' : 'failed'}: ${tx.message || fallbackMessage || tx.state}`,
    success ? 'success' : 'error'
  );
  // A retained payment method can be charged again; a cached one gets a single attempt.
  const retained = lastResult?.paymentMethod?.storage_state === 'retained';
  $('gp-purchase-btn').disabled = !retained;
}

/** Spreedly error bodies come back as `{ transaction }` or `{ errors: [...] }`. */
function purchaseErrorMessage(error) {
  const data = error?.response?.data || error;
  return (
    data?.transaction?.message ||
    data?.errors?.[0]?.message ||
    data?.error ||
    error?.message ||
    'Purchase failed'
  );
}

function showChallengeModal() {
  $('challenge-overlay').classList.remove('hidden');
}

function hideChallengeModal() {
  $('challenge-overlay').classList.add('hidden');
  $('challenge-container').innerHTML = '';
}

async function purchase() {
  if (!lastResult) return;
  // Disabled while the purchase runs, so a double click can't charge twice.
  $('gp-purchase-btn').disabled = true;
  const cents = Math.round(orderTotal() * 100);
  const mode = threeDSMode();

  if (mode === 'none') {
    return simplePurchase(cents);
  }
  // TOKENIZED_CARD carries a device cryptogram: authentication is already done, so no 3DS.
  // Unknown types fall through to 3DS, the safe side.
  if (lastResult.googlePayType === 'TOKENIZED_CARD' && !threeDSForEveryCard()) {
    logEvent('TOKENIZED_CARD — authentication already carried, skipping 3DS');
    return simplePurchase(cents);
  }
  return purchaseWith3DS(mode, cents);
}

async function simplePurchase(cents) {
  logEvent(`POST /simple-purchase ${cents} ${DEMO.currencyCode}`);
  try {
    const { success, transaction } = await SpreedlyUtils.createPurchase(
      lastResult.token,
      cents,
      DEMO.currencyCode
    );
    showPurchaseResult(success, transaction);
  } catch (error) {
    showPurchaseResult(false, null, purchaseErrorMessage(error));
  }
}

async function purchaseWith3DS(mode, cents) {
  // A bundle global, like SpreedlyThreeDSLifecycle.
  const browserInfo = serializeBrowserInfo(THREE_DS.browserSize, THREE_DS.acceptHeader);

  let transaction;
  try {
    if (mode === 'gateway') {
      logEvent(`POST /create-purchase-with-3ds-gateway-specific ${cents} ${DEMO.currencyCode}`);
      const response = await axios.post(
        `${SpreedlyUtils.API_BASE_URL}/create-purchase-with-3ds-gateway-specific`,
        {
          payment_method_token: lastResult.token,
          amount: cents,
          currency_code: DEMO.currencyCode,
          browser_info: browserInfo,
        }
      );
      ({ transaction } = response.data);
    } else {
      const scenario = threeDSScenario();
      logEvent(`POST /create-purchase-with-3ds ${cents} ${DEMO.currencyCode} (test SCA provider, ${scenario})`);
      ({ transaction } = await SpreedlyUtils.createPurchaseWith3DS(
        lastResult.token,
        cents,
        browserInfo,
        DEMO.currencyCode,
        { providerType: 'test', scenario }
      ));
    }
  } catch (error) {
    const failed = error?.response?.data?.transaction || error?.transaction;
    // e.g. "attempt_3dsecure is not supported for this payment method type. 3DS is only available
    // for credit cards." — Spreedly's reason, which the gateway's message doesn't give.
    if (failed?.warning) {
      logEvent(`Spreedly warning: ${failed.warning}`, 'error');
    }
    showPurchaseResult(false, failed, purchaseErrorMessage(error));
    return;
  }

  logEvent(`Transaction ${transaction?.token || ''} — state: ${transaction?.state}`);
  // e.g. "Bypassing Spreedly 3DS authentication for GooglePay payment methods that are CRYPTOGRAM_3DS"
  if (transaction?.warning) {
    logEvent(`Spreedly warning: ${transaction.warning}`, 'info');
  }

  if (transaction?.state === 'succeeded') {
    showPurchaseResult(true, transaction);
  } else if (transaction?.state === 'pending') {
    start3DSLifecycle(transaction.token, mode);
  } else {
    showPurchaseResult(false, transaction);
  }
}

/** Device fingerprint and/or challenge. Same lifecycle as the 3DS demo pages. */
function start3DSLifecycle(transactionToken, mode) {
  logEvent('Transaction pending — starting SpreedlyThreeDSLifecycle');

  const callbacks = {
    onDeviceFingerprint: event => {
      logEvent(`3DS device fingerprint (action: ${event.action})`);
    },
    onChallenge: event => {
      logEvent(`3DS challenge required (action: ${event.action}) — showing modal`);
      showChallengeModal();
    },
    onSuccess: event => {
      logEvent(`3DS authentication successful (action: ${event.action})`, 'success');
      hideChallengeModal();
      showPurchaseResult(true, event.context);
    },
    onError: event => {
      const message =
        event.context === 'messages.failed_sca_authentication'
          ? 'Transaction failed due to failed authentication.'
          : event.context;
      logEvent(`3DS error (action: ${event.action}): ${message}`, 'error');
      hideChallengeModal();
      showPurchaseResult(false, event.response, message);
    },
  };

  // Gateway 3DS hands completion back to the merchant server.
  if (mode === 'gateway') {
    callbacks.onTriggerCompletion = async event => {
      logEvent(`3DS trigger completion — POST /transactions/${event.token}/complete`);
      try {
        const response = await axios.post(
          `${SpreedlyUtils.API_BASE_URL}/transactions/${event.token}/complete`
        );
        const { transaction } = response.data;
        if (transaction.state === 'succeeded') {
          hideChallengeModal();
          showPurchaseResult(true, transaction);
        } else if (transaction.state === 'pending') {
          event.finalize(transaction); // e.g. a challenge still follows the fingerprint
        } else {
          hideChallengeModal();
          showPurchaseResult(false, transaction);
        }
      } catch (error) {
        hideChallengeModal();
        showPurchaseResult(false, error?.response?.data?.transaction, purchaseErrorMessage(error));
      }
    };
    callbacks.onFinalizationTimeout = () => {
      logEvent('3DS challenge timed out', 'error');
      hideChallengeModal();
      showPurchaseResult(false, null, 'Challenge timed out. Please try again.');
    };
  }

  lifecycle = new SpreedlyThreeDSLifecycle({
    transactionToken,
    hiddenIframeLocation: 'device-fingerprint',
    challengeIframeLocation: 'challenge-container',
    challengeIframeClasses: 'challenge-iframe',
    environmentKey: authDetails.environment_key,
    callbacks,
  });
  lifecycle.start();
}

/** Certificate auth is per checkout: fetch fresh params and remount for the next one. */
async function newCheckout() {
  lastResult = null;
  lifecycle = null;
  hideChallengeModal();
  $('result-card').className = 'result-card hidden';
  $('gp-purchase-btn').classList.add('hidden');
  $('gp-new-checkout-btn').classList.add('hidden');
  await refreshAuth();
  await mountGooglePay();
}

async function refreshAuth() {
  const auth = await SpreedlyUtils.fetchAuthParams();
  authDetails = {
    environment_key: auth.environmentKey,
    certificate_token: auth.certificateToken,
    nonce: auth.nonce,
    signature: auth.signature,
    timestamp: auth.timestamp,
  };
}

// ── Wiring ────────────────────────────────────────────────────────────────────

function wireControls() {
  // The total changes often and needs no remount — that's what setTransactionInfo() is for.
  $('gp-amount').addEventListener('input', () => {
    if ((!googlePay && !checkout) || orderTotal() <= 0) return;
    try {
      applyTransactionInfo();
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });

  // Everything else changes the request or the button, so rebuild the instance.
  document
    .querySelectorAll('#payment-section input[type="checkbox"], #payment-section select, #gp-btn-radius, #gp-test-card')
    .forEach(control => control.addEventListener('change', () => mountGooglePay()));

  // The test SCA scenario only applies to 3DS Global.
  document.querySelectorAll('input[name="gp-3ds-mode"]').forEach(radio =>
    radio.addEventListener('change', () => {
      $('gp-3ds-scenarios').classList.toggle('hidden', threeDSMode() !== 'global');
    })
  );

  document
    .querySelectorAll('input[name="gp-placement"], input[name="gp-ec-display"]')
    .forEach(radio => radio.addEventListener('change', () => mountGooglePay()));

  $('gp-ec-open-btn').addEventListener('click', openExpressCheckout);
  $('gp-copy-config').addEventListener('click', copyConfigSnippet);
  $('gp-ec-dialog-close').addEventListener('click', closeDialog);
  $(EC_DIALOG_ID).addEventListener('click', event => {
    if (event.target === $(EC_DIALOG_ID)) closeDialog();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeDialog();
  });
  $('gp-purchase-btn').addEventListener('click', purchase);
  $('gp-new-checkout-btn').addEventListener('click', newCheckout);
  window.addEventListener('beforeunload', teardown);
}

/** Inside the Express Checkout form by default on that bundle; ?placement=standalone opts out. */
function initPlacement() {
  const available = typeof window.SpreedlyExpressCheckout === 'function';
  const requested = new URLSearchParams(window.location.search).get('placement');
  const initial = available && requested !== 'standalone' ? 'express-checkout' : 'standalone';
  // Set explicitly: browsers restore a checked radio on reload, even into the other bundle.
  document.querySelectorAll('input[name="gp-placement"]').forEach(radio => {
    radio.checked = radio.value === initial;
  });
  $('gp-placement-section').classList.toggle('hidden', !available);
}

function init() {
  // Both bundles (Hosted Fields and Express Checkout) expose window.SpreedlyGooglePay.
  SpreedlyUtils.loadSDKScript(async error => {
    if (error) {
      showFatal('Failed to load the Spreedly SDK. Please refresh.');
      return;
    }
    if (typeof window.SpreedlyGooglePay === 'undefined') {
      showFatal(
        'SpreedlyGooglePay is not in this SDK build yet. Run checkout-web-sdk locally (npm run dev) ' +
          'and enable the local-SDK block in shared/utils.js — see docs/google-pay/DEMO_GUIDE.md.'
      );
      return;
    }

    try {
      await refreshAuth();
    } catch {
      showFatal('Failed to fetch auth params from the server.');
      return;
    }

    $('loading-state').classList.add('hidden');
    $('gp-workspace').classList.remove('hidden');
    logEvent('SDK loaded, auth params fetched');
    initPlacement();
    wireControls();
    await mountGooglePay();
  });
}

init();
