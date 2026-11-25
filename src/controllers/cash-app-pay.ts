import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

// TODO: Implementation pending
// Spreedly Core's cash_app gateway isn't available yet. Replace this mock with a purchase on the
// cash_app gateway token (POST /v1/gateways/{token}/purchase.json) once it is.
// POST /api/v1/cash-app-pay-purchase
// body: { payment_method_token, amount (cents), currency_code? }
export const createCashAppPayPurchase = (req: Request, res: Response): void => {
  const { payment_method_token, amount, currency_code = 'USD' } = req.body || {};

  if (!payment_method_token || typeof payment_method_token !== 'string') {
    res.status(422).json({ error: 'payment_method_token is required' });
    return;
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    res.status(422).json({ error: 'amount must be a positive integer in cents' });
    return;
  }
  if (currency_code !== 'USD') {
    res.status(422).json({ error: 'Cash App Pay only supports USD' });
    return;
  }

  const now = new Date().toISOString();
  // Synthetic response shaped like a Spreedly purchase. No call to Spreedly is made.
  res.json({
    transaction: {
      amount,
      created_at: now,
      currency_code,
      gateway_type: 'cash_app',
      message: 'Succeeded! (mock)',
      mock: true,
      payment_method: { token: payment_method_token, payment_method_type: 'cash_app_pay' },
      state: 'succeeded',
      succeeded: true,
      token: `mock_txn_${randomUUID().replace(/-/g, '')}`,
      transaction_type: 'Purchase',
      updated_at: now,
    },
  });
};
