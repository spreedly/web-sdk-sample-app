/**
 * Purchase Flow - Spreedly Web SDK Demo
 * 
 * This file handles the step-wise purchase flow:
 * 1. Product Selection
 * 2. Payment (Saved Card or New Card)
 * 3. Confirmation
 */
const PRODUCTS = [
  {
    id: 'prod_1',
    name: 'Wireless Headphones',
    description: 'Premium noise-canceling headphones',
    price: 149.99,
    emoji: '🎧'
  },
  {
    id: 'prod_2',
    name: 'Smart Watch',
    description: 'Fitness tracker with heart rate monitor',
    price: 299.99,
    emoji: '⌚'
  },
  {
    id: 'prod_3',
    name: 'Laptop Stand',
    description: 'Ergonomic aluminum stand',
    price: 79.99,
    emoji: '💻'
  }
];

// State
let sdkType = null;
let sdk = null;
let isReady = false;
let storedAuthParams = null;
let currentStep = 1;
let cart = {}; // { productId: quantity }
let savedCards = [];
let selectedSavedCard = null;
let paymentMethodToken = null;

// Pagination state for saved cards
const CARDS_PER_PAGE = 5;
let currentCardsPage = 1;

// DOM Elements
const elements = {
  sdkBadge: () => document.getElementById('sdk-badge'),
  stepper: () => document.getElementById('stepper'),
  productsGrid: () => document.getElementById('products-grid'),
  cartSummary: () => document.getElementById('cart-summary'),
  cartItems: () => document.getElementById('cart-items'),
  cartTotal: () => document.getElementById('cart-total'),
  proceedToPayment: () => document.getElementById('proceed-to-payment'),
  summaryItems: () => document.getElementById('summary-items'),
  summaryTotal: () => document.getElementById('summary-total'),
  savedCardsList: () => document.getElementById('saved-cards-list'),
  hostedFieldsForm: () => document.getElementById('hosted-fields-form'),
  expressCheckoutSection: () => document.getElementById('express-checkout-section'),
  payBtn: () => document.getElementById('pay-btn'),
  statusMessage: () => document.getElementById('status-message'),
  resultSection: () => document.getElementById('result-section'),
};

// Initialization
document.addEventListener('DOMContentLoaded', init);

async function init() {
  sdkType = SpreedlyUtils.getSDKType();
  elements.sdkBadge().textContent = SpreedlyUtils.getSDKDisplayName();
  
  renderProducts();
  
  setupEventListeners();
  
  try {
    await loadAndInitializeSDK();
  } catch (error) {
    console.error('Failed to initialize SDK:', error);
    showStatus('Failed to initialize SDK. Please refresh the page.', 'error');
  }
}

function setupEventListeners() {
  // Proceed to payment button
  elements.proceedToPayment().addEventListener('click', () => goToStep(2));
  
  document.querySelectorAll('.payment-tab').forEach(tab => {
    tab.addEventListener('click', () => switchPaymentTab(tab.dataset.tab));
  });
}

async function loadAndInitializeSDK() {
  await new Promise((resolve, reject) => {
    SpreedlyUtils.loadSDKScript((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  
  const authParams = await SpreedlyUtils.fetchAuthParams();
  storedAuthParams = authParams;
  
  if (sdkType === 'express-checkout') {
    initializeExpressCheckout(authParams);
  } else {
    initializeHostedFields(authParams);
  }
  
  await loadSavedCards();
}

function initializeHostedFields(authParams) {  
  sdk = new SpreedlyHostedFields({
    environment_key: authParams.environmentKey,
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.certificateToken,
    signature: authParams.signature,
  });
  
  // Set up event handlers FIRST
  sdk.on('ready', () => {
    isReady = true;
    elements.hostedFieldsForm().classList.remove('hidden');
    console.log('Hosted Fields ready - form is now visible');
  });
  
  sdk.on('tokenGenerated', (response) => {
    console.log('Token generated:', response);
    const token = response?.tokenResponse?.payment_method?.token;
    if (token) {
      paymentMethodToken = token;
      console.log('Payment method token received:', token);
      processPurchase();
    } else {
      console.error('Token not found in response:', response);
      showStatus('Failed to generate payment token', 'error');
      setPayButtonLoading(false);
    }
  });
  
  sdk.on('error', (error) => {
    console.error('SDK error:', error);
    showStatus(error.message || 'An error occurred', 'error');
    setPayButtonLoading(false);
  });
  
  sdk.on('validation', (validationResponse) => {
    console.log('Validation response:', validationResponse);
  });
  
  // THEN set up hosted field containers
  sdk.inAppElements({
    number: { containerId: 'card-number-field' },
    cvv: { containerId: 'cvv-field' },
  });
}

function initializeExpressCheckout(authParams) {
  sdk = new SpreedlyExpressCheckout({
    environment_key: authParams.environmentKey,
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.certificateToken,
    signature: authParams.signature,
  });
  
  elements.expressCheckoutSection().classList.remove('hidden');
  console.log('Express Checkout SDK initialized');
}

// Open Express Checkout form (in 550x550 dialog)
window.openExpressCheckoutForm = function() {
  if (!sdk || !storedAuthParams) {
    showStatus('SDK not initialized', 'error');
    return;
  }
  
  SpreedlyUtils.setButtonLoading('open-express-checkout-btn', true, 'Loading...');
  
  const dialogOverlay = document.getElementById('express-checkout-dialog');
  dialogOverlay?.classList.remove('hidden');
  
  sdk.on('ready', () => {
    isReady = true;
    SpreedlyUtils.setButtonLoading('open-express-checkout-btn', false);
    document.getElementById('express-checkout-open-section').classList.add('hidden');
    console.log('Express Checkout ready');
  });
  
  sdk.on('tokenGenerated', (response) => {
    console.log('Token generated:', response);
    const token = response?.tokenResponse?.payment_method?.token;
    if (token) {
      paymentMethodToken = token;
      dialogOverlay?.classList.add('hidden');
      processPurchase();
    } else {
      showStatus('Failed to generate payment token', 'error');
    }
  });
  
  sdk.on('error', (error) => {
    console.error('SDK error:', error);
    SpreedlyUtils.setButtonLoading('open-express-checkout-btn', false);
    showStatus(error.message || 'An error occurred', 'error');
  });
  
  sdk.on('close', () => {
    console.log('Express checkout closed');
    dialogOverlay?.classList.add('hidden');
    document.getElementById('express-checkout-open-section').classList.remove('hidden');
  });
  
  const checkoutConfig = {
    parentContainerId: 'express-checkout-dialog-container', // Use the dialog container
    uiConfig: {
      textConfig: {
        title: 'Payment Details',
        submitBtnText: `Pay ${SpreedlyUtils.formatCurrency(getCartTotal())}`,
        processingText: 'Processing...',
      },
      styles: {
        button: {
          backgroundColor: '#1f2937',
          borderRadius: '8px',
          hover: {
            backgroundColor: '#374151',
          },
        },
      },
    },
  };
  
  sdk.expressCheckout(checkoutConfig);
};

// Saved Cards
async function loadSavedCards() {
  try {
    savedCards = await SpreedlyUtils.fetchPaymentMethods();
    renderSavedCards();
  } catch (error) {
    console.error('Failed to load saved cards:', error);
    elements.savedCardsList().innerHTML = `
      <div class="no-saved-cards">
        <p>Failed to load saved cards</p>
      </div>
    `;
  }
}

function renderSavedCards() {
  const container = elements.savedCardsList();
  
  if (!savedCards || savedCards.length === 0) {
    container.innerHTML = `
      <div class="no-saved-cards">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 3rem; height: 3rem; margin-bottom: 0.5rem; opacity: 0.5;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
        </svg>
        <p>No saved cards found</p>
        <p style="font-size: 0.875rem; margin-top: 0.5rem;">Add a new card to continue</p>
      </div>
    `;
    return;
  }
  
  // Calculate pagination
  const totalCards = savedCards.length;
  const totalPages = Math.ceil(totalCards / CARDS_PER_PAGE);
  const startIndex = (currentCardsPage - 1) * CARDS_PER_PAGE;
  const endIndex = Math.min(startIndex + CARDS_PER_PAGE, totalCards);
  const paginatedCards = savedCards.slice(startIndex, endIndex);
  
  // Render cards
  let html = paginatedCards.map(card => {
    const fullName = [card.first_name, card.last_name].filter(Boolean).join(' ') || 'Cardholder';
    return `
    <div class="saved-card" data-token="${card.token}" onclick="selectSavedCard('${card.token}')">
      <span class="saved-card-icon">${SpreedlyUtils.getCardIcon(card.card_type)}</span>
      <div class="saved-card-details">
        <div class="saved-card-name">${fullName}</div>
        <div class="saved-card-number">${SpreedlyUtils.capitalizeFirst(card.card_type)} •••• ${card.last_four_digits}</div>
        <div class="saved-card-expiry">Expires ${card.month}/${card.year}</div>
      </div>
      <input type="radio" name="saved-card" class="saved-card-radio" ${selectedSavedCard === card.token ? 'checked' : ''}>
    </div>
  `;
  }).join('');
  
  // Add pagination controls if needed
  if (totalPages > 1) {
    html += `
      <div class="pagination">
        <button class="pagination-btn" onclick="changeCardsPage(-1)" ${currentCardsPage === 1 ? 'disabled' : ''}>
          ← Previous
        </button>
        <span class="pagination-info">
          Page ${currentCardsPage} of ${totalPages}
        </span>
        <button class="pagination-btn" onclick="changeCardsPage(1)" ${currentCardsPage === totalPages ? 'disabled' : ''}>
          Next →
        </button>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

window.changeCardsPage = function(delta) {
  const totalPages = Math.ceil(savedCards.length / CARDS_PER_PAGE);
  currentCardsPage = Math.max(1, Math.min(totalPages, currentCardsPage + delta));
  renderSavedCards();
};

window.selectSavedCard = function(token) {
  selectedSavedCard = token;
  
  // Update UI
  document.querySelectorAll('.saved-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.token === token);
    card.querySelector('.saved-card-radio').checked = card.dataset.token === token;
  });
  
  updatePayButton();
};

// Products & Cart
function renderProducts() {
  const container = elements.productsGrid();
  
  container.innerHTML = PRODUCTS.map(product => `
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
  `).join('');
  
  updateCartSummary();
}

window.updateQuantity = function(productId, delta) {
  const currentQty = cart[productId] || 0;
  const newQty = Math.max(0, currentQty + delta);
  
  if (newQty === 0) {
    delete cart[productId];
  } else {
    cart[productId] = newQty;
  }
  
  renderProducts();
  updateCartSummary();
};

function updateCartSummary() {
  const hasItems = Object.keys(cart).length > 0;
  const cartSummary = elements.cartSummary();
  const proceedBtn = elements.proceedToPayment();
  
  if (!hasItems) {
    cartSummary.style.display = 'none';
    proceedBtn.disabled = true;
    return;
  }
  
  cartSummary.style.display = 'block';
  proceedBtn.disabled = false;
  
  // Render cart items
  const cartItemsHtml = Object.entries(cart).map(([productId, qty]) => {
    const product = PRODUCTS.find(p => p.id === productId);
    return `
      <div class="order-item">
        <div class="order-item-name">
          <span>${product.emoji}</span>
          <span>${product.name}</span>
          <span class="order-item-qty">× ${qty}</span>
        </div>
        <span>${SpreedlyUtils.formatCurrency(product.price * qty)}</span>
      </div>
    `;
  }).join('');
  
  elements.cartItems().innerHTML = cartItemsHtml;
  elements.cartTotal().textContent = SpreedlyUtils.formatCurrency(getCartTotal());
}

function getCartTotal() {
  return Object.entries(cart).reduce((total, [productId, qty]) => {
    const product = PRODUCTS.find(p => p.id === productId);
    return total + (product.price * qty);
  }, 0);
}

// Step Navigation
window.goToStep = function(step) {
  currentStep = step;
  
  // Update stepper
  document.querySelectorAll('.stepper-step').forEach(s => {
    const stepNum = parseInt(s.dataset.step);
    s.classList.remove('active', 'completed');
    if (stepNum === step) {
      s.classList.add('active');
    } else if (stepNum < step) {
      s.classList.add('completed');
    }
  });
  
  // Update content
  document.querySelectorAll('.step-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`step-${step}`).classList.add('active');
  
  // Step-specific logic
  if (step === 2) {
    updateOrderSummary();
    updatePayButton();
  }
};

function updateOrderSummary() {
  const summaryItemsHtml = Object.entries(cart).map(([productId, qty]) => {
    const product = PRODUCTS.find(p => p.id === productId);
    return `
      <div class="order-item">
        <div class="order-item-name">
          <span>${product.emoji}</span>
          <span>${product.name}</span>
          <span class="order-item-qty">× ${qty}</span>
        </div>
        <span>${SpreedlyUtils.formatCurrency(product.price * qty)}</span>
      </div>
    `;
  }).join('');
  
  elements.summaryItems().innerHTML = summaryItemsHtml;
  elements.summaryTotal().textContent = SpreedlyUtils.formatCurrency(getCartTotal());
}

// Payment Tab Switching
function switchPaymentTab(tab) {
  document.querySelectorAll('.payment-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  
  document.querySelectorAll('.payment-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`payment-${tab}`).classList.add('active');
  
  // Clear selection when switching tabs
  if (tab === 'new') {
    selectedSavedCard = null;
    document.querySelectorAll('.saved-card').forEach(card => {
      card.classList.remove('selected');
      card.querySelector('.saved-card-radio').checked = false;
    });
  }
  
  updatePayButton();
}

function updatePayButton() {
  const activeTab = document.querySelector('.payment-tab.active').dataset.tab;
  const payBtn = elements.payBtn();
  
  if (activeTab === 'saved') {
    payBtn.disabled = !selectedSavedCard;
  } else {
    // For new card, enable button (validation will happen on submit)
    payBtn.disabled = false;
  }
  
  payBtn.textContent = `Pay ${SpreedlyUtils.formatCurrency(getCartTotal())}`;
}

// Payment Processing
window.handlePayment = function() {
  const activeTab = document.querySelector('.payment-tab.active').dataset.tab;
  
  hideStatus();
  setPayButtonLoading(true);
  
  if (activeTab === 'saved') {
    // Use saved card - already have the token
    paymentMethodToken = selectedSavedCard;
    processPurchase();
  } else {
    // New card - need to tokenize first
    if (sdkType === 'express-checkout') {
      // Express Checkout handles its own form submission
      showStatus('Please complete the payment form above', 'info');
      setPayButtonLoading(false);
    } else {
      // Hosted Fields - tokenize
      tokenizeNewCard();
    }
  }
};

function tokenizeNewCard() {
  console.log('tokenizeNewCard called, sdk:', sdk, 'isReady:', isReady);
  
  if (!sdk) {
    showStatus('SDK not initialized. Please refresh the page.', 'error');
    setPayButtonLoading(false);
    return;
  }
  
  if (!isReady) {
    showStatus('SDK not ready. Please wait for the form to load.', 'error');
    setPayButtonLoading(false);
    return;
  }
  
  const firstName = document.getElementById('first_name')?.value?.trim() || '';
  const lastName = document.getElementById('last_name')?.value?.trim() || '';
  const month = document.getElementById('month')?.value?.trim() || '';
  const year = document.getElementById('year')?.value?.trim() || '';
  
  console.log('Card details:', { firstName, lastName, month, year });
  
  if (!firstName || !lastName || !month || !year) {
    showStatus('Please fill in all required fields', 'error');
    setPayButtonLoading(false);
    return;
  }
  
  console.log('Calling sdk.submit...');
  
  sdk.submit({
    first_name: firstName,
    last_name: lastName,
    month: month,
    year: year,
  });
}

async function processPurchase() {
  try {
    showStatus('Processing payment...', 'info');
    
    const amount = Math.round(getCartTotal() * 100); // Convert to cents for API
    
    // Create purchase WITHOUT sca_provider_key and browser_info (no 3DS)
    const data = await SpreedlyUtils.createPurchase(paymentMethodToken, amount, 'USD');
    
    if (data.success || data.transaction?.succeeded) {
      showResult('success', data.transaction);
    } else {
      showResult('error', data);
    }
  } catch (error) {
    console.error('Purchase failed:', error);
    showResult('error', { message: error.response?.data?.error || error.message || 'Purchase failed' });
  }
}

// Results
function showResult(type, data) {
  goToStep(3);
  
  const container = elements.resultSection();
  
  if (type === 'success') {
    container.innerHTML = `
      <div class="result-icon success">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <h2 class="result-title" style="color: var(--color-success);">Payment Successful!</h2>
      <p class="result-message">Your order has been processed successfully.</p>
      <div class="result-details">
        <div class="result-detail-row">
          <span class="result-detail-label">Transaction ID</span>
          <span class="result-detail-value">${data?.token || 'N/A'}</span>
        </div>
        <div class="result-detail-row">
          <span class="result-detail-label">Amount</span>
          <span class="result-detail-value">${SpreedlyUtils.formatCurrency(getCartTotal())}</span>
        </div>
        <div class="result-detail-row">
          <span class="result-detail-label">Status</span>
          <span class="result-detail-value" style="color: var(--color-success);">Completed</span>
        </div>
      </div>
      <button class="btn btn-primary" onclick="resetPurchase()">Make Another Purchase</button>
    `;
  } else {
    const errorMessage = data?.message || data?.error || 'An error occurred during payment processing.';
    container.innerHTML = `
      <div class="result-icon error">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h2 class="result-title" style="color: var(--color-error);">Payment Failed</h2>
      <p class="result-message">${errorMessage}</p>
      <div style="display: flex; gap: 1rem; justify-content: center;">
        <button class="btn btn-back" onclick="window.location.reload()">← Try Again</button>
        <button class="btn btn-primary" onclick="resetPurchase()">Start Over</button>
      </div>
    `;
  }
}

window.resetPurchase = function() {
  // Simply refresh the page to ensure SDK is properly reloaded
  window.location.reload();
  
  // Reset form fields
  const firstName = document.getElementById('first_name');
  const lastName = document.getElementById('last_name');
  const month = document.getElementById('month');
  const year = document.getElementById('year');
  
  if (firstName) firstName.value = '';
  if (lastName) lastName.value = '';
  if (month) month.value = '';
  if (year) year.value = '';
};

// UI Helpers
function setPayButtonLoading(loading) {
  SpreedlyUtils.setButtonLoading('pay-btn', loading, 'Processing...');
}

function showStatus(message, type = 'info') {
  const statusEl = elements.statusMessage();
  statusEl.textContent = message;
  statusEl.className = `status-message visible ${type}`;
}

function hideStatus() {
  const statusEl = elements.statusMessage();
  statusEl.className = 'status-message';
}

