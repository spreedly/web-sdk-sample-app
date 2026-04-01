/**
 * Purchase with 3DS Flow - Spreedly Web SDK Demo
 * 
 * This demonstrates a complete 3DS checkout flow:
 * 1. Select products
 * 2. Choose payment method (saved card or new card)
 * 3. Tokenize if new card
 * 4. Collect browser info using serializeBrowserInfo()
 * 5. Create purchase with browser_info and sca_provider_key
 * 6. If transaction is pending, start SpreedlyThreeDSLifecycle
 * 7. Handle challenge/success/error
 */

// Configuration
const CONFIG = {
  browserSize: '04', // 600x400px challenge window
  acceptHeader: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// Products Data
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
  },
];

// State
let sdkType = null;
let sdk = null;
let lifecycle = null;
let isReady = false;
let storedAuthParams = null;
let cart = {};
let savedCards = [];
let selectedSavedCard = null;
let paymentMethodToken = null;
let currentStep = 1;
const CARDS_PER_PAGE = 5;
let currentCardsPage = 1;

// DOM Elements
const elements = {
  sdkBadge: () => document.getElementById('sdk-badge'),
  stepperSteps: () => document.querySelectorAll('.stepper-step'),
  stepContents: () => document.querySelectorAll('.step-content'),
  productsGrid: () => document.getElementById('products-grid'),
  cartSummary: () => document.getElementById('cart-summary'),
  cartItems: () => document.getElementById('cart-items'),
  cartTotal: () => document.getElementById('cart-total'),
  proceedToPaymentBtn: () => document.getElementById('proceed-to-payment'),
  summaryItems: () => document.getElementById('summary-items'),
  summaryTotal: () => document.getElementById('summary-total'),
  paymentTabs: () => document.querySelectorAll('.payment-tab'),
  paymentContents: () => document.querySelectorAll('.payment-content'),
  savedCardsList: () => document.getElementById('saved-cards-list'),
  savedCardsPagination: () => document.getElementById('saved-cards-pagination'),
  prevCardsBtn: () => document.getElementById('prev-cards-btn'),
  nextCardsBtn: () => document.getElementById('next-cards-btn'),
  paginationInfo: () => document.getElementById('pagination-info'),
  hostedFieldsForm: () => document.getElementById('hosted-fields-form'),
  expressCheckoutSection: () => document.getElementById('express-checkout-section'),
  payBtn: () => document.getElementById('pay-btn'),
  resultSection: () => document.getElementById('result-section'),
  statusMessage: () => document.getElementById('status-message'),
  eventLog: () => document.getElementById('event-log'),
  challengeOverlay: () => document.getElementById('challenge-overlay'),
};

// Logging
function logEvent(message, type = 'info') {
  const log = elements.eventLog();
  if (!log) return;
  
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  
  const entry = document.createElement('div');
  entry.className = `event-log-entry ${type}`;
  entry.innerHTML = `<span class="time">[${time}]</span> ${message}`;
  
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
  
  console.log(`[${type.toUpperCase()}] ${message}`);
}

// Initialization
document.addEventListener('DOMContentLoaded', init);

async function init() {
  sdkType = SpreedlyUtils.getSDKType();
  elements.sdkBadge().textContent = SpreedlyUtils.getSDKDisplayName();

  logEvent('Initializing Purchase with 3DS flow...');
  
  // Render products first (doesn't depend on SDK)
  renderProducts();
  updateCartSummary();
  setupEventListeners();
  goToStep(1);

  // Load SDK script dynamically
  SpreedlyUtils.loadSDKScript(async (error) => {
    if (error) {
      console.error('Failed to load SDK:', error);
      logEvent(`Failed to load SDK: ${error.message}`, 'error');
      SpreedlyUtils.showStatus('global-status-message', 'Failed to load SDK. Please refresh.', 'error');
      return;
    }
    
    logEvent('SDK script loaded');
    
    try {
      const authParams = await SpreedlyUtils.fetchAuthParams();
      storedAuthParams = authParams;

      if (sdkType === 'express-checkout') {
        initializeExpressCheckout(authParams);
      } else {
        initializeHostedFields(authParams);
      }
      
      await loadSavedCards();
      
    } catch (error) {
      console.error('Failed to initialize:', error);
      logEvent(`Initialization failed: ${error.message}`, 'error');
      SpreedlyUtils.showStatus('global-status-message', error.message || 'Failed to initialize SDK.', 'error');
    }
  });
}

function setupEventListeners() {
  // Product quantity controls
  elements.productsGrid().addEventListener('click', (e) => {
    const target = e.target;
    if (target.classList.contains('quantity-btn')) {
      const productId = target.closest('.product-card').dataset.productId;
      if (target.classList.contains('increase-qty')) {
        updateCart(productId, (cart[productId] || 0) + 1);
      } else if (target.classList.contains('decrease-qty')) {
        updateCart(productId, (cart[productId] || 0) - 1);
      }
    }
  });

  // Proceed to Payment button
  elements.proceedToPaymentBtn().addEventListener('click', () => {
    goToStep(2);
  });

  // Payment tabs
  elements.paymentTabs().forEach(tab => {
    tab.addEventListener('click', () => {
      switchPaymentTab(tab.dataset.tab);
    });
  });

  // Pagination buttons
  elements.prevCardsBtn().addEventListener('click', () => changeCardsPage(-1));
  elements.nextCardsBtn().addEventListener('click', () => changeCardsPage(1));
}

// Stepper Navigation
window.goToStep = function(stepNumber) {
  currentStep = stepNumber;

  elements.stepperSteps().forEach((step, index) => {
    if (index + 1 < stepNumber) {
      step.classList.add('completed');
      step.classList.remove('active');
    } else if (index + 1 === stepNumber) {
      step.classList.add('active');
      step.classList.remove('completed');
    } else {
      step.classList.remove('active', 'completed');
    }
  });

  elements.stepContents().forEach((content, index) => {
    if (index + 1 === stepNumber) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  if (stepNumber === 2) {
    updateOrderSummary();
    updatePayButton();
  }
};

// Product & Cart Management
function renderProducts() {
  elements.productsGrid().innerHTML = PRODUCTS.map(product => `
    <div class="product-card" data-product-id="${product.id}">
      <div class="product-emoji">${product.emoji}</div>
      <div class="product-name">${product.name}</div>
      <div class="product-description">${product.description}</div>
      <div class="product-price">${SpreedlyUtils.formatCurrency(product.price)}</div>
      <div class="quantity-control">
        <button class="quantity-btn decrease-qty" ${!cart[product.id] || cart[product.id] <= 0 ? 'disabled' : ''}>-</button>
        <input type="text" class="quantity-input" value="${cart[product.id] || 0}" readonly>
        <button class="quantity-btn increase-qty">+</button>
      </div>
    </div>
  `).join('');
}

function updateCart(productId, quantity) {
  if (quantity <= 0) {
    delete cart[productId];
  } else {
    cart[productId] = quantity;
  }
  renderProducts();
  updateCartSummary();
}

function getCartTotal() {
  return Object.entries(cart).reduce((total, [productId, quantity]) => {
    const product = PRODUCTS.find(p => p.id === productId);
    return total + (product ? product.price * quantity : 0);
  }, 0);
}

function updateCartSummary() {
  const total = getCartTotal();
  if (total > 0) {
    elements.cartSummary().style.display = 'block';
    elements.cartItems().innerHTML = Object.entries(cart).map(([productId, quantity]) => {
      const product = PRODUCTS.find(p => p.id === productId);
      return product ? `
        <div class="order-item">
          <span>${product.emoji} ${product.name} <span class="order-item-qty">x${quantity}</span></span>
          <span>${SpreedlyUtils.formatCurrency(product.price * quantity)}</span>
        </div>
      ` : '';
    }).join('');
    elements.cartTotal().textContent = SpreedlyUtils.formatCurrency(total);
    elements.proceedToPaymentBtn().disabled = false;
  } else {
    elements.cartSummary().style.display = 'none';
    elements.proceedToPaymentBtn().disabled = true;
  }
}

function updateOrderSummary() {
  const total = getCartTotal();
  elements.summaryItems().innerHTML = Object.entries(cart).map(([productId, quantity]) => {
    const product = PRODUCTS.find(p => p.id === productId);
    return product ? `
      <div class="order-item">
        <span>${product.emoji} ${product.name} <span class="order-item-qty">x${quantity}</span></span>
        <span>${SpreedlyUtils.formatCurrency(product.price * quantity)}</span>
      </div>
    ` : '';
  }).join('');
  elements.summaryTotal().textContent = SpreedlyUtils.formatCurrency(total);
}

// SDK Initialization
function initializeHostedFields(authParams) {
  logEvent('Initializing Hosted Fields SDK...');
  
  sdk = new SpreedlyHostedFields({
    environment_key: authParams.environmentKey,
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.certificateToken,
    signature: authParams.signature,
  });
  
  sdk.on('ready', () => {
    isReady = true;
    elements.hostedFieldsForm().classList.remove('hidden');
    logEvent('Hosted Fields ready', 'success');
  });
  
  sdk.on('tokenGenerated', (response) => {
    logEvent('Token generated', 'success');
    const token = response?.tokenResponse?.payment_method?.token;
    if (token) {
      paymentMethodToken = token;
      processPurchaseWith3DS();
    } else {
      logEvent('Failed to extract token from response', 'error');
      showStatus('Failed to generate payment token', 'error');
      setPayButtonLoading(false);
    }
  });
  
  sdk.on('error', (error) => {
    logEvent(`SDK error: ${error.message}`, 'error');
    showStatus(error.message || 'An error occurred', 'error');
    setPayButtonLoading(false);
  });

  sdk.inAppElements({
    number: { containerId: 'card-number-field' },
    cvv: { containerId: 'cvv-field' },
  });
  
  logEvent('Hosted Fields SDK initialized');
}

function initializeExpressCheckout(authParams) {
  logEvent('Initializing Express Checkout SDK...');
  
  sdk = new SpreedlyExpressCheckout({
    environment_key: authParams.environmentKey,
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.certificateToken,
    signature: authParams.signature,
  });
  
  elements.expressCheckoutSection().classList.remove('hidden');
  logEvent('Express Checkout SDK initialized');
}

// Open Express Checkout in 550x550 dialog
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
    logEvent('Express Checkout ready', 'success');
  });
  
  sdk.on('tokenGenerated', (response) => {
    logEvent('Token generated', 'success');
    const token = response?.tokenResponse?.payment_method?.token;
    if (token) {
      paymentMethodToken = token;
      dialogOverlay?.classList.add('hidden');
      processPurchaseWith3DS();
    } else {
      logEvent('Failed to extract token', 'error');
      showStatus('Failed to generate payment token', 'error');
    }
  });
  
  sdk.on('error', (error) => {
    logEvent(`SDK error: ${error.message}`, 'error');
    SpreedlyUtils.setButtonLoading('open-express-checkout-btn', false);
    showStatus(error.message || 'An error occurred', 'error');
  });
  
  sdk.on('close', () => {
    logEvent('Express checkout closed');
    dialogOverlay?.classList.add('hidden');
    document.getElementById('express-checkout-open-section').classList.remove('hidden');
  });
  
  const checkoutConfig = {
    parentContainerId: 'express-checkout-dialog-container',
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
          hover: { backgroundColor: '#374151' },
        },
      },
    },
  };
  
  sdk.expressCheckout(checkoutConfig);
};

// Payment Tab Management
function switchPaymentTab(tabName) {
  elements.paymentTabs().forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  elements.paymentContents().forEach(content => {
    content.classList.toggle('active', content.id === `payment-${tabName}`);
  });

  if (tabName === 'new') {
    selectedSavedCard = null;
    if (sdkType === 'hosted-fields') {
      elements.hostedFieldsForm().classList.remove('hidden');
      elements.expressCheckoutSection().classList.add('hidden');
    } else {
      elements.hostedFieldsForm().classList.add('hidden');
      elements.expressCheckoutSection().classList.remove('hidden');
    }
  } else {
    elements.hostedFieldsForm().classList.add('hidden');
    elements.expressCheckoutSection().classList.add('hidden');
  }
  updatePayButton();
}

// Saved Cards
async function loadSavedCards() {
  try {
    savedCards = await SpreedlyUtils.fetchPaymentMethods();
    renderSavedCards();
    logEvent(`Loaded ${savedCards.length} saved cards`);
  } catch (error) {
    logEvent(`Failed to load saved cards: ${error.message}`, 'error');
    elements.savedCardsList().innerHTML = `<p style="text-align: center; color: var(--color-gray-500);">Failed to load saved cards</p>`;
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
    elements.savedCardsPagination().classList.add('hidden');
    return;
  }
  
  // Calculate pagination
  const totalCards = savedCards.length;
  const totalPages = Math.ceil(totalCards / CARDS_PER_PAGE);
  const startIndex = (currentCardsPage - 1) * CARDS_PER_PAGE;
  const endIndex = Math.min(startIndex + CARDS_PER_PAGE, totalCards);
  const paginatedCards = savedCards.slice(startIndex, endIndex);
  
  // Render cards
  container.innerHTML = paginatedCards.map(card => {
    const fullName = [card.first_name, card.last_name].filter(Boolean).join(' ') || '[Cardholder Name Not Available]';
    return `
    <div class="saved-card ${selectedSavedCard === card.token ? 'selected' : ''}" data-token="${card.token}" onclick="selectSavedCard('${card.token}')">
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
  
  // Update pagination controls
  if (totalPages > 1) {
    elements.savedCardsPagination().classList.remove('hidden');
    elements.paginationInfo().textContent = `Page ${currentCardsPage} of ${totalPages}`;
    elements.prevCardsBtn().disabled = currentCardsPage === 1;
    elements.nextCardsBtn().disabled = currentCardsPage === totalPages;
  } else {
    elements.savedCardsPagination().classList.add('hidden');
  }
  
  updatePayButton();
}

window.selectSavedCard = function(token) {
  selectedSavedCard = token;
  
  // Update UI
  document.querySelectorAll('.saved-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.token === token);
    card.querySelector('.saved-card-radio').checked = card.dataset.token === token;
  });
  
  updatePayButton();
};

function changeCardsPage(direction) {
  const totalPages = Math.ceil(savedCards.length / CARDS_PER_PAGE);
  currentCardsPage = Math.max(1, Math.min(totalPages, currentCardsPage + direction));
  renderSavedCards();
}

// Payment Button State
function updatePayButton() {
  const activeTab = document.querySelector('.payment-tab.active').dataset.tab;
  const payBtn = elements.payBtn();
  
  if (activeTab === 'saved') {
    payBtn.disabled = !selectedSavedCard;
  } else {
    payBtn.disabled = false;
  }
  
  const btnText = payBtn.querySelector('.btn-text');
  if (btnText) {
    btnText.textContent = `Pay with 3DS ${SpreedlyUtils.formatCurrency(getCartTotal())}`;
  }
}

// Payment Processing
window.handlePayment = function() {
  const activeTab = document.querySelector('.payment-tab.active').dataset.tab;
  
  hideStatus();
  setPayButtonLoading(true);
  logEvent('Starting payment process...');
  
  if (activeTab === 'saved') {
    paymentMethodToken = selectedSavedCard;
    logEvent('Using saved card token');
    processPurchaseWith3DS();
  } else {
    if (sdkType === 'express-checkout') {
      // Express Checkout handles its own tokenization
      logEvent('Express Checkout will handle tokenization');
      setPayButtonLoading(false);
    } else {
      tokenizeNewCard();
    }
  }
};

function tokenizeNewCard() {
  logEvent('Tokenizing new card...');
  
  if (!sdk || !isReady) {
    showStatus('SDK not ready. Please wait.', 'error');
    setPayButtonLoading(false);
    return;
  }
  
  const firstName = document.getElementById('first_name')?.value?.trim() || '';
  const lastName = document.getElementById('last_name')?.value?.trim() || '';
  const month = document.getElementById('month')?.value?.trim() || '';
  const year = document.getElementById('year')?.value?.trim() || '';
  const email = document.getElementById('email')?.value?.trim() || '';
  
  if (!firstName || !lastName || !month || !year) {
    showStatus('Please fill in all required fields', 'error');
    setPayButtonLoading(false);
    return;
  }
  
  const submitData = {
    first_name: firstName,
    last_name: lastName,
    month: month,
    year: year,
  };
  
  if (email) {
    submitData.email = email;
  }
  
  sdk.submit(submitData);
}

// 3DS Purchase Flow
async function processPurchaseWith3DS() {
  if (!paymentMethodToken) {
    showStatus('No payment method token available.', 'error');
    setPayButtonLoading(false);
    return;
  }

  try {
    // Step 1: Collect browser info
    logEvent('Collecting browser info...');
    setPayButtonLoading(true, 'Collecting browser info...');
    
    const browserInfo = serializeBrowserInfo(CONFIG.browserSize, CONFIG.acceptHeader);
    logEvent('Browser info collected', 'success');
    
    // Step 2: Create purchase with 3DS
    logEvent('Creating purchase with 3DS...');
    setPayButtonLoading(true, 'Processing payment...');
    
    const totalAmount = Math.round(getCartTotal() * 100); // Convert to cents
    
    const response = await SpreedlyUtils.createPurchaseWith3DS(
      paymentMethodToken,
      totalAmount,
      browserInfo,
      'USD'
    );
    
    const transaction = response.transaction;
    
    logEvent(`Transaction created: ${transaction.token?.substring(0, 15)}...`);
    logEvent(`State: ${transaction.state}`);
    
    // Step 3: Handle based on transaction state
    if (transaction.state === 'succeeded') {
      logEvent('Transaction succeeded immediately', 'success');
      showResult('success', transaction);
    } else if (transaction.state === 'pending') {
      logEvent('Transaction pending - starting 3DS lifecycle...', 'info');
      start3DSLifecycle(transaction.token);
    } else {
      logEvent(`Transaction failed: ${transaction.state}`, 'error');
      showResult('error', { message: transaction.message || `Transaction ${transaction.state}` });
    }
    
  } catch (error) {
    logEvent(`Purchase failed: ${error.error}`, 'error');
    showResult('error', { message: error.transaction.message || 'Purchase failed' });
  }
}

// 3DS Lifecycle
function start3DSLifecycle(transactionToken) {
  setPayButtonLoading(true, 'Authenticating...');
  logEvent('Creating 3DS Lifecycle...');
  
  lifecycle = new SpreedlyThreeDSLifecycle({
    transactionToken: transactionToken,
    hiddenIframeLocation: 'device-fingerprint',
    challengeIframeLocation: 'challenge-container',
    challengeIframeClasses: 'challenge-iframe',
    environmentKey: storedAuthParams?.environmentKey,
    
    callbacks: {
      // All callbacks receive consistent event structure: { action, context, token, finalize, response }
      onChallenge: (event) => {
        logEvent(`Challenge required (action: ${event.action}) - showing modal`, 'info');
        setPayButtonLoading(true, 'Complete verification...');
        showChallengeModal();
      },
      
      onSuccess: (event) => {
        logEvent(`3DS authentication successful (action: ${event.action})`, 'success');
        hideChallengeModal();
        // event.context contains the full TransactionStatus
        showResult('success', event.context);
      },
      
      onError: (event) => {
        // event.context is the error message, event.response has { state, message, error_code }
        let errorMsg = event.context;
        if (errorMsg === 'messages.failed_sca_authentication') {
          errorMsg = 'Transaction failed due to failed authentication. Please try again.';
        }
        logEvent(`3DS error (action: ${event.action}): ${errorMsg}`, 'error');
        hideChallengeModal();
        showResult('error', { message: errorMsg });
      },
    },
  });
  
  logEvent('Starting 3DS flow...');
  lifecycle.start();
}

// Challenge Modal
function showChallengeModal() {
  const overlay = elements.challengeOverlay();
  if (overlay) {
    overlay.classList.remove('hidden');
    logEvent('Challenge modal displayed', 'info');
  }
}

function hideChallengeModal() {
  const overlay = elements.challengeOverlay();
  if (overlay) {
    overlay.classList.add('hidden');
  }
  
  const container = document.getElementById('challenge-container');
  if (container) container.innerHTML = '';
}

// Results
function showResult(type, data) {
  setPayButtonLoading(false);
  goToStep(3);
  
  const container = elements.resultSection();
  
  if (type === 'success') {
    container.innerHTML = `
      <div class="result-icon success">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <h2 class="result-title" style="color: var(--color-success);">3DS Payment Successful!</h2>
      <p class="result-message">Your payment has been securely authenticated and processed.</p>
      <div class="result-details">
        <div class="result-detail-row">
          <span class="result-detail-label">Transaction ID</span>
          <span class="result-detail-value">${data?.token || data?.response?.token || 'N/A'}</span>
        </div>
        <div class="result-detail-row">
          <span class="result-detail-label">Amount</span>
          <span class="result-detail-value">${SpreedlyUtils.formatCurrency(getCartTotal())}</span>
        </div>
        <div class="result-detail-row">
          <span class="result-detail-label">3DS Status</span>
          <span class="result-detail-value" style="color: var(--color-success);">✓ Authenticated</span>
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
  
  // Re-initialize
  init();
};

// UI Helpers
let originalPayBtnText = null;

function setPayButtonLoading(loading, text = null) {
  const button = document.getElementById('pay-btn');
  if (!button) return;
  
  const spinnerEl = button.querySelector('.btn-spinner');
  const textEl = button.querySelector('.btn-text');
  
  button.disabled = loading;
  
  if (spinnerEl) {
    spinnerEl.classList.toggle('hidden', !loading);
  }
  
  if (textEl) {
    if (loading) {
      // Save original text if not already saved
      if (!originalPayBtnText) {
        originalPayBtnText = textEl.textContent;
      }
      // Update text if provided
      if (text) {
        textEl.textContent = text;
      }
    } else {
      // Restore original text when not loading
      if (originalPayBtnText) {
        textEl.textContent = originalPayBtnText;
        originalPayBtnText = null;
      }
    }
  }
}

function showStatus(message, type = 'info') {
  const statusEl = elements.statusMessage();
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status-message visible ${type}`;
  }
}

function hideStatus() {
  const statusEl = elements.statusMessage();
  if (statusEl) {
    statusEl.className = 'status-message';
  }
}

