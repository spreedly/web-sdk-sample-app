/**
 * Paze Digital Wallet Demo
 * Uses SpreedlyPaze standalone class with merchant-loaded Paze SDK script.
 *
 * The <paze-button> is created by the SDK: this page supplies an empty
 * #paze-button-container and calls mount(). It never builds the button itself and never calls
 * checkout() to start a flow — the SDK owns that so it can count button impressions.
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

const BUTTON_CONTAINER_ID = 'paze-button-container';

let pazeInstance = null;
let lastCheckoutData = null;
let environmentKey = '';
let checkoutInFlight = false;

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
  elements.buttonContainer = document.getElementById(BUTTON_CONTAINER_ID);
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

/** Returns the selected SDK display mode. Named distinctly from SpreedlyUtils.getDisplayMode. */
function getPazeDisplayMode() {
  return elements.pazeButtonMode?.value === 'dynamic' ? 'dynamic' : 'static';
}

/** Returns the <paze-button> presentation attributes from the demo controls */
function getButtonStyle() {
  return {
    color: elements.pazeBtnColor?.value || 'pazeblue',
    disableMaxHeight: elements.pazeBtnDisableMaxHeight?.checked === true,
    shape: elements.pazeBtnShape?.value || 'default',
  };
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

/** Returns the current email from the form */
function getEmail() {
  return normalizePazeEmail(elements.pazeEmail?.value);
}

/**
 * Builds the checkout call for each button click. The SDK calls this synchronously on click,
 * so it must not await anything — doing so would spend the click's user activation and Paze's
 * popup would be blocked.
 */
function getCheckoutOptions() {
  const options = {
    emailAddress: getEmail(),
    transactionValue: TRANSACTION_VALUE,
  };

  const intent = elements.pazeIntent?.value;
  if (intent) {
    options.intent = intent;
  }

  return options;
}

/** Checks wallet eligibility; in dynamic mode this is what reveals the SDK's button */
async function checkWalletEligibility(email, { showStatus = true } = {}) {
  const normalizedEmail = normalizePazeEmail(email);
  if (!normalizedEmail || !pazeInstance?.isInitialized?.()) {
    return false;
  }

  if (showStatus) {
    setStatus('Checking Paze eligibility...', 'info');
  }

  const { consumerPresent } = await pazeInstance.canCheckout(normalizedEmail);

  if (!showStatus) {
    return consumerPresent;
  }

  if (getPazeDisplayMode() === 'dynamic') {
    setStatus(
      consumerPresent
        ? 'Paze wallet found — the Paze button is available.'
        : 'No Paze wallet detected for this email.',
      consumerPresent ? 'success' : 'info'
    );
    return consumerPresent;
  }

  setStatus(
    consumerPresent
      ? 'Paze wallet found for this email.'
      : 'No Paze wallet detected — you can still try the Paze button.',
    consumerPresent ? 'success' : 'info'
  );
  return consumerPresent;
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

/**
 * Blocks clicks on the SDK's button while a checkout is running or the email is empty.
 * Visibility itself is the SDK's job — this only covers demo preconditions.
 */
function updateButtonInteractivity() {
  const blocked = checkoutInFlight || !getEmail();
  elements.buttonContainer?.classList.toggle('busy', blocked);
}

/** Shows the reset button after checkout finishes */
function showResetButton() {
  elements.resetBtn?.classList.remove('hidden');
}

/** Reloads the demo page */
function handleReset() {
  window.location.reload();
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
  });

  // The SDK only ever toggles display on the <paze-button> element it creates. In dynamic
  // mode that leaves this page's own wrapper (margin, min-height) visible as an empty box
  // whenever the button is hidden, so mirror the SDK's pass/fail result onto the container
  // itself rather than relying on the SDK to manage layout it doesn't own.
  pazeInstance.on('pazeEligibilityChecked', ({ eligible }) => {
    if (getPazeDisplayMode() !== 'dynamic') {
      return;
    }
    elements.buttonContainer?.classList.toggle('hidden', !eligible);
  });

  pazeInstance.on('pazeButtonClicked', handlePazeButtonClick);

  pazeInstance.on('pazeCheckoutComplete', async data => {
    checkoutInFlight = false;
    updateButtonInteractivity();
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

    checkoutInFlight = false;
    updateButtonInteractivity();
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

/** Checks wallet eligibility on email blur; in dynamic mode this reveals the SDK's button */
async function handleEmailBlur() {
  updateButtonInteractivity();

  const email = getEmail();
  if (!email || !pazeInstance) return;

  try {
    await checkWalletEligibility(email);
  } catch (error) {
    setStatus(error.message || 'Eligibility check failed', 'error');
  }
}

/** Resets the demo panels when the SDK reports the shopper pressed the mounted Paze button */
function handlePazeButtonClick() {
  checkoutInFlight = true;
  updateButtonInteractivity();

  elements.completeBtn?.classList.add('hidden');
  elements.resetBtn?.classList.add('hidden');
  elements.reviewPanel?.classList.add('hidden');
  elements.resultCard?.classList.add('hidden');
  lastCheckoutData = null;

  setStatus('Opening Paze checkout...', 'info');
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

/**
 * Creates the SpreedlyPaze instance, sets it up, and mounts the SDK-owned button.
 *
 * `displayMode` and `buttonStyle` are constructor config read once at mount(), so the demo's
 * display/color/shape controls rebuild the instance rather than editing the button in place.
 */
async function createAndMountPaze() {
  pazeInstance = new window.SpreedlyPaze({
    buttonStyle: getButtonStyle(),
    clientConfig: getPazeClientConfig(),
    displayMode: getPazeDisplayMode(),
    environment: 'sandbox',
    environmentKey,
    getCheckoutOptions,
    paymentElements: { paze: BUTTON_CONTAINER_ID },
  });

  registerPazeEventHandlers();

  const setupResult = await pazeInstance.setup();
  if (setupResult.error) {
    throw new Error(setupResult.error);
  }

  const mountResult = await pazeInstance.mount();
  if (mountResult.error) {
    throw new Error(mountResult.error);
  }

  // Dynamic mode mounts the button hidden until the first eligibility check; keep our own
  // container hidden too so there's no empty box before that check resolves.
  elements.buttonContainer?.classList.toggle('hidden', getPazeDisplayMode() === 'dynamic');
  elements.buttonContainer?.classList.toggle(
    'tall',
    elements.pazeBtnDisableMaxHeight?.checked === true
  );
  updateButtonInteractivity();
}

/** Rebuilds the Paze instance so new display mode / button style take effect */
async function rebuildPazeInstance() {
  if (!pazeInstance) return;

  pazeInstance.destroy();
  pazeInstance = null;
  checkoutInFlight = false;

  try {
    await createAndMountPaze();

    const email = getEmail();
    if (email) {
      await checkWalletEligibility(email, { showStatus: false });
    }
    setStatus('Paze button updated.', 'success');
  } catch (error) {
    setStatus(error.message || 'Failed to remount the Paze button.', 'error');
  }
}

/** Main initialization */
async function init() {
  initElements();

  elements.pazeEmail?.addEventListener('blur', handleEmailBlur);
  elements.pazeEmail?.addEventListener('input', updateButtonInteractivity);
  elements.pazeButtonMode?.addEventListener('change', rebuildPazeInstance);
  elements.pazeBtnColor?.addEventListener('change', rebuildPazeInstance);
  elements.pazeBtnShape?.addEventListener('change', rebuildPazeInstance);
  elements.pazeBtnDisableMaxHeight?.addEventListener('change', rebuildPazeInstance);
  elements.completeBtn?.addEventListener('click', handleCompletePayment);
  elements.resetBtn?.addEventListener('click', handleReset);

  try {
    await loadSpreedlySDK();

    // Optional but recommended by the SDK. Not worth failing the demo over, so a
    // lookup failure just leaves the key empty.
    try {
      const authParams = await SpreedlyUtils.fetchAuthParams();
      environmentKey = authParams?.environmentKey || '';
    } catch (authError) {
      console.warn('Could not load the environment key:', authError.message);
    }

    showPaymentSection();
    await createAndMountPaze();
    setStatus('Ready to create Paze payment methods.', 'success');

    const prefilledEmail = getEmail();
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
