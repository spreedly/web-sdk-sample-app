/**
 * Stripe Radar Flow - Spreedly Web SDK Demo
 *
 * Demonstrates the end-to-end Stripe Radar fraud-signals integration:
 *   1. Load Stripe.js (in index.html) and the Spreedly SDK.
 *   2. Tokenize the card with Hosted Fields.
 *   3. Call sdk.stripeRadar(publishableKey) -> returns a Radar session id.
 *   4. POST the token + radar session id to the backend.
 *   5. Backend purchases through the Stripe Payment Intents gateway, forwarding
 *      the session via gateway_specific_fields.stripe_payment_intents.radar_session.
 *
 * Stripe then evaluates the charge against Radar (visible in the Stripe Dashboard).
 */

// IMPORTANT: this publishable key MUST belong to the same Stripe account as the
// Spreedly Stripe gateway (STRIPE_GATEWAY_TOKEN_NEW), otherwise Stripe cannot
// correlate the Radar session with the resulting charge. This is the same test
// key used by the Stripe APM demo.
const STRIPE_PUBLISHABLE_KEY =
  'pk_test_51T1N7JDWwvL2jfwiHgQ7xLqMHbLqhyQMLRwGpvHVsEHzKwbE75W4F5VcYNGQSfR9yIsjGdGm5oQnntSeQvW9lvfb00WkyYZctJ';

// State
let sdk = null;
let isReady = false;
let paymentMethodToken = null;
let lastRadarSessionId = null;

const elements = {
  sdkBadge: () => document.getElementById('sdk-badge'),
  loadingState: () => document.getElementById('loading-state'),
  paymentFormSection: () => document.getElementById('payment-form-section'),
  payBtn: () => document.getElementById('pay-btn'),
  statusMessage: () => document.getElementById('status-message'),
  resultSection: () => document.getElementById('result-section'),
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  elements.sdkBadge().textContent = 'Hosted Fields';
  elements.payBtn().addEventListener('click', handlePay);

  try {
    await loadAndInitializeSDK();
  } catch (error) {
    console.error('Failed to initialize SDK:', error);
    showStatus('Failed to initialize SDK. Please refresh the page.', 'error');
  }
}

async function loadAndInitializeSDK() {
  await new Promise((resolve, reject) => {
    SpreedlyUtils.loadSDKScript((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

  const authParams = await SpreedlyUtils.fetchAuthParams();

  sdk = new SpreedlyHostedFields({
    environment_key: authParams.environmentKey,
    nonce: authParams.nonce,
    timestamp: authParams.timestamp,
    certificate_token: authParams.certificateToken,
    signature: authParams.signature,
  });

  // Guard: the rc CDN build may not include stripeRadar yet. Run the local SDK
  // build (npm run dev in checkout-web-sdk) until the method ships to rc.
  if (typeof sdk.stripeRadar !== 'function') {
    elements.loadingState().classList.add('hidden');
    elements.paymentFormSection().classList.remove('hidden');
    elements.payBtn().disabled = true;
    showStatus(
      'This SDK build does not expose sdk.stripeRadar(). Point the sample app at a local SDK build that includes it.',
      'error'
    );
    return;
  }

  sdk.on('ready', () => {
    isReady = true;
    elements.loadingState().classList.add('hidden');
    elements.paymentFormSection().classList.remove('hidden');
    elements.payBtn().disabled = false;
    console.log('Hosted Fields ready');
  });

  sdk.on('tokenGenerated', (response) => {
    const token = response?.tokenResponse?.payment_method?.token;
    if (token) {
      paymentMethodToken = token;
      console.log('Payment method token received:', token);
      processRadarPurchase();
    } else {
      console.error('Token not found in response:', response);
      showStatus('Failed to generate payment token', 'error');
      setPayLoading(false);
    }
  });

  sdk.on('error', (error) => {
    console.error('SDK error:', error);
    showStatus(error.message || 'An error occurred', 'error');
    setPayLoading(false);
  });

  sdk.inAppElements({
    number: { containerId: 'card-number-field' },
    cvv: { containerId: 'cvv-field' },
  });
}

function handlePay() {
  if (!sdk || !isReady) {
    showStatus('SDK not ready. Please wait for the form to load.', 'error');
    return;
  }

  const firstName = document.getElementById('first_name')?.value?.trim() || '';
  const lastName = document.getElementById('last_name')?.value?.trim() || '';
  const month = document.getElementById('month')?.value?.trim() || '';
  const year = document.getElementById('year')?.value?.trim() || '';

  if (!firstName || !lastName || !month || !year) {
    showStatus('Please fill in all required fields', 'error');
    return;
  }

  hideStatus();
  setPayLoading(true);

  // Tokenize first; the Radar session is created in processRadarPurchase()
  // once we have a token, right before the purchase.
  sdk.submit({
    first_name: firstName,
    last_name: lastName,
    month: month,
    year: year,
  });
}

async function processRadarPurchase() {
  try {
    // 1. Create the Stripe Radar session. Returns null if Stripe.js is missing
    //    or session creation fails — we degrade gracefully and still charge.
    showStatus('Creating Stripe Radar session...', 'info');
    lastRadarSessionId = await sdk.stripeRadar(STRIPE_PUBLISHABLE_KEY);

    if (lastRadarSessionId) {
      console.log('Radar session id:', lastRadarSessionId);
      showStatus('Radar session created. Processing payment...', 'info');
    } else {
      console.warn('Radar session could not be created; charging without it.');
      showStatus('Could not create a Radar session — charging without it...', 'info');
    }

    // 2. Purchase through the Stripe gateway, forwarding the radar session id.
    const amountValue = parseFloat(document.getElementById('amount')?.value || '0');
    const amount = Math.round(amountValue * 100); // minor units (cents)

    const data = await SpreedlyUtils.createStripeRadarPurchase(
      paymentMethodToken,
      amount,
      lastRadarSessionId,
      'USD'
    );

    if (data.success || data.transaction?.succeeded) {
      showResult('success', data);
    } else {
      showResult('error', data);
    }
  } catch (error) {
    console.error('Radar purchase failed:', error);
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Purchase failed';
    showResult('error', { message });
  } finally {
    setPayLoading(false);
  }
}

function showResult(type, data) {
  const esc = SpreedlyUtils.escapeHtml;
  const container = elements.resultSection();
  elements.paymentFormSection().classList.add('hidden');
  container.classList.remove('hidden');

  const radarRow = `
    <div class="result-detail-row">
      <span class="result-detail-label">Radar Session</span>
      <span class="result-detail-value" style="font-family: var(--font-mono, monospace);">
        ${lastRadarSessionId ? esc(lastRadarSessionId) : 'Not created'}
      </span>
    </div>
    <div class="result-detail-row">
      <span class="result-detail-label">Forwarded to Stripe</span>
      <span class="result-detail-value">${data.radar_session_forwarded ? 'Yes' : 'No'}</span>
    </div>`;

  if (type === 'success') {
    const tx = data.transaction || {};
    container.innerHTML = `
      <div class="card" style="text-align: center;">
        <div class="result-icon success">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h2 class="result-title" style="color: var(--color-success);">Payment Successful!</h2>
        <p class="result-message">Charged through the Stripe Payment Intents gateway.</p>
        <div class="result-details" style="text-align: left;">
          <div class="result-detail-row">
            <span class="result-detail-label">Transaction ID</span>
            <span class="result-detail-value">${esc(tx.token || 'N/A')}</span>
          </div>
          <div class="result-detail-row">
            <span class="result-detail-label">State</span>
            <span class="result-detail-value" style="color: var(--color-success);">${esc(tx.state || 'N/A')}</span>
          </div>
          ${radarRow}
        </div>
        <button class="btn btn-primary mt-4" onclick="window.location.reload()">Make Another Purchase</button>
      </div>`;
  } else {
    const errorMessage =
      data?.message || data?.error || 'An error occurred during payment processing.';
    container.innerHTML = `
      <div class="card" style="text-align: center;">
        <div class="result-icon error">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 class="result-title" style="color: var(--color-error);">Payment Failed</h2>
        <p class="result-message">${esc(errorMessage)}</p>
        <div class="result-details" style="text-align: left;">
          ${radarRow}
        </div>
        <button class="btn btn-primary mt-4" onclick="window.location.reload()">Try Again</button>
      </div>`;
  }
}

// UI Helpers
function setPayLoading(loading) {
  SpreedlyUtils.setButtonLoading('pay-btn', loading, 'Processing...');
}

function showStatus(message, type = 'info') {
  const statusEl = elements.statusMessage();
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = `status-message visible ${type}`;
}

function hideStatus() {
  const statusEl = elements.statusMessage();
  if (!statusEl) return;
  statusEl.className = 'status-message';
}
