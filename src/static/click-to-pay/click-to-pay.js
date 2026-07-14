/**
 * Click to Pay (Mastercard SRC) demo.
 *
 * Mirrors Mastercard's PreVue Shop demo across the full set of flows:
 *   1. Products  → pick items, proceed to checkout.
 *   2. Payment   → email-first LOOKUP (idLookup) determines who the shopper is:
 *        • Recognized device      → c2p-verified-user → saved card list → pay with selected
 *        • Known, new device       → c2p-existing-user → OTP → saved card list
 *        • No profile / no email    → c2p-new-user → new-card form (encrypt in iframe → enroll)
 *   3. Confirmation → token + result.
 *
 * The orchestrator (SpreedlyClickToPay) drives all of this; this file is just the UI
 * wiring. Cards come straight off the `display-cards-ready` payload (no dependency on
 * Mastercard's <src-card-list> web component).
 *
 * Requires: Mastercard lib.js on the page (see index.html), the Spreedly sandbox DPAID,
 * and a Spreedly env with Click to Pay enabled. Run the SDK locally (npm run dev in
 * checkout-web-sdk) so localhost serves the build with C2P.
 */

const SUPPORTED_BRANDS = ['mastercard', 'visa', 'amex', 'discover'];

const PRODUCTS = [
  { id: 'prod_1', name: 'Jacket', description: 'Lightweight zip hoodie', price: 1.0, emoji: '🧥' },
  { id: 'prod_2', name: 'Coffee Cup', description: 'Ceramic mug, 12oz', price: 1.5, emoji: '☕' },
  { id: 'prod_3', name: 'Sticker Pack', description: 'Vinyl, set of 5', price: 0.5, emoji: '✨' },
];

// State
let hostedFields = null;
let c2p = null;
let isReady = false;
let cart = {};

// Returning-user state. Card selection is owned by Mastercard's <src-card-list>
// component (the SDK calls setSelectedCard on its events and pre-selects the first
// card), so the demo only tracks whether a selectable list is showing.
let cardSelectionReady = false;

// Card field state (from the SDK's fieldStateChange). validCvv is usable in both
// flows — the SDK falls back to a length check when there's no PAN (selected-card).
const cardState = { validNumber: false, validCvv: false, cardType: '' };
let encryptedCard = null;
let cardBrand = null;
let encrypting = false;
let consentCheckoutAsGuest = false; // raw value from <src-consent>'s checkoutAsGuest event
let consentComplianceResources = []; // complianceResources from <src-consent> → checkout's complianceSettings

const SECTIONS = ['c2p-lookup-section', 'c2p-saved-section', 'c2p-otp-section', 'c2p-new-card-section'];

// DOM helpers
const $ = (id) => document.getElementById(id);
const show = (id) => $(id)?.classList.remove('hidden');
const hide = (id) => $(id)?.classList.add('hidden');

// Mastercard <src-loader> overlay, shown during async SRC calls (lookup, OTP validate).
const showLoader = () => show('c2p-loader-overlay');
const hideLoader = () => hide('c2p-loader-overlay');

// The CVV hosted field is shared between the new-card and selected-card flows
// (only one cvv iframe exists). Move it to whichever flow is active. Reparenting
// reloads the iframe, but the cvv frame re-establishes its link to the number
// frame on load, so the CVV still reaches tokenization. Done before CVV entry, so
// no typed value is lost.
function relocateCvvField(hostId) {
  const cvv = $('cvv-field');
  const host = $(hostId);
  if (cvv && host && cvv.parentElement !== host) {
    host.appendChild(cvv);
  }
}

function showSection(id) {
  SECTIONS.forEach((s) => (s === id ? show(s) : hide(s)));
  if (id === 'c2p-saved-section') {
    relocateCvvField('saved-cvv-host');
    requestAnimationFrame(() => sizeBrandBtn('pay-selected-btn')); // size once laid out
  } else if (id === 'c2p-new-card-section') {
    relocateCvvField('newcard-cvv-host');
    requestAnimationFrame(() => sizeBrandBtn('continue-btn'));
  }
}

function logEvent(message, type = 'info') {
  const log = $('event-log');
  if (!log) return;
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const entry = document.createElement('div');
  entry.className = `event-log-entry ${type}`;
  entry.innerHTML = `<span class="time">[${time}]</span> ${SpreedlyUtils.escapeHtml(message)}`;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
  console.log(`[${type.toUpperCase()}] ${message}`);
}

function showStatus(message, type = 'info') {
  const el = $('status-message');
  if (!el) return;
  el.textContent = message;
  el.className = `status-message visible ${type}`;
}
function hideStatus() {
  const el = $('status-message');
  if (el) el.className = 'status-message';
}

function setBtnLoading(id, loading, text = null) {
  const btn = $(id);
  if (!btn) return;
  const spinner = btn.querySelector('.btn-spinner');
  const textEl = btn.querySelector('.btn-text');
  btn.disabled = loading;
  spinner?.classList.toggle('hidden', !loading);
  if (text && textEl) textEl.textContent = text;
}

// Mastercard's <src-button> (branded button) has no `disabled`/loading props, so gate it via a
// class (pointer-events:none), and its width is a numeric (px) prop, not CSS — size it to its
// container so it spans full width. Shared by both branded buttons (selected-card "pay" and
// new-card "continue"). Sizing must run while the button is visible (a hidden ancestor → 0).
function setBrandBtnDisabled(id, disabled) {
  $(id)?.classList.toggle('src-btn-disabled', disabled);
}
function sizeBrandBtn(id) {
  const btn = $(id);
  const wrap = btn?.parentElement;
  if (btn && wrap && wrap.clientWidth) btn.width = wrap.clientWidth;
}

// ── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

async function init() {
  $('sdk-badge').textContent = SpreedlyUtils.getSDKDisplayName();

  renderProducts();
  updateCartSummary();
  setupEventListeners();
  goToStep(1);

  logEvent('Initializing Click to Pay flow…');

  SpreedlyUtils.loadSDKScript(async (error) => {
    if (error) {
      logEvent(`Failed to load SDK: ${error.message}`, 'error');
      SpreedlyUtils.showStatus('global-status-message', 'Failed to load SDK. Please refresh.', 'error');
      return;
    }
    logEvent('SDK script loaded');

    if (typeof window.SpreedlyClickToPay === 'undefined') {
      SpreedlyUtils.showStatus(
        'global-status-message',
        'SpreedlyClickToPay not found — is the local SDK build running (npm run dev)?',
        'error'
      );
      return;
    }

    try {
      const auth = await SpreedlyUtils.fetchAuthParams();
      const authDetails = {
        environment_key: auth.environmentKey,
        certificate_token: auth.certificateToken,
        nonce: auth.nonce,
        signature: auth.signature,
        timestamp: auth.timestamp,
      };

      // Single-entry integration: SpreedlyClickToPay creates + mounts its own hosted
      // fields (config.fields) and tokenizes inside the number iframe automatically.
      initializeClickToPay(authDetails);
      attachHostedFieldsListeners();
      await c2p.init(); // mounts the fields, then initializes Click to Pay
    } catch (err) {
      logEvent(`Initialization failed: ${err.message}`, 'error');
      SpreedlyUtils.showStatus('global-status-message', err.message || 'Failed to initialize SDK.', 'error');
    }
  });
}

// Hosted-fields listeners: the instance is created and mounted BY SpreedlyClickToPay
// (config.fields) and exposed as c2p.hostedFields — full public API. Listeners are
// attached after construction, before c2p.init() mounts the fields. The raw card is
// encrypted in-iframe via encryptCardForClickToPay; the PAN never leaves it.
function attachHostedFieldsListeners() {
  hostedFields = c2p.hostedFields;

  hostedFields.on('ready', () => {
    isReady = true;
    logEvent('Hosted Fields ready', 'success');
  });

  // Live field metadata — each snapshot carries both validNumber + validCvv, so the
  // card is encrypted as soon as number + CVV are valid (and name + expiry present).
  hostedFields.on('fieldStateChange', (payload) => {
    cardState.validNumber = payload.validNumber === true;
    cardState.validCvv = payload.validCvv === true;
    if (payload.cardType) cardState.cardType = payload.cardType;
    evaluateCardReady();
    // The selected-card flow also requires a CVC (shared cvv field).
    evaluateSelectedReady();
  });

  hostedFields.on('error', (err) => {
    logEvent(`Hosted Fields error: ${err.message || err}`, 'error');
    showStatus(err.message || 'A card error occurred', 'error');
  });
}

function initializeClickToPay(authDetails) {
  logEvent('Initializing Click to Pay orchestrator…');
  c2p = new window.SpreedlyClickToPay(authDetails, {
    // The SDK creates + mounts its own hosted number/cvv fields in these containers
    // (number lives in the hidden new-card section — the number iframe is the
    // tokenization engine and CVV holder, so it must be mounted even for the
    // saved-card flow; hidden is fine).
    fields: {
      number: { containerId: 'card-number-field' },
      cvv: { containerId: 'cvv-field' },
    },
    c2pConfig: {
      dpaData: { dpaPresentationName: 'Spreedly Demo Store', dpaName: 'SpreedlyDemoStore' },
      dpaTransactionOptions: {
        paymentOptions: [{ dynamicDataType: 'NONE' }],
        transactionAmount: {
          // Mastercard wants the amount in the CURRENCY UNIT (dollars for USD), NOT cents.
          // (The real amount is re-sent at checkout time via dpaTransactionOptions below.)
          transactionAmount: getCartTotal() || 1,
          transactionCurrencyCode: 'USD',
        },
        // Make Mastercard's DCF collect a billing address (like the Mastercard demo).
        // Default is 'NONE' (contact info only). 'FULL' = full billing address;
        // 'POSTAL_COUNTRY' = just zip + country.
        dpaBillingPreference: 'FULL',
      },
      cardBrands: SUPPORTED_BRANDS,
    },
    cardsEl: 'c2p-card-list',
    otpEl: 'c2p-otp-input',
    isSandbox: true,
    doLookup: false, // we trigger lookup from the email "Continue" button.
    // Request device recognition so Mastercard remembers this browser after enrollment
    // → checkoutWithCard/NewCard gets rememberMe:true → getCards() should recognize the
    // shopper on return (cookie-based). If third-party cookies are blocked this won't
    // stick, which would tell us we need the recognitionToken (option b).
    rememberMe: true,
    // Present Mastercard's DCF checkout as an embedded side drawer (like Mastercard's
    // demo) instead of a popup window. Switch to 'popup' for the legacy window.open UX.
    // The SDK mounts the DCF iframe into checkoutContainerEl; THIS demo owns the drawer
    // chrome (panel/backdrop/animation) and shows/hides it on checkout-window-open/close.
    checkoutPresentation: 'drawer',
    checkoutContainerEl: 'c2p-checkout-host',
  });

  c2p.on('c2p-initialized', () => logEvent('Click to Pay ready', 'success'));

  // ── Lookup branches ──────────────────────────────────────────────────────
  c2p.on('c2p-verified-user', () => {
    logEvent('Recognized shopper', 'success');
  });

  c2p.on('display-cards-ready', (payload) => {
    const cards = payload?.cards || [];
    logEvent(`Loaded ${cards.length} saved card(s)`, 'success');
    setBtnLoading('lookup-btn', false);
    hideStatus();
    hideLoader(); // cards are ready — drop the "finding your cards" loader
    // SDK mounts the <src-card-list> component (it renders from the SRC session). A card
    // isn't selected until the shopper picks one (selectSrcDigitalCardId → setSelectedCard).
    cardSelectionReady = false;
    showSection('c2p-saved-section');
    evaluateSelectedReady();
  });

  c2p.on('c2p-existing-user', () => {
    logEvent('Known shopper on a new device — verification required');
    showStatus("We'll verify it's you with a one-time code.", 'info');
  });

  c2p.on('otp-initiated', () => {
    // The SDK drives the <src-otp-input> component (channels, masked identity, resend,
    // "Not you?"). We just reveal the section that holds it.
    logEvent('OTP initiated — Mastercard <src-otp-input> shown');
    setBtnLoading('lookup-btn', false);
    hideStatus();
    hideLoader(); // lookup done — reveal the OTP component
    showSection('c2p-otp-section');
  });

  c2p.on('otp-response', (r) => {
    if (r.success) {
      logEvent('OTP verified', 'success');
      // Keep the loader up — display-cards-ready follows and hides it.
    } else {
      logEvent(`OTP failed: ${r.errorReason || ''}`, 'error');
      hideLoader(); // reveal the OTP component so its error state shows
    }
  });

  c2p.on('c2p-new-user', () => {
    logEvent('No Click to Pay profile — new-card enrollment');
    setBtnLoading('lookup-btn', false);
    hideLoader();
    showStatus('Enter your card to pay with Click to Pay.', 'info');
    showSection('c2p-new-card-section');
  });

  // The <src-card-list> "Enter card manually" option fires this. Reveal OUR hosted-fields
  // new-card form (Spreedly number + CVV iframes) — the PAN goes through Spreedly's PCI
  // iframe, not the component's inline form (which hits Mastercard's sandbox lib.js bug).
  c2p.on('add-new-card', () => {
    logEvent('Enter card manually — showing hosted-fields new-card form');
    hideLoader();
    showStatus('Enter your card details to pay with Click to Pay.', 'info');
    showSection('c2p-new-card-section');
  });

  // The <src-card-list> "Not your cards?" link (or any signOut) lands here — the SDK
  // has already cleared recognition, so just reset the demo UI to email entry.
  c2p.on('c2p-session-deleted', () => {
    logEvent('Click to Pay session cleared', 'success');
    resetDemoState();
    showStatus('Click to Pay reset — enter an email to start fresh.', 'info');
    showSection('c2p-lookup-section');
  });

  // ── Checkout window + result ───────────────────────────────────────────────
  c2p.on('checkout-window-open', () => {
    logEvent('Mastercard verification window opened', 'info');
    // The SDK has mounted the DCF iframe into #c2p-checkout-host; slide our drawer in.
    // (No-op visually if running in 'popup' mode — the drawer just stays closed.)
    requestAnimationFrame(() => $('c2p-checkout-drawer')?.classList.add('open'));
  });
  c2p.on('checkout-window-close', () => {
    logEvent('Mastercard window closed', 'info');
    $('c2p-checkout-drawer')?.classList.remove('open'); // slide the drawer out
  });
  c2p.on('checkout-cancelled', () => {
    logEvent('Checkout cancelled by shopper', 'info');
    showStatus('Checkout cancelled. You can try again.', 'info');
    setBrandBtnDisabled('pay-selected-btn', false);
    setContinueLoading(false);
  });

  c2p.on('tokenGenerated', (payload) => {
    const token =
      payload?.tokenResponse?.payment_method?.token || payload?.tokenResponse?.token || payload?.token;
    logEvent(`Payment method created: ${token || '(token missing)'}`, 'success');
    showResult('success', { token });
  });

  c2p.on('error', (err) => {
    const msg = err?.errors?.[0]?.message || err?.message || String(err);
    logEvent(`Click to Pay error: ${msg}`, 'error');
    setBtnLoading('lookup-btn', false);
    setBrandBtnDisabled('pay-selected-btn', false);
    setContinueLoading(false);
    hideLoader();
    showResult('error', { message: msg });
  });
}

// ── Lookup ───────────────────────────────────────────────────────────────────
function runLookup() {
  const email = $('c2p-email').value.trim();
  const mobile = $('c2p-mobile').value.trim();
  const countryCode = $('c2p-country-code').value;
  hideStatus();
  setBtnLoading('lookup-btn', true, 'Looking up…');
  showLoader(); // Mastercard <src-loader> "finding your cards" while lookup runs

  // Build the lookup identity: email if present, else mobile (the SDK's _buildConsumer
  // is email-first, matching Mastercard's demo). lookup() also checks device recognition
  // (getCards) first, then idLookup, emitting verified / existing / new-user.
  const info = {};
  if (email) info.email = email;
  if (mobile) info.phone = { number: mobile, countryCode };
  logEvent(
    email
      ? `Looking up ${email}`
      : mobile
        ? `Looking up +${countryCode} ${mobile}`
        : 'Checking device recognition (no email/mobile)…'
  );
  c2p.lookup(Object.keys(info).length ? info : undefined);
}

// Mastercard recognizes the DEVICE (a cookie on src.mastercard.com), not the email,
// so once you've enrolled on this browser every lookup short-circuits to saved cards.
// signOut() clears that recognition so the new-user flow can be tested again.
// Clear the demo's returning-user state (does NOT call signOut — used both after a
// manual reset and when the SDK emits c2p-session-deleted from the component's link).
function resetDemoState() {
  cardSelectionReady = false;
  ['c2p-email', 'c2p-mobile', 'c2p-sel-first-name', 'c2p-sel-last-name'].forEach(
    (id) => ($(id).value = '')
  );
  setBrandBtnDisabled('pay-selected-btn', true);
}

async function resetClickToPay() {
  document.querySelectorAll('[data-reset]').forEach((b) => (b.disabled = true));
  logEvent('Resetting Click to Pay (clearing device recognition)…');
  try {
    await c2p.signOut(); // emits c2p-session-deleted → resets UI + returns to email entry
    logEvent('Device recognition cleared', 'success');
  } catch (err) {
    logEvent(`Sign out failed: ${err.message || err}`, 'error');
    // signOut failed (no session-deleted event) — reset the UI directly.
    resetDemoState();
    showSection('c2p-lookup-section');
  }
  document.querySelectorAll('[data-reset]').forEach((b) => (b.disabled = false));
}

// ── Returning user: card list ───────────────────────────────────────────────
// Rendering + selection is handled by Mastercard's <src-card-list> component (driven
// by the SDK). When the shopper picks a card the component fires selectSrcDigitalCardId,
// which the SDK turns into setSelectedCard; the demo listens too, to gate the pay button.

// A non-blank first + last name (Spreedly requires a cardholder name; Click to Pay
// only returns it masked client-side, so the merchant supplies it).
function validSelectedName() {
  return (
    $('c2p-sel-first-name').value.trim() !== '' && $('c2p-sel-last-name').value.trim() !== ''
  );
}

// A valid CVC (issuer requirement for returning cards). The SDK reports validCvv
// even without a PAN (length fallback), so this works in the selected-card flow.
function validSelectedCvv() {
  return cardState.validCvv;
}

function evaluateSelectedReady() {
  // Cards showing (component pre-selects one), a non-blank name, AND a CVC.
  setBrandBtnDisabled('pay-selected-btn', 
    !(cardSelectionReady && validSelectedName() && validSelectedCvv())
  );
}

async function payWithSelectedCard() {
  if (!cardSelectionReady) {
    showStatus('Select a card first.', 'error');
    return;
  }
  if (!validSelectedName()) {
    showStatus('Enter the cardholder first and last name.', 'error');
    return;
  }
  if (!validSelectedCvv()) {
    showStatus('Enter the card security code (CVC).', 'error');
    return;
  }
  hideStatus();
  setBrandBtnDisabled('pay-selected-btn', true);
  logEvent('Checking out with selected card…');
  const firstName = $('c2p-sel-first-name').value.trim();
  const lastName = $('c2p-sel-last-name').value.trim();
  try {
    await c2p.checkout({
      withSelectedCard: true,
      // Merchant-supplied cardholder name — mirrors the legacy iframe, which plucks
      // first_name/last_name/full_name from merchant params for the selected-card flow too.
      cardholder: { firstName, lastName, fullName: [firstName, lastName].filter(Boolean).join(' ') },
      // No tokenize callback needed: the SDK routes tokenization into its own hosted
      // number iframe automatically (config.fields), injecting the held CVV for this
      // selected-card flow (withCvv is decided by flow inside the SDK).
      // Consumer consent captured by <src-consent> (documented complianceSettings).
      ...(consentComplianceResources.length
        ? { complianceSettings: { complianceResources: consentComplianceResources } }
        : {}),
      // Send the CURRENT cart amount (dollars, not cents) so Mastercard's DCF shows the
      // real total instead of the stale page-load value.
      dpaTransactionOptions: {
        transactionAmount: { transactionAmount: getCartTotal(), transactionCurrencyCode: 'USD' },
      },
    });
  } catch (err) {
    logEvent(`Checkout failed: ${err.message || err}`, 'error');
    setBrandBtnDisabled('pay-selected-btn', false);
    showResult('error', { message: err.message || 'Checkout failed' });
  }
}

// ── OTP ──────────────────────────────────────────────────────────────────────
// OTP entry/submit/resend/"Not you?" are handled entirely by Mastercard's
// <src-otp-input> component, driven by the SDK. No manual OTP wiring in the demo.

// ── New-card: ready evaluation + eager encryption ──────────────────────────
function validExpiry() {
  const monthStr = $('c2p-month').value.trim();
  const yearStr = $('c2p-year').value.trim();
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);
  if (!(month >= 1 && month <= 12) || !/^\d{4}$/.test(yearStr)) return false;
  // Reject expired / implausible years (e.g. 1237, 9999) — Mastercard/Spreedly won't
  // validate this for us; the last-2-digits normalization is why 1237 became 2037.
  const now = new Date();
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  if (year < curYear || year > curYear + 20) return false;
  if (year === curYear && month < curMonth) return false;
  return true;
}

// Spreedly's tokenization requires a non-blank first + last name, so the card is
// only encrypted once the name is present too.
function validName() {
  return $('c2p-first-name').value.trim() !== '' && $('c2p-last-name').value.trim() !== '';
}

function evaluateCardReady() {
  const ready = cardState.validNumber && cardState.validCvv && validExpiry() && validName();
  if (ready && !encryptedCard && !encrypting) {
    encryptCard();
  } else if (!ready && (encryptedCard || encrypting)) {
    resetEncrypted();
  }
}

function resetEncrypted() {
  encryptedCard = null;
  cardBrand = null;
  hide('c2p-consent');
  setBrandBtnDisabled('continue-btn', true);
}

async function encryptCard() {
  if (!isReady) return;
  encrypting = true;
  showStatus('Securing your card…', 'info');
  logEvent('Encrypting card in the number iframe (ENCRYPT_CARD)…');

  const firstName = $('c2p-first-name').value.trim();
  const lastName = $('c2p-last-name').value.trim();

  try {
    const result = await hostedFields.encryptCardForClickToPay({
      first_name: firstName,
      last_name: lastName,
      full_name: [firstName, lastName].filter(Boolean).join(' '),
      month: $('c2p-month').value.trim(),
      year: $('c2p-year').value.trim(),
      available_card_brands: SUPPORTED_BRANDS,
      sandbox: true,
    });
    encrypting = false;
    encryptedCard = result.encryptedCard;
    cardBrand = result.cardBrand;
    logEvent(`Card encrypted (${cardBrand})`, 'success');
    show('c2p-consent');
    setBrandBtnDisabled('continue-btn', false);
    hideStatus();
  } catch (err) {
    encrypting = false;
    logEvent(`Card encryption failed: ${err.message || err}`, 'error');
    showStatus(err.message || 'Could not secure the card. Check the details and try again.', 'error');
  }
}

async function handleContinue() {
  if (!encryptedCard) {
    showStatus('Enter a valid card first.', 'error');
    return;
  }
  hideStatus();
  setContinueLoading(true, 'Starting Click to Pay…');
  logEvent('Calling checkoutWithNewCard…');
  const firstName = $('c2p-first-name').value.trim();
  const lastName = $('c2p-last-name').value.trim();
  try {
    await c2p.checkout({
      encryptedCard,
      cardBrand,
      // Spreedly requires a non-blank cardholder name on the C2P token request.
      cardholder: { firstName, lastName, fullName: [firstName, lastName].filter(Boolean).join(' ') },
      // No tokenize callback needed: the SDK tokenizes inside its own hosted number
      // iframe automatically (config.fields). New-card sends no verification_value —
      // the CVV rides in Mastercard's encrypted blob (live-tested; see
      // CLICK_TO_PAY_PARITY.md).
      // Consumer consent captured by <src-consent> (documented complianceSettings).
      ...(consentComplianceResources.length
        ? { complianceSettings: { complianceResources: consentComplianceResources } }
        : {}),
      // Send the CURRENT cart amount (dollars, not cents) so Mastercard's DCF shows the
      // real total instead of the stale page-load value.
      dpaTransactionOptions: {
        transactionAmount: { transactionAmount: getCartTotal(), transactionCurrencyCode: 'USD' },
      },
    });
  } catch (err) {
    logEvent(`Checkout failed: ${err.message || err}`, 'error');
    setContinueLoading(false);
    showResult('error', { message: err.message || 'Checkout failed' });
  }
}

// ── Products & cart ──────────────────────────────────────────────────────────
function renderProducts() {
  $('products-grid').innerHTML = PRODUCTS.map(
    (p) => `
    <div class="product-card" data-product-id="${p.id}">
      <div class="product-emoji">${p.emoji}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-description">${p.description}</div>
      <div class="product-price">${SpreedlyUtils.formatCurrency(p.price)}</div>
      <div class="quantity-control">
        <button class="quantity-btn decrease-qty" ${!cart[p.id] ? 'disabled' : ''}>-</button>
        <input type="text" class="quantity-input" value="${cart[p.id] || 0}" readonly>
        <button class="quantity-btn increase-qty">+</button>
      </div>
    </div>`
  ).join('');
}

function updateCart(productId, quantity) {
  if (quantity <= 0) delete cart[productId];
  else cart[productId] = quantity;
  renderProducts();
  updateCartSummary();
}

function getCartTotal() {
  return Object.entries(cart).reduce((total, [id, qty]) => {
    const p = PRODUCTS.find((x) => x.id === id);
    return total + (p ? p.price * qty : 0);
  }, 0);
}

function cartItemsHtml() {
  return Object.entries(cart)
    .map(([id, qty]) => {
      const p = PRODUCTS.find((x) => x.id === id);
      return p
        ? `<div class="order-item"><span>${p.emoji} ${p.name} <span class="order-item-qty">x${qty}</span></span><span>${SpreedlyUtils.formatCurrency(p.price * qty)}</span></div>`
        : '';
    })
    .join('');
}

function updateCartSummary() {
  const total = getCartTotal();
  if (total > 0) {
    $('cart-summary').style.display = 'block';
    $('cart-items').innerHTML = cartItemsHtml();
    $('cart-total').textContent = SpreedlyUtils.formatCurrency(total);
    $('proceed-to-payment').disabled = false;
  } else {
    $('cart-summary').style.display = 'none';
    $('proceed-to-payment').disabled = true;
  }
}

function updateOrderSummary() {
  $('summary-items').innerHTML = cartItemsHtml();
  $('summary-total').textContent = SpreedlyUtils.formatCurrency(getCartTotal());
}

// ── Stepper ──────────────────────────────────────────────────────────────────
function goToStep(stepNumber) {
  document.querySelectorAll('.stepper-step').forEach((step, i) => {
    step.classList.toggle('completed', i + 1 < stepNumber);
    step.classList.toggle('active', i + 1 === stepNumber);
  });
  document.querySelectorAll('.step-content').forEach((content, i) => {
    content.classList.toggle('active', i + 1 === stepNumber);
  });
  if (stepNumber === 2) updateOrderSummary();
}

// ── Result ───────────────────────────────────────────────────────────────────
function showResult(type, data) {
  setContinueLoading(false);
  goToStep(3);
  const container = $('result-section');
  if (type === 'success') {
    container.innerHTML = `
      <div class="result-icon success">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
      </div>
      <h2 class="result-title" style="color: var(--color-success);">Click to Pay Successful!</h2>
      <p class="result-message">Your card was tokenized by Spreedly via Mastercard Click to Pay.</p>
      <div class="result-details">
        <div class="result-detail-row"><span class="result-detail-label">Payment Method Token</span><span class="result-detail-value">${SpreedlyUtils.escapeHtml(data?.token || 'N/A')}</span></div>
        <div class="result-detail-row"><span class="result-detail-label">Amount</span><span class="result-detail-value">${SpreedlyUtils.formatCurrency(getCartTotal())}</span></div>
        <div class="result-detail-row"><span class="result-detail-label">Network</span><span class="result-detail-value">Mastercard Click to Pay</span></div>
      </div>
      <button class="btn btn-primary" onclick="window.location.reload()">Start Over</button>`;
  } else {
    container.innerHTML = `
      <div class="result-icon error">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </div>
      <h2 class="result-title" style="color: var(--color-error);">Click to Pay Failed</h2>
      <p class="result-message">${SpreedlyUtils.escapeHtml(data?.message || 'An error occurred.')}</p>
      <button class="btn btn-primary" onclick="window.location.reload()">Try Again</button>`;
  }
}

// continue-btn is Mastercard's <src-button> (no spinner/text) — reflect loading as the gated
// state. It also stays disabled until the card is encrypted (encryptedCard set).
function setContinueLoading(loading) {
  setBrandBtnDisabled('continue-btn', loading || !encryptedCard);
}

// ── Listeners ──────────────────────────────────────────────────────────────
function setupEventListeners() {
  $('products-grid').addEventListener('click', (e) => {
    const target = e.target;
    if (!target.classList.contains('quantity-btn')) return;
    const productId = target.closest('.product-card').dataset.productId;
    if (target.classList.contains('increase-qty')) updateCart(productId, (cart[productId] || 0) + 1);
    else if (target.classList.contains('decrease-qty')) updateCart(productId, (cart[productId] || 0) - 1);
  });

  $('proceed-to-payment').addEventListener('click', () => goToStep(2));
  $('back-to-products').addEventListener('click', () => goToStep(1));

  // Lookup / returning-user / OTP / new-card actions.
  $('lookup-btn').addEventListener('click', runLookup);
  $('pay-selected-btn').addEventListener('click', payWithSelectedCard);
  window.addEventListener('resize', () => {
    sizeBrandBtn('pay-selected-btn');
    sizeBrandBtn('continue-btn');
  });
  $('use-new-card-btn').addEventListener('click', () => {
    showStatus('Enter a new card to pay with Click to Pay.', 'info');
    showSection('c2p-new-card-section');
  });
  $('continue-btn').addEventListener('click', handleContinue);
  document
    .querySelectorAll('[data-reset]')
    .forEach((btn) => btn.addEventListener('click', resetClickToPay));

  // When the shopper picks a card in Mastercard's <src-card-list>, enable the pay button.
  $('c2p-card-list').addEventListener('selectSrcDigitalCardId', () => {
    cardSelectionReady = true;
    evaluateSelectedReady();
  });

  // When the shopper submits the OTP, show the "finding your cards" loader over the
  // OTP component while the SDK validates (the SDK also listens to this event to validate).
  $('c2p-otp-input').addEventListener('continue', () => showLoader());

  // Mastercard's <src-consent> component emits the shopper's choices. We record them here;
  // checkoutAsGuest.detail.complianceResources carries Mastercard's official Terms/Privacy
  // URLs (so no placeholder links to maintain). NOTE: wiring consentGiven through to
  // checkout() (guest vs enroll) is an SDK-side follow-up — see CLICK_TO_PAY_PARITY.md.
  const consentEl = $('c2p-consent-el');
  if (consentEl) {
    // Record the raw component values. Exact mapping to checkout (the checkoutAsGuest
    // field's meaning, enroll-vs-guest) is the SDK-side follow-up — see the tracker.
    consentEl.addEventListener('checkoutAsGuest', (e) => {
      consentCheckoutAsGuest = !!e.detail?.checkoutAsGuest;
      // complianceResources is the documented consent payload → checkout's complianceSettings.
      consentComplianceResources = e.detail?.complianceResources || [];
      logEvent(`Consent changed (checkoutAsGuest=${consentCheckoutAsGuest})`);
    });
    consentEl.addEventListener('rememberMe', (e) =>
      logEvent(`Consent: remember this device = ${!!e.detail?.rememberMe}`)
    );
    consentEl.addEventListener('learnMore', () => logEvent('Consent: opened "learn more"'));
  }

  // Expiry / name changes can invalidate or feed a pending encryption.
  ['c2p-month', 'c2p-year', 'c2p-first-name', 'c2p-last-name'].forEach((id) =>
    $(id).addEventListener('input', () => {
      if (encryptedCard) resetEncrypted();
      evaluateCardReady();
    })
  );

  // Selected-card name gates the "Pay with selected card" button.
  ['c2p-sel-first-name', 'c2p-sel-last-name'].forEach((id) =>
    $(id).addEventListener('input', evaluateSelectedReady)
  );
}
