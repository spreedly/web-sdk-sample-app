import axios, { AxiosError } from 'axios';
import { Request, Response } from 'express';
import { UserAgentAugmentedRequest } from 'express-useragent'
import config from '../config';

interface PaymentMethod {
  first_name?: string;
  last_name?: string;
  full_name?: string;
}

const getAuthorizationHeader = () => {
  if (!config.spreedlyEnvironmentKey || !config.spreedlyAccessSecret) {
    throw new Error('SPREEDLY_ENVIRONMENT_KEY and SPREEDLY_ACCESS_SECRET environment variables are required');
  }
  const credentials = Buffer.from(`${config.spreedlyEnvironmentKey}:${config.spreedlyAccessSecret}`).toString('base64');
  return `Basic ${credentials}`;
};

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
    case 'spreedly':
      return config.spreedlyGatewayToken;
    default:
      return config.spreedlyGatewayToken;
  }
};

export const createPaymentMethod = async (req: Request, res: Response): Promise<void> => {
  try {
    const response = await axios.post(
      `${config.spreedlyUrl}/v1/payment_methods/restricted.json`,
      req.body,
      {
        headers: {
          'spreedly-environment-key': req.headers['spreedly-environment-key'],
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    // Forward Spreedly's real status + body (e.g. a 422 with validation errors)
    // instead of collapsing everything into a generic 500 — otherwise the actual
    // tokenization failure reason is lost to the caller.
    if (axios.isAxiosError(error) && error.response) {
      res.status(error.response.status).json(error.response.data);
    } else if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
};

export const getPaymentMethods = async (req: Request, res: Response): Promise<void> => {
  try {
    const response = await axios.get(
      `${config.spreedlyUrl}/v1/payment_methods`,
      {
        params: {
          order: 'desc',
        },
        headers: {
          Authorization: getAuthorizationHeader(),
        },
      }
    );

    const paymentMethods: PaymentMethod[] = response.data.payment_methods;
    res.json({ payment_methods: paymentMethods });
  } catch (error) {
    if (error instanceof AxiosError) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
};

export const retainPaymentMethod = async (req: Request, res: Response): Promise<void> => {
  const token = req.params.paymentMethodToken || '';
  // Only allow token to contain alphanumeric, underscore, or hyphen
  if (!/^[a-zA-Z0-9_\-]+$/.test(token)) {
    res.status(400).json({ error: 'Invalid payment method token format' });
    return;
  }

  try {
    const response = await axios.put(
      `${config.spreedlyUrl}/v1/payment_methods/${token}/retain`,
      { data: true },
      {
        headers: {
          Authorization: getAuthorizationHeader(),
        },
      },
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

export const recachePaymentMethod = async (req: Request, res: Response): Promise<void> => {
  const token = req.params.paymentMethodToken || '';
  // Only allow token to contain alphanumeric, underscore, or hyphen
  if (!/^[a-zA-Z0-9_\-]+$/.test(token)) {
    res.status(400).json({ error: 'Invalid payment method token format' });
    return;
  }

  try {
    const response = await axios.post(
      `${config.spreedlyUrl}/v1/payment_methods/${token}/recache.json`,
      req.body,
      {
        headers: {
          'spreedly-environment-key': req.headers['spreedly-environment-key'],
        },
      }
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

  const sca_provider_key = config.spreedlySCAProviderKey;
  const attempt_3dsecure = req.body.attempt_3dsecure;

  const requestBody = {
    transaction: {
      amount: req.body.amount,
      currency_code: req.body.currency_code,
      payment_method_token: req.body.payment_method_token,
      ip: req.ip || '127.0.0.1',
      // If attempt_3dsecure is true, we want to attempt gateway specific 3DS
      ...(sca_provider_key && !attempt_3dsecure ? { sca_provider_key } : {}),
      ...(attempt_3dsecure ? { attempt_3dsecure, three_ds_version: 2 } : {}),
      browser_info: btoa(JSON.stringify(browserInfo)),
    }
  };

  try {
    const response = await axios.post(
      `${config.spreedlyUrl}/v1/gateways/${config.spreedlyGatewayToken}/purchase.json`,
      requestBody,
      {
        headers: {
          Authorization: getAuthorizationHeader(),
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    const apiError = error as AxiosError;
    res.status(apiError.response?.status || 500).json(apiError.response?.data); 
  }
};

// Web SDK endpoint for creating a purchase with 3DS
export const createPurchaseWith3DS = async (req: Request, res: Response): Promise<void> => {
  const sca_provider_key = config.spreedlySCAProviderKey;
  const gateway_key = config.spreedlyGatewayToken;

  const payment_method_token = req.body.payment_method_token;
  const amount = req.body.amount;
  const browser_info = req.body.browser_info;
  const currency_code = req.body.currency_code;
  const body = {
    transaction: {
      sca_provider_key,
      payment_method_token,
      amount,
      browser_info,
      currency_code,
    },
  };
  try {
    const response = await axios.post(
      `${config.spreedlyUrl}/v1/gateways/${gateway_key}/purchase.json`, body, 
      {
        headers: {
          Authorization: getAuthorizationHeader(),
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    const apiError = error as AxiosError;
    res.status(apiError.response?.status || 500).json(apiError.response?.data); 
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
    const response = await axios.post(
      `${config.spreedlyUrl}/v1/gateways/${gateway_key}/purchase.json`, body, 
      {
        headers: {
          Authorization: getAuthorizationHeader(),
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    const apiError = error as AxiosError;
    res.status(apiError.response?.status || 500).json(apiError.response?.data); 
  }
};

// Complete a 3DS transaction
export const completeTransaction = async (req: Request, res: Response): Promise<void> => {
  const transactionToken = req.params.transactionToken || '';
  try {
    const response = await axios.post(
      `${config.spreedlyUrl}/v1/transactions/${transactionToken}/complete.json`,
      {},
      {
        headers: {
          Authorization: getAuthorizationHeader(),
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    const apiError = error as AxiosError;
    res.status(apiError.response?.status || 500).json(apiError.response?.data);
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
    const response = await axios.post(
      `${config.spreedlyUrl}/v1/gateways/${gateway_key}/purchase.json`, body, 
      {
        headers: {
          Authorization: getAuthorizationHeader(),
        },
      }
    );
    
    const transaction = response.data?.transaction;
    res.json({
      success: transaction?.succeeded || false,
      transaction: transaction,
    });
  } catch (error) {
    const apiError = error as AxiosError;
    res.status(apiError.response?.status || 500).json(apiError.response?.data);
  }
};

// Web SDK endpoint demonstrating Stripe Radar fraud signals.
//
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
    const response = await axios.post(
      `${config.spreedlyUrl}/v1/gateways/${gateway_key}/purchase.json`,
      { transaction },
      {
        headers: {
          Authorization: getAuthorizationHeader(),
        },
      }
    );

    const tx = response.data?.transaction;
    res.json({
      success: tx?.succeeded || false,
      radar_session_forwarded: Boolean(radar_session_id),
      transaction: tx,
    });
  } catch (error) {
    const apiError = error as AxiosError;
    res.status(apiError.response?.status || 500).json(apiError.response?.data);
  }
};

//Create an offsite purchase
export const createOffsitePurchase = async (req: Request, res: Response): Promise<void> => {
  const gateway_key = getGatewayKey(req.body.gateway || 'spreedly');
  
  const {payment_method_token, amount, currency_code = 'USD', redirect_url, callback_url, ...rest} = req.body;
  
  const body = {
    transaction: {
      payment_method_token,
      amount,
      currency_code,
      redirect_url,
      callback_url,
      ...rest,
    },
  };
  
  try {
    const response = await axios.post(
      `${config.spreedlyUrl}/v1/gateways/${gateway_key}/purchase.json`,
      body,
      {
        headers: {
          Authorization: getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
      }
    );
    
    const transaction = response.data?.transaction;
    
    // For offsite transactions, the response includes checkout_url
    res.json({
      success: transaction?.succeeded || false,
      transaction: transaction,
      checkout_url: transaction?.checkout_url,
      state: transaction?.state,
    });
  } catch (error) {
    const apiError = error as AxiosError;
    res.status(apiError.response?.status || 500).json(apiError.response?.data);
  }
};

export const getTransaction = async (req: Request, res: Response): Promise<void> => {
  const transactionToken = req.params.transactionToken || '';  
  try {
    const response = await axios.get(
      `${config.spreedlyUrl}/v1/transactions/${transactionToken}.json`,
      {
        headers: {
          Authorization: getAuthorizationHeader(),
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    const apiError = error as AxiosError;
    res.status(apiError.response?.status || 500).json(apiError.response?.data);
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

export const createStripeAPMPurchase = async (req: Request, res: Response): Promise<void> => {
  const { 
    amount = 1000, 
    currency_code = 'EUR',
    apm_types = ['ideal', 'bancontact', 'eps', 'p24', 'sepa_debit'],
    redirect_url,
    callback_url
  } = req.body;

  const gateway_key = config.stripeGatewayToken;

  const body = {
    transaction: {
      amount,
      currency_code,
      redirect_url,
      callback_url,
      payment_method: {
        payment_method_type: 'stripe_apm',
        apm_types,
      },
    },
  };

  try {
    const response = await axios.post(
      `${config.spreedlyUrl}/v1/gateways/${gateway_key}/purchase.json`,
      body,
      {
        headers: {
          Authorization: getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    const apiError = error as AxiosError;
    res.status(apiError.response?.status || 500).json(apiError.response?.data);
  }
};

export const createPurchase = async (req: Request, res: Response): Promise<void> => { 
  const gateway_key = getGatewayKey(req.body.gateway || 'spreedly');
  try {
    const response = await axios.post(
      `${config.spreedlyUrl}/v1/gateways/${gateway_key}/purchase.json`,
      req.body,
      {
        headers: {
          Authorization: getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
      }
    );    
    res.json(response.data);
  } catch (error) {
    const apiError = error as AxiosError;
    res.status(apiError.response?.status || 500).json(apiError.response?.data);
  }
}

export const createBraintreePurchase = async (req: Request, res: Response): Promise<void> => {
  const { 
    amount = 1000, 
    currency_code = 'USD',
    redirect_url,
    callback_url,
  } = req.body;

  const gateway_key = config.braintreeGatewayToken;
  const body: Record<string, unknown> = {
    transaction: {
      amount,
      currency_code,
      redirect_url,
      callback_url,
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
    const response = await axios.post(
      `${config.spreedlyUrl}/v1/gateways/${gateway_key}/purchase.json`,
      body,
      {
        headers: {
          Authorization: getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
      }
    );
    
    res.json(response.data);
  } catch (error) {
    const apiError = error as AxiosError;
    res.status(apiError.response?.status || 500).json(apiError.response?.data);
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
    const response = await axios.post(
      `${config.spreedlyUrl}/v1/gateways/${gateway_key}/purchase.json`,
      body,
      {
        headers: {
          Authorization: getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
      }
    );

    const transaction = response.data?.transaction;
    res.json({
      success: transaction?.succeeded || false,
      transaction,
    });
  } catch (error) {
    const apiError = error as AxiosError;
    res.status(apiError.response?.status || 500).json(apiError.response?.data);
  }
};

// Confirm a Braintree/Stripe-apm transaction with the nonce from PayPal/Venmo
export const confirmTransaction = async (req: Request, res: Response): Promise<void> => {
  const transaction_token = req.params.transactionToken || '';
  const { state, nonce, payment_method_type } = req.body;
  
  const body: Record<string, unknown> = {
    state,
    nonce,
    payment_method: {
      payment_method_type,
    }
  };

  try {
    const response = await axios.post(
      `${config.spreedlyUrl}/v1/transactions/${transaction_token}/confirm.json`,
      body,
      {
        headers: {
          Authorization: getAuthorizationHeader(),
          'Content-Type': 'application/json',
        },
      }
    );
    
    res.json(response.data);
  } catch (error) {
    const apiError = error as AxiosError;
    res.status(apiError.response?.status || 500).json(apiError.response?.data);
  }
};