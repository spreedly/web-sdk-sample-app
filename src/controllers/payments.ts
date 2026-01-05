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

    // Added filtering to only return payment methods that have a first name, last name, or full name
    const paymentMethods: PaymentMethod[] = response.data.payment_methods;
    const filteredResponse: PaymentMethod[] = paymentMethods.filter(
      (paymentMethod) =>
        paymentMethod.first_name || paymentMethod.last_name || paymentMethod.full_name
    );
    res.json({ payment_methods: filteredResponse });
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

  const requestBody = {
    transaction: {
      amount: req.body.amount,
      currency_code: req.body.currency_code,
      payment_method_token: req.body.payment_method_token,
      sca_provider_key: config.spreedlySCAProviderKey,
      ip: req.ip || '127.0.0.1',
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
    if (error instanceof AxiosError) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
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
    if (error instanceof AxiosError) {
      res.status(500).json({ error: error.message }); 
    } else {
      res.status(500).json({ error: 'An unknown error occurred' });
    }
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
