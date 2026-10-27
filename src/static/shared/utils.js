const LOCAL_API_URL = 'http://localhost:3000/api/v1';

// Each Heroku app calls its own API. Local pages call the sample app on localhost.
const API_BASE_URL =
  window.location.hostname === 'localhost' ? LOCAL_API_URL : `${window.location.origin}/api/v1`;

function getRedirectOrigin() {
  if (window.location.hostname === 'localhost') return '';
  return window.location.origin;
}

// Production CDN origin. The server rewrites this line from the SDK_BASE_URL env var
// before the browser receives this file. Do not rename it; app.ts matches this line.
const SDK_SCRIPT_ORIGIN = 'https://core.spreedly.com';

// SDK URL Helpers
function getSDKType() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('sdk') || 'hosted-fields';
}

function getSDKScriptUrl(sdkType = getSDKType()) {
  // A page opened on localhost loads the SDK dev servers. Deployed pages load the CDN.
  if (window.location.hostname === 'localhost') {
    if (sdkType === 'express-checkout') {
      return 'http://localhost:5173/express-checkout.js';
    }
    return 'http://localhost:5000/index.js';
  }

  if (sdkType === 'express-checkout') {
    return `${SDK_SCRIPT_ORIGIN}/checkout/elements/rc/express-checkout.js`;
  }
  return `${SDK_SCRIPT_ORIGIN}/checkout/sdk/rc/index.js`;
}

function getSDKDisplayName() {
  const sdkType = getSDKType();
  return sdkType === 'express-checkout' ? 'Express Checkout' : 'Hosted Fields';
}

function getDisplayMode() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('mode') || 'embedded';
}

async function fetchAuthParams() {
  try {
    const [response] = await Promise.all([axios.get(`${API_BASE_URL}/auth/params`), ownerTagReady]);
    const authParams = response.data;
    return authParams;
  } catch (error) {
    console.error('Error fetching auth params:', error);
    throw new Error('Failed to fetch authentication parameters');
  }
}

// Payment Methods
// Saved cards live in this visitor's browser, never in a shared server list. Each visitor sees
// only the cards they retained on this site. A real merchant would keep them on the customer's
// account in their own database instead.
const SAVED_CARDS_KEY = 'spreedlySampleApp.savedPaymentMethods';
const MAX_SAVED_CARDS = 20;

// Only the fields the saved-card lists display.
const SAVED_CARD_FIELDS = [
  'token',
  'payment_method_type',
  'storage_state',
  'card_type',
  'first_six_digits',
  'last_four_digits',
  'month',
  'year',
  'first_name',
  'last_name',
  'full_name',
  'created_at',
];

function readSavedPaymentMethods() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_CARDS_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function rememberPaymentMethod(paymentMethod) {
  if (!paymentMethod?.token) return;
  const entry = {};
  for (const field of SAVED_CARD_FIELDS) {
    if (paymentMethod[field] !== undefined) entry[field] = paymentMethod[field];
  }
  const others = readSavedPaymentMethods().filter(pm => pm.token !== entry.token);
  try {
    localStorage.setItem(SAVED_CARDS_KEY, JSON.stringify([entry, ...others].slice(0, MAX_SAVED_CARDS)));
  } catch {
    // Storage blocked (private window, full quota): the card is retained but not listed.
  }
}

// Retain only works for the browser that created the card. Each tab keeps a random secret, sends
// its SHA-256 as tokenization metadata, and sends the secret itself to the retain route. The
// server reads the payment method's metadata from Core and retains only on a match.
const OWNER_SECRET_KEY = 'spreedlySampleApp.ownerSecret';
const OWNER_METADATA_KEY = 'sample_app_owner';

function readOwnerSecret() {
  try {
    const stored = sessionStorage.getItem(OWNER_SECRET_KEY);
    if (stored) return stored;
    const secret = crypto.randomUUID();
    sessionStorage.setItem(OWNER_SECRET_KEY, secret);
    return secret;
  } catch {
    // Storage blocked: the secret lasts until the page is reloaded.
    return crypto.randomUUID();
  }
}

const ownerSecret = readOwnerSecret();
let ownerTag = '';
const ownerTagReady = crypto.subtle
  .digest('SHA-256', new TextEncoder().encode(ownerSecret))
  .then(digest => {
    ownerTag = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  });

// Spread into every tokenization's metadata. Ready once fetchAuthParams() has resolved.
function ownerMetadata() {
  return { [OWNER_METADATA_KEY]: ownerTag };
}

async function fetchPaymentMethods() {
  // Newest first, credit cards only, as the server list used to return.
  return readSavedPaymentMethods().filter(pm => pm.payment_method_type === 'credit_card');
}

async function retainPaymentMethod(paymentMethodToken) {
  try {
    const response = await axios.put(`${API_BASE_URL}/payment_methods/${paymentMethodToken}/retain`, {
      owner_secret: ownerSecret,
    });
    rememberPaymentMethod(response.data?.transaction?.payment_method);
    return response.data;
  } catch (error) {
    console.error('Error retaining payment method:', error);
    throw error;
  }
}

// API Calls
async function createPurchase(paymentMethodToken, amount, currencyCode = 'USD') {
  try {
    const response = await axios.post(`${API_BASE_URL}/simple-purchase`, {
      payment_method_token: paymentMethodToken,
      amount: amount,
      currency_code: currencyCode,
    });
    return response.data;
  } catch (error) {
    console.error('Error creating purchase:', error);
    throw error;
  }
}

async function createPurchaseWith3DS(paymentMethodToken, amount, browserInfo, currencyCode = 'USD', scaOptions = {}) {
  try {
    const response = await axios.post(`${API_BASE_URL}/create-purchase-with-3ds`, {
      payment_method_token: paymentMethodToken,
      amount: amount,
      currency_code: currencyCode,
      browser_info: browserInfo,
      sca_provider_type: scaOptions.providerType,
      test_scenario: scaOptions.scenario,
    });
    return response.data;
  } catch (error) {
    console.error('Error creating 3DS purchase:', error.response?.data ? error.response?.data : error);
    throw error.response?.data ? error.response?.data : error;
  }
}

/** Creates a Paze payment method from securedPayload via third_party_network_token */
async function createPazePaymentMethod({
  payloadId,
  provisionNetworkToken,
  retained,
  securedPayload,
  sessionId,
  shippingAddress,
}) {
  try {
    const response = await axios.post(`${API_BASE_URL}/paze-payment-method`, {
      payloadId,
      provisionNetworkToken,
      retained,
      securedPayload,
      sessionId,
      shippingAddress,
    });
    return response.data;
  } catch (error) {
    console.error('Error creating Paze payment method:', error.response?.data || error);
    throw error.response?.data || error;
  }
}

// Cash App Pay
async function fetchCashAppPayConfig() {
  const response = await axios.get(`${API_BASE_URL}/cash-app-pay/config`);
  return response.data;
}

// Mock until Spreedly Core's cash_app gateway exists; the server returns a synthetic transaction.
async function createCashAppPayPurchase({ paymentMethodToken, amount, currencyCode = 'USD' }) {
  try {
    const response = await axios.post(`${API_BASE_URL}/cash-app-pay-purchase`, {
      amount,
      currency_code: currencyCode,
      payment_method_token: paymentMethodToken,
    });
    return response.data;
  } catch (error) {
    console.error('Error creating Cash App Pay purchase:', error.response?.data || error);
    throw error.response?.data || error;
  }
}

// UI Helpers
function showStatus(elementId, message, type = 'info') {
  const statusEl = document.getElementById(elementId);
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = `status-message visible ${type}`;
}

function hideStatus(elementId) {
  const statusEl = document.getElementById(elementId);
  if (!statusEl) return;

  statusEl.className = 'status-message';
}

function setButtonLoading(buttonId, loading, loadingText = 'Processing...') {
  const button = document.getElementById(buttonId);
  if (!button) return;

  const textEl = button.querySelector('.btn-text');
  const loadingEl = button.querySelector('.btn-loading');

  button.disabled = loading;

  if (textEl) textEl.style.display = loading ? 'none' : 'inline';
  if (loadingEl) {
    loadingEl.style.display = loading ? 'inline-flex' : 'none';
    const loadingTextEl = loadingEl.querySelector('.loading-text');
    if (loadingTextEl) loadingTextEl.textContent = loadingText;
  }
}

// Card Helpers
function getCardIcon(cardType) {
  const icons = {
    'visa': '💳',
    'master': '💳',
    'mastercard': '💳',
    'american_express': '💳',
    'amex': '💳',
    'discover': '💳',
    'jcb': '💳',
    'diners_club': '💳',
  };
  return icons[(cardType || '').toLowerCase()] || '💳';
}

function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

function formatCardNumber(lastFour) {
  return `•••• ${lastFour}`;
}

function formatExpiry(month, year) {
  const m = String(month || '').padStart(2, '0');
  const y = String(year || '').slice(-2);
  return `${m}/${y}`;
}

// Currency Formatting
function formatCurrency(amount, currencyCode = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}

// Form Helpers
function getFormData(formId) {
  const form = document.getElementById(formId);
  if (!form) return {};

  const formData = new FormData(form);
  const data = {};

  formData.forEach((value, key) => {
    data[key] = value;
  });

  return data;
}

// Dynamic SDK Loading
function loadSDKScript(callback) {
  const scriptUrl = getSDKScriptUrl();
  const script = document.createElement('script');
  script.src = scriptUrl;
  script.onload = () => {
    // Call callback with no argument to indicate success
    if (callback) callback();
  };
  script.onerror = () => {
    console.error('Failed to load SDK script from:', scriptUrl);
    if (callback) callback(new Error('Failed to load SDK'));
  };
  document.body.appendChild(script);
}

// Stripe Radar — runs a server-side purchase through the Stripe Payment Intents
// gateway, forwarding the radar session id created by sdk.stripeRadar().
async function createStripeRadarPurchase(paymentMethodToken, amount, radarSessionId, currencyCode = 'USD') {
  try {
    const response = await axios.post(`${API_BASE_URL}/stripe-radar-purchase`, {
      payment_method_token: paymentMethodToken,
      amount: amount,
      currency_code: currencyCode,
      radar_session_id: radarSessionId,
    });
    return response.data;
  } catch (error) {
    console.error('Error creating Stripe Radar purchase:', error);
    throw error;
  }
}

// Offsite Payments
async function createOffsitePurchase(paymentMethodToken, amount, redirectUrl, callbackUrl, currencyCode = 'USD', gateway = 'spreedly') {
  try {
    const response = await axios.post(`${API_BASE_URL}/offsite-purchase`, {
      payment_method_token: paymentMethodToken,
      amount: amount,
      currency_code: currencyCode,
      redirect_url: redirectUrl,
      callback_url: callbackUrl,
      gateway: gateway,
    });
    return response.data;
  } catch (error) {
    console.error('Error creating offsite purchase:', error);
    throw error;
  }
}

// ACH Payments — runs a server-side gateway purchase against an ACH
// (bank_account) payment method token using the configured Spreedly Test gateway.
async function createAchPurchase(paymentMethodToken, amount, currencyCode = 'USD') {
  try {
    const response = await axios.post(`${API_BASE_URL}/ach-purchase`, {
      payment_method_token: paymentMethodToken,
      amount,
      currency_code: currencyCode,
    });
    return response.data;
  } catch (error) {
    console.error('Error creating ACH purchase:', error);
    throw error;
  }
}

async function getTransactionStatus(transactionToken) {
  try {
    const response = await axios.get(`${API_BASE_URL}/transactions/${transactionToken}`);
    return response.data;
  } catch (error) {
    console.error('Error getting transaction status:', error);
    throw error;
  }
}

// HTML-escape a value so it can be safely interpolated into innerHTML strings.
// Use this on any value that originated from an API response (gateway-controlled
// fields, error messages, transaction details) before it is templated into HTML.
const HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => HTML_ESCAPE_MAP[c]);
}

function showTestCardsBanner() {
  if (document.querySelector('.test-cards-banner')) return;
  const banner = document.createElement('div');
  banner.className = 'test-cards-banner';
  banner.setAttribute('role', 'note');
  const label = document.createElement('strong');
  label.textContent = 'Test cards only.';
  banner.append(label, ' Do not enter a real card number on this page.');
  document.body.prepend(banner);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', showTestCardsBanner);
} else {
  showTestCardsBanner();
}

window.SpreedlyUtils = {
  // Config
  API_BASE_URL,
  LOCAL_API_URL,
  getRedirectOrigin,

  // SDK helpers
  getSDKType,
  getSDKScriptUrl,
  getSDKDisplayName,
  getDisplayMode,
  loadSDKScript,

  // Auth
  fetchAuthParams,

  // Payment methods
  fetchPaymentMethods,
  ownerMetadata,

  // API
  retainPaymentMethod,
  createPurchase,
  createPurchaseWith3DS,
  createPazePaymentMethod,

  // Cash App Pay
  fetchCashAppPayConfig,
  createCashAppPayPurchase,

  // Stripe Radar
  createStripeRadarPurchase,

  // Offsite Payments
  createOffsitePurchase,
  getTransactionStatus,

  // ACH Payments
  createAchPurchase,

  // UI helpers
  showStatus,
  hideStatus,
  setButtonLoading,

  // Card helpers
  getCardIcon,
  capitalizeFirst,
  formatCardNumber,
  formatExpiry,

  // Currency
  formatCurrency,

  // Form
  getFormData,

  // Security
  escapeHtml,
};

