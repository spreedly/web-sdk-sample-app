import axios, { AxiosError } from 'axios';
import { Request, Response } from 'express';
import config from '../config';
import { callerUrl } from './ppcp';

// PPCP through Spreedly's `paypal_commerce_platform` gateway.

// Spreedly wants integer minor units; the SDK/PayPal side uses a decimal string.
const toMinorUnits = (amount: string | number): number =>
  Math.round(Number(amount) * 100);

/**
 * An OffsitePurchase takes the money the moment Spreedly finalizes it, so there is no second leg —
 * capture.json rejects it. An OffsiteAuthorization does need capturing. Returns the transaction
 * that represents the money movement either way.
 */
const captureIfNeeded = async (authorization: {
  transaction_type?: string;
  token?: string;
}): Promise<Record<string, unknown>> => {
  if (authorization.transaction_type === 'OffsitePurchase') {
    return authorization as Record<string, unknown>;
  }
  const response = await axios.post(
    `${config.spreedlyUrl}/v1/transactions/${authorization.token}/capture.json`,
    { transaction: {} },
    { headers: spreedlyHeaders() }
  );
  return response.data?.transaction;
};

// PayPal order id -> Spreedly transaction token. The SDK's callbacks only carry the PayPal order
// id, but capture addresses the Spreedly transaction. Demo-only: a real merchant persists this.
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

// Spreedly rejects localhost redirect/callback URLs, so fall back to the deployed sample app.
const publicOrigin = (req: Request): string => {
  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  return /^https:\/\//.test(origin) && !/localhost|127\.0\.0\.1/.test(origin)
    ? origin
    : 'https://checkout-web-sample-app-049a3c617015.herokuapp.com';
};

// Only paypal and venmo are distinct wallet types. Pay Later and PayPal Credit are funding
// sources on a PayPal account, so they transact as paypal.
const PAYMENT_METHOD_TYPES = ['paypal', 'venmo'] as const;
type SpreedlyWalletType = (typeof PAYMENT_METHOD_TYPES)[number];

// `purchase` exists so confirm.json can be tested — it rejects the OffsiteAuthorization that
// authorize.json produces. Default stays 'authorize'.
const TRANSACTION_TYPES = ['authorize', 'purchase'] as const;
type SpreedlyTransactionType = (typeof TRANSACTION_TYPES)[number];

// Both return a literal rather than the caller's value: transactionType goes into the Spreedly
// URL, and returning the request value keeps it linked to user input for CodeQL's SSRF check.
// They do NOT widen automatically — adding a value above needs a case added here too.
const resolveTransactionType = (requested: unknown): SpreedlyTransactionType =>
  requested === 'authorize' ? 'authorize' : 'purchase';

const resolvePaymentMethodType = (requested: unknown): SpreedlyWalletType =>
  requested === 'venmo' ? 'venmo' : 'paypal';

// POST /api/v1/ppcp/spreedly/orders
// body: { amount?, currency_code?, payment_method_type?, transaction_type?, redirect_url?,
//         callback_url? }
// Creates the PayPal order THROUGH Spreedly and returns its id for the SDK's createOrder().
export const createSpreedlyPPCPOrder = async (
  req: Request,
  res: Response
): Promise<void> => {
  const {
    amount = '10.00',
    currency_code = 'USD',
    redirect_url,
    callback_url,
    // Vault WITH purchase: save the wallet as part of taking the payment. One offsite flow, not two.
    store_in_vault = false,
  } = req.body || {};
  const paymentMethodType = resolvePaymentMethodType(req.body?.payment_method_type);
  const transactionType = resolveTransactionType(req.body?.transaction_type);
  try {
    assertGatewayConfigured();

    // The offsite authorize needs a payment method even though the buyer's wallet identity
    // only materializes at approval.
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

    const origin = publicOrigin(req);
    // Caller-supplied URLs win over the computed origin, so mobile can send its own deep links.
    const callerRedirect = callerUrl(redirect_url);
    const callerCallback = callerUrl(callback_url);
    const transactionResponse = await axios.post(
      `${config.spreedlyUrl}/v1/gateways/${config.ppcpGatewayToken}/${transactionType}.json`,
      {
        transaction: {
          payment_method_token: paymentMethodToken,
          amount: toMinorUnits(amount),
          currency_code,
          // Where Spreedly lands the buyer, with ?transaction_token= appended.
          redirect_url: callerRedirect || `${origin}/ppcp/return/`,
          // Required by Spreedly, but not load-bearing: the redirect leg is what finalizes.
          callback_url: callerCallback || `${origin}/api/v1/offsite-callback`,
          // Without retain_on_success the payment method lands in storage_state 'used'.
          retain_on_success: true,
          // Vault WITH purchase. ON_SUCCESS = only vault if the payment goes through.
          ...(store_in_vault
            ? {
                gateway_specific_fields: {
                  paypal_commerce_platform: {
                    vault: { store_in_vault: 'ON_SUCCESS', usage_type: 'MERCHANT' },
                  },
                },
              }
            : {}),
        },
      },
      { headers: spreedlyHeaders() }
    );

    const transaction = transactionResponse.data?.transaction;
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

    res.json({
      id: orderId,
      status: transaction.state,
      payment_method_type: paymentMethodType,
      transaction_type: transaction.transaction_type,
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
    // Capture only works after approval. Capturing earlier returns Spreedly's opaque
    // "errors.reference_transaction_failed", so check first and report what is actually wrong.
    const current = await axios.get(
      `${config.spreedlyUrl}/v1/transactions/${transactionToken}.json`,
      { headers: spreedlyHeaders() }
    );
    const authorization = current.data?.transaction;
    if (!authorization?.succeeded) {
      res.status(409).json({
        error: 'The transaction has not been approved yet, so there is nothing to capture.',
        detail:
          'Complete the PayPal approval first (click a PPCP button and approve in the popup, ' +
          'or open the checkout_url). Spreedly finalizes the transaction on its own once the ' +
          'buyer approves; it then moves to state "succeeded".',
        state: authorization?.state,
        checkout_url: authorization?.response?.checkout_url,
      });
      return;
    }

    const transaction = await captureIfNeeded(authorization);
    const savedByOrder = await recordVaultedWalletByToken(
      (transaction?.payment_method as { token?: string } | undefined)?.token
    );
    res.json({
      id: orderId,
      savedPaymentMethod: savedPaymentMethodPayload(savedByOrder),
      status: transaction?.state,
      succeeded: transaction?.succeeded,
      message: transaction?.message,
      transaction,
    });
  } catch (error) {
    handleError(error, res);
  }
};

/**
 * POST /api/v1/ppcp/spreedly/transactions/:transactionToken/capture
 *
 * Capture by SPREEDLY transaction token — the redirect-flow counterpart. The buyer navigates
 * away, so ?transaction_token= on the return URL is the only handle the landing page has.
 *
 * Demo-only: a real merchant checks this token against their own order record before capturing.
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

    if (!authorization?.succeeded) {
      res.status(409).json({
        error: 'The transaction is not in a succeeded state, so there is nothing to capture.',
        state: authorization?.state,
        message: authorization?.message,
      });
      return;
    }

    const capture = (await captureIfNeeded(authorization)) as Record<string, string | undefined>;
    const savedByTransaction = await recordVaultedWalletByToken(
      (capture?.payment_method as { token?: string } | undefined)?.token
    );
    const paypal = authorization.gateway_specific_response_fields?.paypal_commerce_platform || {};
    // An OffsitePurchase is its own capture, so these two ids are the same transaction.
    res.json({
      status: capture?.state,
      succeeded: capture?.succeeded,
      message: capture?.message,
      amount: capture?.amount,
      currency_code: capture?.currency_code,
      transactionType: authorization.transaction_type,
      authorizationToken: transactionToken,
      captureToken: capture?.token,
      paypalOrderId: authorization.setup_verification,
      paypalAuthorizationId: authorization.gateway_transaction_id,
      paypalCaptureId: capture?.gateway_transaction_id,
      payer: paypal.payer,
      // Null when nothing vaulted — the return page is the only screen that can report a save.
      savedPaymentMethod: savedPaymentMethodPayload(savedByTransaction),
    });
  } catch (error) {
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

// ── Vault / recurring via Spreedly ────────────────────────────────────────────
// A vaulted wallet keeps payment_method_type 'paypal' and gains reference 'vault#<id>'. Charging
// it uses the Spreedly payment method token, never the vault id — Spreedly resolves that itself.
interface SpreedlyVaultedToken {
  paymentMethodToken: string;
  createdAt: string;
  label?: string;
  details?: Record<string, string>;
}
const spreedlyVaultedTokens: SpreedlyVaultedToken[] = [];

// A wallet counts as vaulted only when Spreedly gives it a `vault#…` reference — better an empty
// list than a saved method that cannot be charged.
const recordVaultedWallet = (
  paymentMethod: SpreedlyPaymentMethod | undefined
): SpreedlyVaultedToken | null => {
  const reference = paymentMethod?.reference;
  if (!paymentMethod?.token || !reference || !reference.startsWith('vault#')) return null;
  const already = spreedlyVaultedTokens.find(t => t.paymentMethodToken === paymentMethod.token);
  if (already) return already;
  const saved: SpreedlyVaultedToken = {
    paymentMethodToken: paymentMethod.token,
    createdAt: new Date().toISOString(),
    ...(paymentMethod.email ? { label: paymentMethod.email } : {}),
    details: {
      reference,
      payment_method_type: paymentMethod.payment_method_type || '',
      storage_state: paymentMethod.storage_state || '',
    },
  };
  spreedlyVaultedTokens.unshift(saved);
  return saved;
};

// The `payment_method` inside a transaction response is a snapshot from when the transaction was
// CREATED — before approval — so its `reference` is still null. Re-read the payment method.
const recordVaultedWalletByToken = async (
  paymentMethodToken: string | undefined
): Promise<SpreedlyVaultedToken | null> => {
  if (!paymentMethodToken) return null;
  try {
    const response = await axios.get(
      `${config.spreedlyUrl}/v1/payment_methods/${encodeURIComponent(paymentMethodToken)}.json`,
      { headers: spreedlyHeaders() }
    );
    return recordVaultedWallet(response.data?.payment_method);
  } catch {
    return null;
  }
};

// Null when nothing vaulted, so callers can tell "saved" from "paid but not saved".
const savedPaymentMethodPayload = (saved: SpreedlyVaultedToken | null) =>
  saved
    ? {
        label: saved.label || 'PayPal account',
        reference: saved.details?.reference,
        payment_method_type: saved.details?.payment_method_type,
        storage_state: saved.details?.storage_state,
      }
    : null;

interface SpreedlyPaymentMethod {
  token?: string;
  reference?: string;
  email?: string;
  payment_method_type?: string;
  storage_state?: string;
}

/**
 * POST /api/v1/ppcp/spreedly/vault/setup   body: { redirect_url?, callback_url? }
 *
 * Vault a PayPal wallet WITHOUT taking a payment. Returns the approval URL to send the buyer to —
 * there is no PayPal setup token in this flow, Spreedly mints the approval session itself, so the
 * browser does not run a vault-mode SpreedlyPPCP at all.
 *
 * Gateway verify only, not smart-routing inline verify. Venmo has no verify path; Venmo can only
 * be vaulted with a purchase.
 */
export const createSpreedlyPPCPVaultSetup = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { redirect_url, callback_url } = req.body || {};
  try {
    assertGatewayConfigured();

    // `retained` so the payment method survives the verification.
    const pmResponse = await axios.post(
      `${config.spreedlyUrl}/v1/payment_methods.json`,
      { payment_method: { payment_method_type: 'paypal', retained: true } },
      { headers: spreedlyHeaders() }
    );
    const paymentMethodToken =
      pmResponse.data?.transaction?.payment_method?.token ||
      pmResponse.data?.payment_method?.token;
    if (!paymentMethodToken) {
      res.status(502).json({ error: 'Spreedly did not return a payment method token' });
      return;
    }

    const origin = publicOrigin(req);
    const verifyResponse = await axios.post(
      `${config.spreedlyUrl}/v1/gateways/${config.ppcpGatewayToken}/verify.json`,
      {
        transaction: {
          payment_method_token: paymentMethodToken,
          redirect_url: callerUrl(redirect_url) || `${origin}/ppcp/return/`,
          callback_url: callerUrl(callback_url) || `${origin}/api/v1/offsite-callback`,
          retain_on_success: true,
          gateway_specific_fields: {
            paypal_commerce_platform: {
              application_context: {
                brand_name: 'Spreedly PPCP Demo',
                shipping_preference: 'NO_SHIPPING',
                user_action: 'CONTINUE',
              },
            },
          },
        },
      },
      { headers: spreedlyHeaders() }
    );
    const transaction = verifyResponse.data?.transaction;
    const checkoutUrl = transaction?.checkout_url || transaction?.response?.checkout_url;
    if (!checkoutUrl) {
      res.status(502).json({ error: 'Spreedly did not return a checkout_url', transaction });
      return;
    }

    res.json({
      checkout_url: checkoutUrl,
      transaction_token: transaction.token,
      state: transaction.state,
      transaction_type: transaction.transaction_type,
      payment_method_token: paymentMethodToken,
    });
  } catch (error) {
    handleError(error, res);
  }
};

// Record a verification the buyer already approved. Spreedly finalizes on its own redirect leg
// before landing the buyer, so this only reads the transaction back and files the payment method.
export const completeSpreedlyPPCPVaultSetup = async (
  req: Request,
  res: Response
): Promise<void> => {
  const transactionToken = req.body?.transactionToken;
  if (!transactionToken) {
    res.status(400).json({ error: 'transactionToken is required' });
    return;
  }

  try {
    const after = await axios.get(
      `${config.spreedlyUrl}/v1/transactions/${encodeURIComponent(transactionToken)}.json`,
      { headers: spreedlyHeaders() }
    );
    const transaction = after.data?.transaction;
    if (!transaction?.succeeded || !transaction.payment_method?.token) {
      res.status(502).json({
        error: 'Verification did not succeed',
        state: transaction?.state,
        message: transaction?.message,
      });
      return;
    }

    const saved = await recordVaultedWalletByToken(transaction.payment_method.token);
    if (!saved) {
      res.status(502).json({
        error: 'Verification succeeded but the payment method has no vault reference',
      });
      return;
    }

    res.json({ status: 'SUCCESS', ...savedPaymentMethodPayload(saved) });
  } catch (error) {
    handleError(error, res);
  }
};

// Lets a return page tell a payment to capture from a verification to record — Spreedly puts only
// `transaction_token` on the URL.
export const getSpreedlyPPCPTransactionByToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  const transactionToken = req.params.transactionToken;
  if (!transactionToken) {
    res.status(400).json({ error: 'transactionToken is required' });
    return;
  }
  try {
    const response = await axios.get(
      `${config.spreedlyUrl}/v1/transactions/${encodeURIComponent(transactionToken)}.json`,
      { headers: spreedlyHeaders() }
    );
    const transaction = response.data?.transaction;
    res.json({
      token: transaction?.token,
      transaction_type: transaction?.transaction_type,
      state: transaction?.state,
      succeeded: transaction?.succeeded,
      message: transaction?.message,
      payment_method_type: transaction?.payment_method?.payment_method_type,
      // Not payment_method.reference — that is a pre-approval snapshot, always null here.
      vault_reference: transaction?.gateway_transaction_id,
    });
  } catch (error) {
    handleError(error, res);
  }
};

// GET /api/v1/ppcp/spreedly/vault/tokens — saved methods for the demo list.
export const listSpreedlyPPCPVaultTokens = async (_req: Request, res: Response): Promise<void> => {
  res.json({
    tokens: spreedlyVaultedTokens.map((t, index) => ({
      ref: index,
      createdAt: t.createdAt,
      label: t.label || 'PayPal account',
      details: t.details || {},
    })),
  });
};

// Charge a saved method through Spreedly. initiator 'CUSTOMER' = buyer present (one-click);
// 'MERCHANT' (default) = buyer absent (recurring MIT).
export const chargeSpreedlyPPCPVaultToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { ref, amount = '10.00', currency_code = 'USD', initiator = 'MERCHANT' } = req.body || {};
  const token = spreedlyVaultedTokens[Number(ref)];
  if (!token) {
    res.status(404).json({ error: 'No saved payment method for that ref' });
    return;
  }
  const buyerPresent = initiator === 'CUSTOMER';
  try {
    assertGatewayConfigured();
    const response = await axios.post(
      `${config.spreedlyUrl}/v1/gateways/${config.ppcpGatewayToken}/purchase.json`,
      {
        transaction: {
          payment_method_token: token.paymentMethodToken,
          amount: toMinorUnits(amount),
          currency_code,
          stored_credential_initiator: buyerPresent ? 'cardholder' : 'merchant',
          stored_credential_reason_type: buyerPresent ? 'unscheduled' : 'recurring',
        },
      },
      { headers: spreedlyHeaders() }
    );
    const transaction = response.data?.transaction;
    res.json({
      id: transaction?.token,
      status: transaction?.state,
      succeeded: !!transaction?.succeeded,
      message: transaction?.message,
      amount: transaction?.amount,
      currency_code: transaction?.currency_code,
      initiator: buyerPresent ? 'CUSTOMER' : 'MERCHANT',
      scenario: buyerPresent ? 'one-click (buyer present)' : 'recurring MIT (buyer not present)',
      gatewayTransactionId: transaction?.gateway_transaction_id,
      storedCredentialInitiator: transaction?.stored_credential_initiator,
      storedCredentialReasonType: transaction?.stored_credential_reason_type,
    });
  } catch (error) {
    handleError(error, res);
  }
};

// Finalize an in-page approval that did not come back through the redirect. Requires the order to 
// have been created with transaction_type 'purchase'.
export const confirmSpreedlyPPCPOrder = async (
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
    const response = await axios.post(
      `${config.spreedlyUrl}/v1/transactions/${transactionToken}/confirm.json`,
      {
        state: 'Successful',
        nonce: orderId, // the approved PayPal order id stands in for Braintree's nonce
        payment_method: {
          payment_method_type: resolvePaymentMethodType(req.body?.payment_method_type),
        },
      },
      { headers: spreedlyHeaders() }
    );
    const transaction = response.data?.transaction;
    res.json({
      id: orderId,
      status: transaction?.state,
      succeeded: !!transaction?.succeeded,
      message: transaction?.message,
      transaction_type: transaction?.transaction_type,
      confirmToken: transaction?.token,
      authorizationToken: transactionToken,
      gatewayTransactionId: transaction?.gateway_transaction_id,
    });
  } catch (error) {
    handleError(error, res);
  }
};
