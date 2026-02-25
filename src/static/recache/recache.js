/**
 * Recache Flow - Updates the CVV for a saved payment method
 * Supports both Hosted Fields and Express Checkout SDKs
 */

// State
// ============================================
let sdk = null;
let isReady = false;
let isRecacheReady = false; // Tracks if recache mode is active and ready for CVV entry
let sdkType = null;
let storedAuthParams = null;
let savedCards = [];
let selectedCard = null;

// Config options
const config = {
  allowBlankName: false,
  allowExpiredDate: false,
  allowBlankDate: false,
};

// Pagination state
const CARDS_PER_PAGE = 5;
let currentPage = 1;

// DOM Elements
const elements = {
  sdkBadge: () => document.getElementById('sdk-badge'),
  loadingState: () => document.getElementById('loading-state'),
  selectCardSection: () => document.getElementById('select-card-section'),
  savedCardsList: () => document.getElementById('saved-cards-list'),
  recacheBtn: () => document.getElementById('recache-btn'),
  hostedFieldsCvvSection: () => document.getElementById('hosted-fields-cvv-section'),
  expressCheckoutCvvSection: () => document.getElementById('express-checkout-cvv-section'),
  cvvForm: () => document.getElementById('cvv-form'),
  submitCvvBtn: () => document.getElementById('submit-cvv-btn'),
  statusMessage: () => document.getElementById('status-message'),
  globalStatusMessage: () => document.getElementById('global-status-message'),
  resultSection: () => document.getElementById('result-section'),
  resultCard: () => document.getElementById('result-card'),
  resultIcon: () => document.getElementById('result-icon'),
  resultIconSuccess: () => document.getElementById('result-icon-success'),
  resultIconError: () => document.getElementById('result-icon-error'),
  resultTitle: () => document.getElementById('result-title'),
  resultDetails: () => document.getElementById('result-details'),
  debugEnvKey: () => document.getElementById('debug-env-key'),
  debugNonce: () => document.getElementById('debug-nonce'),
  debugTimestamp: () => document.getElementById('debug-timestamp'),
  debugStatus: () => document.getElementById('debug-status'),
};

// Sync config from checkboxes
function syncConfigFromCheckboxes() {
  config.allowBlankName = document.getElementById('config-allow-blank-name')?.checked || false;
  config.allowExpiredDate = document.getElementById('config-allow-expired-date')?.checked || false;
  config.allowBlankDate = document.getElementById('config-allow-blank-date')?.checked || false;
}

// Setup checkbox listeners
function setupConfigCheckboxListeners() {
  document.getElementById('config-allow-blank-name')?.addEventListener('change', function() {
    config.allowBlankName = this.checked;
  });
  
  document.getElementById('config-allow-expired-date')?.addEventListener('change', function() {
    config.allowExpiredDate = this.checked;
  });
  
  document.getElementById('config-allow-blank-date')?.addEventListener('change', function() {
    config.allowBlankDate = this.checked;
  });
}

// Initialization
async function init() {
  sdkType = SpreedlyUtils.getSDKType();
  elements.sdkBadge().textContent = SpreedlyUtils.getSDKDisplayName();
  
  try {
    // Fetch auth params first
    updateDebugStatus('Fetching auth params...');
    storedAuthParams = await SpreedlyUtils.fetchAuthParams();
    
    // Update debug panel
    elements.debugEnvKey().textContent = storedAuthParams.environmentKey;
    elements.debugNonce().textContent = (storedAuthParams.nonce || '').substring(0, 20) + '...';
    elements.debugTimestamp().textContent = storedAuthParams.timestamp;
    
    // Load SDK script
    updateDebugStatus('Loading SDK...');
    await new Promise((resolve, reject) => {
      SpreedlyUtils.loadSDKScript((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
    
    updateDebugStatus('Loading saved cards...');
    await loadSavedCards();
    
    setupEventListeners();
    
    hideLoading();
    elements.selectCardSection().classList.remove('hidden');
    updateDebugStatus('Ready - Select a card');
    
  } catch (error) {
    console.error('Failed to initialize:', error);
    showGlobalError('Failed to initialize. Please refresh the page.');
  }
}

function setupEventListeners() {
  elements.recacheBtn().addEventListener('click', startRecacheFlow);
  
  // CVV form submission (Hosted Fields)
  const cvvForm = elements.cvvForm();
  if (cvvForm) {
    cvvForm.addEventListener('submit', handleCvvSubmit);
  }
  
  // Setup config checkbox listeners
  setupConfigCheckboxListeners();
}

// Saved Cards
async function loadSavedCards() {
  try {
    savedCards = await SpreedlyUtils.fetchPaymentMethods();
    
    // Filter to only show retained cards (storage_state === 'retained')
    savedCards = savedCards.filter(card => 
      card.storage_state === 'retained'
    );
    
    renderSavedCards();
  } catch (error) {
    console.error('Failed to load saved cards:', error);
    elements.savedCardsList().innerHTML = `
      <div class="no-saved-cards">
        <p>Failed to load saved cards</p>
        <p style="font-size: 0.875rem; margin-top: 0.5rem;">Please try again later</p>
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
        <p style="font-size: 0.875rem; margin-top: 0.5rem;">
          You need a retained payment method to use recache.
          <a href="../tokenize/index.html?sdk=${sdkType}" style="color: var(--color-black); text-decoration: underline;">Tokenize a card first</a>.
        </p>
      </div>
    `;
    elements.recacheBtn().disabled = true;
    return;
  }
  
  // Calculate pagination
  const totalCards = savedCards.length;
  const totalPages = Math.ceil(totalCards / CARDS_PER_PAGE);
  const startIndex = (currentPage - 1) * CARDS_PER_PAGE;
  const endIndex = Math.min(startIndex + CARDS_PER_PAGE, totalCards);
  const paginatedCards = savedCards.slice(startIndex, endIndex);
  
  // Render cards
  let html = paginatedCards.map(card => {
    const fullName = [card.first_name, card.last_name].filter(Boolean).join(' ') || '[Cardholder Name Not Available]';
    const isSelected = selectedCard?.token === card.token;
    return `
      <div class="saved-card ${isSelected ? 'selected' : ''}" data-token="${card.token}" onclick="selectCard('${card.token}')">
        <span class="saved-card-icon">${SpreedlyUtils.getCardIcon(card.card_type)}</span>
        <div class="saved-card-details">
          <div class="saved-card-name">${fullName}</div>
          <div class="saved-card-number">${SpreedlyUtils.capitalizeFirst(card.card_type)} •••• ${card.last_four_digits}</div>
          <div class="saved-card-expiry">Expires ${card.month}/${card.year} • ${card.storage_state}</div>
        </div>
        <input type="radio" name="saved-card" class="saved-card-radio" ${isSelected ? 'checked' : ''}>
      </div>
    `;
  }).join('');
  
  // Add pagination controls if needed
  if (totalPages > 1) {
    html += `
      <div class="pagination">
        <button class="pagination-btn" onclick="changePage(-1)" ${currentPage === 1 ? 'disabled' : ''}>
          ← Previous
        </button>
        <span class="pagination-info">
          Page ${currentPage} of ${totalPages}
        </span>
        <button class="pagination-btn" onclick="changePage(1)" ${currentPage === totalPages ? 'disabled' : ''}>
          Next →
        </button>
      </div>
    `;
  }
  
  container.innerHTML = html;
}

window.changePage = function(delta) {
  const totalPages = Math.ceil(savedCards.length / CARDS_PER_PAGE);
  currentPage = Math.max(1, Math.min(totalPages, currentPage + delta));
  renderSavedCards();
};

window.selectCard = function(token) {
  selectedCard = savedCards.find(card => card.token === token);
  
  // Update UI
  document.querySelectorAll('.saved-card').forEach(card => {
    const isSelected = card.dataset.token === token;
    card.classList.toggle('selected', isSelected);
    card.querySelector('.saved-card-radio').checked = isSelected;
  });
  
  // Enable recache button
  elements.recacheBtn().disabled = !selectedCard;
};

// Recache Flow
function startRecacheFlow() {
  if (!selectedCard) {
    showGlobalError('Please select a card first');
    return;
  }
  
  SpreedlyUtils.setButtonLoading('recache-btn', true, 'Loading...');
  updateDebugStatus('Initializing SDK for recache...');
  
  if (sdkType === 'express-checkout') {
    initializeExpressCheckoutRecache();
  } else {
    initializeHostedFieldsRecache();
  }
}

// Hosted Fields Recache
function initializeHostedFieldsRecache() {
  sdk = new SpreedlyHostedFields({
    environment_key: storedAuthParams.environmentKey,
    nonce: storedAuthParams.nonce,
    timestamp: storedAuthParams.timestamp,
    certificate_token: storedAuthParams.certificateToken,
    signature: storedAuthParams.signature,
  });
  
  // Set up event handlers FIRST
  sdk.on('ready', () => {
    isReady = true;
    SpreedlyUtils.setButtonLoading('recache-btn', false);
    
    // Hide card selection, show CVV form
    elements.selectCardSection().classList.add('hidden');
    elements.hostedFieldsCvvSection().classList.remove('hidden');
    
    // Update card display
    updateCardDisplay();
    
    // Set recache mode AFTER ready - THIS IS THE KEY CALL
    syncConfigFromCheckboxes(); // Sync config before setRecache
    sdk.setRecache(selectedCard.token, {
      card_type: selectedCard.card_type,
      last_four_digits: selectedCard.last_four_digits,
      first_six_digits: selectedCard.first_six_digits || '',
      storage_state: selectedCard.storage_state,
      month: String(selectedCard.month),
      year: String(selectedCard.year),
      full_name: [selectedCard.first_name, selectedCard.last_name].filter(Boolean).join(' '),
      allow_blank_name: config.allowBlankName,
      allow_expired_date: config.allowExpiredDate,
      allow_blank_date: config.allowBlankDate,
    });
    
    updateDebugStatus('Recache mode active - Enter CVV');
    console.log('Hosted Fields ready, recache mode set for:', selectedCard.token);
  });
  
  sdk.on('recacheReady', ({ token, options }) => {
    console.log('Recache ready for token:', token, options);
    isRecacheReady = true;
    updateDebugStatus('Recache ready - Enter CVV and click Update');
    
    // Enable the submit button now that recache mode is active
    const submitBtn = elements.submitCvvBtn();
    if (submitBtn) {
      submitBtn.disabled = false;
    }
  });
  
  sdk.on('recacheSuccess', (response) => {
    console.log('Recache success:', response);
    handleRecacheSuccess(response);
  });
  
  sdk.on('error', (error) => {
    console.error('SDK error:', error);
    SpreedlyUtils.setButtonLoading('recache-btn', false);
    handleRecacheError(error);
  });
  
  // THEN mount the hosted fields - this triggers the 'ready' event
  // Both number and cvv are required by the SDK
  sdk.inAppElements({
    number: { containerId: 'card-number-field' },
    cvv: { containerId: 'cvv-field' },
  });
}

function handleCvvSubmit(e) {
  e.preventDefault();
  
  if (!sdk || !isReady) {
    showStatus('SDK not ready', 'error');
    return;
  }
  
  if (!isRecacheReady) {
    showStatus('Recache mode not ready yet', 'error');
    return;
  }
  
  SpreedlyUtils.setButtonLoading('submit-cvv-btn', true, 'Processing...');
  showStatus('Updating CVV...', 'info');
  
  // Call recache to submit the CVV - must be called after recacheReady event
  sdk.recache();
}

// Express Checkout Recache
function initializeExpressCheckoutRecache() {
  sdk = new SpreedlyExpressCheckout({
    environment_key: storedAuthParams.environmentKey,
    nonce: storedAuthParams.nonce,
    timestamp: storedAuthParams.timestamp,
    certificate_token: storedAuthParams.certificateToken,
    signature: storedAuthParams.signature,
  });
  
  // Set up event handlers
  sdk.on('ready', () => {
    isReady = true;
    SpreedlyUtils.setButtonLoading('recache-btn', false);
    
    // Hide card selection, show CVV form
    elements.selectCardSection().classList.add('hidden');
    elements.expressCheckoutCvvSection().classList.remove('hidden');
    
    updateCardDisplay('express');
    
    syncConfigFromCheckboxes(); // Sync config before setRecache
    sdk.setRecache(selectedCard.token, {
      card_type: selectedCard.card_type,
      last_four_digits: selectedCard.last_four_digits,
      first_six_digits: selectedCard.first_six_digits || '',
      storage_state: selectedCard.storage_state,
      month: String(selectedCard.month),
      year: String(selectedCard.year),
      full_name: [selectedCard.first_name, selectedCard.last_name].filter(Boolean).join(' '),
      allow_blank_name: config.allowBlankName,
      allow_expired_date: config.allowExpiredDate,
      allow_blank_date: config.allowBlankDate,
    });
    
    updateDebugStatus('Recache mode active');
    console.log('Express Checkout ready, setRecache called for:', selectedCard.token);
  });
  
  sdk.on('recacheReady', ({ token, options }) => {
    console.log('Recache ready for token:', token, options);
    isRecacheReady = true;
    updateDebugStatus('Recache ready - Enter CVV in the form');
  });
  
  sdk.on('recacheSuccess', (response) => {
    console.log('Recache success:', response);
    handleRecacheSuccess(response);
  });
  
  sdk.on('error', (error) => {
    console.error('SDK error:', error);
    SpreedlyUtils.setButtonLoading('recache-btn', false);
    handleRecacheError(error);
  });
  
  sdk.on('close', () => {
    console.log('Express checkout closed');
    showExpressStatus('Checkout closed', 'info');
    SpreedlyUtils.setButtonLoading('recache-btn', false);
    isRecacheReady = false;
  });
  
  const checkoutConfig = {
    parentContainerId: 'express-checkout-container',
    uiConfig: {
      textConfig: {
        title: 'Update CVV',
        submitBtnText: 'Update CVV',
        processingText: 'Processing...',
      },
      styles: {
        button: {
          backgroundColor: '#0a0a0a',
          borderRadius: '8px',
          hover: {
            backgroundColor: '#262626',
          },
        },
      },
    },
  };
  
  sdk.expressCheckout(checkoutConfig);
  console.log('expressCheckout called, waiting for ready...');
}

// Card Display Update
function updateCardDisplay(prefix = '') {
  const cardTypeEl = document.getElementById(prefix ? `${prefix}-display-card-type` : 'display-card-type');
  const cardNumberEl = document.getElementById(prefix ? `${prefix}-display-card-number` : 'display-card-number');
  const cardExpiryEl = document.getElementById(prefix ? `${prefix}-display-card-expiry` : 'display-card-expiry');
  
  if (cardTypeEl) {
    cardTypeEl.textContent = SpreedlyUtils.capitalizeFirst(selectedCard.card_type);
  }
  if (cardNumberEl) {
    cardNumberEl.textContent = `•••• •••• •••• ${selectedCard.last_four_digits}`;
  }
  if (cardExpiryEl) {
    cardExpiryEl.textContent = `Expires ${SpreedlyUtils.formatExpiry(selectedCard.month, selectedCard.year)}`;
  }
}

// Response Handlers
function handleRecacheSuccess(response) {
  SpreedlyUtils.setButtonLoading('submit-cvv-btn', false);
  hideStatus();
  
  const paymentMethod = response?.payment_method || {};
  const token = paymentMethod.token || selectedCard.token;
  
  elements.hostedFieldsCvvSection()?.classList.add('hidden');
  elements.expressCheckoutCvvSection()?.classList.add('hidden');
  elements.selectCardSection()?.classList.add('hidden');
  elements.resultSection().classList.remove('hidden');
  
  elements.resultCard().classList.add('success');
  elements.resultCard().classList.remove('error');
  elements.resultIcon().classList.add('success');
  elements.resultIcon().classList.remove('error');
  elements.resultIconSuccess().classList.remove('hidden');
  elements.resultIconError().classList.add('hidden');
  elements.resultTitle().textContent = 'CVV Updated Successfully';
  
  const details = `
    <div class="result-row">
      <span class="result-label">Token</span>
      <span class="result-value">${token}</span>
    </div>
    <div class="result-row">
      <span class="result-label">Card Type</span>
      <span class="result-value">${SpreedlyUtils.capitalizeFirst(paymentMethod.card_type || selectedCard.card_type)}</span>
    </div>
    <div class="result-row">
      <span class="result-label">Last Four</span>
      <span class="result-value">${paymentMethod.last_four_digits || selectedCard.last_four_digits}</span>
    </div>
    <div class="result-row">
      <span class="result-label">Storage State</span>
      <span class="result-value">${paymentMethod.storage_state || 'cached'}</span>
    </div>
    <div class="result-row">
      <span class="result-label">Message</span>
      <span class="result-value">${response.message || 'CVV recached successfully'}</span>
    </div>
  `;
  
  elements.resultDetails().innerHTML = details;
  updateDebugStatus('Recache complete');
  console.log('CVV recached successfully:', response);
}

function handleRecacheError(error) {
  SpreedlyUtils.setButtonLoading('submit-cvv-btn', false);
  
  const message = error?.message || error?.errors?.[0]?.message || 'Failed to update CVV. Please try again.';
  showStatus(message, 'error');
  updateDebugStatus('Error: ' + message);
  
  console.error('Recache error:', error);
}

// Navigation
window.goBackToCardSelection = function() {
  // Reset SDK
  sdk = null;
  isReady = false;
  isRecacheReady = false;
  
  // Hide CVV sections, show card selection
  elements.hostedFieldsCvvSection()?.classList.add('hidden');
  elements.expressCheckoutCvvSection()?.classList.add('hidden');
  elements.selectCardSection().classList.remove('hidden');
  
  hideStatus();
  updateDebugStatus('Ready - Select a card');
};

window.resetForm = function() {
  // Reset state
  sdk = null;
  isReady = false;
  isRecacheReady = false;
  selectedCard = null;
  currentPage = 1;
  
  // Hide result, show card selection
  elements.resultSection().classList.add('hidden');
  elements.hostedFieldsCvvSection()?.classList.add('hidden');
  elements.expressCheckoutCvvSection()?.classList.add('hidden');
  elements.selectCardSection().classList.remove('hidden');
  
  // Re-render cards
  renderSavedCards();
  elements.recacheBtn().disabled = true;
  
  hideStatus();
  updateDebugStatus('Ready - Select a card');
};

// UI Helpers
function hideLoading() {
  elements.loadingState().classList.add('hidden');
}

function showStatus(message, type) {
  const statusEl = elements.statusMessage();
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status-message visible ${type}`;
  }
}

function showExpressStatus(message, type) {
  const statusEl = document.getElementById('express-status-message');
  if (statusEl) {
    statusEl.textContent = message;
    statusEl.className = `status-message visible ${type}`;
  }
}

function hideStatus() {
  const statusEl = elements.statusMessage();
  const expressStatusEl = document.getElementById('express-status-message');
  const globalStatusEl = elements.globalStatusMessage();
  
  if (statusEl) statusEl.className = 'status-message';
  if (expressStatusEl) expressStatusEl.className = 'status-message';
  if (globalStatusEl) globalStatusEl.className = 'status-message';
}

function showGlobalError(message) {
  hideLoading();
  const globalStatus = elements.globalStatusMessage();
  if (globalStatus) {
    globalStatus.textContent = message;
    globalStatus.className = 'status-message visible error';
  }
}

function updateDebugStatus(status) {
  elements.debugStatus().textContent = status;
}

// Start
document.addEventListener('DOMContentLoaded', init);

