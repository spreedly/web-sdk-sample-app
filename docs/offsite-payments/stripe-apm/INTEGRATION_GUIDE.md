# Stripe APM Integration Guide

This guide covers integrating Stripe Alternative Payment Methods (APMs) using the Spreedly Web SDK. Stripe APMs leverage the Stripe Payment Element to render payment method options.

## Overview

Stripe APM integration uses a gateway-specific approach where:

1. Spreedly creates a pending purchase and obtains a `client_secret` from Stripe
2. The SDK uses this `client_secret` to initialize Stripe.js and render the Payment Element
3. Customer completes payment via the Stripe Payment Element
4. Stripe handles payment confirmation and redirects

## Prerequisites

- Spreedly account with Stripe gateway configured
- Stripe publishable key
- Spreedly environment key and API credentials

---

## Step 1: Create Pending Purchase

Create a pending transaction on a Stripe Payment Intents gateway that contains information about how much will be charged, what alternative payment methods will be accepted, and where the customer should be redirected when the transaction is complete. This returns the Stripe `client_secret` needed to initialize the Payment Element.

### Frontend: Call Your Backend

```javascript
async function createStripePurchase() {
  const response = await fetch('/api/stripe-apm-purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 1000,
      currency: 'EUR',
      apm_types: ['ideal', 'bancontact', 'sepa_debit'],
      redirect_url: 'https://yoursite.com/handle_redirect.html'
    })
  });
  
  const data = await response.json();
  return data;
}
```

### Backend: Call Spreedly API

```javascript
app.post('/api/stripe-apm-purchase', async (req, res) => {
  const { amount, currency, apm_types, redirect_url } = req.body;
  
  const response = await fetch(
    `https://core.spreedly.com/v1/gateways/${STRIPE_GATEWAY_TOKEN}/purchase.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${ENVIRONMENT_KEY}:${ACCESS_SECRET}`),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transaction: {
          amount,
          currency_code: currency,
          redirect_url,
          payment_method: {
            payment_method_type: 'stripe_apm',
            apm_types
          }
        }
      })
    }
  );
  
  const data = await response.json();
  res.json(data);
});
```

### Spreedly API Response

```json
{
  "transaction": {
    "token": "StripeAPMTransactionToken",
    "state": "pending",
    "gateway_specific_response_fields": {
      "client_secret": "pi_example_secret_placeholder"
    }
    // ...other properties
  }
}
```

### Key Response Fields

| Field | Description |
|-------|-------------|
| `token` | Transaction token for status lookups |
| `gateway_specific_response_fields.client_secret` | Stripe PaymentIntent client secret for SDK initialization |

---

## Step 2: Set Up HTML

Include the required scripts and add a container element where Stripe Payment Element
will be injected:

```html
<script src="https://js.stripe.com/v3/"></script>
<script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>

<div id="stripe-payment-element"></div>
<button id="submit-payment">Pay</button>
```

---

## Step 3: Initialize the SDK

```javascript
const stripeApm = new SpreedlyStripeAPM({
  publishableKey: 'pk_test_your_stripe_publishable_key',
  clientSecret: 'pi_example_secret_placeholder',
  transactionToken: 'StripeAPMTransactionToken',
  paymentElement: 'stripe-payment-element', 
  appearance: {
    theme: 'stripe'
  }
});
```

### Configuration Options

| Option | Required | Description |
|--------|----------|-------------|
| `publishableKey` | Yes | Stripe publishable key from your Stripe dashboard |
| `clientSecret` | Yes | Client secret from pending purchase response |
| `transactionToken` | Yes | Spreedly transaction token from pending purchase |
| `paymentElement` | Yes | DOM element ID where Stripe Payment Element will be rendered |
| `appearance` | No | Stripe Elements appearance configuration |

### Appearance Customization

```javascript
const appearance = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#0570de',
    colorBackground: '#ffffff',
    colorText: '#30313d',
    colorDanger: '#df1b41',
    fontFamily: 'system-ui, sans-serif',
    borderRadius: '4px'
  },
  rules: {
    '.Input': {
      border: '1px solid #e0e0e0'
    }
  }
};
```

---

## Step 4: Mount the Payment Element

```javascript
const result = stripeApm.mount();

if (result.error) {
  console.error('Mount failed:', result.error);
}
```

The Payment Element renders Stripe's pre-built UI for accepting payments, displaying available payment methods based on your Stripe configuration and the customer's location.

---

## Step 5: Handle Payment Submission through the `confirmPayment` method

```javascript
const submitButton = document.getElementById('submit-payment');

submitButton.addEventListener('click', async () => {
  submitButton.disabled = true;
  
  const result = await stripeApm.confirmPayment();

  if (result.error) {
    console.error(result.error);
    submitButton.disabled = false;
  }
  // If no error, user has been redirected
});
```

---

## Step 6: Handle Redirect and Check Transaction Status

After successful payment, the customer is redirected to your `redirect_url` (specified in Step 1) with the transaction token:

```
https://yoursite.com/payment/complete?transaction_token=StripeAPMTransactionToken
```

### Frontend: Handle Redirect

```javascript
async function handlePaymentComplete() {
  const params = new URLSearchParams(window.location.search);
  const transactionToken = params.get('transaction_token');
  
  if (!transactionToken) {
    showErrorMessage('No transaction token received');
    return;
  }
  
  // Check transaction status with your backend
  const response = await fetch(`/api/transactions/${transactionToken}`);
  const data = await response.json();
  
  if (data.transaction.succeeded) {
    showSuccessMessage('Payment completed successfully!');
  } else if (data.transaction.state === 'pending') {
    showPendingMessage('Payment is being processed...');
  } else {
    showErrorMessage('Payment failed');
  }
}
```

### Backend: Get Transaction Status from Spreedly

```javascript
app.get('/api/transactions/:transactionToken', async (req, res) => {
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
  res.json(data);
});
```

### Spreedly API Response

```json
{
  "transaction": {
    "token": "StripeAPMTransactionToken",
    "state": "succeeded",
    "succeeded": true,
    "amount": 1000,
    "currency_code": "EUR"
  }
}
```

---

## Complete Integration Example

### HTML

```html
<!DOCTYPE html>
<html>
<head>
  <title>Checkout</title>
  <script src="https://js.stripe.com/v3/"></script>
  <script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>
</head>
<body>
  <div id="stripe-payment-element"></div>
  <button id="submit-payment">Pay $10.00</button>

  <script src="checkout.js"></script>
</body>
</html>
```

### JavaScript (checkout.js)

```javascript
async function initializeCheckout() {
  // 1. Create pending purchase (fetch from your backend)
  const response = await fetch('/api/create-stripe-purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 1000,
      currency: 'USD'
    })
  });
  
  const { clientSecret, transactionToken } = await response.json();

  // 2. Initialize SDK
  const stripeApm = new SpreedlyStripeAPM({
    publishableKey: 'pk_test_your_key',
    clientSecret: clientSecret,
    transactionToken: transactionToken,
    paymentElement: 'stripe-payment-element',
    appearance: { theme: 'stripe' }
  });

  // 3. Mount Payment Element
  const mountResult = stripeApm.mount();
  if (mountResult.error) {
    console.error('Mount failed:', mountResult.error);
    return;
  }

  // 4. Handle submission
  document.getElementById('submit-payment').addEventListener('click', async (e) => {
    e.target.disabled = true;
    
    const result = await stripeApm.confirmPayment();

    if (result.error) {
      alert(result.error);
      e.target.disabled = false;
    }
    // On success, browser redirects automatically
  });
}

initializeCheckout();
```

---

## Error Handling

### SDK Errors

```javascript
const result = await stripeApm.confirmPayment();

if (result.error) {
  // result.error is a string containing the error message
  showError(result.error);
}
// On success, browser redirects automatically
```

### Transaction Verification

Always verify transaction status with Spreedly on your backend:

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
  res.json(data.transaction);
});
```

