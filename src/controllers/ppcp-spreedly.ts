import axios, { AxiosError } from 'axios';
import { Request, Response } from 'express';
import config from '../config';

/**
 * PPCP via Spreedly's `paypal_commerce_platform` gateway — the PRODUCTION path.
 *
 * The Spreedly-brokered twin of ppcp.ts. Where that controller calls PayPal's REST API
 * directly (a throwaway spike), this one calls ONLY Spreedly: Spreedly creates the PayPal
 * order server-side and hands back its id, so the browser half (SpreedlyPPCP + PayPal's
 * JS SDK v6) is completely unchanged. Both controllers are mounted at once so the demo
 * can A/B them; see src/static/ppcp/ppcp.js.
 *
 * Flow — verified end-to-end in sandbox, see ppcp/integration-plan/14-spreedly-pivot-plan.md §7Z:
 *
 *   1. POST /v1/payment_methods.json          { payment_method_type: 'paypal' }
 *        -> payment_method_token
 *   2. POST /v1/gateways/{gw}/authorize.json  { payment_method_token, amount,
 *                                              redirect_url, callback_url,
 *                                              retain_on_success: true }
 *        -> state 'pending' + setup_verification (= the PayPal ORDER id)
 *   3. SDK createOrder() resolves { orderId: setup_verification }; buyer approves in the popup.
 *      Spreedly finalizes the authorization by itself via its callback — no polling,
 *      no complete.json, no reference authorization.
 *   4. POST /v1/transactions/{token}/capture.json
 *
 * Two traps this encodes (both cost real debugging time):
 *   - Do NOT set gateway_specific_fields.paypal_commerce_platform.order_only. It creates only
 *     a PayPal order with no authorization behind it, and the later capture fails with
 *     "The specified resource does not exist".
 *   - redirect_url / callback_url reject localhost (errors.invalid_url), so they must point at
 *     a real https origin even while developing locally.
 */

// Spreedly amounts are integer minor units (10000 = $100.00); the SDK/PayPal side uses a
// decimal string ('299.99') because findEligibleMethods requires that format.
const toMinorUnits = (amount: string | number): number =>
  Math.round(Number(amount) * 100);

/**
 * PayPal order id -> Spreedly transaction token.
 *
 * The SDK's callback contract carries only the PayPal order id (createOrder() resolves
 * { orderId }, onPaymentResult reports { orderId }), but capture addresses the Spreedly
 * transaction. Keeping the mapping here means the browser never handles a Spreedly
 * transaction token and the demo's capture call is shape-identical to the direct-PayPal one.
 *
 * In-memory and therefore demo-only — a real merchant persists this against their order record.
 */
const orderToTransaction = new Map<string, string>();

const getAuthorizationHeader = (): string => {
  if (!config.spreedlyEnvironmentKey || !config.spreedlyAccessSecret) {
    throw new Error(
      'SPREEDLY_ENVIRONMENT_KEY_NEW and SPREEDLY_ACCESS_SECRET_NEW environment variables are required'
    );
  }
  const credentials = Buffer.from(
    `${config.spreedlyEnvironmentKey}:${config.spreedlyAccessSecret}`
  ).toString('base64');
  return `Basic ${credentials}`;
};

const assertGatewayConfigured = (): void => {
  if (!config.ppcpGatewayToken) {
    throw new Error(
      'PPCP_GATEWAY_TOKEN_NEW environment variable is required (a Spreedly paypal_commerce_platform gateway)'
    );
  }
};

const spreedlyHeaders = () => ({
  Authorization: getAuthorizationHeader(),
  'Content-Type': 'application/json',
});

const handleError = (error: unknown, res: Response): void => {
  const apiError = error as AxiosError;
  res
    .status(apiError.response?.status || 500)
    .json(apiError.response?.data || { error: (error as Error).message });
};

// Spreedly rejects localhost redirect/callback URLs, so fall back to the deployed sample app
// whenever the request origin is not a public https origin. These pages are only landing
// targets — the popup flow hands control back to the opener, not through the redirect.
const publicOrigin = (req: Request): string => {
  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  return /^https:\/\//.test(origin) && !/localhost|127\.0\.0\.1/.test(origin)
    ? origin
    : 'https://checkout-web-sample-app-049a3c617015.herokuapp.com';
};

/**
 * Spreedly payment-method types this gateway accepts for the offsite wallet flow.
 *
 * Only `paypal` and `venmo` exist as distinct types — Pay Later and PayPal Credit are PayPal
 * *funding sources*, not separate payment methods, so they transact as `paypal`. (The gateway's
 * own payment_methods list is credit_card, paypal, venmo, third_party_token.)
 */
const PAYMENT_METHOD_TYPES = ['paypal', 'venmo'] as const;
type SpreedlyWalletType = (typeof PAYMENT_METHOD_TYPES)[number];

const resolvePaymentMethodType = (requested: unknown): SpreedlyWalletType =>
  PAYMENT_METHOD_TYPES.includes(requested as SpreedlyWalletType)
    ? (requested as SpreedlyWalletType)
    : 'paypal';

// POST /api/v1/ppcp/spreedly/orders   body: { amount?, currency_code?, payment_method_type? }
// Creates the PayPal order THROUGH Spreedly and returns its id for the SDK's createOrder().
export const createSpreedlyPPCPOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { amount = '10.00', currency_code = 'USD' } = req.body || {};
  // Which wallet the buyer actually clicked. Defaults to paypal: the SDK's createOrder()
  // callback is not told which funding source triggered it, so the page has to report it.
  const paymentMethodType = resolvePaymentMethodType(req.body?.payment_method_type);
  try {
    assertGatewayConfigured();

    // 1. A payment method to transact against. The offsite authorize requires one even though
    //    the buyer's wallet identity only materializes at approval.
    const paymentMethodResponse = await axios.post(
      `${config.spreedlyUrl}/v1/payment_methods.json`,
      { payment_method: { payment_method_type: paymentMethodType } },
      { headers: spreedlyHeaders() }
    );
    const paymentMethodToken =
      paymentMethodResponse.data?.transaction?.payment_method?.token ||
      paymentMethodResponse.data?.payment_method?.token;
    if (!paymentMethodToken) {
      res.status(502).json({ error: 'Spreedly did not return a payment method token' });
      return;
    }

    // 2. Offsite authorize. retain_on_success keeps the payment method reusable — without it
    //    it lands in storage_state 'used' and any later reuse is rejected.
    const origin = publicOrigin(req);
    const transactionResponse = await axios.post(
      `${config.spreedlyUrl}/v1/gateways/${config.ppcpGatewayToken}/authorize.json`,
      {
        transaction: {
          payment_method_token: paymentMethodToken,
          amount: toMinorUnits(amount),
          currency_code,
          // Dedicated return page — with presentationMode 'redirect' the buyer lands here
          // rather than back on the checkout page, and it captures using the
          // ?transaction_token= Spreedly appends. See src/static/ppcp/return/.
          redirect_url: `${origin}/ppcp/return/`,
          // Required by Spreedly, but its v6 semantics are UNVERIFIED — the gateway doc says only
          // that offsite transactions need one. (Spreedly's public offsite-callbacks page
          // describes the PayPal v5 / Braintree-era flow, so it is not a source of truth here.)
          // Pointed at a real route rather than a static page because a POST is the plausible
          // shape and a route can at least answer one. Empirically NOT load-bearing: a checkout
          // completed end-to-end while this pointed at a static HTML page — the redirect leg is
          // what finalizes the authorization. Open question for the Gateway team.
          callback_url: `${origin}/api/v1/offsite-callback`,
          retain_on_success: true,
        },
      },
      { headers: spreedlyHeaders() }
    );

    const transaction = transactionResponse.data?.transaction;
    console.log('authorize transaction response body: ', transaction);
    // setup_verification is the PayPal order id Spreedly just created on our behalf.
    const orderId = transaction?.setup_verification;
    if (!orderId) {
      res.status(502).json({
        error: 'Spreedly did not return a PayPal order id (setup_verification)',
        state: transaction?.state,
        message: transaction?.message,
      });
      return;
    }

    orderToTransaction.set(orderId, transaction.token);

    // Shaped like the direct-PayPal route's response ({ id, status }) so the demo's
    // createOrder() maps both backends identically.
    res.json({
      id: orderId,
      status: transaction.state,
      payment_method_type: paymentMethodType,
      checkout_url: transaction.response?.checkout_url,
    });
  } catch (error) {
    console.error(error);
    handleError(error, res);
  }
};

// POST /api/v1/ppcp/spreedly/orders/:orderId/capture
// Captures the authorization Spreedly built when the buyer approved in the popup.
export const captureSpreedlyPPCPOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  const orderId = req.params.orderId || '';
  if (!/^[a-zA-Z0-9]+$/.test(orderId)) {
    res.status(400).json({ error: 'Invalid order id format' });
    return;
  }
  const transactionToken = orderToTransaction.get(orderId);
  if (!transactionToken) {
    res.status(404).json({ error: 'No Spreedly transaction for that order id' });
    return;
  }
  try {
    // Capture only works once the buyer has approved: approval is what promotes the PayPal
    // order into a real authorization. Capturing earlier gets Spreedly's opaque
    // "errors.reference_transaction_failed", so check first and say what is actually wrong.
    const current = await axios.get(
      `${config.spreedlyUrl}/v1/transactions/${transactionToken}.json`,
      { headers: spreedlyHeaders() }
    );
    const authorization = current.data?.transaction;
    if (!authorization?.succeeded) {
      res.status(409).json({
        error: 'The authorization has not been approved yet, so there is nothing to capture.',
        detail:
          'Complete the PayPal approval first (click a PPCP button and approve in the popup, ' +
          'or open the checkout_url). Spreedly finalizes the authorization on its own once the ' +
          'buyer approves; the transaction then moves to state "succeeded".',
        state: authorization?.state,
        checkout_url: authorization?.response?.checkout_url,
      });
      return;
    }

    const response = await axios.post(
      `${config.spreedlyUrl}/v1/transactions/${transactionToken}/capture.json`,
      { transaction: {} },
      { headers: spreedlyHeaders() }
    );
    const transaction = response.data?.transaction;
    res.json({
      id: orderId,
      status: transaction?.state,
      succeeded: transaction?.succeeded,
      message: transaction?.message,
      transaction,
    });
  } catch (error) {
    console.log('capture transaction error', (error as AxiosError)?.response?.data);
    console.log('capture transaction error', (error as AxiosError)?.response?.status);
    handleError(error, res);
  }
};

/**
 * POST /api/v1/ppcp/spreedly/transactions/:transactionToken/capture
 *
 * Capture addressed by the SPREEDLY transaction token rather than the PayPal order id.
 * This is the redirect-flow counterpart: presentationMode 'redirect' navigates the buyer away,
 * so the original page (and the SDK instance with it) is gone by the time the payment resolves.
 * Spreedly hands the token back on the return URL as ?transaction_token=..., and that is the
 * only handle the landing page has.
 *
 * Demo-only shortcut: a real merchant must check this token against their own order record
 * before capturing, rather than capturing whatever token arrives on a query string.
 */
export const captureSpreedlyPPCPByTransaction = async (
  req: Request,
  res: Response
): Promise<void> => {
  const transactionToken = req.params.transactionToken || '';
  if (!/^[a-zA-Z0-9]+$/.test(transactionToken)) {
    res.status(400).json({ error: 'Invalid transaction token format' });
    return;
  }
  try {
    const current = await axios.get(
      `${config.spreedlyUrl}/v1/transactions/${transactionToken}.json`,
      { headers: spreedlyHeaders() }
    );
    const authorization = current.data?.transaction;

    // The buyer may have cancelled at PayPal, or the approval may not have landed.
    if (!authorization?.succeeded) {
      res.status(409).json({
        error: 'The authorization is not in a succeeded state, so there is nothing to capture.',
        state: authorization?.state,
        message: authorization?.message,
      });
      return;
    }

    console.log('capture transaction request body');
    const response = await axios.post(
      `${config.spreedlyUrl}/v1/transactions/${transactionToken}/capture.json`,
      { transaction: {} },
      { headers: spreedlyHeaders() }
    );
    console.log('capture transaction response body: ', response.data);
    const capture = response.data?.transaction;
    const paypal = authorization.gateway_specific_response_fields?.paypal_commerce_platform || {};
    res.json({
      status: capture?.state,
      succeeded: capture?.succeeded,
      message: capture?.message,
      amount: capture?.amount,
      currency_code: capture?.currency_code,
      // Useful provenance for the demo readout — all of it comes from Spreedly, not PayPal.
      authorizationToken: transactionToken,
      captureToken: capture?.token,
      paypalOrderId: authorization.setup_verification,
      paypalAuthorizationId: authorization.gateway_transaction_id,
      paypalCaptureId: capture?.gateway_transaction_id,
      payer: paypal.payer,
    });
  } catch (error) {
    console.log('capture transaction error', (error as AxiosError)?.response?.data);
    handleError(error, res);
  }
};

// GET /api/v1/ppcp/spreedly/orders/:orderId
// Demo helper: inspect the underlying Spreedly transaction (state, payer details, PayPal ids).
export const getSpreedlyPPCPTransaction = async (
  req: Request,
  res: Response
): Promise<void> => {
  const transactionToken = orderToTransaction.get(req.params.orderId || '');
  if (!transactionToken) {
    res.status(404).json({ error: 'No Spreedly transaction for that order id' });
    return;
  }
  try {
    const response = await axios.get(
      `${config.spreedlyUrl}/v1/transactions/${transactionToken}.json`,
      { headers: spreedlyHeaders() }
    );
    res.json(response.data);
  } catch (error) {
    handleError(error, res);
  }
};
