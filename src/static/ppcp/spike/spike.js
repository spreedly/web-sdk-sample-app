/**
 * PPCP Demo — PayPal DIRECT (spike).
 *
 * Two-step flow:
 *   1. Product selection — pick products; the total decides the amount. Shows the
 *      button-rendering eligibility criteria (PayPal / Pay Later / Venmo).
 *   2. Payment — on "Proceed to Payment", the PayPal JS SDK v6 + local Spreedly SDK
 *      are loaded and SpreedlyPPCP mounts the eligible buttons for the cart total.
 *
 * Drives SpreedlyPPCP against the sample-app /ppcp/* routes, which call PayPal Orders V2 and
 * Vault v3 DIRECTLY in sandbox. Throwaway dev harness, NOT a production path — it bypasses
 * Spreedly entirely (no Spreedly transaction, no partner fees, no reporting).
 * See ppcp/integration-plan/07-interim-direct-order-spike.md.
 *
 * The Spreedly-brokered version of this same flow lives at /ppcp/ — deliberately a separate
 * page so the two backends cannot contaminate each other.
 *
 * Requires the LOCAL dev loop:
 *   - checkout-web-sdk:   `npm run dev`  (serves the SDK with SpreedlyPPCP on :5000)
 *   - web-sdk-sample-app: `npm run dev`  (this server on :3000, PayPal sandbox creds in .env)
 * SpreedlyPPCP is NOT on the CDN rc channel yet, so the SDK is loaded from localhost:5000.
 */

// The local SDK build exposes window.SpreedlyPPCP (the CDN rc bundle does not yet).
const LOCAL_SDK_URL = 'http://localhost:5000/index.js';
// PayPal JS SDK v6 core (sandbox).
const PAYPAL_V6_SDK_URL = 'https://www.sandbox.paypal.com/web-sdk/v6/core';
// Products are priced in USD (Venmo & Pay Later are US/USD only).
const CURRENCY = 'USD';

// The four wallet buttons: SDK config key, container element, display name. Single source for
// paymentElements, container clearing and the eligibility readout.
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
let savedDuringPurchase = false; // scenario 2: was "save my PayPal" ticked for the current order?

// /ppcp/* routes are local-only (not deployed to Heroku), so use the local API base.
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

  // Step 1 spans the full width; the config panel belongs to the payment step only.
  document.body.classList.toggle('step-1-active', step === 1);

  if (step === 2) {
    el('summary-items').innerHTML = cartItemsHtml();
    el('summary-total').textContent = SpreedlyUtils.formatCurrency(getCartTotal());
    // The saved-method buttons quote the cart total, so re-render them for this cart.
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

// PayPal returns Pay Later OR PayPal Credit, never both, and Pay Later wins. The SDK scopes its
// eligibility request to the kinds in paymentElements, so Credit is only reachable if Pay Later is
// not asked for at all.
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

function buildPPCPConfig(clientId) {
  return {
    currencyCode: CURRENCY,
    amount: getAmount(), // cart total -> Pay Later eligibility (amount-based thresholds)
    ...(cfg('country-code') ? { countryCode: cfg('country-code') } : {}),
    paymentElements: Object.fromEntries(activeButtonKinds().map(b => [b.key, b.elementId])),
    clientId,
    createOrder,
    onPaymentResult: handlePaymentResult,
    buttonStyle: getButtonStyle(),
    // 'auto' pops up; a full-page redirect mode instead returns the buyer through the
    // gateway's own return_url, which is what Spreedly's offsite flow needs to finalize.
    presentationMode: getPresentationMode(),
    ...(getCommit() === undefined ? {} : { commit: getCommit() }),
    // "Also save my PayPal" — tells PayPal this purchase also saves the payment method, so the
    // buyer is asked to agree. Read at mount time, not click time, so the checkbox re-mounts.
    ...(el('save-during-purchase')?.checked ? { savePayment: true } : {}),
    // When the merchant supplies onRedirect the SDK stops navigating and hands back the URL.
    ...(cfg('on-redirect') === 'manual' ? { onRedirect: showRedirectUrl } : {}),
    // Sandbox only, and this whole app is sandbox. It goes on createInstance and only supplies the
    // default for countryCode, so an explicit Buyer country above still wins.
    testBuyerCountry: 'US',
    // This whole app is sandbox, so always point Venmo at Venmo's sandbox. Venmo has its own
    // network and its own accounts, so a Venmo sandbox buyer does not exist in production.
    venmoSandbox: true,
    // PayPal shows a grey overlay over the page while the buyer is away. Only an explicit
    // false turns it off, so only send it then.
    ...(cfg('full-page-overlay') === 'off' ? { fullPageOverlay: false } : {}),
    // Pay Later promotional messaging — independent of the buttons, rendered into its own
    // element. Off unless the panel asks for it, so the default demo looks unchanged.
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

    // Fresh instance each time (the cart/amount may have changed since last mount).
    destroyInstance(ppcpInstance);
    clearButtonContainers();

    ppcpInstance = new window.SpreedlyPPCP(buildPPCPConfig(await getClientId()));

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

// ── SpreedlyPPCP callbacks — wired to the /ppcp/* routes (which call PayPal directly) ──

function getAmount() {
  return getCartTotal().toFixed(2); // Orders V2 expects a decimal string, e.g. "229.98"
}

// The SDK config panel uses radios, one group per SpreedlyPPCP option.
function cfg(name) {
  const picked = document.querySelector(`input[name="${name}"]:checked`);
  return picked ? picked.value : '';
}

// Non-radio config controls — the corner-radius text boxes and the messaging dropdowns.
// Checks select first so a <select> is not missed by an input-only query.
function cfgText(name) {
  const field = document.querySelector(`select[name="${name}"], input[name="${name}"]`);
  return field ? field.value.trim() : '';
}

// Read the button-appearance controls -> SpreedlyPPCP buttonStyle.
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

// PayPal's recommended auth for the JS SDK v6: a static, public client ID — nothing to mint.
// A real merchant inlines this string in their page; the demo reads it from the server only
// because it lives in .env. Cached so a re-mount does not refetch.
let cachedClientId = null;
async function getClientId() {
  if (cachedClientId) return cachedClientId;
  const response = await axios.get(`${apiBase()}/ppcp/config`);
  cachedClientId = response.data.clientId;
  return cachedClientId;
}

// Orders-API equivalent of commit. undefined means we did not send commit, and PayPal's own default
// for it is true — so PAY_NOW is the matching value, not a guess.
const userActionFor = commit => (commit === false ? 'CONTINUE' : 'PAY_NOW');

// commit controls PayPal's final button wording. Only sent when explicitly chosen, so PayPal's
// own default stands otherwise.
function getCommit() {
  const v = cfg('commit');
  return v === '' ? undefined : v === 'true';
}

// v6 session.start presentation mode. 'auto' and 'popup' open a separate window; 'redirect'
// navigates the whole page. 'modal' is not supported by the SDK — PayPal advises WebView only.
function getPresentationMode() {
  return cfg('presentation-mode') || 'auto';
}

// 'paylater' and 'paypal_credit' are funding sources on a PayPal account, not wallets of their
// own — they vault as paypal. Only Venmo is a separate vault.
function walletFor(context) {
  return context?.payment_method?.payment_method_type === 'venmo' ? 'venmo' : 'paypal';
}

// `context` comes from the SDK and names the button that was clicked. The vault-purchase order
// needs it: PayPal and Venmo vault under different payment_source keys.
async function createOrder(context) {
  // Scenario 2 (vault WITH purchase): if "save this wallet" is ticked, use the vault-purchase
  // order route so the wallet is also saved on capture. Same checkout session either way.
  savedDuringPurchase = !!el('save-during-purchase')?.checked;
  const wallet = walletFor(context);
  const walletName = wallet === 'venmo' ? 'Venmo' : 'PayPal';
  setStatus(
    savedDuringPurchase ? `Creating ${walletName} order (+ save)...` : `Creating ${walletName} order...`,
    'info'
  );
  const path = savedDuringPurchase ? '/ppcp/vault/purchase-order' : '/ppcp/orders';
  const willRedirect = getPresentationMode() === 'redirect';
  // A redirect reloads this page, so anything we need afterwards has to outlive it.
  if (willRedirect) {
    sessionStorage.setItem('ppcp_spike_saved', savedDuringPurchase ? '1' : '');
  }
  const response = await axios.post(`${apiBase()}${path}`, {
    amount: getAmount(),
    currency_code: CURRENCY,
    // Only a redirect needs a return URL. See createPPCPOrder in controllers/ppcp.ts.
    redirect: willRedirect,
    // The vault-purchase order carries an experience_context, so it needs user_action to agree with
    // the SDK's commit — otherwise PayPal is told "Review Order" and "Pay" at once. The plain order
    // route sends no experience_context, so commit alone decides there.
    ...(savedDuringPurchase ? { user_action: userActionFor(getCommit()), wallet } : {}),
  });
  updateDebug('orderId', response.data.id);
  return { orderId: response.data.id };
}

async function captureOrder(orderId) {
  const path = savedDuringPurchase
    ? `/ppcp/vault/purchase-order/${orderId}/capture`
    : `/ppcp/orders/${orderId}/capture`;
  const response = await axios.post(`${apiBase()}${path}`);
  return response.data;
}

// Shared by the in-page approval and the return-from-redirect path: both capture, then report.
// `describe` turns the captured status into the message each caller wants to show.
async function captureAndReport(orderId, describe) {
  try {
    const capture = await captureOrder(orderId);
    const status = capture.status || 'COMPLETED';
    updateDebug('status', `Captured: ${status}`);
    showResult(true, 'Payment Successful', describe(status));
    setStatus('Payment complete.', 'success');
    // Scenario 2: a vault-with-purchase capture stores the token — refresh the saved list.
    if (savedDuringPurchase) await refreshVaultedTokens();
  } catch (error) {
    updateDebug('status', 'Capture failed');
    showResult(false, 'Capture Failed', errorText(error));
    setStatus('Failed to capture order', 'error');
  }
}

function savedNote() {
  return savedDuringPurchase ? ' PayPal also saved for future purchases.' : '';
}

async function handlePaymentResult(result) {
  updateDebug('state', result.state);
  updateDebug('payerId', result.payerId);
  const method = result.payment_method?.payment_method_type || 'paypal';

  if (result.state === 'Successful') {
    setStatus('Capturing order...', 'info');
    await captureAndReport(
      result.orderId,
      status => `Order ${result.orderId} captured via ${method} (status: ${status}).${savedNote()}`
    );
  } else if (result.state === 'Cancelled') {
    setStatus('Payment cancelled.', 'info');
    // onCancel carries the order id, so the merchant can void the order they already created.
    showResult(
      false,
      'Payment Cancelled',
      `${method} payment was cancelled.` +
        (result.orderId ? ` Order ${result.orderId} was created and can be voided.` : '')
    );
  } else {
    // Surface the structured error code (from onError) alongside the message when present.
    const detail = result.code
      ? `[${result.code}] ${result.message || ''}`.trim()
      : result.message || `${method} payment failed.`;
    showResult(false, 'Payment Failed', detail);
    setStatus('Payment failed', 'error');
  }
}

// ── Vault / recurring (save a PayPal, then charge it later) ───────────────────

// Mount a vault-mode SpreedlyPPCP that renders a "save PayPal" button (no purchase).
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
      paymentElements: { paypal: 'save-paypal-button' },
      clientId: await getClientId(),
      createVaultSetupToken: async () => {
        const res = await axios.post(`${apiBase()}/ppcp/vault/setup-token`);
        return { setupToken: res.data.setupToken };
      },
      onPaymentResult: handleVaultResult,
    });

    const result = await vaultInstance.mount();
    el('save-loading').classList.add('hidden');
    if (result.error) throw new Error(result.error);

    setVaultStatus(
      result.rendered?.paypal
        ? 'Click the PayPal button to save it for later.'
        : 'PayPal save is not eligible for this session.',
      'info'
    );
  } catch (error) {
    el('save-loading').classList.add('hidden');
    console.error('Vault mount error:', error);
    setVaultStatus(errorText(error), 'error');
  }
}

// On approval, exchange the setup token for a stored payment token, then refresh the list.
async function handleVaultResult(result) {
  if (result.state === 'Successful') {
    try {
      setVaultStatus('Saving payment method...', 'info');
      await axios.post(`${apiBase()}/ppcp/vault/payment-token`, {
        vaultSetupToken: result.vaultSetupToken,
      });
      setVaultStatus('PayPal saved — you can now charge it as a recurring payment.', 'success');
      await refreshVaultedTokens();
    } catch (error) {
      setVaultStatus(errorText(error), 'error');
    }
  } else if (result.state === 'Cancelled') {
    setVaultStatus('Save cancelled.', 'info');
  } else {
    setVaultStatus(result.message || 'Save failed.', 'error');
  }
}

// The same tokens appear in two places with different actions: the products step offers the
// merchant-initiated charge (no cart, fixed $10), the payment step offers the buyer-present
// one-click for the cart total. Rendering both from one fetch keeps them in step.
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
    const res = await axios.get(`${apiBase()}/ppcp/vault/tokens`);
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

// PayPal returns whatever it returns, so render the keys that actually arrived rather than a
// fixed set. Dotted paths (name.given_name) become readable labels.
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
        <span class="elig-badge info">${t.wallet === 'venmo' ? 'Venmo' : 'PayPal'}</span>
        <span class="saved-method-meta">saved ${SpreedlyUtils.escapeHtml(saved)}</span>
      </div>
      ${renderBuyerDetails(t.details)}
      <div class="saved-method-actions">${action}</div>
    </div>`;
}

// Every outcome on this page is a toast. They carry order and capture ids worth reading, so they
// are dismissed by hand rather than on a timer.
//
// `key` decides what replaces what: a pending toast is replaced in place by its own result, and two
// unrelated outcomes sit side by side instead of overwriting each other.
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

// Saved-method charges: keyed by ref+mode, so a charge on the products list never overwrites one on
// the payment list. The list itself re-renders on every charge, which is why these cannot be inline.
function setSavedResult(ref, kind, message, mode) {
  showToast(`${mode}-${ref}`, kind, message);
}

// The two ways to spend a saved token. Same endpoint, same reporting — they differ only in who
// initiated it, which decides the amount and the stored_credential the server sends.
const CHARGE_MODES = {
  // Products step: buyer not present, no cart, so the amount is fixed.
  mit: {
    initiator: 'MERCHANT',
    amount: () => '10.00',
    pending: 'Charging (recurring, buyer not present)…',
    label: 'Recurring charge',
  },
  // Payment step: return buyer present, one-click. No PayPal popup — the method was already
  // authorized when it was vaulted. Charges the cart total, exactly like paying with a button.
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
    const { data } = await axios.post(`${apiBase()}/ppcp/vault/charge`, {
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

// PayPal sends the buyer back here after they approve or cancel. It adds its own values to the
// URL — `?token=<orderId>&PayerID=<payerId>` — not Spreedly's `transaction_token`, so this page
// reads them itself. Cancels come back with ?ppcp_cancelled=1, set as the order's cancel_url.
async function handlePayPalReturn() {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get('token');
  const payerId = params.get('PayerID');
  const cancelled = params.get('ppcp_cancelled') === '1';
  if (!orderId && !cancelled) return false;

  // Clear the URL so a refresh does not try to capture the same order twice.
  window.history.replaceState({}, '', window.location.pathname);

  // "Save my PayPal" was ticked before we navigated away; the page has reloaded since.
  savedDuringPurchase = sessionStorage.getItem('ppcp_spike_saved') === '1';
  sessionStorage.removeItem('ppcp_spike_saved');

  goToStep(2);
  updateDebug('orderId', orderId);
  updateDebug('payerId', payerId);

  if (cancelled) {
    updateDebug('state', 'Cancelled');
    showResult(false, 'Payment Cancelled', 'You came back from PayPal without approving.');
    setStatus('Cancelled at PayPal.', 'info');
    return true;
  }

  updateDebug('state', 'Successful');
  setStatus('Back from PayPal — capturing...', 'info');
  await captureAndReport(
    orderId,
    status =>
      `Order ${orderId} captured (status: ${status}).` +
      (payerId ? ` Payer ${payerId}.` : '') +
      savedNote()
  );
  return true;
}

// "Give me the URL" only does something in a flow that navigates — redirect, or the mobile
// app-switch. In popup PayPal completes in place, so onRedirect never fires and picking it
// would silently do nothing. Grey it out and say why, rather than letting the combination exist.
function syncRedirectHandlingAvailability() {
  const manual = document.querySelector('input[name="on-redirect"][value="manual"]');
  if (!manual) return;
  const mode = getPresentationMode();
  const navigates = mode === 'redirect';
  manual.disabled = !navigates;
  manual.closest('.cfg-opt')?.classList.toggle('disabled', !navigates);

  const why = manual.parentElement?.querySelector('.why');
  if (why) why.textContent = navigates ? 'shows a button' : `not in ${mode} mode`;

  // If it was selected and the mode changed out from under it, fall back to the default.
  if (!navigates && manual.checked) {
    const auto = document.querySelector('input[name="on-redirect"][value=""]');
    if (auto) auto.checked = true;
  }
}

// onRedirect handler. The SDK gives us the approval URL rather than navigating, so we show it and
// let the buyer choose when to go — the same hook a mobile app would use to open it somewhere it
// can handle the return from.
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

// One key, so a new outcome replaces the last one rather than stacking up.
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
  // If PayPal just sent the buyer back, deal with that instead of starting a fresh checkout.
  handlePayPalReturn();
  el('proceed-to-payment').addEventListener('click', () => goToStep(2));
  el('back-to-products').addEventListener('click', () => goToStep(1));
  el('save-trigger').addEventListener('click', mountVault);
  // savePayment is read when the SDK is built, so changing this has to rebuild it.
  el('save-during-purchase')?.addEventListener('change', () => {
    if (sdksLoaded && ppcpInstance) loadAndMountPPCP();
  });
  // Re-mount when any SDK config radio changes. One delegated listener on the panel, so
  // adding an option to the panel needs no JS change.
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
