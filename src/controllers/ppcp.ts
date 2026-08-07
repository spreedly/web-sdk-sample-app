import axios, { AxiosError } from 'axios';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import config from '../config';

/**
 * PPCP (PayPal Complete Payments) — INTERIM direct-to-PayPal spike controller.
 *
 * Talks to PayPal Orders V2 DIRECTLY (sandbox) so the SpreedlyPPCP client SDK can be
 * built/validated before Spreedly Core's PPCP gateway backend exists. This is a
 * throwaway dev harness — NOT a production path: it bypasses Spreedly entirely (no
 * Spreedly transaction, no partner fees, no reporting). When Core's gateway lands,
 * these routes get repointed at Spreedly and the SDK contract is unchanged.
 * See ppcp/integration-plan/07-interim-direct-order-spike.md.
 *
 * Auth here is PayPal OAuth (Bearer) — deliberately separate from the Spreedly
 * Basic-auth calls in payments.ts, which is why this lives in its own controller.
 * NOTE: exact PayPal request/response shapes should be verified against the Orders V2
 * reference (developer.paypal.com/docs/api/orders/v2/) — see integration-plan/05.
 */

// Spreedly's PayPal partner attribution (BN) code — sent on every Orders V2 call so PayPal
// attributes the integration to Spreedly; matches the client-side value the SDK sends via
// createInstance({ partnerAttributionId }). (In production this is owned by Spreedly Core's gateway.)
const PAYPAL_PARTNER_ATTRIBUTION_ID = 'spreedly_pcp';

// In-memory OAuth access-token cache (server-internal; refreshed ~1 min before expiry).
let cachedAccessToken: { value: string; expiresAt: number } | null = null;

const assertPPCPConfigured = (): void => {
  if (!config.paypalPpcpClientId || !config.paypalPpcpClientSecret) {
    throw new Error(
      'PAYPAL_PPCP_CLIENT_ID_NEW and PAYPAL_PPCP_CLIENT_SECRET_NEW environment variables are required'
    );
  }
};

const paypalBasicAuth = () => ({
  username: config.paypalPpcpClientId,
  password: config.paypalPpcpClientSecret,
});

const handleError = (error: unknown, res: Response): void => {
  const apiError = error as AxiosError;
  res
    .status(apiError.response?.status || 500)
    .json(apiError.response?.data || { error: (error as Error).message });
};

// Exchange client id/secret for a PayPal OAuth access token (cached until near expiry).
const getPayPalAccessToken = async (): Promise<string> => {
  assertPPCPConfigured();
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.value;
  }
  const response = await axios.post(
    `${config.paypalApiBaseUrl}/v1/oauth2/token`,
    new URLSearchParams({ grant_type: 'client_credentials' }),
    { auth: paypalBasicAuth() }
  );
  cachedAccessToken = {
    value: response.data.access_token,
    expiresAt: Date.now() + Number(response.data.expires_in || 0) * 1000,
  };
  return cachedAccessToken.value;
};

// GET /api/v1/ppcp/client-token
// Mint a browser-safe client token for the PayPal JS SDK v6: createInstance({ clientToken }).
export const getPPCPClientToken = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    assertPPCPConfigured();
    const response = await axios.post(
      `${config.paypalApiBaseUrl}/v1/oauth2/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        response_type: 'client_token',
      }),
      { auth: paypalBasicAuth() }
    );
    res.json({ clientToken: response.data.access_token });
  } catch (error) {
    handleError(error, res);
  }
};

// GET /api/v1/ppcp/config
// The PayPal client ID for initialising the JS SDK v6 — `createInstance({ clientId })`.
//
// This is a PUBLIC, static value that PayPal documents as safe to embed in front-end code, so a
// real merchant would simply inline it in their page. This endpoint exists only because the demo
// keeps it in .env rather than committing it.
export const getPPCPConfig = async (_req: Request, res: Response): Promise<void> => {
  if (!config.paypalPpcpClientId) {
    res.status(500).json({ error: 'PAYPAL_PPCP_CLIENT_ID_NEW is not configured' });
    return;
  }
  res.json({ clientId: config.paypalPpcpClientId });
};

// POST /api/v1/ppcp/orders   body: { amount?, currency_code?, intent? }
// Create a PayPal order (Orders V2). The SDK's createOrder() maps the response to { orderId: id }.
export const createPPCPOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  const {
    amount = '10.00',
    currency_code = 'USD',
    intent = 'CAPTURE',
  } = req.body || {};
  try {
    const accessToken = await getPayPalAccessToken();
    const body = {
      intent,
      purchase_units: [
        {
          amount: {
            currency_code,
            value: String(amount), // Orders V2 expects a decimal string, e.g. "10.00"
          },
        },
      ],
    };
    const response = await axios.post(
      `${config.paypalApiBaseUrl}/v2/checkout/orders`,
      body,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Partner-Attribution-Id': PAYPAL_PARTNER_ATTRIBUTION_ID,
        },
      }
    );
    // Response includes { id, status, links }.
    res.json(response.data);
  } catch (error) {
    handleError(error, res);
  }
};

// POST /api/v1/ppcp/orders/:orderId/capture
// Capture an approved PayPal order (called from the SDK's onApprove).
export const capturePPCPOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  const orderId = req.params.orderId || '';
  // PayPal order ids are alphanumeric; guard the path param.
  if (!/^[a-zA-Z0-9]+$/.test(orderId)) {
    res.status(400).json({ error: 'Invalid order id format' });
    return;
  }
  try {
    const accessToken = await getPayPalAccessToken();
    const response = await axios.post(
      `${config.paypalApiBaseUrl}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Partner-Attribution-Id': PAYPAL_PARTNER_ATTRIBUTION_ID,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    handleError(error, res);
  }
};

// ── Vault / recurring (interim) ───────────────────────────────────────────────
// In-memory store of vaulted PayPal payment tokens. Throwaway demo state — in production
// Spreedly Core owns token storage; a real integration NEVER exposes raw token ids to the browser.
interface VaultedToken {
  id: string; // PayPal payment-token id (long-lived)
  createdAt: string;
  label?: string; // buyer email, if PayPal returns it
  // Everything else PayPal told us about the buyer. Kept as whatever actually came back rather
  // than a fixed shape, so the demo displays truth instead of assumed field names.
  details?: Record<string, string>;
}
const vaultedTokens: VaultedToken[] = [];

/**
 * Flatten a PayPal payer object into label -> value pairs for display.
 *
 * PayPal's payer payloads nest inconsistently across endpoints (name.given_name,
 * address.address_line_1, shipping.address.*), and the exact fields returned vary by account and
 * call. Rather than hardcode a shape we walk whatever arrived and keep the scalars.
 */
const flattenPayerDetails = (
  source: unknown,
  prefix = '',
  out: Record<string, string> = {}
): Record<string, string> => {
  if (!source || typeof source !== 'object') return out;
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    const label = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'object') {
      flattenPayerDetails(value, label, out);
    } else {
      out[label] = String(value);
    }
  }
  return out;
};

const paypalHeaders = (accessToken: string, idempotent = false) => ({
  Authorization: `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  'PayPal-Partner-Attribution-Id': PAYPAL_PARTNER_ATTRIBUTION_ID,
  ...(idempotent ? { 'PayPal-Request-Id': randomUUID() } : {}),
});

// POST /api/v1/ppcp/vault/setup-token
// Create a PayPal vault setup token (the buyer approves it via the JS SDK). Returns { setupToken }.
export const createPPCPVaultSetupToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const accessToken = await getPayPalAccessToken();
    // Use the app's REAL origin so the approval popup can hand control back to the opener.
    // Placeholder (example.com) URLs make PayPal bail during the popup's loading stage.
    const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    const body = {
      payment_source: {
        paypal: {
          usage_type: 'MERCHANT',
          experience_context: {
            return_url: `${origin}/ppcp/`,
            cancel_url: `${origin}/ppcp/`,
          },
        },
      },
    };
    const response = await axios.post(
      `${config.paypalApiBaseUrl}/v3/vault/setup-tokens`,
      body,
      { headers: paypalHeaders(accessToken, true) }
    );
    // The SDK's createVaultSetupToken() expects { setupToken: <id> }.
    res.json({ setupToken: response.data.id, status: response.data.status });
  } catch (error) {
    handleError(error, res);
  }
};

// POST /api/v1/ppcp/vault/payment-token   body: { vaultSetupToken }
// Exchange an approved setup token for a permanent payment token; store it server-side.
export const createPPCPVaultPaymentToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  const vaultSetupToken = req.body?.vaultSetupToken;
  if (!vaultSetupToken) {
    res.status(400).json({ error: 'vaultSetupToken is required' });
    return;
  }
  try {
    const accessToken = await getPayPalAccessToken();
    const body = {
      payment_source: { token: { id: vaultSetupToken, type: 'SETUP_TOKEN' } },
    };
    const response = await axios.post(
      `${config.paypalApiBaseUrl}/v3/vault/payment-tokens`,
      body,
      { headers: paypalHeaders(accessToken, true) }
    );
    const paypalSource = response.data?.payment_source?.paypal;
    const email = paypalSource?.email_address;
    // Long-lived token — store server-side; do NOT return it to the browser in a real
    // integration. Here we keep an in-memory list for the demo.
    vaultedTokens.unshift({
      id: response.data.id,
      createdAt: new Date().toISOString(),
      label: email,
      // Whatever PayPal returned about the buyer on the payment-token response. Note this is
      // identity only — no shipping address; that appears on the ORDER, not the vault token.
      details: flattenPayerDetails(paypalSource),
    });
    res.json({ status: 'SUCCESS', label: email });
  } catch (error) {
    handleError(error, res);
  }
};

// GET /api/v1/ppcp/vault/tokens — list saved payment methods (demo only; never leak raw ids).
export const listPPCPVaultTokens = async (_req: Request, res: Response): Promise<void> => {
  res.json({
    tokens: vaultedTokens.map((t, index) => ({
      ref: index, // opaque handle the browser uses to charge; the real id stays server-side
      createdAt: t.createdAt,
      label: t.label || 'PayPal account',
      // Buyer details PayPal returned, for the demo's accordion. Never includes the token id.
      details: t.details || {},
    })),
  });
};

// POST /api/v1/ppcp/vault/charge   body: { ref, amount?, currency_code?, initiator? }
// Charge a saved payment token. initiator 'MERCHANT' (default) = merchant-initiated recurring
// MIT, buyer NOT present (scenario 4). initiator 'CUSTOMER' = return buyer PRESENT, one-click
// (scenario 3). Both reuse the same vaulted token; only stored_credential differs.
export const chargePPCPVaultToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { ref, amount = '10.00', currency_code = 'USD', initiator = 'MERCHANT' } = req.body || {};
  const token = vaultedTokens[Number(ref)];
  if (!token) {
    res.status(404).json({ error: 'No saved payment token for that ref' });
    return;
  }
  const buyerPresent = initiator === 'CUSTOMER';
  try {
    const accessToken = await getPayPalAccessToken();
    const body = {
      intent: 'CAPTURE',
      purchase_units: [{ amount: { currency_code, value: String(amount) } }],
      payment_source: {
        paypal: {
          vault_id: token.id,
          // Buyer present → CUSTOMER-initiated one-click (unscheduled); buyer not present →
          // MERCHANT-initiated recurring (subscription). Both are follow-up (SUBSEQUENT)
          // charges on the same stored payment source.
          stored_credential: buyerPresent
            ? {
                payment_initiator: 'CUSTOMER',
                payment_type: 'UNSCHEDULED',
                usage: 'SUBSEQUENT',
              }
            : {
                payment_initiator: 'MERCHANT',
                usage: 'SUBSEQUENT',
                usage_pattern: 'SUBSCRIPTION_PREPAID',
              },
        },
      },
    };
    const response = await axios.post(
      `${config.paypalApiBaseUrl}/v2/checkout/orders`,
      body,
      // A create-order that carries a payment_source (the vaulted token) REQUIRES a
      // PayPal-Request-Id (idempotency key) — PayPal rejects it otherwise with
      // PAYPAL_REQUEST_ID_REQUIRED. (Plain orders without a payment_source don't need it.)
      { headers: paypalHeaders(accessToken, true) }
    );
    // intent=CAPTURE with a vaulted MERCHANT token auto-captures. Fallback: if it came back
    // approved-but-not-captured, capture it so the demo shows COMPLETED.
    let order = response.data;
    let captureError: string | undefined;
    if (order?.id && order.status && order.status !== 'COMPLETED') {
      try {
        const captured = await axios.post(
          `${config.paypalApiBaseUrl}/v2/checkout/orders/${order.id}/capture`,
          {},
          { headers: paypalHeaders(accessToken) }
        );
        order = captured.data;
      } catch (err) {
        // Surface it rather than swallowing — a failed follow-up capture used to render as a
        // neutral success, which hid real failures.
        const apiError = err as AxiosError;
        const body = apiError.response?.data as { message?: string } | undefined;
        captureError = body?.message || (err as Error).message;
      }
    }

    // The ORDER carries payer + shipping, which the vault token does not. Fold it into the
    // stored details so the saved-methods accordion can show it after a charge.
    const payer = order?.payment_source?.paypal || order?.payer;
    const shipping = order?.purchase_units?.[0]?.shipping;
    if (payer || shipping) {
      token.details = {
        ...(token.details || {}),
        ...flattenPayerDetails(payer),
        ...flattenPayerDetails(shipping, 'shipping'),
      };
    }

    const capture = order?.purchase_units?.[0]?.payments?.captures?.[0];
    res.json({
      id: order?.id,
      status: order?.status,
      succeeded: order?.status === 'COMPLETED',
      initiator: buyerPresent ? 'CUSTOMER' : 'MERCHANT',
      scenario: buyerPresent ? 'one-click (buyer present)' : 'recurring MIT (buyer not present)',
      amount: capture?.amount?.value,
      currency_code: capture?.amount?.currency_code,
      captureId: capture?.id,
      captureStatus: capture?.status,
      ...(captureError ? { captureError } : {}),
    });
  } catch (error) {
    handleError(error, res);
  }
};

// POST /api/v1/ppcp/vault/purchase-order   body: { amount?, currency_code? }
// Scenario 2 (vault WITH purchase): create a checkout order that ALSO saves the PayPal on a
// successful capture. The buyer approves the payment + the save in one pass via the normal JS
// SDK checkout session; the vaulted token id comes back on capture (see the capture route below).
export const createPPCPVaultPurchaseOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { amount = '10.00', currency_code = 'USD' } = req.body || {};
  try {
    const accessToken = await getPayPalAccessToken();
    const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    const body = {
      intent: 'CAPTURE',
      purchase_units: [{ amount: { currency_code, value: String(amount) } }],
      payment_source: {
        paypal: {
          // store_in_vault: ON_SUCCESS → vault the PayPal only if the payment succeeds.
          attributes: { vault: { store_in_vault: 'ON_SUCCESS', usage_type: 'MERCHANT' } },
          experience_context: {
            return_url: `${origin}/ppcp/`,
            cancel_url: `${origin}/ppcp/`,
            shipping_preference: 'NO_SHIPPING',
            user_action: 'PAY_NOW',
          },
        },
      },
    };
    const response = await axios.post(
      `${config.paypalApiBaseUrl}/v2/checkout/orders`,
      body,
      // Carries a payment_source → PayPal requires a PayPal-Request-Id (idempotency key).
      { headers: paypalHeaders(accessToken, true) }
    );
    // { id, status, links } — the SDK's createOrder() maps this to { orderId: id }.
    res.json(response.data);
  } catch (error) {
    handleError(error, res);
  }
};

// POST /api/v1/ppcp/vault/purchase-order/:orderId/capture
// Capture a vault-with-purchase order (scenario 2) and store the PayPal token it vaulted so it
// shows up in the saved list (reusable for scenario 3 one-click / scenario 4 recurring).
export const capturePPCPVaultPurchaseOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  const orderId = req.params.orderId || '';
  if (!/^[a-zA-Z0-9]+$/.test(orderId)) {
    res.status(400).json({ error: 'Invalid order id format' });
    return;
  }
  try {
    const accessToken = await getPayPalAccessToken();
    const response = await axios.post(
      `${config.paypalApiBaseUrl}/v2/checkout/orders/${orderId}/capture`,
      {},
      { headers: paypalHeaders(accessToken, true) }
    );
    const data = response.data;
    // On a successful vault-with-purchase, the capture response carries the vaulted token id at
    // payment_source.paypal.attributes.vault.id — store it (mirrors the setup→payment-token path).
    const vaulted = data?.payment_source?.paypal?.attributes?.vault;
    if (vaulted?.id) {
      const email = data?.payment_source?.paypal?.email_address || data?.payer?.email_address;
      vaultedTokens.unshift({
        id: vaulted.id,
        createdAt: new Date().toISOString(),
        label: email,
      });
    }
    res.json(data);
  } catch (error) {
    handleError(error, res);
  }
};
