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

// Pay Later US thresholds — the cart total is passed to findEligibleMethods (as `amount`),
// which is what decides Pay Later eligibility; these values drive the live hint below.
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
let sdksLoaded = false;

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

// Live button-eligibility hint based on the current cart total.
function updateEligibilityHints() {
  const total = getCartTotal();
  const pl = el('elig-paylater');
  if (!pl) return;
  if (total >= PAY_MONTHLY_MIN) {
    pl.textContent = 'Pay in 4 + Pay Monthly';
    pl.className = 'elig-badge ok';
  } else if (total >= PAY_IN_4_MIN) {
    pl.textContent = 'Pay in 4';
    pl.className = 'elig-badge ok';
  } else if (total > 0) {
    pl.textContent = `add ≥ ${SpreedlyUtils.formatCurrency(PAY_IN_4_MIN)}`;
    pl.className = 'elig-badge warn';
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

async function getClientToken() {
  const response = await axios.get(`${apiBase()}/ppcp/client-token`);
  return response.data.clientToken;
}

async function createOrder() {
  setStatus('Creating PayPal order...', 'info');
  const response = await axios.post(`${apiBase()}/ppcp/orders`, {
    amount: getAmount(),
    currency_code: CURRENCY,
  });
  updateDebug('orderId', response.data.id);
  return { orderId: response.data.id };
}

async function captureOrder(orderId) {
  const response = await axios.post(`${apiBase()}/ppcp/orders/${orderId}/capture`);
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
      showResult(
        true,
        'Payment Successful',
        `Order ${result.orderId} captured via ${method} (status: ${status}).`
      );
      setStatus('Payment complete.', 'success');
    } catch (error) {
      const msg = error.response?.data ? JSON.stringify(error.response.data) : error.message;
      showResult(false, 'Capture Failed', msg);
      setStatus('Failed to capture order', 'error');
    }
  } else if (result.state === 'Cancelled') {
    setStatus('Payment cancelled.', 'info');
    showResult(false, 'Payment Cancelled', `${method} payment was cancelled.`);
  } else {
    showResult(false, 'Payment Failed', result.message || `${method} payment failed.`);
    setStatus('Payment failed', 'error');
  }
}

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
  el('proceed-to-payment').addEventListener('click', () => goToStep(2));
  el('back-to-products').addEventListener('click', () => goToStep(1));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
