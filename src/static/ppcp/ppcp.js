/**
 * PPCP Demo — brokered through SPREEDLY (the production path).
 *
 * Two-step flow:
 *   1. Product selection — pick products; the total decides the amount. Shows the
 *      button-rendering eligibility criteria (PayPal / Pay Later / Venmo).
 *   2. Payment — on "Proceed to Payment", the PayPal JS SDK v6 + local Spreedly SDK
 *      are loaded and SpreedlyPPCP mounts the eligible buttons for the cart total.
 *
 * Drives SpreedlyPPCP against the sample-app /ppcp/spreedly/* routes, which talk ONLY to
 * Spreedly's paypal_commerce_platform gateway. Spreedly creates the PayPal order server-side and
 * returns its id, so the browser half is identical to the direct-PayPal version.
 *
 * presentationMode defaults to 'redirect': Spreedly's offsite gateway only finalizes an
 * authorization when the buyer returns through its own return_url, which a popup never does.
 * The redirect lands on /ppcp/return/, which captures. See doc 14 §7ZZZ.
 *
 * The PayPal-direct version of this same flow lives at /ppcp/spike/.
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

  if (step === 2) {
    el('summary-items').innerHTML = cartItemsHtml();
    el('summary-total').textContent = SpreedlyUtils.formatCurrency(getCartTotal());
    loadAndMountPPCP();
  }
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

function clearButtonContainers() {
  ['paypal-button', 'paylater-button', 'paypalcredit-button', 'venmo-button'].forEach(id => {
    const container = el(id);
    if (container) container.innerHTML = '';
  });
}

async function loadAndMountPPCP() {
  el('payment-buttons-loading').classList.remove('hidden');
  el('payment-buttons-container').classList.add('hidden');
  el('result-card').classList.add('hidden');
  el('eligibility-result').textContent = '';
  setStatus('', 'info');
  updateDebug('status', 'Loading PayPal & Spreedly SDKs...');

  try {
    await loadDependencies();

    // Fresh instance each time (the cart/amount may have changed since last mount).
    if (ppcpInstance) {
      try {
        ppcpInstance.destroy();
      } catch (e) {
        /* ignore */
      }
    }
    clearButtonContainers();

    const clientId = await getClientId();

    ppcpInstance = new window.SpreedlyPPCP({
      currencyCode: CURRENCY,
      amount: getAmount(), // cart total -> Pay Later eligibility (amount-based thresholds)
      countryCode: 'US', // Pay Later & Venmo are US-only
      paymentElements: {
        paypal: 'paypal-button',
        payLater: 'paylater-button',
        payPalCredit: 'paypalcredit-button',
        venmo: 'venmo-button',
      },
      clientId,
      createOrder,
      onPaymentResult: handlePaymentResult,
      buttonStyle: getButtonStyle(),
      // 'auto' pops up; a full-page redirect mode instead returns the buyer through the
      // gateway's own return_url, which is what Spreedly's offsite flow needs to finalize.
      presentationMode: getPresentationMode(),
    });

    const result = await ppcpInstance.mount();
    if (result.error) throw new Error(result.error);

    // Buttons now exist in their containers — start recording which wallet gets clicked.
    trackClickedWallet();

    el('payment-buttons-loading').classList.add('hidden');
    el('payment-buttons-container').classList.remove('hidden');

    // Show which buttons actually rendered vs were not eligible for this order.
    const rendered = result.rendered || {};
    const labels = {
      paypal: 'PayPal',
      payLater: 'Pay Later',
      payPalCredit: 'PayPal Credit',
      venmo: 'Venmo',
    };
    el('eligibility-result').innerHTML = Object.keys(labels)
      .map(
        k =>
          `<span class="elig-result ${rendered[k] ? 'ok' : 'no'}">${labels[k]}: ${
            rendered[k] ? '✓ rendered' : '✗ not eligible'
          }</span>`
      )
      .join('');

    const renderedNames = Object.keys(labels).filter(k => rendered[k]).map(k => labels[k]);
    if (renderedNames.length) {
      updateDebug('status', `Rendered: ${renderedNames.join(', ')}`);
      setStatus(
        `Ready: ${renderedNames.join(', ')}. Click a button to pay ${SpreedlyUtils.formatCurrency(getCartTotal())}.`,
        'success'
      );
    } else {
      updateDebug('status', 'No eligible buttons');
      setStatus(
        'No eligible buttons for this order (check account/region; Venmo & Pay Later are US/USD).',
        'info'
      );
    }
  } catch (error) {
    console.error('PPCP mount error:', error);
    showError(error.response?.data ? JSON.stringify(error.response.data) : error.message);
  }
}

// ── SpreedlyPPCP callbacks — wired to the /ppcp/* routes (which call PayPal directly) ──

function getAmount() {
  return getCartTotal().toFixed(2); // Orders V2 expects a decimal string, e.g. "229.98"
}

// Read the button-appearance selectors -> SpreedlyPPCP buttonStyle ({ label?, shape? }).
// (v6 exposes no button color, so there is no color control here.)
function getButtonStyle() {
  const label = el('btn-label') && el('btn-label').value;
  const shape = el('btn-shape') && el('btn-shape').value;
  const style = {};
  if (label) style.label = label;
  if (shape) style.shape = shape;
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

// v6 session.start presentation mode. 'auto' and 'popup' open a separate window; 'modal' is the
// in-page overlay; 'redirect' navigates the whole page.
function getPresentationMode() {
  const modeEl = el('presentation-mode');
  return (modeEl && modeEl.value) || 'redirect';
}

// Which wallet the buyer clicked, as a Spreedly payment_method_type.
// SpreedlyPPCP's createOrder() callback is NOT told which funding source triggered it, so we
// record it ourselves: a capture-phase listener on each button's container fires before the
// SDK's own click handler (which is bound to the button element inside it) calls createOrder().
// Pay Later and PayPal Credit are PayPal *funding sources*, not separate Spreedly payment
// methods, so they transact as 'paypal'.
const CONTAINER_PAYMENT_METHOD_TYPE = {
  'paypal-button': 'paypal',
  'paylater-button': 'paypal',
  'paypalcredit-button': 'paypal',
  'venmo-button': 'venmo',
};
let clickedPaymentMethodType = 'paypal';

function trackClickedWallet() {
  Object.entries(CONTAINER_PAYMENT_METHOD_TYPE).forEach(([containerId, type]) => {
    const container = el(containerId);
    if (!container || container.dataset.walletTracked) return;
    container.dataset.walletTracked = 'true';
    container.addEventListener(
      'click',
      () => {
        clickedPaymentMethodType = type;
      },
      true // capture phase — must run before the SDK's handler on the button element
    );
  });
}


async function createOrder() {
  // Scenario 2 (vault WITH purchase) has no Spreedly path yet, so ticking "save my PayPal"
  // still routes to the PayPal-direct vault-purchase order. Everything else goes to Spreedly.
  const saveEl = el('save-during-purchase');
  savedDuringPurchase = !!(saveEl && saveEl.checked);
  setStatus(
    savedDuringPurchase
      ? 'Creating PayPal order (+ save, PayPal-direct)...'
      : 'Creating order via Spreedly...',
    'info'
  );
  const path = savedDuringPurchase ? '/ppcp/vault/purchase-order' : '/ppcp/spreedly/orders';
  const response = await axios.post(`${apiBase()}${path}`, {
    amount: getAmount(),
    currency_code: CURRENCY,
    // Spreedly transacts venmo as its own payment method type.
    payment_method_type: clickedPaymentMethodType,
  });
  updateDebug('orderId', response.data.id);
  updateDebug('backend', savedDuringPurchase ? 'PayPal direct (vault)' : 'Spreedly gateway');
  return { orderId: response.data.id };
}

async function captureOrder(orderId) {
  // NOTE: in the default 'redirect' mode this is never reached — the page is destroyed by the
  // navigation and /ppcp/return/ does the capture instead. It only runs if you switch to a
  // popup-family presentation mode, where Spreedly is never told the buyer approved, so it will
  // report that the authorization is still pending. That is the known gateway gap, not a bug here.
  const path = savedDuringPurchase
    ? `/ppcp/vault/purchase-order/${orderId}/capture`
    : `/ppcp/spreedly/orders/${orderId}/capture`;
  const response = await axios.post(`${apiBase()}${path}`);
  return response.data;
}

async function handlePaymentResult(result) {
  updateDebug('state', result.state);
  const method = result.payment_method?.payment_method_type || 'paypal';

  if (result.state === 'Successful') {
    try {
      setStatus('Capturing order...', 'info');
      const capture = await captureOrder(result.orderId);
      const status = capture.status || 'COMPLETED';
      updateDebug('status', `Captured: ${status}`);
      const savedNote = savedDuringPurchase ? ' PayPal also saved for future purchases.' : '';
      showResult(
        true,
        'Payment Successful',
        `Order ${result.orderId} captured via ${method} (status: ${status}).${savedNote}`
      );
      setStatus('Payment complete.', 'success');
      // Scenario 2: a vault-with-purchase capture stores the token — refresh the saved list.
      if (savedDuringPurchase) await refreshVaultedTokens();
    } catch (error) {
      const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      showResult(false, 'Capture Failed', msg);
      setStatus('Failed to capture order', 'error');
    }
  } else if (result.state === 'Cancelled') {
    setStatus('Payment cancelled.', 'info');
    showResult(false, 'Payment Cancelled', `${method} payment was cancelled.`);
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

function setVaultStatus(message, type = 'info') {
  const statusEl = el('vault-status');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
}

function vaultError(error) {
  return error.response?.data ? JSON.stringify(error.response.data) : error.message;
}

// Mount a vault-mode SpreedlyPPCP that renders a "save PayPal" button (no purchase).
async function mountVault() {
  const trigger = el('save-trigger');
  if (trigger) trigger.classList.add('hidden');
  el('save-loading').classList.remove('hidden');
  setVaultStatus('Loading PayPal SDK...', 'info');

  try {
    await loadDependencies();
    if (vaultInstance) {
      try {
        vaultInstance.destroy();
      } catch (e) {
        /* ignore */
      }
    }
    el('save-paypal-button').innerHTML = '';

    const clientId = await getClientId();

    vaultInstance = new window.SpreedlyPPCP({
      flow: 'vault',
      currencyCode: CURRENCY,
      countryCode: 'US',
      paymentElements: { paypal: 'save-paypal-button' },
      clientId,
      createVaultSetupToken: async () => {
        const res = await axios.post(`${apiBase()}/ppcp/vault/setup-token`);
        return { setupToken: res.data.setupToken };
      },
      onPaymentResult: handleVaultResult,
    });

    const result = await vaultInstance.mount();
    el('save-loading').classList.add('hidden');
    if (result.error) throw new Error(result.error);

    if (result.rendered && result.rendered.paypal) {
      setVaultStatus('Click the PayPal button to save it for later.', 'info');
    } else {
      setVaultStatus('PayPal save is not eligible for this session.', 'info');
    }
  } catch (error) {
    el('save-loading').classList.add('hidden');
    console.error('Vault mount error:', error);
    setVaultStatus(vaultError(error), 'error');
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
      setVaultStatus(vaultError(error), 'error');
    }
  } else if (result.state === 'Cancelled') {
    setVaultStatus('Save cancelled.', 'info');
  } else {
    setVaultStatus(result.message || 'Save failed.', 'error');
  }
}

async function refreshVaultedTokens() {
  try {
    const res = await axios.get(`${apiBase()}/ppcp/vault/tokens`);
    const tokens = res.data.tokens || [];
    const list = el('saved-methods-list');
    if (!tokens.length) {
      list.innerHTML =
        '<p style="color: var(--color-gray-500); font-size: 0.8125rem;">None saved yet.</p>';
      return;
    }
    list.innerHTML = tokens.map(renderSavedMethod).join('');
  } catch (error) {
    /* ignore — leave the list as-is */
  }
}

// PayPal returns whatever it returns, so render the keys that actually arrived rather than a
// fixed set. Dotted paths (name.given_name) become readable labels.
function prettyDetailLabel(key) {
  return key
    .split('.')
    .join(' ')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
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

function renderSavedMethod(t) {
  const saved = t.createdAt ? new Date(t.createdAt).toLocaleString() : '';
  return `
    <div class="saved-method" data-ref="${t.ref}">
      <div class="saved-method-head">
        <span class="saved-method-label">${SpreedlyUtils.escapeHtml(t.label)}</span>
        <span class="saved-method-meta">saved ${SpreedlyUtils.escapeHtml(saved)}</span>
      </div>
      ${renderBuyerDetails(t.details)}
      <div class="saved-method-actions">
        <button class="btn btn-primary" onclick="payWithSaved(${t.ref})"
          title="Return buyer present — one-click (CUSTOMER-initiated)">Pay $10 (1-click)</button>
        <button class="btn btn-secondary" onclick="chargeSaved(${t.ref})"
          title="Buyer not present — recurring MIT (MERCHANT-initiated)">Charge $10 (recurring)</button>
      </div>
      <div class="saved-method-result" id="saved-result-${t.ref}"></div>
    </div>`;
}

// Result shown next to the buttons that produced it — the shared vault status sits above the
// list, where a click at the bottom of the page is easy to miss.
function setSavedResult(ref, kind, message) {
  const node = el(`saved-result-${ref}`);
  if (!node) return;
  node.className = `saved-method-result show ${kind}`;
  node.textContent = message;
}

// Charge a saved token as a merchant-initiated recurring payment (buyer not present).
window.chargeSaved = async function (ref) {
  setSavedResult(ref, 'pending', 'Charging (recurring, buyer not present)…');
  try {
    const res = await axios.post(`${apiBase()}/ppcp/vault/charge`, {
      ref,
      amount: '10.00',
      currency_code: CURRENCY,
    });
    const d = res.data;
    const amount = d.amount ? `$${d.amount} ${d.currency_code || ''}`.trim() : '$10.00';
    // Refresh first — re-rendering the list replaces the result node, so write it after.
    await refreshVaultedTokens();
    if (d.succeeded) {
      setSavedResult(ref, 'ok',
        `Recurring charge succeeded — ${amount} captured. Order ${d.id}` +
          (d.captureId ? `, capture ${d.captureId}.` : '.'));
      setVaultStatus('Recurring charge succeeded.', 'success');
    } else {
      setSavedResult(ref, 'err',
        `Recurring charge did not complete — order status ${d.status || 'unknown'}` +
          (d.captureError ? ` (${d.captureError})` : '') + '.');
      setVaultStatus('Recurring charge did not complete.', 'error');
    }
  } catch (error) {
    setSavedResult(ref, 'err', vaultError(error));
    setVaultStatus(vaultError(error), 'error');
  }
};

// Scenario 3 — return buyer present: pay with a saved token in one click (buyer present,
// CUSTOMER-initiated). No PayPal popup: the method was already authorized when it was vaulted.
window.payWithSaved = async function (ref) {
  setSavedResult(ref, 'pending', 'Paying (one-click, buyer present)…');
  try {
    const res = await axios.post(`${apiBase()}/ppcp/vault/charge`, {
      ref,
      amount: '10.00',
      currency_code: CURRENCY,
      initiator: 'CUSTOMER',
    });
    const d = res.data;
    const amount = d.amount ? `$${d.amount} ${d.currency_code || ''}`.trim() : '$10.00';
    // Refresh first — re-rendering the list replaces the result node, so write it after.
    await refreshVaultedTokens();
    if (d.succeeded) {
      setSavedResult(ref, 'ok',
        `One-click payment succeeded — ${amount} captured. Order ${d.id}` +
          (d.captureId ? `, capture ${d.captureId}.` : '.'));
      setVaultStatus('One-click payment succeeded.', 'success');
    } else {
      setSavedResult(ref, 'err',
        `One-click payment did not complete — order status ${d.status || 'unknown'}` +
          (d.captureError ? ` (${d.captureError})` : '') + '.');
      setVaultStatus('One-click payment did not complete.', 'error');
    }
  } catch (error) {
    setSavedResult(ref, 'err', vaultError(error));
    setVaultStatus(vaultError(error), 'error');
  }
};

// ── UI helpers ────────────────────────────────────────────────────────────────

function updateDebug(field, value) {
  const target = el(`debug-${field === 'orderId' ? 'order-id' : field}`);
  if (target) target.textContent = value || '—';
}

function setStatus(message, type = 'info') {
  const statusEl = el('status-message');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
}

function showResult(isSuccess, title, message) {
  const card = el('result-card');
  card.classList.remove('hidden', 'success', 'error');
  card.classList.add(isSuccess ? 'success' : 'error');
  el('result-title').textContent = title;
  el('result-message').textContent = message;
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
  // Re-mount the buttons when any selector that feeds the SDK config changes (destroy() now
  // clears old buttons). presentationMode and buttonStyle are read by the constructor, so a
  // change only takes effect on a fresh mount; backend-mode is read per call but re-mounts too
  // so the rendered buttons always match what the controls say.
  ['btn-label', 'btn-shape', 'presentation-mode'].forEach(id => {
    const sel = el(id);
    if (sel) {
      sel.addEventListener('change', () => {
        if (sdksLoaded && ppcpInstance) loadAndMountPPCP();
      });
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
