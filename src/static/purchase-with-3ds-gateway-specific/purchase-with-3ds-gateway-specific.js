/**
 * Purchase with 3DS Gateway Specific Flow - Spreedly Web SDK Demo
 * 
 * This demonstrates the Gateway Specific 3DS flow:
 * 1. Select amount (triggers different 3DS flows)
 * 2. Choose payment method (filtered saved cards or new card)
 * 3. Tokenize if new card
 * 4. Create purchase with three_ds_version=2 and attempt_3dsecure=true
 * 5. Check transaction state:
 *    - succeeded: show success
 *    - failed: show error  
 *    - pending: start SpreedlyThreeDSLifecycle for gateway-specific flow
 */

// Configuration
const CONFIG = {
  browserSize: '04', // 600x400px challenge window
  acceptHeader: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// Gateway Specific 3DS Test Cards
// These are the only cards that should be shown for saved cards
const GATEWAY_SPECIFIC_TEST_CARDS = [
  { first_six: '455676', last_four: '3886' }, // 4556761029983886 - Valid 3DS
  { first_six: '402400', last_four: '4890' }, // 4024007101934890 - Invalid 3DS
];

// State
let sdkType = null;
let sdk = null;
let lifecycle = null;
let isReady = false;
let hostedFieldsInitialized = false; // Track if Hosted Fields has been initialized
let storedAuthParams = null;
let savedCards = [];
let filteredSavedCards = [];
let selectedSavedCard = null;
let paymentMethodToken = null;
let currentStep = 1;
let selectedAmount = 3001; // Default to frictionless flow
const CARDS_PER_PAGE = 5;
let currentCardsPage = 1;

// DOM Elements
const elements = {
  sdkBadge: () => document.getElementById('sdk-badge'),
  stepperSteps: () => document.querySelectorAll('.stepper-step'),
  stepContents: () => document.querySelectorAll('.step-content'),
  amountOptions: () => document.querySelectorAll('.amount-option-compact'),
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
  challengeOverlay: () => document.getElementById('challenge-overlay'),
  customAmountOption: () => document.getElementById('custom-amount-option'),
  customAmountInput: () => document.getElementById('custom-amount-input'),
};

// Initialization
document.addEventListener('DOMContentLoaded', init);

async function init() {
  sdkType = SpreedlyUtils.getSDKType();
  elements.sdkBadge().textContent = SpreedlyUtils.getSDKDisplayName();

  console.log('Initializing Purchase with 3DS Gateway Specific flow...');
  
  // Setup event listeners
  setupEventListeners();
  goToStep(1);

  // Load SDK script dynamically
  SpreedlyUtils.loadSDKScript(async (error) => {
    if (error) {
      console.error('Failed to load SDK:', error);
      SpreedlyUtils.showStatus('global-status-message', 'Failed to load SDK. Please refresh.', 'error');
      return;
    }
    
    console.log('SDK script loaded');
    
    try {
      const authParams = await SpreedlyUtils.fetchAuthParams();
      storedAuthParams = authParams;

      // Don't initialize SDK yet - wait until user selects "New Card" tab
      // This prevents Hosted Fields iframes from loading unnecessarily
      console.log('Auth params fetched - SDK will initialize when New Card tab is selected');
      
      await loadSavedCards();
      
    } catch (error) {
      console.error('Failed to initialize:', error);
      SpreedlyUtils.showStatus('global-status-message', error.message || 'Failed to initialize SDK.', 'error');
    }
  });
}

function setupEventListeners() {
  // Amount selection
  elements.amountOptions().forEach(option => {
    option.addEventListener('click', () => {
      const amount = option.dataset.amount;
      if (amount === 'custom') {
        selectCustomAmount();
      } else {
        selectAmount(parseInt(amount));
      }
    });
  });

  // Custom amount input
  const customInput = elements.customAmountInput();
  if (customInput) {
    customInput.addEventListener('input', () => {
      // Auto-select custom option when user types
      selectCustomAmount();
    });
    customInput.addEventListener('focus', () => {
      selectCustomAmount();
    });
  }

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

// Amount Selection
function selectAmount(amount) {
  selectedAmount = amount;
  
  elements.amountOptions().forEach(option => {
    const optionAmount = option.dataset.amount;
    const isSelected = optionAmount !== 'custom' && parseInt(optionAmount) === amount;
    option.classList.toggle('selected', isSelected);
    option.querySelector('input[type="radio"]').checked = isSelected;
  });
  
  // Clear custom input when selecting a preset amount
  const customInput = elements.customAmountInput();
  if (customInput) {
    customInput.value = '';
  }
  
  updatePayButton();
}

// Custom Amount Selection
function selectCustomAmount() {
  const customInput = elements.customAmountInput();
  const customOption = elements.customAmountOption();
  
  // Deselect all preset options
  elements.amountOptions().forEach(option => {
    const optionAmount = option.dataset.amount;
    const isCustom = optionAmount === 'custom';
    option.classList.toggle('selected', isCustom);
    option.querySelector('input[type="radio"]').checked = isCustom;
  });
  
  // Get custom value
  const customValue = parseInt(customInput?.value) || 0;
  selectedAmount = customValue > 0 ? customValue : 0;
  
  updatePayButton();
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
};

// SDK Initialization
function initializeHostedFields(authParams) {
  if (hostedFieldsInitialized) {
    console.log('Hosted Fields already initialized');
    return;
  }
  
  console.log('Initializing Hosted Fields SDK...');
  hostedFieldsInitialized = true;
  
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
    console.log('Hosted Fields ready');
  });
  
  sdk.on('tokenGenerated', (response) => {
    console.log('Token generated');
    const token = response?.tokenResponse?.payment_method?.token;
    if (token) {
      paymentMethodToken = token;
      processPurchaseWithGatewaySpecific3DS();
    } else {
      console.error('Failed to extract token from response');
      showStatus('Failed to generate payment token', 'error');
      setPayButtonLoading(false);
    }
  });
  
  sdk.on('error', (error) => {
    console.error('SDK error:', error.message);
    showStatus(error.message || 'An error occurred', 'error');
    setPayButtonLoading(false);
  });

  sdk.inAppElements({
    number: { containerId: 'card-number-field' },
    cvv: { containerId: 'cvv-field' },
  });
  
  console.log('Hosted Fields SDK initialized');
}

function initializeExpressCheckout(authParams) {
  console.log('Initializing Express Checkout SDK...');
  
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
    console.log('Express Checkout ready');
  });
  
  sdk.on('tokenGenerated', (response) => {
    console.log('Token generated');
    const token = response?.tokenResponse?.payment_method?.token;
    if (token) {
      paymentMethodToken = token;
      dialogOverlay?.classList.add('hidden');
      processPurchaseWithGatewaySpecific3DS();
    } else {
      console.error('Failed to extract token');
      showStatus('Failed to generate payment token', 'error');
    }
  });
  
  sdk.on('error', (error) => {
    console.error('SDK error:', error.message);
    SpreedlyUtils.setButtonLoading('open-express-checkout-btn', false);
    showStatus(error.message || 'An error occurred', 'error');
  });
  
  sdk.on('close', () => {
    console.log('Express checkout closed');
    dialogOverlay?.classList.add('hidden');
    document.getElementById('express-checkout-open-section').classList.remove('hidden');
  });
  
  const checkoutConfig = {
    parentContainerId: 'express-checkout-dialog-container',
    uiConfig: {
      textConfig: {
        title: 'Payment Details',
        submitBtnText: `Pay ${formatCentsAsDollars(selectedAmount)}`,
        processingText: 'Processing...',
      },
      styles: {
        button: {
          backgroundColor: '#065f46',
          borderRadius: '8px',
          hover: { backgroundColor: '#047857' },
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
      // Initialize Hosted Fields only when "New Card" tab is first selected
      if (!hostedFieldsInitialized && storedAuthParams) {
        initializeHostedFields(storedAuthParams);
      }
      elements.hostedFieldsForm().classList.remove('hidden');
      elements.expressCheckoutSection().classList.add('hidden');
    } else {
      // Initialize Express Checkout only when "New Card" tab is first selected
      if (!sdk && storedAuthParams) {
        initializeExpressCheckout(storedAuthParams);
      }
      elements.hostedFieldsForm().classList.add('hidden');
      elements.expressCheckoutSection().classList.remove('hidden');
    }
  } else {
    elements.hostedFieldsForm().classList.add('hidden');
    elements.expressCheckoutSection().classList.add('hidden');
  }
  updatePayButton();
}

// Saved Cards - Filter for Gateway Specific 3DS test cards
async function loadSavedCards() {
  try {
    savedCards = await SpreedlyUtils.fetchPaymentMethods();
    
    // Filter to only show gateway-specific 3DS test cards
    filteredSavedCards = savedCards.filter(card => {
      return GATEWAY_SPECIFIC_TEST_CARDS.some(testCard => 
        card.first_six_digits === testCard.first_six && 
        card.last_four_digits === testCard.last_four
      );
    });
    
    renderSavedCards();
    console.log(`Loaded ${savedCards.length} saved cards, ${filteredSavedCards.length} match gateway-specific test cards`);
  } catch (error) {
    console.error('Failed to load saved cards:', error.message);
    elements.savedCardsList().innerHTML = `<p style="text-align: center; color: var(--color-gray-500);">Failed to load saved cards</p>`;
  }
}

function renderSavedCards() {
  const container = elements.savedCardsList();
  
  if (!filteredSavedCards || filteredSavedCards.length === 0) {
    container.innerHTML = `
      <div class="no-saved-cards">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="width: 3rem; height: 3rem; margin-bottom: 0.5rem; opacity: 0.5;">
          <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
        </svg>
        <p>No gateway-specific 3DS test cards found</p>
        <p style="font-size: 0.875rem; margin-top: 0.5rem;">Add a new card with number <code>4556761029983886</code> or <code>4024007101934890</code></p>
      </div>
    `;
    elements.savedCardsPagination().classList.add('hidden');
    return;
  }
  
  // Calculate pagination
  const totalCards = filteredSavedCards.length;
  const totalPages = Math.ceil(totalCards / CARDS_PER_PAGE);
  const startIndex = (currentCardsPage - 1) * CARDS_PER_PAGE;
  const endIndex = Math.min(startIndex + CARDS_PER_PAGE, totalCards);
  const paginatedCards = filteredSavedCards.slice(startIndex, endIndex);
  
  // Render cards
  container.innerHTML = paginatedCards.map(card => {
    const fullName = [card.first_name, card.last_name].filter(Boolean).join(' ') || '[Cardholder Name Not Available]';
    const isValid3DS = card.first_six_digits === '455676' && card.last_four_digits === '3886';
    const cardLabel = isValid3DS ? '✓ Valid 3DS' : '✗ Invalid 3DS';
    const labelColor = isValid3DS ? 'color: var(--color-success);' : 'color: var(--color-error);';
    
    return `
    <div class="saved-card ${selectedSavedCard === card.token ? 'selected' : ''}" data-token="${card.token}" onclick="selectSavedCard('${card.token}')">
      <span class="saved-card-icon">${SpreedlyUtils.getCardIcon(card.card_type)}</span>
      <div class="saved-card-details">
        <div class="saved-card-name">${fullName}</div>
        <div class="saved-card-number">${SpreedlyUtils.capitalizeFirst(card.card_type)} •••• ${card.last_four_digits}</div>
        <div class="saved-card-expiry">Expires ${card.month}/${card.year} <span style="${labelColor} font-weight: 500; margin-left: 0.5rem;">${cardLabel}</span></div>
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
  const totalPages = Math.ceil(filteredSavedCards.length / CARDS_PER_PAGE);
  currentCardsPage = Math.max(1, Math.min(totalPages, currentCardsPage + direction));
  renderSavedCards();
}

// Payment Button State
function updatePayButton() {
  const activeTab = document.querySelector('.payment-tab.active').dataset.tab;
  const payBtn = elements.payBtn();
  
  // Check if custom amount is selected but invalid
  const isCustomSelected = elements.customAmountOption()?.classList.contains('selected');
  const hasValidAmount = selectedAmount > 0;
  
  if (activeTab === 'saved') {
    payBtn.disabled = !selectedSavedCard || (isCustomSelected && !hasValidAmount);
  } else {
    payBtn.disabled = isCustomSelected && !hasValidAmount;
  }
  
  const btnText = payBtn.querySelector('.btn-text');
  if (btnText) {
    if (isCustomSelected && !hasValidAmount) {
      btnText.textContent = 'Pay with 3DS (Enter amount)';
    } else {
      btnText.textContent = `Pay with 3DS ${formatCentsAsDollars(selectedAmount)}`;
    }
  }
}

// Helper to format cents as dollars
function formatCentsAsDollars(cents) {
  return SpreedlyUtils.formatCurrency(cents / 100);
}

// Payment Processing
window.handlePayment = function() {
  const activeTab = document.querySelector('.payment-tab.active').dataset.tab;
  
  hideStatus();
  setPayButtonLoading(true);
  console.log('Starting payment process...');
  
  if (activeTab === 'saved') {
    paymentMethodToken = selectedSavedCard;
    console.log('Using saved card token');
    processPurchaseWithGatewaySpecific3DS();
  } else {
    if (sdkType === 'express-checkout') {
      // Express Checkout handles its own tokenization
      console.log('Express Checkout will handle tokenization');
      setPayButtonLoading(false);
    } else {
      tokenizeNewCard();
    }
  }
};

function tokenizeNewCard() {
  console.log('Tokenizing new card...');
  
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

// Gateway Specific 3DS Purchase Flow
async function processPurchaseWithGatewaySpecific3DS() {
  if (!paymentMethodToken) {
    showStatus('No payment method token available.', 'error');
    setPayButtonLoading(false);
    return;
  }

  try {
    // Step 1: Collect browser info (still needed for gateway-specific)
    console.log('Collecting browser info...');
    setPayButtonLoading(true, 'Collecting browser info...');
    
    const browserInfo = serializeBrowserInfo(CONFIG.browserSize, CONFIG.acceptHeader);
    console.log('Browser info collected');
    
    // Step 2: Create purchase with gateway-specific 3DS params
    console.log('Creating purchase with Gateway Specific 3DS...');
    setPayButtonLoading(true, 'Processing payment...');
    
    const response = await createPurchaseWithGatewaySpecific3DS(
      paymentMethodToken,
      selectedAmount, // Already in cents
      browserInfo,
      'USD'
    );
    
    const transaction = response.transaction;
    
    console.log(`Transaction created: ${transaction.token?.substring(0, 15)}...`);
    console.log(`State: ${transaction.state}`);
    
    // Step 3: Handle based on transaction state
    switch (transaction.state) {
      case 'succeeded':
        console.log('Transaction succeeded immediately (frictionless)');
        showResult('success', transaction);
        break;
        
      case 'pending':
        console.log('Transaction pending - starting Gateway Specific 3DS lifecycle...');
        start3DSLifecycle(transaction.token);
        break;
        
      case 'failed':
      case 'gateway_processing_failed':
      case 'gateway_setup_failed':
        console.log(`Transaction failed: ${transaction.state}`);
        showResult('error', { message: transaction.message || `Transaction ${transaction.state}` });
        break;
        
      default:
        console.log(`Unexpected transaction state: ${transaction.state}`);
        showResult('error', { message: transaction.message || `Unexpected state: ${transaction.state}` });
    }
    
  } catch (error) {
    console.error('Purchase failed:', error);
    let errorMessage = ''
    if(error?.transaction?.state === 'gateway_setup_failed' || error?.transaction?.state === 'gateway_processing_failed') {
      errorMessage = 'Transaction failed due to gateway setup failure.'
    } else {
      errorMessage = error?.transaction?.message || error?.error || error?.message || 'Purchase failed';
    }
    showResult('error', { message: errorMessage });
  }
}

// API call for Gateway Specific 3DS
async function createPurchaseWithGatewaySpecific3DS(paymentMethodToken, amount, browserInfo, currencyCode) {
  try {
    const response = await axios.post(`${SpreedlyUtils.API_BASE_URL}/create-purchase-with-3ds-gateway-specific`, {
      payment_method_token: paymentMethodToken,
      amount: amount,
      currency_code: currencyCode,
      browser_info: browserInfo,
    });
    return response.data;
  } catch (error) {
    console.error('Error creating gateway-specific 3DS purchase:', error.response?.data || error);
    throw error.response?.data || error;
  }
}

// 3DS Lifecycle - same for both Global and Gateway Specific
function start3DSLifecycle(transactionToken) {
  setPayButtonLoading(true, 'Authenticating...');
  console.log('Creating 3DS Lifecycle for Gateway Specific flow...');
  
  lifecycle = new SpreedlyThreeDSLifecycle({
    transactionToken: transactionToken,
    hiddenIframeLocation: 'device-fingerprint',
    challengeIframeLocation: 'challenge-container',
    challengeIframeClasses: 'challenge-iframe',
    environmentKey: storedAuthParams?.environmentKey,
    
    callbacks: {
      // All callbacks receive consistent event structure: { action, context, token, finalize, response }
      
      // Device fingerprint started (Gateway Specific)
      onDeviceFingerprint: (event) => {
        console.log(`3ds Callback: Device fingerprint (action: ${event.action}, token: ${event.token})`);
      },
      
      // Challenge required - show modal
      onChallenge: (event) => {
        console.log(`3ds Callback: Challenge (action: ${event.action}) - showing modal`);
        setPayButtonLoading(true, 'Complete verification...');
        showChallengeModal();
      },
      
      // 3DS authentication successful
      onSuccess: (event) => {
        console.log(`3ds Callback: Success (action: ${event.action})`);
        hideChallengeModal();
        // event.context contains the full TransactionStatus
        showResult('success', event.context);
      },
      
      // 3DS authentication failed
      onError: (event) => {
        // event.context is the error message, event.response has { state, message, error_code }
        let errorMsg = event.context;
        if (errorMsg === 'messages.failed_sca_authentication') {
          errorMsg = 'Transaction failed due to failed authentication. Please try again.';
        }
        console.error(`3ds Callback: Error (action: ${event.action}):`, errorMsg);
        hideChallengeModal();
        showResult('error', { message: errorMsg });
      },
      
      // Gateway Specific: Device fingerprint/Braintree completed - call completion endpoint
      onTriggerCompletion: async (event) => {
        console.log(`3ds Callback: Trigger completion (action: ${event.action}, token: ${event.token})`);
        console.log('Context:', event.context);
        
        try {
          // Call the backend completion endpoint
          console.log('Calling completion endpoint...');
          const response = await axios.post(
            `${SpreedlyUtils.API_BASE_URL}/transactions/${event.token}/complete`
          );
          
          const transaction = response.data.transaction;
          console.log('Completion response:', transaction.state);
          
          if (transaction.state === 'succeeded') {
            // Transaction completed successfully - show success
            console.log('Transaction succeeded after completion');
            hideChallengeModal();
            showResult('success', transaction);
          } else if (transaction.state === 'pending') {
            // Still pending - continue the 3DS flow (e.g., challenge required)
            console.log('Transaction still pending - continuing 3DS flow');
            event.finalize(transaction);
          } else {
            // Transaction failed
            console.error('Transaction failed after completion:', transaction.message);
            hideChallengeModal();
            showResult('error', { message: transaction.message || 'Transaction failed' });
          }
        } catch (error) {
          if (error.response.data.transaction.state === 'gateway_processing_failed') {
            showResult('error', { message: error.response.data.transaction.message });
          } else {
            showResult('error', { message: 'Error calling completion endpoint' });
          }
        }
      },
      
      // Gateway Specific: Challenge polling timed out (10-15 minutes)
      onFinalizationTimeout: (event) => {
        console.warn(`3ds Callback: Finalization timeout (action: ${event.action}, token: ${event.token})`);
        console.log('Challenge polling timed out - merchant should attempt manual completion');
        hideChallengeModal();
        showResult('error', { message: 'Challenge timed out. Please try again.' });
      },
    },
  });
  
  console.log('Starting 3DS flow...');
  lifecycle.start();
}

// Challenge Modal
function showChallengeModal() {
  const overlay = elements.challengeOverlay();
  if (overlay) {
    overlay.classList.remove('hidden');
    console.log('Challenge modal displayed');
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
  goToStep(2);
  
  const container = elements.resultSection();
  
  if (type === 'success') {
    container.innerHTML = `
      <div class="result-icon success">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <h2 class="result-title" style="color: var(--color-success);">Gateway Specific 3DS Payment Successful!</h2>
      <p class="result-message">Your payment has been authenticated via Gateway Specific 3DS and processed.</p>
      <div class="result-details">
        <div class="result-detail-row">
          <span class="result-detail-label">Transaction ID</span>
          <span class="result-detail-value">${SpreedlyUtils.escapeHtml(data?.token || data?.response?.token || 'N/A')}</span>
        </div>
        <div class="result-detail-row">
          <span class="result-detail-label">Amount</span>
          <span class="result-detail-value">${formatCentsAsDollars(selectedAmount)}</span>
        </div>
        <div class="result-detail-row">
          <span class="result-detail-label">3DS Flow</span>
          <span class="result-detail-value">Gateway Specific</span>
        </div>
        <div class="result-detail-row">
          <span class="result-detail-label">Status</span>
          <span class="result-detail-value" style="color: var(--color-success);">✓ Authenticated & Completed</span>
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
      <p class="result-message">${SpreedlyUtils.escapeHtml(errorMessage)}</p>
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
      if (!originalPayBtnText) {
        originalPayBtnText = textEl.textContent;
      }
      if (text) {
        textEl.textContent = text;
      }
    } else {
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
