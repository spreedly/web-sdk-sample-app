/**
 * Apple Pay start page: pick some products, then Proceed opens the Apple Pay page
 * (../apple-pay-local-sdk/, where the SDK draws the button and runs the sheet) with the cart total.
 *
 * The ?sdk= bundle chosen on the landing page is passed on unchanged.
 */

// Synthetic products, as in the Purchase flow.
const PRODUCTS = [
  { id: 'prod_1', name: 'Wireless Headphones', description: 'Premium noise-canceling headphones', price: 149.99, emoji: '🎧' },
  { id: 'prod_2', name: 'Smart Watch', description: 'Fitness tracker with heart rate monitor', price: 299.99, emoji: '⌚' },
  { id: 'prod_3', name: 'Laptop Stand', description: 'Ergonomic aluminum stand', price: 79.99, emoji: '💻' },
];

const APPLE_PAY_PAGE = '../apple-pay-local-sdk/index.html';

const sdkType = SpreedlyUtils.getSDKType();
const cart = {}; // { productId: quantity }

const $ = id => document.getElementById(id);

/** Total in cents, so adding prices can't drift. */
const cartTotalCents = () =>
  Object.entries(cart).reduce((total, [id, qty]) => {
    const product = PRODUCTS.find(p => p.id === id);
    return total + Math.round(product.price * 100) * qty;
  }, 0);

/** Apple's amount format: digits with exactly two decimals, e.g. '529.97'. */
const cartTotalAmount = () => (cartTotalCents() / 100).toFixed(2);

function renderProducts() {
  const grid = $('products-grid');
  grid.replaceChildren(
    ...PRODUCTS.map(product => {
      const qty = cart[product.id] || 0;
      const card = document.createElement('div');
      card.className = `product-card${qty ? ' selected' : ''}`;
      card.innerHTML = `
        <div class="product-image"></div>
        <div class="product-name"></div>
        <div class="product-description"></div>
        <div class="product-price"></div>
        <div class="product-quantity">
          <button type="button" class="quantity-btn" data-delta="-1" aria-label="Remove one">−</button>
          <span class="quantity-value"></span>
          <button type="button" class="quantity-btn" data-delta="1" aria-label="Add one">+</button>
        </div>`;
      card.querySelector('.product-image').textContent = product.emoji;
      card.querySelector('.product-name').textContent = product.name;
      card.querySelector('.product-description').textContent = product.description;
      card.querySelector('.product-price').textContent = SpreedlyUtils.formatCurrency(product.price);
      card.querySelector('.quantity-value').textContent = String(qty);
      const minus = card.querySelector('[data-delta="-1"]');
      minus.disabled = qty === 0;
      card.querySelectorAll('.quantity-btn').forEach(button =>
        button.addEventListener('click', () => updateQuantity(product.id, Number(button.dataset.delta)))
      );
      return card;
    })
  );
}

function updateQuantity(productId, delta) {
  const qty = Math.max(0, (cart[productId] || 0) + delta);
  if (qty === 0) {
    delete cart[productId];
  } else {
    cart[productId] = qty;
  }
  renderProducts();
  updateSummary();
}

function updateSummary() {
  const hasItems = Object.keys(cart).length > 0;
  $('cart-summary').classList.toggle('hidden', !hasItems);
  if (hasItems) {
    $('cart-items').replaceChildren(
      ...Object.entries(cart).map(([id, qty]) => {
        const product = PRODUCTS.find(p => p.id === id);
        const row = document.createElement('div');
        row.className = 'order-item';
        row.innerHTML =
          '<div class="order-item-name"><span></span><span></span><span class="order-item-qty"></span></div><span></span>';
        const [emoji, name, qtyLabel] = row.querySelectorAll('.order-item-name span');
        emoji.textContent = product.emoji;
        name.textContent = product.name;
        qtyLabel.textContent = `× ${qty}`;
        row.lastElementChild.textContent = SpreedlyUtils.formatCurrency((Math.round(product.price * 100) * qty) / 100);
        return row;
      })
    );
    $('cart-total').textContent = SpreedlyUtils.formatCurrency(cartTotalCents() / 100);
  }
  updateProceed();
}

function updateProceed() {
  const hasItems = Object.keys(cart).length > 0;
  $('proceed').disabled = !hasItems;
  $('proceed-hint').textContent = hasItems
    ? `Total ${SpreedlyUtils.formatCurrency(cartTotalCents() / 100)}.`
    : 'Add at least one product.';
}

function proceed() {
  if (!Object.keys(cart).length) {
    return;
  }
  const params = new URLSearchParams({ sdk: sdkType, amount: cartTotalAmount() });
  window.location.href = `${APPLE_PAY_PAGE}?${params}`;
}

document.addEventListener('DOMContentLoaded', () => {
  $('sdk-badge').textContent = `Apple Pay · ${sdkType === 'express-checkout' ? 'Express Checkout' : 'Hosted Fields'}`;
  $('proceed').addEventListener('click', proceed);
  renderProducts();
  updateSummary();
});
