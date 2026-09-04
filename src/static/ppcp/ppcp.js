
const LOCAL_SDK_URL = 'http://localhost:5000/index.js';
const PAYPAL_V6_SDK_URL = 'https://www.sandbox.paypal.com/web-sdk/v6/core';
const CURRENCY = 'USD';

// SDK config key, container element, display name.
const BUTTON_KINDS = [
  { key: 'paypal', elementId: 'paypal-button', label: 'PayPal' },
  { key: 'payLater', elementId: 'paylater-button', label: 'Pay Later' },
  { key: 'payPalCredit', elementId: 'paypalcredit-button', label: 'PayPal Credit' },
  { key: 'venmo', elementId: 'venmo-button', label: 'Venmo' },
];

const PRODUCTS = [
  { id: 'prod_1', name: 'Wireless Headphones', description: 'Premium noise-canceling headphones', price: 149.99, emoji: '🎧' },
  { id: 'prod_2', name: 'Smart Watch', description: 'Fitness tracker with heart rate monitor', price: 299.99, emoji: '⌚' },
  { id: 'prod_3', name: 'Laptop Stand', description: 'Ergonomic aluminum stand', price: 79.99, emoji: '💻' },
  { id: 'prod_4', name: 'USB-C Cable', description: 'Braided 2m charging cable', price: 12.99, emoji: '🔌' },
];

// State
let cart = {}; // { productId: quantity }
let ppcpInstance = null;
let vaultInstance = null;
let sdksLoaded = false;
let savedDuringPurchase = false; // was "save my PayPal" ticked for the current order?

const apiBase = () => window.SpreedlyUtils.LOCAL_API_URL;
const el = id => document.getElementById(id);
const errorText = error =>
  error.response?.data ? JSON.stringify(error.response.data) : error.message;

function destroyInstance(instance) {
  try {
    instance?.destroy();
  } catch (e) {
    /* already torn down */
  }
}

// ── Step 1: products & cart ───────────────────────────────────────────────────

function renderProducts() {
  el('products-grid').innerHTML = PRODUCTS.map(
    product => `
    <div class="product-card" data-id="${product.id}">
      <div class="product-image">${product.emoji}</div>
      <div class="product-name">${product.name}</div>
      <div class="product-description">${product.description}</div>
      <div class="product-price">${SpreedlyUtils.formatCurrency(product.price)}</div>
      <div class="product-quantity">
        <button class="quantity-btn" onclick="updateQuantity('${product.id}', -1)" ${!cart[product.id] ? 'disabled' : ''}>−</button>
        <span class="quantity-value">${cart[product.id] || 0}</span>
        <button class="quantity-btn" onclick="updateQuantity('${product.id}', 1)">+</button>
      </div>
    </div>
  `
  ).join('');
  updateCartSummary();
}

window.updateQuantity = function (productId, delta) {
  const newQty = Math.max(0, (cart[productId] || 0) + delta);
  if (newQty === 0) {
    delete cart[productId];
  } else {
    cart[productId] = newQty;
  }
  renderProducts();
};

function getCartTotal() {
  return Object.entries(cart).reduce((total, [productId, qty]) => {
    const product = PRODUCTS.find(p => p.id === productId);
    return total + product.price * qty;
  }, 0);
}

function cartItemsHtml() {
  return Object.entries(cart)
    .map(([productId, qty]) => {
      const product = PRODUCTS.find(p => p.id === productId);
      return `
      <div class="order-item">
        <div class="order-item-name">
          <span>${product.emoji}</span>
          <span>${product.name}</span>
          <span class="order-item-qty">× ${qty}</span>
        </div>
        <span>${SpreedlyUtils.formatCurrency(product.price * qty)}</span>
      </div>`;
    })
    .join('');
}

function updateCartSummary() {
  const hasItems = Object.keys(cart).length > 0;
  el('cart-summary').style.display = hasItems ? 'block' : 'none';
  el('proceed-to-payment').disabled = !hasItems;
  if (hasItems) {
    el('cart-items').innerHTML = cartItemsHtml();
    el('cart-total').textContent = SpreedlyUtils.formatCurrency(getCartTotal());
  }
}

// ── Step navigation ───────────────────────────────────────────────────────────

window.goToStep = function (step) {
  document.querySelectorAll('.stepper-step').forEach(s => {
    const stepNum = parseInt(s.dataset.step, 10);
    s.classList.remove('active', 'completed');
    if (stepNum === step) s.classList.add('active');
    else if (stepNum < step) s.classList.add('completed');
  });
  document.querySelectorAll('.step-content').forEach(c => c.classList.remove('active'));
  el(`step-${step}`).classList.add('active');

  document.body.classList.toggle('step-1-active', step === 1);

  if (step === 2) {
    el('summary-items').innerHTML = cartItemsHtml();
    el('summary-total').textContent = SpreedlyUtils.formatCurrency(getCartTotal());
    refreshVaultedTokens();
    loadAndMountPPCP();
  }
};

window.toggleAccordion = function (id) {
  el(id)?.classList.toggle('open');
};

// ── Step 2: load SDKs + mount SpreedlyPPCP ────────────────────────────────────

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.body.appendChild(script);
  });
}

async function loadDependencies() {
  if (sdksLoaded) return;
  await loadScript(PAYPAL_V6_SDK_URL);
  if (!window.paypal || typeof window.paypal.createInstance !== 'function') {
    throw new Error('PayPal Web SDK v6 failed to load (window.paypal.createInstance missing).');
  }
  await loadScript(LOCAL_SDK_URL);
  if (typeof window.SpreedlyPPCP === 'undefined') {
    throw new Error(
      'SpreedlyPPCP is not available. Is the local SDK dev server running on :5000 ' +
        '(in checkout-web-sdk run `npm run dev`)?'
    );
  }
  sdksLoaded = true;
}

// PayPal returns Pay Later OR PayPal Credit, never both, and Pay Later wins. Credit is only
// reachable if Pay Later is not requested at all.
function activeButtonKinds() {
  return cfg('show-credit') === 'on'
    ? BUTTON_KINDS.filter(({ key }) => key !== 'payLater')
    : BUTTON_KINDS;
}

function clearButtonContainers() {
  BUTTON_KINDS.forEach(({ elementId }) => {
    const container = el(elementId);
    if (container) container.innerHTML = '';
  });
}

function buildMessagingConfig() {
  return {
    elementId: 'paylater-message',
    ...(cfgText('message-logo-type') ? { logoType: cfgText('message-logo-type') } : {}),
    ...(cfgText('message-text-color') ? { textColor: cfgText('message-text-color') } : {}),
    ...(cfgText('message-presentation-mode')
      ? { presentationMode: cfgText('message-presentation-mode') }
      : {}),
    onContentReady: () => console.log('[paylater-message] content ready'),
  };
}

function buildPPCPConfig({ clientId, environmentKey }) {
  return {
    clientId,
    environmentKey,
    currencyCode: CURRENCY,
    amount: getAmount(), // cart total -> Pay Later eligibility (amount-based thresholds)
    ...(cfg('country-code') ? { countryCode: cfg('country-code') } : {}),
    paymentElements: Object.fromEntries(activeButtonKinds().map(b => [b.key, b.elementId])),
    createOrder,
    onPaymentResult: handlePaymentResult,
    buttonStyle: getButtonStyle(),
    presentationMode: getPresentationMode(),
    ...(getCommit() === undefined ? {} : { commit: getCommit() }),
    // Tells PayPal this purchase also saves the payment method, so the buyer is asked to agree.
    ...(el('save-during-purchase')?.checked ? { savePayment: true } : {}),
    ...(cfg('on-redirect') === 'manual' ? { onRedirect: showRedirectUrl } : {}),
    // Sandbox only. Supplies the default for countryCode, so an explicit countryCode still wins.
    testBuyerCountry: 'US',
    // Venmo has its own sandbox network and its own accounts.
    venmoSandbox: true,
    // PayPal's waiting overlay. Only an explicit false turns it off.
    ...(cfg('full-page-overlay') === 'off' ? { fullPageOverlay: false } : {}),
    // Pay Later promotional messaging — independent of the buttons, rendered into its own element.
    ...(cfg('paylater-messaging') === 'on' ? { payLaterMessaging: buildMessagingConfig() } : {}),
  };
}

function renderEligibility(rendered) {
  const requested = activeButtonKinds();
  const notRequested = BUTTON_KINDS.filter(b => !requested.includes(b));
  el('eligibility-result').innerHTML = [
    ...requested.map(
      ({ key, label }) =>
        `<span class="elig-result ${rendered[key] ? 'ok' : 'no'}">${label}: ${
          rendered[key] ? '✓ rendered' : '✗ not eligible'
        }</span>`
    ),
    ...notRequested.map(({ label }) => `<span class="elig-result no">${label}: — not requested</span>`),
  ].join('');

  const names = requested.filter(({ key }) => rendered[key]).map(({ label }) => label);
  if (names.length) {
    updateDebug('status', `Rendered: ${names.join(', ')}`);
    setStatus(
      `Ready: ${names.join(', ')}. Click a button to pay ${SpreedlyUtils.formatCurrency(getCartTotal())}.`,
      'success'
    );
  } else {
    updateDebug('status', 'No eligible buttons');
    setStatus(
      'No eligible buttons for this order (check account/region; Venmo & Pay Later are US/USD).',
      'info'
    );
  }
}

async function loadAndMountPPCP() {
  el('payment-buttons-loading').classList.remove('hidden');
  el('payment-buttons-container').classList.add('hidden');
  dismissToast('payment');
  el('eligibility-result').textContent = '';
  setStatus('', 'info');
  updateDebug('status', 'Loading PayPal & Spreedly SDKs...');

  try {
    await loadDependencies();

    destroyInstance(ppcpInstance);
    clearButtonContainers();

    ppcpInstance = new window.SpreedlyPPCP(buildPPCPConfig(await getPPCPConfig()));

    const result = await ppcpInstance.mount();
    if (result.error) throw new Error(result.error);

    el('payment-buttons-loading').classList.add('hidden');
    el('payment-buttons-container').classList.remove('hidden');
    renderEligibility(result.rendered || {});
  } catch (error) {
    console.error('PPCP mount error:', error);
    showError(errorText(error));
  }
}

// ── SpreedlyPPCP callbacks ────────────────────────────────────────────────────

function getAmount() {
  return getCartTotal().toFixed(2); // Orders V2 expects a decimal string, e.g. "229.98"
}

function cfg(name) {
  const picked = document.querySelector(`input[name="${name}"]:checked`);
  return picked ? picked.value : '';
}

// Non-radio config controls. Checks select first so a <select> is not missed.
function cfgText(name) {
  const field = document.querySelector(`select[name="${name}"], input[name="${name}"]`);
  return field ? field.value.trim() : '';
}

function getButtonStyle() {
  const style = {};
  const label = cfg('btn-label');
  const color = cfg('btn-color');
  const paypalRadius = cfgText('paypal-radius');
  const venmoRadius = cfgText('venmo-radius');
  if (label) style.label = label;
  if (color) style.color = color;
  if (paypalRadius) style.paypalBorderRadius = paypalRadius;
  if (venmoRadius) style.venmoBorderRadius = venmoRadius;
  return Object.keys(style).length ? style : undefined;
}

// The PayPal client ID is a static, public value — inline it in your page. The demo fetches it
// only because it lives in .env.
let cachedConfig = null;
async function getPPCPConfig() {
  if (cachedConfig) return cachedConfig;
  const response = await axios.get(`${apiBase()}/ppcp/config`);
  cachedConfig = response.data;
  return cachedConfig;
}

// commit controls PayPal's final button wording. Only sent when explicitly chosen.
function getCommit() {
  const v = cfg('commit');
  return v === '' ? undefined : v === 'true';
}

// 'auto' and 'popup' open a separate window; 'redirect' navigates the whole page.
function getPresentationMode() {
  return cfg('presentation-mode') || 'auto';
}

// Spreedly transacts venmo as its own payment method type. 'paylater' and 'paypal_credit' are
// funding sources on a PayPal account, so they transact as paypal.
function walletFor(context) {
  return context?.payment_method?.payment_method_type === 'venmo' ? 'venmo' : 'paypal';
}

// `context` is the SDK reporting which button was clicked.
async function createOrder(context) {
  savedDuringPurchase = !!el('save-during-purchase')?.checked;
  setStatus(
    savedDuringPurchase ? 'Creating order via Spreedly (+ save)...' : 'Creating order via Spreedly...',
    'info'
  );
  const response = await axios.post(`${apiBase()}/ppcp/spreedly/orders`, {
    amount: getAmount(),
    currency_code: CURRENCY,
    payment_method_type: walletFor(context),
    transaction_type: cfg('transaction-type'),
    // Vault with purchase — one offsite flow that pays and saves.
    ...(savedDuringPurchase ? { store_in_vault: true } : {}),
  });
  updateDebug('orderId', response.data.id);
  updateDebug('backend', 'Spreedly gateway');
  return { orderId: response.data.id };
}

async function captureOrder(orderId) {
  const response = await axios.post(
    `${apiBase()}/ppcp/spreedly/orders/${orderId}/capture`
  );
  return response.data;
}

// Captures in-page. Only reached when the redirect leg could not run — the normal path navigates
// to /ppcp/return/, which captures there instead.
async function captureAndReport(orderId, describe, finalize) {
  try {
    const capture = finalize ? await finalize() : await captureOrder(orderId);
    const status = capture.status || 'COMPLETED';
    updateDebug('status', `Captured: ${status}`);
    showResult(true, 'Payment Successful', describe(status));
    setStatus('Payment complete.', 'success');
    // Refresh on what the server actually vaulted, not on what the checkbox asked for.
    if (capture.savedPaymentMethod) await refreshVaultedTokens();
  } catch (error) {
    updateDebug('status', 'Capture failed');
    showResult(false, 'Capture Failed', errorText(error));
    setStatus('Failed to capture order', 'error');
  }
}

function savedNote() {
  return savedDuringPurchase ? ' PayPal also saved for future purchases.' : '';
}

function traceRedirectLeg(message) {
  console.log('[redirect-leg]', message);
  updateDebug('status', message);
}

/**
 * Finalize a popup approval by visiting Spreedly's redirect leg — the URL PayPal would have sent
 * the buyer through in redirect mode.
 *
 *   GET {SPREEDLY_URL}/transaction/{transaction_token}/redirect?token={paypal_order_id}
 *
 * Navigate rather than fetch, so the browser follows the 302 chain. Nothing after this runs:
 * Spreedly lands the buyer on redirect_url, and that page captures.
 */
async function finalizeViaSpreedlyRedirect(result) {
  try {
    setStatus("Finalizing via Spreedly's redirect leg...", 'info');

    const before = (await axios.get(`${apiBase()}/ppcp/spreedly/orders/${result.orderId}`)).data;
    const txnToken = before?.transaction?.token;
    if (!txnToken) {
      traceRedirectLeg('no transaction token for that order');
      return false;
    }

    const url =
      `https://core.spreedly.com/transaction/${encodeURIComponent(txnToken)}/redirect` +
      `?token=${encodeURIComponent(result.orderId)}`;
    traceRedirectLeg(`navigating to ${url}`);
    window.location.assign(url);
    return true;
  } catch (error) {
    traceRedirectLeg(`error: ${errorText(error)}`);
    return false;
  }
}

async function handlePaymentResult(result) {
  updateDebug('state', result.state);
  updateDebug('payerId', result.payerId);
  const method = result.payment_method?.payment_method_type || 'paypal';

  if (result.state === 'Successful') {
    // A popup approval never travels through Spreedly's redirect_url, so Spreedly has not
    // finalized the transaction. Visiting the redirect leg does it, and navigates away.
    if (getPresentationMode() !== 'redirect') {
      if (await finalizeViaSpreedlyRedirect(result)) return;
    }

    setStatus('Capturing order...', 'info');
    await captureAndReport(
      result.orderId,
      status => `Order ${result.orderId} captured via ${method} (status: ${status}).${savedNote()}`
    );
  } else if (result.state === 'Cancelled') {
    setStatus('Payment cancelled.', 'info');
    showResult(
      false,
      'Payment Cancelled',
      `${method} payment was cancelled.` +
        (result.orderId ? ` Order ${result.orderId} was created and can be voided.` : '')
    );
  } else {
    const detail = result.code
      ? `[${result.code}] ${result.message || ''}`.trim()
      : result.message || `${method} payment failed.`;
    showResult(false, 'Payment Failed', detail);
    setStatus('Payment failed', 'error');
  }
}

// ── Vault / recurring (save a PayPal, then charge it later) ───────────────────

/**
 * Save a PayPal without paying.
 *
 * Spreedly's gateway verify creates the approval session; `createVaultSetupToken` hands its
 * approval_session_id to the SDK where PayPal's save session expects a Vault v3 setup token.
 * PayPal accepts it, so the buyer gets a real PayPal button rather than a bare redirect.
 *
 * The transaction token is held for the popup path: PayPal returns the buyer through Spreedly's
 * own redirect leg, which finalizes the verification, but a popup never travels through it.
 */
async function mountVault() {
  el('save-trigger')?.classList.add('hidden');
  el('save-loading').classList.remove('hidden');
  setVaultStatus('Loading PayPal SDK...', 'info');

  try {
    await loadDependencies();
    destroyInstance(vaultInstance);
    el('save-paypal-button').innerHTML = '';

    vaultInstance = new window.SpreedlyPPCP({
      flow: 'vault',
      currencyCode: CURRENCY,
      countryCode: 'US',
      testBuyerCountry: 'US',
      paymentElements: { paypal: 'save-paypal-button' },
      ...(await getPPCPConfig()),
      // Redirect, not the panel's presentationMode. Spreedly bakes its redirect_url into the
      // approval session, so PayPal finishes by navigating rather than handing the result back to
      // the opener. In a popup the wallet still vaults — inside the popup — but onPaymentResult
      // never fires and this page would show the buyer nothing.
      presentationMode: 'redirect',
      createVaultSetupToken: async () => {
        const res = await axios.post(`${apiBase()}/ppcp/spreedly/vault/setup`);
        if (!res.data.approval_session_id) {
          throw new Error('Spreedly did not return an approval session.');
        }
        return { setupToken: res.data.approval_session_id };
      },
      onPaymentResult: handleVaultResult,
    });

    const result = await vaultInstance.mount();
    el('save-loading').classList.add('hidden');
    if (result.error) throw new Error(result.error);

    setVaultStatus(
      result.rendered?.paypal
        ? 'Click the PayPal button to save it for later.'
        : 'Saving a PayPal is not eligible for this session.',
      'info'
    );
  } catch (error) {
    el('save-loading').classList.add('hidden');
    el('save-trigger')?.classList.remove('hidden');
    setVaultStatus(errorText(error), 'error');
  }
}

/**
 * Only cancellation and failure reach this. On success PayPal navigates the buyer away, Spreedly
 * finalizes on its redirect leg, and /ppcp/return/ records the saved method.
 */
async function handleVaultResult(result) {
  if (result.state === 'Cancelled') {
    setVaultStatus('Save cancelled.', 'info');
  } else if (result.state !== 'Successful') {
    setVaultStatus(result.message || 'Save failed.', 'error');
  }
}

// The same tokens appear twice with different actions: the products step charges
// merchant-initiated, the payment step charges buyer-present for the cart total.
const SAVED_METHOD_LISTS = [
  { elementId: 'saved-methods-list', mode: 'mit', empty: 'None saved yet.' },
  {
    elementId: 'checkout-saved-methods',
    mode: 'cit',
    empty: 'Nothing saved yet — save one from the products step.',
  },
];

async function refreshVaultedTokens() {
  try {
    const res = await axios.get(`${apiBase()}/ppcp/spreedly/vault/tokens`);
    const tokens = res.data.tokens || [];
    SAVED_METHOD_LISTS.forEach(({ elementId, mode, empty }) => {
      const node = el(elementId);
      if (!node) return;
      node.innerHTML = tokens.length
        ? tokens.map(t => renderSavedMethod(t, mode)).join('')
        : `<p style="color: var(--color-gray-500); font-size: 0.8125rem;">${empty}</p>`;
    });
  } catch (error) {
    /* ignore — leave the lists as-is */
  }
}

// Render whatever keys arrived rather than a fixed set.
function prettyDetailLabel(key) {
  return key.replace(/\./g, ' ').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function renderBuyerDetails(details) {
  const entries = Object.entries(details || {});
  if (!entries.length) return '';
  const rows = entries
    .map(
      ([k, v]) =>
        `<dt>${SpreedlyUtils.escapeHtml(prettyDetailLabel(k))}</dt>` +
        `<dd>${SpreedlyUtils.escapeHtml(String(v))}</dd>`
    )
    .join('');
  return `
    <details class="buyer-details">
      <summary>Buyer details (${entries.length})</summary>
      <dl>${rows}</dl>
    </details>`;
}

function renderSavedMethod(t, mode) {
  const saved = t.createdAt ? new Date(t.createdAt).toLocaleString() : '';
  const action =
    mode === 'cit'
      ? `<button class="btn btn-primary" onclick="payWithSaved(${t.ref})"
           title="Buyer present — one-click (CUSTOMER-initiated)">Pay ${SpreedlyUtils.formatCurrency(getCartTotal())} (1-click)</button>`
      : `<button class="btn btn-secondary" onclick="chargeSaved(${t.ref})"
           title="Buyer not present — recurring MIT (MERCHANT-initiated)">Charge $10 (recurring)</button>`;
  return `
    <div class="saved-method" data-ref="${t.ref}">
      <div class="saved-method-head">
        <span class="saved-method-label">${SpreedlyUtils.escapeHtml(t.label)}</span>
        <span class="saved-method-meta">saved ${SpreedlyUtils.escapeHtml(saved)}</span>
      </div>
      ${renderBuyerDetails(t.details)}
      <div class="saved-method-actions">${action}</div>
    </div>`;
}

// Toasts are dismissed by hand, not on a timer — they carry ids worth reading. `key` decides what
// replaces what, so a pending toast is replaced by its own result.
const toasts = new Map();

function showToast(key, kind, message, title) {
  const stack = el('toast-stack');
  if (!stack) return;

  let toast = toasts.get(key);
  if (!toast) {
    toast = document.createElement('div');
    const content = document.createElement('div');
    content.className = 'toast-body';
    const heading = document.createElement('div');
    heading.className = 'toast-title';
    const body = document.createElement('div');
    content.append(heading, body);
    const close = document.createElement('button');
    close.className = 'toast-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss');
    close.textContent = '×';
    close.addEventListener('click', () => {
      toast.remove();
      toasts.delete(key);
    });
    toast.append(content, close);
    stack.appendChild(toast);
    toasts.set(key, toast);
  }

  toast.className = `toast ${kind}`;
  const heading = toast.querySelector('.toast-title');
  heading.textContent = title || '';
  heading.style.display = title ? '' : 'none';
  toast.querySelector('.toast-body > div:last-child').textContent = message;
}

function dismissToast(key) {
  toasts.get(key)?.remove();
  toasts.delete(key);
}

// Keyed by ref+mode, so a charge on one list never overwrites one on the other.
function setSavedResult(ref, kind, message, mode) {
  showToast(`${mode}-${ref}`, kind, message);
}

// The two ways to spend a saved token. Same endpoint; they differ in who initiated it, which
// decides the stored_credential fields the server sends.
const CHARGE_MODES = {
  mit: {
    initiator: 'MERCHANT',
    amount: () => '10.00',
    pending: 'Charging (recurring, buyer not present)…',
    label: 'Recurring charge',
  },
  // Return buyer present, one-click. No PayPal popup — the wallet was authorized when vaulted.
  cit: {
    initiator: 'CUSTOMER',
    amount: () => getCartTotal().toFixed(2),
    pending: 'Paying (one-click, buyer present)…',
    label: 'One-click payment',
  },
};

async function chargeSavedToken(ref, mode) {
  const { initiator, amount, pending, label } = CHARGE_MODES[mode];
  const value = amount();
  if (Number(value) <= 0) {
    setSavedResult(ref, 'err', 'Cart is empty — add products before paying.', mode);
    return;
  }

  setSavedResult(ref, 'pending', pending, mode);
  try {
    const { data } = await axios.post(`${apiBase()}/ppcp/spreedly/vault/charge`, {
      ref,
      amount: value,
      currency_code: CURRENCY,
      initiator,
    });
    await refreshVaultedTokens();

    const charged = data.amount ? `$${data.amount} ${data.currency_code || ''}`.trim() : `$${value}`;
    if (data.succeeded) {
      setSavedResult(
        ref,
        'ok',
        `${label} succeeded — ${charged} captured. Order ${data.id}` +
          (data.captureId ? `, capture ${data.captureId}.` : '.'),
        mode
      );
      setVaultStatus(`${label} succeeded.`, 'success');
    } else {
      setSavedResult(
        ref,
        'err',
        `${label} did not complete — order status ${data.status || 'unknown'}` +
          (data.captureError ? ` (${data.captureError})` : '') + '.',
        mode
      );
      setVaultStatus(`${label} did not complete.`, 'error');
    }
  } catch (error) {
    setSavedResult(ref, 'err', errorText(error), mode);
    setVaultStatus(errorText(error), 'error');
  }
}

window.chargeSaved = ref => chargeSavedToken(ref, 'mit');
window.payWithSaved = ref => chargeSavedToken(ref, 'cit');

// onRedirect only fires in a flow that navigates. In popup mode PayPal completes in place, so the
// option is disabled rather than left to do nothing.
function syncRedirectHandlingAvailability() {
  const manual = document.querySelector('input[name="on-redirect"][value="manual"]');
  if (!manual) return;
  const mode = getPresentationMode();
  const navigates = mode === 'redirect';
  manual.disabled = !navigates;
  manual.closest('.cfg-opt')?.classList.toggle('disabled', !navigates);

  const why = manual.parentElement?.querySelector('.why');
  if (why) why.textContent = navigates ? 'shows a button' : `not in ${mode} mode`;

  if (!navigates && manual.checked) {
    const auto = document.querySelector('input[name="on-redirect"][value=""]');
    if (auto) auto.checked = true;
  }
}

// The SDK hands back the approval URL instead of navigating — the hook a mobile app uses to open
// it somewhere it can handle the return from.
function showRedirectUrl(url) {
  updateDebug('status', 'Redirect URL received (SDK did not navigate)');
  setStatus('SDK handed back the approval URL instead of navigating.', 'info');
  const container = el('payment-buttons-container');
  if (!container) return;
  let box = el('redirect-url-box');
  if (!box) {
    box = document.createElement('div');
    box.id = 'redirect-url-box';
    box.style.cssText =
      'margin-top:1rem;padding:0.75rem;border:1px solid var(--color-gray-300);' +
      'border-radius:var(--radius-sm);background:var(--color-gray-50);font-size:0.8125rem;';
    container.appendChild(box);
  }
  box.innerHTML = '';
  const label = document.createElement('div');
  label.style.cssText = 'color:var(--color-gray-600);margin-bottom:0.5rem;';
  label.textContent = 'onRedirect fired. The SDK did not navigate — this URL is yours to use:';
  const code = document.createElement('div');
  code.style.cssText =
    'font-family:var(--font-mono);font-size:0.6875rem;word-break:break-all;' +
    'color:var(--color-gray-800);margin-bottom:0.75rem;';
  code.textContent = url;
  const go = document.createElement('button');
  go.className = 'btn btn-primary';
  go.textContent = 'Continue to PayPal';
  go.addEventListener('click', () => window.location.assign(url));
  box.append(label, code, go);
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function updateDebug(field, value) {
  const map = { orderId: 'order-id', payerId: 'payer-id' };
  const target = el(`debug-${map[field] || field}`);
  if (target) target.textContent = value || '—';
}

function setMessage(elementId, message, type) {
  const node = el(elementId);
  if (!node) return;
  node.textContent = message;
  node.className = `status-message ${type}`;
}

function setStatus(message, type = 'info') {
  setMessage('status-message', message, type);
}

function setVaultStatus(message, type = 'info') {
  setMessage('vault-status', message, type);
}

function showResult(isSuccess, title, message) {
  showToast('payment', isSuccess ? 'ok' : 'err', message, title);
}

function showError(message) {
  el('payment-buttons-loading').classList.add('hidden');
  showResult(false, 'Error', message);
  setStatus('Error', 'error');
  updateDebug('status', `Error: ${message}`);
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
  renderProducts();
  refreshVaultedTokens();
  el('proceed-to-payment').addEventListener('click', () => goToStep(2));
  el('back-to-products').addEventListener('click', () => goToStep(1));
  el('save-trigger').addEventListener('click', mountVault);
  el('save-during-purchase')?.addEventListener('change', () => {
    if (sdksLoaded && ppcpInstance) loadAndMountPPCP();
  });
  // Re-mount when any SDK config radio changes.
  const cfgPanel = el('sdk-config');
  if (cfgPanel) {
    cfgPanel.addEventListener('change', () => {
      syncRedirectHandlingAvailability();
      if (sdksLoaded && ppcpInstance) loadAndMountPPCP();
    });
    syncRedirectHandlingAvailability();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
