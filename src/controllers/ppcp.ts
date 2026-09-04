import axios, { AxiosError } from 'axios';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import config from '../config';

// PPCP by calling PayPal directly — Orders V2 and Vault v3. Does not go through Spreedly, so
// there is no Spreedly transaction and no reporting. The Spreedly-brokered twin is ppcp-spreedly.ts.

// Spreedly's PayPal partner attribution (BN) code — sent on every Orders V2 call
const PAYPAL_PARTNER_ATTRIBUTION_ID = 'Spreedly_PCP';

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

const MAX_URL_LENGTH = 2000;
const UNSAFE_SCHEMES = /^(javascript|data|vbscript|file):/i;
export const callerUrl = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value || value.length > MAX_URL_LENGTH) return null;
  if (UNSAFE_SCHEMES.test(value.trim())) return null;
  try {
    return new URL(value).href ? value : null;
  } catch {
    return null;
  }
};

const handleError = (error: unknown, res: Response): void => {
  const apiError = error as AxiosError;
  res
    .status(apiError.response?.status || 500)
    .json(apiError.response?.data || { error: (error as Error).message });
};

// Exchange client id/secret for a PayPal OAuth access token
export const getPayPalAccessToken = async (): Promise<string> => {
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

// GET /api/v1/ppcp/config
// The PayPal client ID for initialising the JS SDK v6 — `createInstance({ clientId })`.
export const getPPCPConfig = async (_req: Request, res: Response): Promise<void> => {
  if (!config.paypalPpcpClientId) {
    res.status(500).json({ error: 'PAYPAL_PPCP_CLIENT_ID_NEW is not configured' });
    return;
  }
  res.json({
    clientId: config.paypalPpcpClientId,
    environmentKey: config.spreedlyEnvironmentKey,
  });
};

// POST /api/v1/ppcp/orders
// body: { amount?, currency_code?, intent?, redirect?, return_url?, cancel_url? }
// Create a PayPal order (Orders V2). The SDK's createOrder() maps the response to { orderId: id }.
export const createPPCPOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  const {
    amount = '10.00',
    currency_code = 'USD',
    intent = 'CAPTURE',
    redirect = false,
    // Where PayPal sends the buyer afterwards. Mobile passes a deep link; web omits both.
    return_url,
    cancel_url,
  } = req.body || {};
  try {
    const accessToken = await getPayPalAccessToken();
    const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    const body: Record<string, unknown> = {
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

    // Only send a return URL when the buyer is navigated away. In a popup PayPal talks back to
    // the opener, and adding a payment_source block makes PayPal answer PAYER_ACTION_REQUIRED
    // instead of CREATED.
    const callerReturn = callerUrl(return_url);
    const callerCancel = callerUrl(cancel_url);
    if (redirect || callerReturn) {
      body.payment_source = {
        paypal: {
          experience_context: {
            return_url: callerReturn || `${origin}/ppcp/spike/`,
            // Reuse the caller's return URL on cancel — sending a mobile buyer to a web page
            // would drop them out of their app.
            cancel_url:
              callerCancel || callerReturn || `${origin}/ppcp/spike/?ppcp_cancelled=1`,
          },
        },
      };
    }
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

// ── Vault / recurring ─────────────────────────────────────────────────────────
// Vault tokens are long-lived: store them server-side and never expose the raw id to the browser.
// Kept in memory here for the demo.

// PayPal vaults paypal and venmo separately. 'paylater' and 'paypal_credit' are funding sources on
// a PayPal account, so they vault as paypal. Return a literal — this becomes a payment_source key.
const resolveWallet = (requested: unknown): 'paypal' | 'venmo' =>
  requested === 'venmo' ? 'venmo' : 'paypal';

interface VaultedToken {
  id: string; // PayPal payment-token id (long-lived)
  wallet: 'paypal' | 'venmo';
  createdAt: string;
  label?: string; // buyer email, if PayPal returns it
  details?: Record<string, string>;
  completeDetails?: unknown;
}
const vaultedTokens: VaultedToken[] = [];

// Flatten a PayPal payer object for display. The fields returned vary by endpoint and account, so
// walk whatever arrived rather than assuming a shape.
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

// POST /api/v1/ppcp/vault/setup-token   body: { return_url?, cancel_url? }
// Create a PayPal vault setup token (the buyer approves it via the JS SDK). Returns { setupToken }.
export const createPPCPVaultSetupToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { return_url, cancel_url } = req.body || {};
  try {
    const accessToken = await getPayPalAccessToken();
    // Use a real origin — PayPal bails during the popup's loading stage on placeholder URLs.
    const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    const callerReturn = callerUrl(return_url);
    const callerCancel = callerUrl(cancel_url);
    const body = {
      payment_source: {
        paypal: {
          usage_type: 'MERCHANT',
          experience_context: {
            return_url: callerReturn || `${origin}/ppcp/`,
            cancel_url: callerCancel || callerReturn || `${origin}/ppcp/`,
          },
        },
      },
    };
    const response = await axios.post(
      `${config.paypalApiBaseUrl}/v3/vault/setup-tokens`,
      body,
      { headers: paypalHeaders(accessToken, true) }
    );
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
    vaultedTokens.unshift({
      id: response.data.id,
      // Setup tokens are PayPal-only — the SDK's vault flow mounts the PayPal button alone.
      wallet: 'paypal',
      createdAt: new Date().toISOString(),
      label: email,
      // Identity only — shipping address appears on the ORDER, not the vault token.
      details: flattenPayerDetails(paypalSource),
      completeDetails: response.data,
    });
    res.json({ status: 'SUCCESS', label: email });
  } catch (error) {
    handleError(error, res);
  }
};

// GET /api/v1/ppcp/vault/tokens — saved methods for the demo list. Never leaks the raw token id.
export const listPPCPVaultTokens = async (_req: Request, res: Response): Promise<void> => {
  res.json({
    tokens: vaultedTokens.map((t, index) => ({
      ref: index, // opaque handle the browser uses to charge; the real id stays server-side
      createdAt: t.createdAt,
      wallet: t.wallet,
      label: t.label || (t.wallet === 'venmo' ? 'Venmo account' : 'PayPal account'),
      details: t.details || {},
      completeDetails: t.completeDetails || {},
    })),
  });
};

// POST /api/v1/ppcp/vault/charge   body: { ref, amount?, currency_code?, initiator? }
// Charge a saved wallet. initiator 'MERCHANT' (default) = recurring MIT, buyer not present;
// 'CUSTOMER' = return buyer present, one-click. Only stored_credential differs.
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
      // Charge against whichever wallet was vaulted — a Venmo vault_id under `paypal` is
      // rejected as an unknown token.
      payment_source: {
        [token.wallet]: {
          vault_id: token.id,
          // Both are follow-up (SUBSEQUENT) charges on the same stored payment source.
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
      // An order carrying a payment_source requires a PayPal-Request-Id (idempotency key).
      { headers: paypalHeaders(accessToken, true) }
    );
    // intent=CAPTURE with a vaulted MERCHANT token auto-captures; capture explicitly if not.
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
        const apiError = err as AxiosError;
        const body = apiError.response?.data as { message?: string } | undefined;
        captureError = body?.message || (err as Error).message;
      }
    }

    // The order carries payer + shipping, which the vault token does not.
    const payer = order?.payment_source?.[token.wallet] || order?.payer;
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

// user_action is the Orders-API twin of the JS SDK's `commit`: PAY_NOW renders "Pay" on PayPal's
// final button, CONTINUE renders "Review Order". Keep it in step with `commit` or PayPal is told
// both things at once.
const resolveUserAction = (requested: unknown): 'PAY_NOW' | 'CONTINUE' =>
  requested === 'CONTINUE' ? 'CONTINUE' : 'PAY_NOW';

// POST /api/v1/ppcp/vault/purchase-order
// Vault WITH purchase: a checkout order that also saves the wallet on a successful capture. One
// approval covers both. The vaulted token id comes back on capture.
export const createPPCPVaultPurchaseOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { amount = '10.00', currency_code = 'USD', return_url, cancel_url } = req.body || {};
  const userAction = resolveUserAction(req.body?.user_action);
  // Which button the buyer pressed, from the SDK's createOrder context. PayPal and Venmo vault
  // under different payment_source keys, and the wrong one saves nothing.
  const wallet = resolveWallet(req.body?.wallet);
  try {
    const accessToken = await getPayPalAccessToken();
    const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    const callerReturn = callerUrl(return_url);
    const callerCancel = callerUrl(cancel_url);
    const experienceContext = {
      return_url: callerReturn || `${origin}/ppcp/`,
      cancel_url: callerCancel || callerReturn || `${origin}/ppcp/`,
      shipping_preference: 'NO_SHIPPING',
      // Venmo has no review screen, so user_action is only sent for paypal.
      ...(wallet === 'paypal' ? { user_action: userAction } : {}),
    };
    const source = {
      // store_in_vault: ON_SUCCESS → vault the wallet only if the payment succeeds.
      attributes: { vault: { store_in_vault: 'ON_SUCCESS', usage_type: 'MERCHANT' } },
      experience_context: experienceContext,
    };
    const body = {
      intent: 'CAPTURE',
      purchase_units: [{ amount: { currency_code, value: String(amount) } }],
      payment_source: wallet === 'venmo' ? { venmo: source } : { paypal: source },
    };
    const response = await axios.post(
      `${config.paypalApiBaseUrl}/v2/checkout/orders`,
      body,
      { headers: paypalHeaders(accessToken, true) }
    );
    res.json(response.data);
  } catch (error) {
    handleError(error, res);
  }
};

// POST /api/v1/ppcp/vault/purchase-order/:orderId/capture
// Captures a vault-with-purchase order and stores the wallet token it vaulted.
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
    // The capture response carries the vaulted token id at
    // payment_source.<wallet>.attributes.vault.id. Read whichever wallet came back.
    const source = data?.payment_source?.venmo ? 'venmo' : 'paypal';
    const returned = data?.payment_source?.[source];
    const vaulted = returned?.attributes?.vault;
    if (vaulted?.id) {
      vaultedTokens.unshift({
        id: vaulted.id,
        wallet: source,
        createdAt: new Date().toISOString(),
        // Venmo identifies the buyer by handle; PayPal by email. Take whichever arrived.
        label:
          returned?.email_address ||
          (returned?.user_name ? `@${returned.user_name}` : undefined) ||
          data?.payer?.email_address,
        details: flattenPayerDetails(returned),
      });
    }
    res.json(data);
  } catch (error) {
    handleError(error, res);
  }
};
