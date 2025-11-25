import axios, { AxiosError } from 'axios';
import { Request, Response } from 'express';
import config from '../config';

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
    res.json(response.data);
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
