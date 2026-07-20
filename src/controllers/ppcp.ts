import axios, { AxiosError } from 'axios';
import { Request, Response } from 'express';
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
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    handleError(error, res);
  }
};
