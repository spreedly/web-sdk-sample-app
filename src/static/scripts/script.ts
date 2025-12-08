interface AuthParams {
  'env-key': string;
  nonce: string;
  timestamp: string;
  signature: string;
  token: string;
}

interface SavedPaymentMethod {
  token: string;
  card_type: string;
  last_four_digits: string;
  first_six_digits?: string;
  month: string;
  year: string;
  full_name?: string;
  storage_state: string;
}

// In-memory storage for saved payment methods (max 5)
let savedPaymentMethods: SavedPaymentMethod[] = [];

const MAX_SAVED_CARDS = 5;

// Track selected card
let selectedCardToken: string | null = null;

let allowBlankNameChecked = false;
let allowExpiryDateChecked = false;
let openInEmbeddedModeChecked = false;

function syncCheckboxStates(): void {
  const allowBlankNameEl = document.getElementById(
    'allow_blank_name'
  ) as HTMLInputElement | null;
  const allowExpiryDateEl = document.getElementById(
    'allow_expired_date'
  ) as HTMLInputElement | null;
  const openInEmbeddedModeEl = document.getElementById(
    'open_in_embedded_mode'
  ) as HTMLInputElement | null;

  if (allowBlankNameEl) allowBlankNameChecked = allowBlankNameEl.checked;
  if (allowExpiryDateEl) allowExpiryDateChecked = allowExpiryDateEl.checked;
  if (openInEmbeddedModeEl)
    openInEmbeddedModeChecked = openInEmbeddedModeEl.checked;
}

function attachCheckboxListeners(): void {
  const allowBlankNameEl = document.getElementById(
    'allow_blank_name'
  ) as HTMLInputElement | null;
  const allowExpiryDateEl = document.getElementById(
    'allow_expiry_date'
  ) as HTMLInputElement | null;
  const openInEmbeddedModeEl = document.getElementById(
    'open_in_embedded_mode'
  ) as HTMLInputElement | null;

  const handler = () => syncCheckboxStates();

  allowBlankNameEl?.addEventListener('change', handler);
  allowExpiryDateEl?.addEventListener('change', handler);
  openInEmbeddedModeEl?.addEventListener('change', handler);

  // Initialize state once on attach
  syncCheckboxStates();
}

attachCheckboxListeners();

function handleHostedFieldsClick(): void {
  const authParams: AuthParams = captureAuthParams();

  disableCheckboxes();
  disableButtons();

  window.sessionStorage.setItem('authParams', JSON.stringify(authParams));
  window.location.href = '/hostedFields.html';
}

// ------------------------------------------------------------
// Spreedly Web SDK Functions
// ------------------------------------------------------------

function captureAuthParams(): AuthParams {
  const authParams: AuthParams = {
    'env-key':
      (document.getElementById('env-key') as HTMLInputElement)?.value || '',
    nonce: (document.getElementById('nonce') as HTMLInputElement)?.value || '',
    timestamp:
      (document.getElementById('timestamp') as HTMLInputElement)?.value || '',
    signature:
      (document.getElementById('signature') as HTMLInputElement)?.value || '',
    token: (document.getElementById('token') as HTMLInputElement)?.value || '',
  };

  return authParams;
}

function disableCheckboxes(): void {
  const allowBlankNameEl = document.getElementById(
    'allow_blank_name'
  ) as HTMLInputElement | null;
  const allowExpiryDateEl = document.getElementById(
    'allow_expired_date'
  ) as HTMLInputElement | null;
  const twoDigitExpiryEl = document.getElementById(
    'two_digit_expiry'
  ) as HTMLInputElement | null;
  const openInEmbeddedModeEl = document.getElementById(
    'open_in_embedded_mode'
  ) as HTMLInputElement | null;

  if (allowBlankNameEl) allowBlankNameEl.disabled = true;
  if (allowExpiryDateEl) allowExpiryDateEl.disabled = true;
  if (openInEmbeddedModeEl) openInEmbeddedModeEl.disabled = true;
  if (twoDigitExpiryEl) twoDigitExpiryEl.disabled = true;
}

function enableCheckboxes(): void {
  const allowBlankNameEl = document.getElementById(
    'allow_blank_name'
  ) as HTMLInputElement | null;
  const allowExpiryDateEl = document.getElementById(
    'allow_expired_date'
  ) as HTMLInputElement | null;
  const openInEmbeddedModeEl = document.getElementById(
    'open_in_embedded_mode'
  ) as HTMLInputElement | null;

  if (allowBlankNameEl) allowBlankNameEl.disabled = false;
  if (allowExpiryDateEl) allowExpiryDateEl.disabled = false;
  if (openInEmbeddedModeEl) openInEmbeddedModeEl.disabled = false;
}

// ------------------------------------------------------------
// Saved Payment Methods Functions
// ------------------------------------------------------------

function addSavedPaymentMethod(paymentMethod: any): void {
  // Check if already exists
  const exists = savedPaymentMethods.find(pm => pm.token === paymentMethod.token);
  if (exists) return;
  
  // Only save retained payment methods
  if (paymentMethod.storage_state !== 'retained') {
    console.log('Payment method not retained, cannot save for recache');
    return;
  }
  
  // Add new card (limit to 5)
  const newCard: SavedPaymentMethod = {
    token: paymentMethod.token,
    card_type: paymentMethod.card_type,
    last_four_digits: paymentMethod.last_four_digits,
    first_six_digits: paymentMethod.first_six_digits,
    month: paymentMethod.month,
    year: paymentMethod.year,
    full_name: paymentMethod.full_name,
    storage_state: paymentMethod.storage_state,
  };
  
  savedPaymentMethods.unshift(newCard);
  
  // Keep only last 5
  if (savedPaymentMethods.length > MAX_SAVED_CARDS) {
    savedPaymentMethods = savedPaymentMethods.slice(0, MAX_SAVED_CARDS);
  }
  
  renderSavedCards();
}

function renderSavedCards(): void {
  const container = document.getElementById('saved-cards-list');
  const section = document.getElementById('saved-cards-section');
  
  // Hide section if no saved cards
  if (!container || savedPaymentMethods.length === 0) {
    if (section) section.style.display = 'none';
    return;
  }
  
  // Show section
  if (section) section.style.display = 'block';
  
  container.innerHTML = savedPaymentMethods.map((pm) => `
    <div class="saved-card" 
         data-token="${pm.token}"
         onclick="handleUseCardClick('${pm.token}')">
      <div class="saved-card-content">
        <div class="saved-card-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-credit-card-icon lucide-credit-card">
          <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
          </svg>
        </div>
        <div class="saved-card-details">
          <div class="saved-card-type">${pm.card_type.charAt(0).toUpperCase() + pm.card_type.slice(1)}</div>
          <div class="saved-card-number">•••• ${pm.last_four_digits}</div>
          <div class="saved-card-expiry">Expires: ${pm.month}/${pm.year}</div>
        </div>
      </div>
      <div class="saved-card-checkmark">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </div>
    </div>
  `).join('');
  
  // Add "Use this card" button
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'saved-card-button-container';
  buttonContainer.style.display = selectedCardToken ? 'block' : 'none';
  buttonContainer.innerHTML = `
    <button class="saved-card-use-button" onclick="handleUseSelectedCard()">
      Use this card
    </button>
  `;
  container.appendChild(buttonContainer);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handleUseCardClick(token: string): void {
  // Toggle selection
  if (selectedCardToken === token) {
    // Deselect if clicking the same card
    selectedCardToken = null;
  } else {
    // Select the clicked card
    selectedCardToken = token;
  }
  
  // Update visual selection
  document.querySelectorAll('.saved-card').forEach(el => {
    el.classList.remove('saved-card-selected');
  });
  
  if (selectedCardToken) {
    const selectedCard = document.querySelector(`[data-token="${selectedCardToken}"]`);
    if (selectedCard) {
      selectedCard.classList.add('saved-card-selected');
    }
  }
  
  // Show/hide button
  const buttonContainer = document.querySelector('.saved-card-button-container') as HTMLElement;
  if (buttonContainer) {
    buttonContainer.style.display = selectedCardToken ? 'block' : 'none';
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handleUseSelectedCard(): void {
  if (!selectedCardToken) return;
  
  const card = savedPaymentMethods.find(pm => pm.token === selectedCardToken);
  if (!card) return;
  
  console.log('Using saved card:', card);
  
  // Get auth params
  const authParams: AuthParams = captureAuthParams();
  
  if (
    authParams['env-key'] === '' ||
    authParams.nonce === '' ||
    authParams.timestamp === '' ||
    authParams.token === '' ||
    authParams.signature === ''
  ) {
    alert('Please fill all auth fields');
    return;
  }
  
  disableCheckboxes();
  disableButtons();
  
  // Initialize SDK
  const sdkRecache = new SpreedlyWebSDK({
    environment_key: authParams['env-key'],
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.token,
    signature: authParams.signature,
  });
  
  // Set up recache event listeners
  sdkRecache.on('recacheReady', () => {
    // Open express checkout in recache mode
    sdkRecache.expressCheckout({
      className: 'checkout-plugin-recache',
      ...(openInEmbeddedModeChecked
        ? { parentContainerId: 'checkout-plugin-container' }
        : {}),
        uiConfig: {
          textConfig: {
            title: 'Pay with Card',
            submitBtnText: 'Pay',
            processingText: 'Processing...',
          },
          styles: {
            button: {
              backgroundColor: '#000',
              hover: {
                backgroundColor: '#000',
              },
            },
          },
        },
    });
  });
  
  sdkRecache.on('recacheSuccess', (response: any) => {
    const tokenContainer = document.getElementById('token-container-message');
    if (tokenContainer) {
      tokenContainer.textContent = `CVV Recached! Token: ${response.token}`;
    }
    enableCheckboxes();
    enableButtons();
  });
  
  sdkRecache.on('error', (error: any) => {
    console.error('Recache error:', error);
    const tokenContainer = document.getElementById('token-container');
    if (tokenContainer) {
      if (typeof error === 'string') {
        tokenContainer.textContent = `Recache Error: ${error}`;
      } else {
        tokenContainer.textContent = `Recache Error: ${error.message || error.error}`;
      }
    }
    enableCheckboxes();
    enableButtons();
  });
  
  // Set recache mode
  sdkRecache.setRecache(selectedCardToken, {
    payment_method_token: card.token,
    card_type: card.card_type,
    last_four_digits: card.last_four_digits,
    first_six_digits: card.first_six_digits,
    storage_state: card.storage_state,
    month: card.month,
    year: card.year,
    full_name: card.full_name,
  });
}

function disableButtons(): void {
  const expressBtn = document.getElementById(
    'express-btn'
  ) as HTMLButtonElement | null;
  const hostedFieldsBtn = document.getElementById(
    'hosted-fields-btn'
  ) as HTMLButtonElement | null;
  const restartBtn = document.getElementById(
    'restart-btn'
  ) as HTMLButtonElement | null;

  if (expressBtn) expressBtn.disabled = true;
  if (hostedFieldsBtn) hostedFieldsBtn.disabled = true;
  if (restartBtn) restartBtn.disabled = false; // Keep restart button enabled
}

function enableButtons(): void {
  const expressBtn = document.getElementById(
    'express-btn'
  ) as HTMLButtonElement | null;
  const hostedFieldsBtn = document.getElementById(
    'hosted-fields-btn'
  ) as HTMLButtonElement | null;
  const restartBtn = document.getElementById(
    'restart-btn'
  ) as HTMLButtonElement | null;

  if (expressBtn) expressBtn.disabled = false;
  if (hostedFieldsBtn) hostedFieldsBtn.disabled = false;
  if (restartBtn) restartBtn.disabled = false;
}

function handleRestartClick(): void {
  window.location.reload();
}

function handleExpressClick(): void {
  const authParams: AuthParams = captureAuthParams();
  const tokenContainer = document.getElementById('token-container-message');
  if (
    authParams['env-key'] === '' ||
    authParams.nonce === '' ||
    authParams.timestamp === '' ||
    authParams.token === '' ||
    authParams.signature === ''
  ) {
    alert('Please fill all auth fields');
    return;
  }

  disableCheckboxes();
  disableButtons();
  const sdkExpressCheckout = new SpreedlyWebSDK({
    environment_key: authParams['env-key'],
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.token,
    signature: authParams.signature,
  });
  sdkExpressCheckout.on('ready', () => {
    sdkExpressCheckout.setFieldConfig('phone_number', {
      styles: {
        backgroundColor: 'cyan',
      },
    });
  });
  sdkExpressCheckout.on('error', (error: any) => {
    // sdkExpressCheckout.close();
    if (typeof error === 'string') {
      tokenContainer!.textContent = error;
    } else {
      tokenContainer!.textContent = error.error;
    }
  });
  sdkExpressCheckout.on('tokenGenerated', async (token: any) => {
    // sdkExpressCheckout.close();
    tokenContainer!.textContent = `Token: ${token.tokenResponse.payment_method.token}`;
    const paymentMethodToken = token.tokenResponse.payment_method.token;
    tokenContainer!.textContent = `Token: ${paymentMethodToken}`;
    
    // Check if user wants to retain this payment method
    // First check the in-modal checkbox (token.shouldRetain), then fallback to external checkbox
    const retainCheckbox = document.getElementById('retain_payment_method') as HTMLInputElement;
    const shouldRetain = token.shouldRetain ?? retainCheckbox?.checked ?? false;
    
    
    if (shouldRetain) {
      // Call merchant backend to retain the payment method
      try {
        tokenContainer!.textContent = `Token: ${paymentMethodToken} (Retaining...)`;
        
        const retainResponse = await fetch(
          `${window.location.origin}/api/v1/payment_methods/${paymentMethodToken}/retain`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (retainResponse.ok) {
          const retainData = await retainResponse.json();
          const retainedPaymentMethod = retainData.transaction.payment_method;
          
          tokenContainer!.textContent = `Token: ${paymentMethodToken} (Retained ✅)`;
          
          // Add to saved cards list
          addSavedPaymentMethod(retainedPaymentMethod);
        } else {
          tokenContainer!.textContent = `Token: ${paymentMethodToken} (Retain failed ❌)`;
          console.error('Failed to retain payment method:', await retainResponse.text());
        }
      } catch (error) {
        tokenContainer!.textContent = `Token: ${paymentMethodToken} (Retain error ❌)`;
        console.error('Error retaining payment method:', error);
      }
    } else {
      // Payment method is cached (not retained)
      tokenContainer!.textContent = `Token: ${paymentMethodToken}`;
    }
  });
  console.log({
    openInEmbeddedModeChecked,
    allowExpiryDateChecked,
    allowBlankNameChecked,
  });

  sdkExpressCheckout.expressCheckout({
    className:
      (document.getElementById('two_digit_expiry') as HTMLInputElement)
        ?.checked || false
        ? 'checkout-plugin-small'
        : 'checkout-plugin',
    ...(openInEmbeddedModeChecked
      ? { parentContainerId: 'checkout-plugin-container' }
      : {}),
    submitParams: {
      allow_expired_date:
        (document.getElementById('allow_expired_date') as HTMLInputElement)
          ?.checked || false,
      allow_blank_name:
        (document.getElementById('allow_blank_name') as HTMLInputElement)
          ?.checked || false,
    },
    uiConfig: {
      twoDigitExpiry:
        (document.getElementById('two_digit_expiry') as HTMLInputElement)
          ?.checked || false,
      // Show "Save this card" checkbox inside the modal
      // The shouldRetain value will be passed in the tokenGenerated callback
      showSaveCardCheckbox: true,
      saveCardCheckboxLabel: 'Save this card for future payments',
      textConfig: {
        title: 'Pay with Card',
        submitBtnText: 'Pay',
        processingText: 'Processing...',
      },
      styles: {
        button: {
          backgroundColor: '#000',
          hover: {
            backgroundColor: '#000',
          },
          borderColor: 'red',
        },
      },
    },
  });
}

// Initialize on page load
renderSavedCards();
