import axios, { AxiosError } from 'axios';
import { createHash, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import { UserAgentAugmentedRequest } from 'express-useragent'
import config from '../config';
import { core, INVALID_TOKEN, isSpreedlyToken, sendCoreError } from '../coreClient';
import { checkRedirectUrl, INVALID_REDIRECT_URL, serverCallbackUrl } from '../returnUrls';

const OFFSITE_RETURN_PAGE = '/offsite-payments/handle_redirect.html';

const getGatewayKey = (gateway: string = 'spreedly') => {
  switch (gateway) {
    case 'paypal':
      return config.paypalGatewayToken;
    case 'ebanx':
      return config.ebanxGatewayToken;
    case 'stripe':
      return config.stripeGatewayToken;
    case 'braintree':
      return config.braintreeGatewayToken;
    case 'ppcp':
      return config.ppcpGatewayToken;
    case 'spreedly':
      return config.spreedlyGatewayToken;
    default:
      return config.spreedlyGatewayToken;
  }
};

// The page tags each payment method it creates with sha256(owner secret) as metadata, and sends
// the secret to retain. Only the tab that created a payment method can retain it.
const OWNER_METADATA_KEY = 'sample_app_owner';
const OWNER_SECRET_PATTERN = /^[A-Za-z0-9-]{16,128}$/;
const NOT_OWNER = { error: 'This payment method was not created in this session' };

const ownsPaymentMethod = (secret: string, paymentMethod: unknown): boolean => {
  const stored = (paymentMethod as { metadata?: Record<string, unknown> } | undefined)?.metadata?.[
    OWNER_METADATA_KEY
  ];
  if (typeof stored !== 'string') return false;
  const expected = createHash('sha256').update(secret).digest();
  const actual = Buffer.from(stored, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const retainPaymentMethod = async (req: Request, res: Response): Promise<void> => {
  const token = req.params.paymentMethodToken;
  if (!isSpreedlyToken(token)) {
    res.status(400).json({ error: 'Invalid payment method token format' });
    return;
  }

  const secret = req.body?.owner_secret;
  if (typeof secret !== 'string' || !OWNER_SECRET_PATTERN.test(secret)) {
    res.status(403).json(NOT_OWNER);
    return;
  }

  try {
    const existing = await core.get(`/v1/payment_methods/${encodeURIComponent(token)}.json`);
    if (!ownsPaymentMethod(secret, existing.data?.payment_method)) {
      res.status(403).json(NOT_OWNER);
      return;
    }
  } catch (error) {
    // An unknown token gets the same answer as someone else's, so this can't probe for tokens.
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      res.status(403).json(NOT_OWNER);
      return;
    }
    sendCoreError(error, res);
    return;
  }

  try {
    const response = await core.put(
      `/v1/payment_methods/${encodeURIComponent(token)}/retain`,
      { data: true }
    );
    res.json(response.data);
  } catch (error) {
    if (error instanceof AxiosError) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
};

export const createPurchaseTransaction = async (req: UserAgentAugmentedRequest, res: Response): Promise<void> => {
  const browserInfo = {
    user_agent: req.useragent?.source,
    is_mobile: req.useragent?.isMobile,
    is_desktop: req.useragent?.isDesktop,
    browser: req.useragent?.browser,
    version: req.useragent?.version,
    platform: req.useragent?.platform,
    os: req.useragent?.os,
  }

  const attempt_3dsecure = req.body.attempt_3dsecure;
  const isTestProvider = req.body.sca_provider_type === 'test';
  const sca_provider_key = isTestProvider
    ? config.spreedlySCAProviderKeyTestScenario
    : config.spreedlySCAProviderKey;
  const test_scenario = req.body.test_scenario;

  const build3dsParams = () => {
    // If attempt_3dsecure is true, we want to attempt gateway specific 3DS
    if (attempt_3dsecure) {
      return { attempt_3dsecure, three_ds_version: 2 };
    }

    // no sca provider key, plain purchase
    if (!sca_provider_key) {
      return {};
    }

    // global 3ds, test provider flow
    if (isTestProvider) {
      return {
        sca_provider_key,
        ...(test_scenario
          ? { sca_authentication_parameters: { test_scenario: { scenario: test_scenario } } }
          : {}),
      };
    }

    // global 3ds, forter flow
    return { sca_provider_key };
  }


  const requestBody = {
    transaction: {
      amount: req.body.amount,
      currency_code: req.body.currency_code,
      payment_method_token: req.body.payment_method_token,
      ip: req.ip || '127.0.0.1',
      ...build3dsParams(),
      browser_info: btoa(JSON.stringify(browserInfo)),
    }
  };

  try {
    const response = await core.post(
      `/v1/gateways/${config.spreedlyGatewayToken}/purchase.json`,
      requestBody
    );
    res.json(response.data);
  } catch (error) {
    sendCoreError(error, res);
  }
};

// Web SDK endpoint for creating a purchase with 3DS
export const createPurchaseWith3DS = async (req: Request, res: Response): Promise<void> => {
  const gateway_key = config.spreedlyGatewayToken;

  const payment_method_token = req.body.payment_method_token;
  const amount = req.body.amount;
  const browser_info = req.body.browser_info;
  const currency_code = req.body.currency_code;

  const isTestProvider = req.body.sca_provider_type === 'test';
  const sca_provider_key = isTestProvider
    ? config.spreedlySCAProviderKeyTestScenario
    : config.spreedlySCAProviderKey;
  const test_scenario = req.body.test_scenario;

  const body = {
    transaction: {
      sca_provider_key,
      payment_method_token,
      ...(isTestProvider && test_scenario
        ? { sca_authentication_parameters: { test_scenario: { scenario: test_scenario } } }
        : {}),
      amount,
      browser_info,
      currency_code,
    },
  };
  try {
    const response = await core.post(`/v1/gateways/${gateway_key}/purchase.json`, body);
    res.json(response.data);
  } catch (error) {
    sendCoreError(error, res);
  }
};

// Web SDK endpoint for Gateway Specific 3DS purchase
// Uses three_ds_version=2 and attempt_3dsecure=true instead of sca_provider_key
export const createPurchaseWith3DSGatewaySpecific = async (req: Request, res: Response): Promise<void> => {
  const gateway_key = getGatewayKey(req.body.gateway || 'spreedly');

  const payment_method_token = req.body.payment_method_token;
  const amount = req.body.amount;
  const browser_info = req.body.browser_info;
  const currency_code = req.body.currency_code || 'USD';

  const body = {
    transaction: {
      payment_method_token,
      amount,
      currency_code,
      browser_info,
      three_ds_version: '2',
      attempt_3dsecure: true,
    },
  };

  try {
    const response = await core.post(`/v1/gateways/${gateway_key}/purchase.json`, body);
    res.json(response.data);
  } catch (error) {
    sendCoreError(error, res);
  }
};

// Complete a 3DS transaction
export const completeTransaction = async (req: Request, res: Response): Promise<void> => {
  const transactionToken = req.params.transactionToken;
  if (!isSpreedlyToken(transactionToken)) {
    res.status(400).json(INVALID_TOKEN);
    return;
  }
  try {
    const response = await core.post(
      `/v1/transactions/${encodeURIComponent(transactionToken)}/complete.json`,
      {}
    );
    res.json(response.data);
  } catch (error) {
    sendCoreError(error, res);
  }
};

// Web SDK endpoint for Simple purchase without 3DS (no sca_provider_key, browser_info)
export const createSimplePurchase = async (req: Request, res: Response): Promise<void> => {
  const gateway_key = config.spreedlyGatewayToken;

  const payment_method_token = req.body.payment_method_token;
  const amount = req.body.amount;
  const currency_code = req.body.currency_code || 'USD';

  const body = {
    transaction: {
      payment_method_token,
      amount,
      currency_code,
    },
  };

  try {
    const response = await core.post(`/v1/gateways/${gateway_key}/purchase.json`, body);

    const transaction = response.data?.transaction;
    res.json({
      success: transaction?.succeeded || false,
      transaction: transaction,
    });
  } catch (error) {
    sendCoreError(error, res);
  }
};

// Web SDK endpoint demonstrating Stripe Radar fraud signals.
// The browser calls sdk.stripeRadar(publishableKey) to create a Stripe Radar
// session and posts the resulting session id here. We forward it to Stripe
// through the Stripe Payment Intents gateway using the documented
// gateway_specific_fields.stripe_payment_intents.radar_session_id field, so
// Stripe can correlate its fraud evaluation with this charge.
export const createStripeRadarPurchase = async (req: Request, res: Response): Promise<void> => {
  const gateway_key = config.stripeGatewayToken;

  const payment_method_token = req.body.payment_method_token;
  const amount = req.body.amount;
  const currency_code = req.body.currency_code || 'USD';
  const radar_session_id = req.body.radar_session_id;

  if (!gateway_key) {
    res.status(500).json({
      error: 'STRIPE_GATEWAY_TOKEN_NEW is not configured. A Stripe Payment Intents gateway is required for the Radar demo.',
    });
    return;
  }

  const transaction: Record<string, unknown> = {
    payment_method_token,
    amount,
    currency_code,
  };

  // Only attach the gateway-specific field when we actually have a session id,
  // so a failed/absent Radar session still produces a normal Stripe charge.
  if (radar_session_id) {
    transaction.gateway_specific_fields = {
      stripe_payment_intents: {
        radar_session_id,
      },
    };
  }

  try {
    const response = await core.post(`/v1/gateways/${gateway_key}/purchase.json`, { transaction });

    const tx = response.data?.transaction;
    res.json({
      success: tx?.succeeded || false,
      radar_session_forwarded: Boolean(radar_session_id),
      transaction: tx,
    });
  } catch (error) {
    sendCoreError(error, res);
  }
};

//Create an offsite purchase
export const createOffsitePurchase = async (req: Request, res: Response): Promise<void> => {
  const gateway_key = getGatewayKey(req.body.gateway || 'spreedly');

  const { payment_method_token, amount, currency_code = 'USD', redirect_url } = req.body;

  const redirect = checkRedirectUrl(redirect_url, OFFSITE_RETURN_PAGE);
  if (!redirect.ok) {
    res.status(400).json(INVALID_REDIRECT_URL);
    return;
  }

  const body = {
    transaction: {
      payment_method_token,
      amount,
      currency_code,
      redirect_url: redirect.url,
      callback_url: serverCallbackUrl(),
    },
  };

  try {
    const response = await core.post(`/v1/gateways/${gateway_key}/purchase.json`, body);

    const transaction = response.data?.transaction;

    // For offsite transactions, the response includes checkout_url
    res.json({
      success: transaction?.succeeded || false,
      transaction: transaction,
      checkout_url: transaction?.checkout_url,
      state: transaction?.state,
    });
  } catch (error) {
    sendCoreError(error, res);
  }
};

export const getTransaction = async (req: Request, res: Response): Promise<void> => {
  const transactionToken = req.params.transactionToken;
  if (!isSpreedlyToken(transactionToken)) {
    res.status(400).json(INVALID_TOKEN);
    return;
  }
  try {
    const response = await core.get(`/v1/transactions/${encodeURIComponent(transactionToken)}.json`);
    res.json(response.data);
  } catch (error) {
    sendCoreError(error, res);
  }
};

export const handleOffsiteCallback = async (req: Request, res: Response): Promise<void> => {
  // In a production app, you would:
  // 1. Verify the callback authenticity
  // 2. Update your database with the transaction status
  // 3. Send notifications to the user

  // For the demo, we just acknowledge receipt
  res.status(200).json({ received: true });
};

// Stripe APM types the demo offers. Anything else is dropped.
const STRIPE_APM_TYPES = ['ideal', 'bancontact', 'eps', 'p24', 'sepa_debit'];

export const createStripeAPMPurchase = async (req: Request, res: Response): Promise<void> => {
  const {
    amount = 1000,
    currency_code = 'EUR',
    apm_types = STRIPE_APM_TYPES,
    redirect_url,
  } = req.body;

  const redirect = checkRedirectUrl(redirect_url, OFFSITE_RETURN_PAGE);
  if (!redirect.ok) {
    res.status(400).json(INVALID_REDIRECT_URL);
    return;
  }

  const gateway_key = config.stripeGatewayToken;

  const body = {
    transaction: {
      amount,
      currency_code,
      redirect_url: redirect.url,
      callback_url: serverCallbackUrl(),
      payment_method: {
        payment_method_type: 'stripe_apm',
        apm_types: Array.isArray(apm_types)
          ? apm_types.filter((type: unknown) => STRIPE_APM_TYPES.includes(type as string))
          : STRIPE_APM_TYPES,
      },
    },
  };

  try {
    const response = await core.post(`/v1/gateways/${gateway_key}/purchase.json`, body);
    res.json(response.data);
  } catch (error) {
    sendCoreError(error, res);
  }
};

// EBANX offsite purchase. The page sends { gateway, transaction: { ... } }; only the fields
// below reach Spreedly.
export const createPurchase = async (req: Request, res: Response): Promise<void> => {
  const gateway_key = getGatewayKey(req.body.gateway || 'spreedly');
  const { payment_method_token, amount, currency_code, redirect_url } = req.body.transaction || {};

  const redirect = checkRedirectUrl(redirect_url, OFFSITE_RETURN_PAGE);
  if (!redirect.ok) {
    res.status(400).json(INVALID_REDIRECT_URL);
    return;
  }

  const body = {
    transaction: {
      payment_method_token,
      amount,
      currency_code,
      redirect_url: redirect.url,
      callback_url: serverCallbackUrl(),
    },
  };

  try {
    const response = await core.post(`/v1/gateways/${gateway_key}/purchase.json`, body);
    res.json(response.data);
  } catch (error) {
    sendCoreError(error, res);
  }
}

export const createBraintreePurchase = async (req: Request, res: Response): Promise<void> => {
  const {
    amount = 1000,
    currency_code = 'USD',
    redirect_url,
  } = req.body;

  const redirect = checkRedirectUrl(redirect_url, OFFSITE_RETURN_PAGE);
  if (!redirect.ok) {
    res.status(400).json(INVALID_REDIRECT_URL);
    return;
  }

  const gateway_key = config.braintreeGatewayToken;
  const body: Record<string, unknown> = {
    transaction: {
      amount,
      currency_code,
      redirect_url: redirect.url,
      callback_url: serverCallbackUrl(),
      payment_method: {
        payment_method_type: 'paypal',
        offsite_sync: true,
      },
      gateway_specific_fields: {
        braintree: {
          paypal_flow_type: "checkout",
        },
      },
    },
  };

  try {
    const response = await core.post(`/v1/gateways/${gateway_key}/purchase.json`, body);

    res.json(response.data);
  } catch (error) {
    sendCoreError(error, res);
  }
};

// Run a purchase against an ACH (bank_account) payment method token using
// the Spreedly Test gateway. Mirrors createSimplePurchase but is dedicated to
// ACH so it can be wired and documented independently for the demo flow.
export const createAchPurchase = async (req: Request, res: Response): Promise<void> => {
  const gateway_key = config.spreedlyGatewayToken;

  const { payment_method_token, amount, currency_code = 'USD' } = req.body;

  if (!payment_method_token || !amount) {
    res.status(400).json({ error: 'payment_method_token and amount are required' });
    return;
  }

  const body = {
    transaction: {
      payment_method_token,
      amount,
      currency_code,
    },
  };

  try {
    const response = await core.post(`/v1/gateways/${gateway_key}/purchase.json`, body);

    const transaction = response.data?.transaction;
    res.json({
      success: transaction?.succeeded || false,
      transaction,
    });
  } catch (error) {
    sendCoreError(error, res);
  }
};

// Confirm a Braintree/Stripe-apm transaction with the nonce from PayPal/Venmo
export const confirmTransaction = async (req: Request, res: Response): Promise<void> => {
  const transaction_token = req.params.transactionToken;
  if (!isSpreedlyToken(transaction_token)) {
    res.status(400).json(INVALID_TOKEN);
    return;
  }
  const { state, nonce, payment_method_type } = req.body;

  const body: Record<string, unknown> = {
    state,
    nonce,
    payment_method: {
      payment_method_type,
    }
  };

  try {
    const response = await core.post(
      `/v1/transactions/${encodeURIComponent(transaction_token)}/confirm.json`,
      body
    );

    res.json(response.data);
  } catch (error) {
    sendCoreError(error, res);
  }
};

type PazeShippingAddress = {
  shipping_address1?: string;
  shipping_address2?: string;
  shipping_city?: string;
  shipping_country?: string;
  shipping_state?: string;
  shipping_zip?: string;
};

/** Builds third_party_network_token fields for Paze payment method creation */
const buildPazeThirdPartyNetworkToken = (
  securedPayload: string,
  sessionId?: string,
  payloadId?: string,
  shippingAddress?: PazeShippingAddress
): Record<string, unknown> => {
  const token: Record<string, unknown> = {
    certificate_token: config.pazeCertificateToken,
    secured_payload: securedPayload,
    source: 'paze',
  };

  if (sessionId) {
    token.session_id = sessionId;
  }
  if (payloadId) {
    token.payload_id = payloadId;
  }
  if (shippingAddress?.shipping_address1) {
    token.shipping_address1 = shippingAddress.shipping_address1;
  }
  if (shippingAddress?.shipping_address2) {
    token.shipping_address2 = shippingAddress.shipping_address2;
  }
  if (shippingAddress?.shipping_city) {
    token.shipping_city = shippingAddress.shipping_city;
  }
  if (shippingAddress?.shipping_country) {
    token.shipping_country = shippingAddress.shipping_country;
  }
  if (shippingAddress?.shipping_state) {
    token.shipping_state = shippingAddress.shipping_state;
  }
  if (shippingAddress?.shipping_zip) {
    token.shipping_zip = shippingAddress.shipping_zip;
  }

  return token;
};

/** Creates a Paze payment method from securedPayload via third_party_network_token */
export const createPazePaymentMethod = async (req: Request, res: Response): Promise<void> => {
  const {
    payloadId,
    provisionNetworkToken,
    retained,
    securedPayload,
    sessionId,
    shippingAddress,
  } = req.body;

  if (!securedPayload) {
    res.status(400).json({ error: 'securedPayload is required' });
    return;
  }

  const paymentMethod: Record<string, unknown> = {
    third_party_network_token: buildPazeThirdPartyNetworkToken(
      securedPayload,
      sessionId,
      payloadId,
      shippingAddress
    ),
  };

  if (retained) {
    paymentMethod.retained = true;
  }
  if (provisionNetworkToken) {
    paymentMethod.provision_network_token = true;
  }

  try {
    const response = await core.post('/v1/payment_methods.json', { payment_method: paymentMethod });

    const paymentMethodToken = response.data?.transaction?.payment_method?.token;
    res.json({
      payment_method: response.data?.transaction?.payment_method,
      payment_method_token: paymentMethodToken,
      success: Boolean(paymentMethodToken),
      transaction: response.data?.transaction,
    });
  } catch (error) {
    sendCoreError(error, res);
  }
};
