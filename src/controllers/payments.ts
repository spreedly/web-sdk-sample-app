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
    if (error instanceof Error) {
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
  const gateway_key = config.spreedlyGatewayToken;

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
    if (error instanceof AxiosError) {
      res.status(500).json({ 
        success: false,
        error: error.message,
        details: error.response?.data 
      }); 
    } else {
      res.status(500).json({ 
        success: false,
        error: 'An unknown error occurred' 
      });
    }
  }
};

// =====================================================
// OFFSITE PAYMENTS
// =====================================================

/**
 * Create an offsite purchase
 * This initiates the purchase and returns a checkout_url for redirect
 */
export const createOffsitePurchase = async (req: Request, res: Response): Promise<void> => {
  const gateway_key = config.spreedlyGatewayToken;
  
  const payment_method_token = req.body.payment_method_token;
  const amount = req.body.amount;
  const currency_code = req.body.currency_code || 'USD';
  const redirect_url = req.body.redirect_url;
  const callback_url = req.body.callback_url;
  
  if (!payment_method_token || !amount) {
    res.status(400).json({ error: 'payment_method_token and amount are required' });
    return;
  }
  
  if (!redirect_url || !callback_url) {
    res.status(400).json({ error: 'redirect_url and callback_url are required for offsite payments' });
    return;
  }
  
  const body = {
    transaction: {
      payment_method_token,
      amount,
      currency_code,
      redirect_url,
      callback_url,
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
    if (error instanceof AxiosError) {
      console.error('Create offsite purchase error:', error.response?.data);
      res.status(error.response?.status || 500).json({ 
        error: error.message,
        details: error.response?.data 
      }); 
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
};

/**
 * Get transaction status
 * Used to check the status of a transaction after redirect
 */
export const getTransaction = async (req: Request, res: Response): Promise<void> => {
  const transactionToken = req.params.transactionToken || '';
  
  // Validate token format
  if (!/^[a-zA-Z0-9_\-]+$/.test(transactionToken)) {
    res.status(400).json({ error: 'Invalid transaction token format' });
    return;
  }
  
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
    if (error instanceof AxiosError) {
      res.status(error.response?.status || 500).json({ 
        error: error.message,
        details: error.response?.data 
      }); 
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
  }
};

/**
 * Handle offsite callback
 * This endpoint receives callbacks from Spreedly when offsite transactions complete
 */
export const handleOffsiteCallback = async (req: Request, res: Response): Promise<void> => {
  console.log('Offsite callback received:', JSON.stringify(req.body, null, 2));
  
  // In a production app, you would:
  // 1. Verify the callback authenticity
  // 2. Update your database with the transaction status
  // 3. Send notifications to the user
  
  // For the demo, we just acknowledge receipt
  res.status(200).json({ received: true });
};
