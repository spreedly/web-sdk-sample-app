/**
 * PPCP redirect return handler.
 *
 * Spreedly's `redirect_url` points here. With presentationMode 'redirect' the buyer navigates
 * away from the checkout page, so the SpreedlyPPCP instance no longer exists when the payment
 * resolves — onApprove, and therefore the merchant's onPaymentResult, never fire for the
 * success path. Spreedly finalizes the authorization from its own return leg and then sends the
 * buyer here with ?transaction_token=<token>, which is the only handle this page has.
 *
 * This mirrors how Spreedly's other offsite flows work (see SpreedlyStripeAPM.confirmPayment):
 * the SDK starts the redirect, the merchant owns the landing.
 *
 * NOTE: Spreedly rejects localhost redirect URLs, so the buyer lands on the deployed Heroku
 * origin. Swap the host for localhost:3000 by hand to capture against a local server.
 */

const el = id => document.getElementById(id);
const apiBase = () => window.SpreedlyUtils.LOCAL_API_URL;

function setStatus(html, type) {
  const node = el('return-status');
  node.className = `status-message ${type || 'info'}`;
  node.innerHTML = html;
}

function showResult(isSuccess, title, message) {
  const card = el('result-card');
  card.classList.remove('hidden', 'success', 'error');
  card.classList.add(isSuccess ? 'success' : 'error');
  el('result-title').textContent = title;
  el('result-message').textContent = message;
}

// Values here come from the query string, so they are attacker-controlled. Build the nodes and
// assign textContent instead of interpolating into innerHTML.
function showDetails(rows) {
  const list = el('detail-list');
  list.textContent = '';
  rows
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .forEach(([key, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = String(key);
      const dd = document.createElement('dd');
      dd.textContent = String(value);
      list.appendChild(dt);
      list.appendChild(dd);
    });
  list.classList.remove('hidden');
}

function showChain(order, authorization, capture) {
  if (!order && !authorization && !capture) return;
  el('chain-order').textContent = order || '—';
  el('chain-auth').textContent = authorization || '—';
  el('chain-capture').textContent = capture || '—';
  el('chain-wrap').classList.remove('hidden');
}

// Spreedly amounts are integer minor units (52997 = $529.97).
function formatAmount(minorUnits, currency) {
  if (typeof minorUnits !== 'number') return '';
  return `${(minorUnits / 100).toFixed(2)} ${currency || ''}`.trim();
}

async function captureReturn() {
  const params = new URLSearchParams(window.location.search);
  const transactionToken = params.get('transaction_token');

  if (!transactionToken) {
    setStatus('No <code>transaction_token</code> on the URL.', 'error');
    showResult(
      false,
      'Nothing to capture',
      'This page is the return URL for a PPCP redirect payment. Open it with a ' +
        'transaction_token query parameter, or start a payment from the PPCP demo.'
    );
    return;
  }

  // Drop the token from the address bar so a refresh cannot attempt a second capture.
  window.history.replaceState({}, '', window.location.pathname);

  setStatus('<span class="spinner"></span> Capturing payment through Spreedly&hellip;', 'info');

  try {
    const response = await axios.post(
      `${apiBase()}/ppcp/spreedly/transactions/${transactionToken}/capture`
    );
    const data = response.data;

    setStatus('Payment complete.', 'success');
    showResult(
      true,
      'Payment Successful',
      `Captured ${formatAmount(data.amount, data.currency_code)} through Spreedly's ` +
        `paypal_commerce_platform gateway.${data.payer ? ` Payer: ${data.payer}.` : ''}`
    );
    showChain(data.paypalOrderId, data.paypalAuthorizationId, data.paypalCaptureId);
    showDetails([
      ['Capture state', data.status],
      ['Amount', formatAmount(data.amount, data.currency_code)],
      ['Payer', data.payer],
      ['Spreedly authorization', data.authorizationToken],
      ['Spreedly capture', data.captureToken],
      ['PayPal order', data.paypalOrderId],
      ['PayPal authorization', data.paypalAuthorizationId],
      ['PayPal capture', data.paypalCaptureId],
    ]);
  } catch (error) {
    const body = error.response && error.response.data;
    const detail = (body && (body.error || body.message)) || error.message;
    setStatus('Capture failed.', 'error');
    showResult(false, 'Capture Failed', detail);
    showDetails([
      ['Spreedly authorization', transactionToken],
      ['Transaction state', body && body.state],
      ['Gateway message', body && body.message],
    ]);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', captureReturn);
} else {
  captureReturn();
}
