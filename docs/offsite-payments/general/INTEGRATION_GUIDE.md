# Offsite Payments Integration Guide

This guide covers integrating offsite payment methods (PayPal, EBANX local payment methods, etc.) using the Spreedly Web SDK.

## Overview

Offsite payments require customers to navigate to a third-party page (e.g., PayPal) to authorize payment. The flow involves:

1. Creating a payment method token via the SDK
2. Initiating a purchase transaction on your backend
3. Redirecting the customer to complete payment
4. Handling the redirect back to your site
5. Processing callbacks for transaction status updates

## Prerequisites

- Spreedly account with offsite-capable gateway configured
- Spreedly environment key and API credentials

---

## Step 1: Load the SDK

```html
<script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>
```

## Step 2: Initialize the SDK through either SpreedlyHostedFields or SpreedlyExpressCheckout.

```javascript
const sdk = new SpreedlyHostedFields({
  environment_key: 'your_environment_key',
  certificate_token: 'your_certificate_token',
  nonce: 'generated_nonce',
  timestamp: 'generated_timestamp',
  signature: 'generated_signature'
});
```

## Step 3: Set Up Event Listeners

```javascript
sdk.on('offsiteTokenGenerated', (data) => {
  // data contains: { token, paymentMethodType }
  console.log('Payment method type:', data.paymentMethodType);
  
  // Proceed to create purchase transaction
  createPurchase(data.token);
});

sdk.on('offsitePaymentError', (error) => {
  console.error('Error:', error.message);
});
```

## Step 4: Configure and Submit Offsite Payment

### Simple Flow (PayPal, etc.)

```javascript
sdk.setupOffsitePayment({
  paymentMethodType: 'paypal'
});

sdk.submitOffsitePayment();
```

### With Customer Details (EBANX methods)

```javascript
sdk.setupOffsitePayment({
  paymentMethodType: 'pix',
  email: 'customer@example.com',
  fullName: 'Ana Santos Araujo',
  documentId: '853.513.468-93',
  country: 'BR',
  zip: '12345',
  address1: 'Rua E, 1040',
  city: 'Maracanaú',
  state: 'CE',
  phoneNumber: '8522847035'
});

sdk.submitOffsitePayment();
```

### Configuration Options

| Field | Required | Description |
|-------|----------|-------------|
| `paymentMethodType` | Yes | Payment method type (e.g., `paypal`, `pix`, `oxxo`) |
| `email` | Varies | Customer email address |
| `fullName` | Varies | Customer full name |
| `firstName` | No | Customer first name (alternative to fullName) |
| `lastName` | No | Customer last name (alternative to fullName) |
| `documentId` | Varies | Customer document/tax ID (required for Brazil) |
| `country` | Varies | Two-letter country code |
| `phoneNumber` | No | Customer phone number |
| `address1` | No | Address line 1 |
| `address2` | No | Address line 2 |
| `city` | No | City |
| `state` | No | State/province |
| `zip` | No | Postal/ZIP code |

---

## Step 5: Create Purchase Transaction

After receiving the payment method token, call your backend to create a purchase transaction.

### Frontend: Call Your Backend

```javascript
async function createPurchase(paymentMethodToken) {
  const response = await fetch('/api/offsite-purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payment_method_token: paymentMethodToken,
      amount: 1000,
      currency: 'USD'
    })
  });
  
  const data = await response.json();
  
  // Redirect to payment provider
  if (data.checkout_url) {
    window.location.href = data.checkout_url;
  }
}
```

### Backend: Call Spreedly API

Your backend endpoint should call the Spreedly purchase API:

```javascript
app.post('/api/offsite-purchase', async (req, res) => {
  const { payment_method_token, amount, currency } = req.body;
  
  const response = await fetch(
    `https://core.spreedly.com/v1/gateways/${GATEWAY_TOKEN}/purchase.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${ENVIRONMENT_KEY}:${ACCESS_SECRET}`),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transaction: {
          payment_method_token,
          amount,
          currency_code: currency,
          redirect_url: 'https://yoursite.com/payment/complete',
          callback_url: 'https://yoursite.com/api/payment-callback'
        }
      })
    }
  );
  
  const data = await response.json();
  const transaction = data.transaction;
  
  res.json({
    transaction_token: transaction.token,
    checkout_url: transaction.checkout_url,
    state: transaction.state
  });
});
```

### Spreedly API Response

```json
{
  "transaction": {
    "token": "ExampleTransactionToken123",
    "state": "pending",
    "succeeded": false,
    "amount": 1000,
    "currency_code": "USD",
    "checkout_url": "https://www.paypal.com/checkoutnow?token=86828328C31528625"
  }
}
```

Your backend should return the `checkout_url` to the frontend for redirection.

### Key Response Fields

| Field | Description |
|-------|-------------|
| `token` | Transaction token for status lookups |
| `state` | Transaction state (`pending`, `succeeded`, `failed`, etc.) |
| `checkout_url` | URL to redirect customer for payment authorization |

---

## Step 6: Customer Completes Payment

After redirection, the customer completes payment authorization on the provider's site (e.g., PayPal login and confirmation).

---

## Step 7: Handle Redirect Back

After authorization, the customer is redirected to your `redirect_url` with the transaction token:

```
https://yoursite.com/payment/complete?transaction_token=ExampleTransactionToken123
```

### Frontend: Check Transaction Status

```javascript
async function handlePaymentComplete() {
  const params = new URLSearchParams(window.location.search);
  const transactionToken = params.get('transaction_token');
  
  const response = await fetch(`/api/transaction/${transactionToken}`);
  const data = await response.json();
  
  if (data.succeeded) {
    showSuccessMessage('Payment completed successfully!');
  } else {
    showErrorMessage('Payment failed: ' + data.message);
  }
}
```

### Backend: Verify Transaction with Spreedly

```javascript
app.get('/api/transaction/:transactionToken', async (req, res) => {
  const { transactionToken } = req.params;
  
  const response = await fetch(
    `https://core.spreedly.com/v1/transactions/${transactionToken}.json`,
    {
      headers: {
        'Authorization': 'Basic ' + btoa(`${ENVIRONMENT_KEY}:${ACCESS_SECRET}`)
      }
    }
  );
  
  const data = await response.json();
  const transaction = data.transaction;
  
  res.json({
    succeeded: transaction.succeeded,
    state: transaction.state,
    amount: transaction.amount,
    currency_code: transaction.currency_code,
    message: transaction.message
  });
});
```

### Spreedly API Response (Successful)

```json
{
  "transaction": {
    "token": "ExampleTransactionToken123",
    "state": "succeeded",
    "succeeded": true,
    "amount": 1000,
    "currency_code": "USD"
  }
}
```

---

## Step 8: Handle Callbacks

The `callback_url` receives POST notifications when transaction state changes. This is important because:

- Browser redirects may fail (user closes browser, network issues)
- Some payment methods have delayed settlement (e.g., Boleto)

### Callback Payload

```json
{
  "transactions": [
    {
      "token": "ExampleTransactionToken123",
      "state": "succeeded",
      "succeeded": true,
      "amount": 1000,
      "signed": {
        "signature": "f5b701255eedbe1da6562b535bfbcd3b35fd944c",
        "fields": "amount created_at currency_code state succeeded token",
        "algorithm": "sha1"
      }
    }
  ]
}
```

### Callback Requirements

- Respond with HTTP `200 OK` within 5 seconds
- Use the signed fields to verify authenticity, or make an authenticated API call to fetch transaction details
- Handle idempotently (you may receive multiple callbacks for the same transaction)

---

## Error Handling

### SDK Errors

```javascript
sdk.on('offsitePaymentError', (error) => {
  // handle based on error received.
});
```

### Transaction Errors

Check the `state` and `message` fields in transaction responses:

```json
{
  "transaction": {
    "state": "gateway_processing_failed",
    "succeeded": false,
    "message": "The transaction was declined."
  }
}
```

---

## Testing

Use the Spreedly test gateway with the `sprel` payment method type to simulate offsite flows without a live gateway.

```javascript
sdk.setupOffsitePayment({
  paymentMethodType: 'sprel'
});
```

The test gateway provides a mock checkout page that lets you simulate success, failure, and delayed settlement scenarios.
