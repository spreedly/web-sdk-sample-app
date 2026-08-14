/**
 * Paze Digital Wallet Demo
 * Uses SpreedlyPaze standalone class with merchant-loaded Paze SDK script
 */

const PAZE_CLIENT_CONFIG = {
  id: 'Q8U2W6W9EYCO205KT5LO13iO4a4w6J-fjAjd51d2qYk96jx2M',
  name: 'Spreedly',
  profileId: 'Spreedly',
};

const TRANSACTION_VALUE = {
  transactionAmount: '10.00',
  transactionCurrencyCode: 'USD',
};

let pazeInstance = null;
let lastCheckoutData = null;
let walletEligible = false;
let payButtonLocked = false;

const elements = {};

/** Initializes DOM element references */
function initElements() {
  elements.loadingState = document.getElementById('loading-state');
  elements.paymentSection = document.getElementById('payment-section');
  elements.errorState = document.getElementById('error-state');
  elements.errorMessage = document.getElementById('error-message');
  elements.pazeEmail = document.getElementById('paze-email');
  elements.pazeButtonMode = document.getElementById('paze-button-mode');
  elements.pazeIntent = document.getElementById('paze-intent');
  elements.pazeRetainPm = document.getElementById('paze-retain-pm');
  elements.pazeBtnColor = document.getElementById('paze-btn-color');
  elements.pazeBtnShape = document.getElementById('paze-btn-shape');
  elements.pazeBtnDisableMaxHeight = document.getElementById('paze-btn-disable-max-height');
  elements.reviewPanel = document.getElementById('review-panel');
  elements.payBtn = document.getElementById('paze-pay-btn');
  elements.pazeButton = document.querySelector('paze-button');
  elements.completeBtn = document.getElementById('paze-complete-btn');
  elements.resetBtn = document.getElementById('paze-reset-btn');
  elements.resultCard = document.getElementById('result-card');
  elements.resultTitle = document.getElementById('result-title');
  elements.resultMessage = document.getElementById('result-message');
  elements.statusMessage = document.getElementById('status-message');
}

/** Returns the demo Paze clientConfig */
function getPazeClientConfig() {
  return PAZE_CLIENT_CONFIG;
}

/** Returns whether dynamic button mode is enabled */
function isDynamicButtonMode() {
  return elements.pazeButtonMode?.value === 'dynamic';
}

/** Returns whether express checkout intent is selected */
function isExpressFlow() {
  return elements.pazeIntent?.value === 'EXPRESS_CHECKOUT';
}

/** Returns whether payment method retention is enabled */
function isRetainPaymentMethod() {
  return elements.pazeRetainPm?.checked === true;
}

/** Normalizes a Paze lookup email per RFC 5322 lowercase requirement */
function normalizePazeEmail(email) {
  return email?.trim().toLowerCase() || '';
}

/** Returns wallet eligibility from a canCheckout response */
function isWalletEligible(result) {
  return Boolean(result?.consumerPresent);
}

/** Checks wallet eligibility and updates dynamic button visibility */
async function checkWalletEligibility(email, { showStatus = true } = {}) {
  const normalizedEmail = normalizePazeEmail(email);
  if (!normalizedEmail || !pazeInstance?.isInitialized?.()) {
    return false;
  }

  if (showStatus) {
    setStatus('Checking Paze eligibility...', 'info');
  }

  const result = await pazeInstance.canCheckout(normalizedEmail);
  walletEligible = isWalletEligible(result);

  updatePayButtonVisibility();

  if (!showStatus) {
    return walletEligible;
  }

  if (isDynamicButtonMode()) {
    setStatus(
      walletEligible
        ? 'Paze wallet found — the Paze button is available.'
        : 'No Paze wallet detected for this email.',
      walletEligible ? 'success' : 'info'
    );
    return walletEligible;
  }

  setStatus(
    walletEligible
      ? 'Paze wallet found for this email.'
      : 'No Paze wallet detected — you can still try the Paze button.',
    walletEligible ? 'success' : 'info'
  );
  return walletEligible;
}

/** Shows a fatal initialization error */
function showError(message) {
  elements.loadingState?.classList.add('hidden');
  elements.paymentSection?.classList.add('hidden');
  elements.errorState?.classList.remove('hidden');
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message;
  }
}

/** Shows the payment section after successful init */
function showPaymentSection() {
  elements.loadingState?.classList.add('hidden');
  elements.errorState?.classList.add('hidden');
  elements.paymentSection?.classList.remove('hidden');
}

/** Updates inline status message */
function setStatus(message, type = 'info') {
  if (!elements.statusMessage) return;
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message visible ${type}`;
}

/** Shows success or error result card */
function showResult(isSuccess, title, message) {
  elements.resultCard?.classList.remove('hidden', 'success', 'error');
  elements.resultCard?.classList.add(isSuccess ? 'success' : 'error');
  if (elements.resultTitle) elements.resultTitle.textContent = title;
  if (elements.resultMessage) elements.resultMessage.textContent = message;
}

/** Returns the demo transaction amount and currency */
function getTransactionValue() {
  return TRANSACTION_VALUE;
}

/** Builds optional shipping address fields from checkout data for Spreedly API */
function buildShippingAddress(checkoutData) {
  const shipping = checkoutData?.shippingAddress;
  if (!shipping?.line1) {
    return undefined;
  }

  return {
    shipping_address1: shipping.line1,
    shipping_city: shipping.city,
    shipping_country: shipping.countryCode,
    shipping_state: shipping.state,
    shipping_zip: shipping.zip,
  };
}

/** Enables or disables the branded Paze button wrapper */
function setPayButtonLocked(locked) {
  payButtonLocked = locked;
  applyPayButtonDisabledState();
}

/** Applies disabled styling from lock state and dynamic eligibility */
function applyPayButtonDisabledState() {
  const disabled = payButtonLocked || (isDynamicButtonMode() && !walletEligible);
  elements.payBtn?.classList.toggle('disabled', disabled);
}

/** Shows the reset button after checkout finishes */
function showResetButton() {
  elements.resetBtn?.classList.remove('hidden');
}

/** Reloads the demo page */
function handleReset() {
  window.location.reload();
}

/** Shows or hides the Paze button based on button display mode and eligibility */
function updatePayButtonVisibility() {
  if (!elements.payBtn) return;

  if (isDynamicButtonMode()) {
    elements.payBtn.classList.toggle('hidden', !walletEligible);
    applyPayButtonDisabledState();
    return;
  }

  elements.payBtn.classList.remove('hidden');
  applyPayButtonDisabledState();
}

/** Loads Spreedly SDK and verifies SpreedlyPaze is available */
async function loadSpreedlySDK() {
  await new Promise((resolve, reject) => {
    SpreedlyUtils.loadSDKScript(error => (error ? reject(error) : resolve()));
  });

  if (typeof window.SpreedlyPaze === 'undefined') {
    throw new Error('SpreedlyPaze is not available. Ensure the Spreedly SDK bundle is loaded.');
  }
}

/** Registers Paze event handlers on the instance */
function registerPazeEventHandlers() {
  pazeInstance.on('pazeReady', () => {
    setStatus('Paze is ready. Enter your email to check eligibility.', 'success');
    updatePayButtonVisibility();
  });

  pazeInstance.on('pazeCheckoutComplete', async data => {
    lastCheckoutData = data;
    showReviewPanel(data);

    if (isExpressFlow()) {
      setStatus('Express checkout complete. Creating payment method automatically...', 'info');
      await handleCompletePayment();
      return;
    }

    elements.completeBtn?.classList.remove('hidden');
    setStatus('Card selected. Review details and click Complete Payment.', 'success');
  });

  pazeInstance.on('pazeTokenGenerated', async data => {
    elements.completeBtn?.classList.add('hidden');

    await createPaymentMethodFromSecuredPayload(data);
  });

  pazeInstance.on('pazeError', error => {
    elements.completeBtn.disabled = false;
    setStatus(`${error.code}: ${error.message}`, 'error');

    const checkoutEnded = error.code === 'COMPLETE_FAILED' || error.code === 'NO_SECURED_PAYLOAD';
    if (checkoutEnded) {
      showResetButton();
      return;
    }

    setPayButtonLocked(false);
  });
}

/** Shows masked card review panel with change card/address actions */
function showReviewPanel(data) {
  const card = data.maskedCard || {};
  const consumer = data.consumer || {};
  const shipping = data.shippingAddress || {};
  elements.reviewPanel?.classList.remove('hidden');

  if (!elements.reviewPanel) return;

  elements.reviewPanel.innerHTML = `
    <p><strong>Card:</strong> ${card.paymentCardBrand || 'N/A'} ****${card.panLastFour || '????'}</p>
    <p><strong>Expires:</strong> ${card.panExpirationMonth || '??'}/${card.panExpirationYear || '????'}</p>
    <p><strong>Name:</strong> ${consumer.fullName || `${consumer.firstName || ''} ${consumer.lastName || ''}`.trim() || 'N/A'}</p>
    <p><strong>Email:</strong> ${consumer.emailAddress || 'N/A'}</p>
    ${shipping.line1 ? `<p><strong>Shipping:</strong> ${shipping.line1}, ${shipping.city || ''} ${shipping.state || ''} ${shipping.zip || ''}</p>` : ''}
    <div class="review-actions">
      <button type="button" id="paze-change-card-btn">Change Card</button>
      <button type="button" id="paze-change-shipping-btn">Change Shipping Address</button>
    </div>
  `;

  document.getElementById('paze-change-card-btn')?.addEventListener('click', handleChangeCard);
  document.getElementById('paze-change-shipping-btn')?.addEventListener('click', handleChangeShippingAddress);
}

/** Checks wallet eligibility on email blur and updates dynamic button visibility */
async function handleEmailBlur() {
  const email = normalizePazeEmail(elements.pazeEmail?.value);
  if (!email || !pazeInstance) return;

  try {
    await checkWalletEligibility(email);
  } catch (error) {
    setStatus(error.message || 'Eligibility check failed', 'error');
  }
}

/** Handles branded Paze button click */
async function handlePayWithPaze() {
  if (!pazeInstance) return;

  const email = normalizePazeEmail(elements.pazeEmail?.value);
  if (!email) {
    setStatus('Please enter an email address.', 'warn');
    return;
  }

  setPayButtonLocked(true);
  elements.completeBtn?.classList.add('hidden');
  elements.resetBtn?.classList.add('hidden');
  elements.reviewPanel?.classList.add('hidden');
  elements.resultCard?.classList.add('hidden');
  lastCheckoutData = null;

  try {
    setStatus('Opening Paze checkout...', 'info');

    const options = {
      emailAddress: email,
      transactionValue: getTransactionValue(),
    };
    const intent = elements.pazeIntent?.value;
    if (intent) {
      options.intent = intent;
    }

    await pazeInstance.checkout(options);
  } catch (error) {
    setStatus(error.message || 'Checkout failed', 'error');
    setPayButtonLocked(false);
  }
}

/** Reopens Paze checkout to change the selected card */
async function handleChangeCard() {
  if (!pazeInstance) return;

  elements.completeBtn?.classList.add('hidden');
  setStatus('Reopening Paze to change card...', 'info');

  await pazeInstance.checkout({
    actionCode: 'CHANGE_CARD',
    transactionValue: getTransactionValue(),
  });
}

/** Reopens Paze checkout to change the shipping address */
async function handleChangeShippingAddress() {
  if (!pazeInstance) return;

  elements.completeBtn?.classList.add('hidden');
  setStatus('Reopening Paze to change shipping address...', 'info');

  await pazeInstance.checkout({
    actionCode: 'CHANGE_SHIPPING_ADDRESS',
    transactionValue: getTransactionValue(),
  });
}

/** Handles Complete Payment button click */
async function handleCompletePayment() {
  if (!pazeInstance) return;

  elements.completeBtn.disabled = true;
  setStatus('Completing Paze flow...', 'info');

  const completeOptions = {
    transactionType: 'PURCHASE',
    transactionValue: getTransactionValue(),
  };

  await pazeInstance.complete(completeOptions);
}

/** Creates a Spreedly payment method from the Paze securedPayload */
async function createPaymentMethodFromSecuredPayload(completeData) {
  setStatus('Creating Paze payment method on server...', 'info');

  try {
    const shippingAddress = buildShippingAddress(lastCheckoutData);
    const retain = isRetainPaymentMethod();

    const pmRequest = {
      payloadId: completeData.payloadId,
      provisionNetworkToken: retain,
      retained: retain,
      securedPayload: completeData.securedPayload,
      sessionId: completeData.sessionId,
      shippingAddress,
    };

    const pmResult = await SpreedlyUtils.createPazePaymentMethod(pmRequest);

    const paymentMethodToken = pmResult.payment_method_token;
    if (!paymentMethodToken) {
      throw new Error('Payment method token was not returned from server.');
    }

    showResult(
      true,
      'Payment Method Created',
      `Payment method token: ${paymentMethodToken}`
    );
    setStatus('Payment method created successfully.', 'success');
    showResetButton();
  } catch (error) {
    showResult(false, 'Payment Method Failed', error.message || JSON.stringify(error));
    setStatus('Payment method creation failed.', 'error');
    elements.completeBtn.disabled = false;
    showResetButton();
  }
}

/** Handles button display mode changes */
function handleButtonModeChange() {
  walletEligible = false;
  updatePayButtonVisibility();
  const email = elements.pazeEmail?.value?.trim();
  if (email && isDynamicButtonMode()) {
    handleEmailBlur();
  }
}

/** Binds click and error handlers on the branded Paze button */
function bindPazeButton() {
  if (!elements.pazeButton) return;

  elements.pazeButton.addEventListener('click', handlePayWithPaze);
  elements.pazeButton._onError = error => {
    setStatus(error?.message || 'Paze button error', 'error');
    setPayButtonLocked(false);
  };
}

/** Applies color, shape, and max-height attributes from the demo controls */
function applyPazeButtonCustomization() {
  const wrap = elements.payBtn;
  if (!wrap) return;

  const color = elements.pazeBtnColor?.value || 'pazeblue';
  const shape = elements.pazeBtnShape?.value || 'default';
  const disableMaxHeight = elements.pazeBtnDisableMaxHeight?.checked === true;

  wrap.classList.toggle('tall', disableMaxHeight);

  const next = document.createElement('paze-button');
  next.setAttribute('color', color);
  next.setAttribute('shape', shape);
  if (disableMaxHeight) {
    next.setAttribute('disableMaxHeight', '');
  }

  wrap.replaceChildren(next);
  elements.pazeButton = next;
  bindPazeButton();
  applyPayButtonDisabledState();
}

/** Main initialization */
async function init() {
  initElements();

  elements.pazeEmail?.addEventListener('blur', handleEmailBlur);
  elements.pazeButtonMode?.addEventListener('change', handleButtonModeChange);
  elements.pazeBtnColor?.addEventListener('change', applyPazeButtonCustomization);
  elements.pazeBtnShape?.addEventListener('change', applyPazeButtonCustomization);
  elements.pazeBtnDisableMaxHeight?.addEventListener('change', applyPazeButtonCustomization);
  applyPazeButtonCustomization();
  elements.completeBtn?.addEventListener('click', handleCompletePayment);
  elements.resetBtn?.addEventListener('click', handleReset);

  try {
    await loadSpreedlySDK();

    const clientConfig = getPazeClientConfig();
    pazeInstance = new window.SpreedlyPaze({
      clientConfig,
      environment: 'sandbox',
    });

    registerPazeEventHandlers();

    const result = await pazeInstance.setup();
    if (result.error) {
      throw new Error(result.error);
    }

    showPaymentSection();
    updatePayButtonVisibility();
    setStatus('Ready to create Paze payment methods.', 'success');

    const prefilledEmail = normalizePazeEmail(elements.pazeEmail?.value);
    if (prefilledEmail) {
      await checkWalletEligibility(prefilledEmail, { showStatus: false });
    }
  } catch (error) {
    showError(error.message || 'Failed to initialize Paze demo.');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.addEventListener('beforeunload', () => {
  if (pazeInstance) {
    pazeInstance.destroy();
  }
});
