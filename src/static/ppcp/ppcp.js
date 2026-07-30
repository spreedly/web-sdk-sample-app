/**
 * PPCP (PayPal Complete Payments) Demo — INTERIM direct-to-PayPal spike.
 *
 * Two-step flow:
 *   1. Product selection — pick products; the total decides the amount. Shows the
 *      button-rendering eligibility criteria (PayPal / Pay Later / Venmo).
 *   2. Payment — on "Proceed to Payment", the PayPal JS SDK v6 + local Spreedly SDK
 *      are loaded and SpreedlyPPCP mounts the eligible buttons for the cart total.
 *
 * Drives the new SpreedlyPPCP class against the sample-app /ppcp/* routes, which call
 * PayPal Orders V2 DIRECTLY in sandbox. Throwaway dev harness, NOT a production path.
 * See ppcp/integration-plan/07-interim-direct-order-spike.md.
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

// Pay Later US *plan* thresholds — informational only. Pay Later ELIGIBILITY is PayPal's call
// (findEligibleMethods, per account/country/currency); it can return Pay Later eligible even BELOW
// these amounts, so we never gate the button on them. These just drive the hint showing which
// installment plan PayPal *typically* offers at a given amount (Pay in 4 ≥ $30, Pay Monthly ≥ $199).
const PAY_IN_4_MIN = 30;
const PAY_MONTHLY_MIN = 199;

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
  updateEligibilityHints();
}

// Live hint: which Pay Later PLAN PayPal typically offers at the current amount. NOTE: this is
// illustrative, NOT a gate — actual Pay Later eligibility is PayPal's decision (findEligibleMethods),
// and it can be eligible below these thresholds. The real per-button result shows after mount.
function updateEligibilityHints() {
  const total = getCartTotal();
  const pl = el('elig-paylater');
  if (!pl) return;
  if (total >= PAY_MONTHLY_MIN) {
    pl.textContent = 'Pay in 4 + Monthly';
    pl.className = 'elig-badge ok';
  } else if (total >= PAY_IN_4_MIN) {
    pl.textContent = 'Pay in 4';
    pl.className = 'elig-badge ok';
  } else if (total > 0) {
    pl.textContent = 'PayPal decides';
    pl.className = 'elig-badge info';
  } else {
    pl.textContent = '—';
    pl.className = 'elig-badge';
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
      getClientToken,
      createOrder,
      onPaymentResult: handlePaymentResult,
      buttonStyle: getButtonStyle(),
    });

    const result = await ppcpInstance.mount();
    if (result.error) throw new Error(result.error);

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

async function getClientToken() {
  const response = await axios.get(`${apiBase()}/ppcp/client-token`);
  return response.data.clientToken;
}

async function createOrder() {
  // Scenario 2 (vault WITH purchase): if "save my PayPal" is ticked, use the vault-purchase
  // order route so the PayPal is also saved on capture. Same checkout session either way.
  const saveEl = el('save-during-purchase');
  savedDuringPurchase = !!(saveEl && saveEl.checked);
  setStatus(savedDuringPurchase ? 'Creating PayPal order (+ save)...' : 'Creating PayPal order...', 'info');
  const path = savedDuringPurchase ? '/ppcp/vault/purchase-order' : '/ppcp/orders';
  const response = await axios.post(`${apiBase()}${path}`, {
    amount: getAmount(),
    currency_code: CURRENCY,
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

    vaultInstance = new window.SpreedlyPPCP({
      flow: 'vault',
      currencyCode: CURRENCY,
      countryCode: 'US',
      paymentElements: { paypal: 'save-paypal-button' },
      getClientToken,
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
    list.innerHTML = tokens
      .map(
        t => `
      <div class="order-item">
        <div class="order-item-name">
          <span>${SpreedlyUtils.escapeHtml(t.label)}</span>
          <span class="order-item-qty">${SpreedlyUtils.escapeHtml(t.masked)}</span>
        </div>
        <div style="display: flex; gap: 0.4rem; flex-shrink: 0;">
          <button class="btn btn-primary" style="padding: 0.35rem 0.7rem; font-size: 0.8125rem;"
            onclick="payWithSaved(${t.ref})" title="Return buyer present — one-click (CUSTOMER-initiated)">Pay $10 (1-click)</button>
          <button class="btn btn-secondary" style="padding: 0.35rem 0.7rem; font-size: 0.8125rem;"
            onclick="chargeSaved(${t.ref})" title="Buyer not present — recurring MIT (MERCHANT-initiated)">Charge $10 (recurring)</button>
        </div>
      </div>`
      )
      .join('');
  } catch (error) {
    /* ignore — leave the list as-is */
  }
}

// Charge a saved token as a merchant-initiated recurring payment (buyer not present).
window.chargeSaved = async function (ref) {
  try {
    setVaultStatus('Charging saved PayPal (recurring, buyer not present)...', 'info');
    const res = await axios.post(`${apiBase()}/ppcp/vault/charge`, {
      ref,
      amount: '10.00',
      currency_code: CURRENCY,
    });
    const status = res.data.status || 'processed';
    setVaultStatus(
      `Recurring charge ${status}${res.data.id ? ` (order ${res.data.id})` : ''}.`,
      status === 'COMPLETED' ? 'success' : 'info'
    );
  } catch (error) {
    setVaultStatus(vaultError(error), 'error');
  }
};

// Scenario 3 — return buyer present: pay with a saved token in one click (buyer present,
// CUSTOMER-initiated). No PayPal popup: the method was already authorized when it was vaulted.
window.payWithSaved = async function (ref) {
  try {
    setVaultStatus('Paying with saved PayPal (one-click, buyer present)...', 'info');
    const res = await axios.post(`${apiBase()}/ppcp/vault/charge`, {
      ref,
      amount: '10.00',
      currency_code: CURRENCY,
      initiator: 'CUSTOMER',
    });
    const status = res.data.status || 'processed';
    setVaultStatus(
      `One-click payment ${status}${res.data.id ? ` (order ${res.data.id})` : ''}.`,
      status === 'COMPLETED' ? 'success' : 'info'
    );
  } catch (error) {
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
  // Re-mount the buttons when the appearance selectors change (destroy() now clears old buttons).
  ['btn-label', 'btn-shape'].forEach(id => {
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
