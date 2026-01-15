const API_BASE_URL = 'https://checkout-web-sample-app-049a3c617015.herokuapp.com/api/v1';
const LOCAL_API_URL = 'http://localhost:3000/api/v1';

// SDK URL Helpers
function getSDKType() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('sdk') || 'hosted-fields';
}

function getSDKScriptUrl() {
  const sdkType = getSDKType();
  // if(window.location.hostname === 'localhost') {
  //   if (sdkType === 'express-checkout') {
  //     return 'http://localhost:5173/express-checkout.js';
  //   }
  //   return 'http://localhost:5000/index.js';
  // }

  if (sdkType === 'express-checkout') {
    return 'https://core-test.spreedly.com/checkout/elements/rc/express-checkout.js';
  }
  return 'https://core-test.spreedly.com/checkout/sdk/rc/index.js';
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
    const response = await axios.get(`${API_BASE_URL}/auth/params`);
    const authParams = response.data;
    return authParams;    
  } catch (error) {
    console.error('Error fetching auth params:', error);
    throw new Error('Failed to fetch authentication parameters');
  }
}

// Payment Methods
async function fetchPaymentMethods() {
  try {
    const response = await axios.get(`${API_BASE_URL}/payment_methods`);
    const paymentMethods = response.data?.payment_methods || [];
    
    // Filter to only credit cards
    return paymentMethods.filter(pm => pm.payment_method_type === 'credit_card');
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    throw new Error('Failed to fetch saved payment methods');
  }
}

async function retainPaymentMethod(paymentMethodToken) {
  try {
    const response = await axios.put(`${API_BASE_URL}/payment_methods/${paymentMethodToken}/retain`);
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

async function createPurchaseWith3DS(paymentMethodToken, amount, browserInfo, currencyCode = 'USD') {
  try {
    const response = await axios.post(`${API_BASE_URL}/create-purchase-with-3ds`, {
      payment_method_token: paymentMethodToken,
      amount: amount,
      currency_code: currencyCode,
      browser_info: browserInfo,
    });  
    return response.data;
  } catch (error) {
    console.error('Error creating 3DS purchase:', error.response?.data ? error.response?.data : error);
    throw error.response?.data ? error.response?.data : error;
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

window.SpreedlyUtils = {
  // Config
  API_BASE_URL,
  LOCAL_API_URL,
  
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
  
  // API
  retainPaymentMethod,
  createPurchase,
  createPurchaseWith3DS,
  
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
};

