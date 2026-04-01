# Braintree APM Integration Guide

This guide covers integrating Braintree Alternative Payment Methods (PayPal and Venmo) using the Spreedly Web SDK.

## Overview

The Braintree APM integration renders native PayPal and Venmo buttons using Braintree's JavaScript SDK. The flow:

1. Create a pending purchase with Spreedly
2. Initialize the SDK with the transaction token
3. Mount the payment buttons
4. Customer clicks PayPal or Venmo button and authorizes payment
5. SDK returns result via callback with a nonce
6. Confirm the transaction with Spreedly using the nonce

## Prerequisites

- Spreedly account with Braintree gateway configured
- Braintree account with PayPal and/or Venmo enabled
- Spreedly environment key and API credentials

---

## Step 1: Create Pending Purchase

Create a pending purchase to obtain the Braintree `client_token`.
Include the following fields:
- Payment Method
  - payment_method_type to be paypal or venmo
  - offsite_sync to be true
- Amount
- Currency Code
- Required gateway specific fields for PayPal and Venmo
  - venmo_flow_type or paypal_flow_type
### Frontend: Call Your Backend

```javascript
async function createBraintreePurchase() {
  const response = await fetch('/api/braintree-purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 1000,
      currency: 'USD'
    })
  });
  
  const data = await response.json();
  return data.transaction.token;
}
```

### Backend: Call Spreedly API

```javascript
app.post('/api/braintree-purchase', async (req, res) => {
  const { amount, currency } = req.body;
  
  const response = await fetch(
    `https://core.spreedly.com/v1/gateways/${BRAINTREE_GATEWAY_TOKEN}/purchase.json`,
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
          payment_method_type: 'paypal',
          gateway_specific_fields: {
            braintree: {
              paypal_flow_type: 'checkout'
            }
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
    "token": "BraintreeTransactionToken",
    "state": "pending",
    "gateway_specific_response_fields": {
      "client_token": "REDACTED_BRAINTREE_CLIENT_TOKEN_EXAMPLE"
    }
  }
}
```

---

## Step 2: Set Up HTML

Include the required Braintree scripts and add container elements for the payment buttons:

```html
<script src="https://js.braintreegateway.com/web/3.97.0/js/client.min.js"></script>
<script src="https://js.braintreegateway.com/web/3.97.0/js/paypal-checkout.min.js"></script>
<script src="https://js.braintreegateway.com/web/3.97.0/js/venmo.min.js"></script>
<script src="https://js.braintreegateway.com/web/3.97.0/js/data-collector.min.js"></script>
<script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>

<!-- PayPal button container - SDK renders the button here -->
<div id="paypal-button"></div>

<!-- Venmo button - You provide the button, SDK attaches click handlers -->
<button id="venmo-button">Pay with Venmo</button>

<style>
  #venmo-button {
    background: #008CFF;
    color: white;
    cursor: pointer;
  }
</style>
```

Note: PayPal uses a `<div>` because the SDK renders the button. Venmo uses your own `<button>` element styled with CSS.

---

## Step 3: Initialize the SDK

Initialize `SpreedlyBraintree` with the transaction token and specify which payment elements to render.

### Configuration Options

| Option | Required | Description |
|--------|----------|-------------|
| `transactionToken` | Yes | Spreedly transaction token from pending purchase |
| `environmentKey` | Yes | Spreedly environment key |
| `paymentElements` | Yes | Object with element IDs for `paypal` and/or `venmo` |
| `onPaymentResult` | Yes | Callback function for payment results. When we receive a successful, cancelled or error response from Braintree we will return a hash/object to that callback function. The response returned here will be used in Complete Transaction step.
| `onButtonAction` | No | Callback for PayPal button state changes |
| `style` | No | An object that accepts parameters to configured the display of the PayPal button. The accepted parameters are color, height, shape and layout. |

### Render Only PayPal

```javascript
const braintree = new SpreedlyBraintree({
  transactionToken: 'BraintreeTransactionToken',
  environmentKey: 'your_spreedly_environment_key',
  paymentElements: {
    paypal: 'paypal-button'
  },
  onPaymentResult: handlePaymentResult,
  onButtonAction: handleButtonAction,
  style: {
    paypal: {
      color: 'blue',
      shape: 'rect',
      height: 45
    }
  }
});
```

### Render Only Venmo

```javascript
const braintree = new SpreedlyBraintree({
  transactionToken: 'BraintreeTransactionToken',
  environmentKey: 'your_spreedly_environment_key',
  paymentElements: {
    venmo: 'venmo-button'
  },
  onPaymentResult: handlePaymentResult
});
```


### Render Both PayPal and Venmo

```javascript
const braintree = new SpreedlyBraintree({
  transactionToken: 'BraintreeTransactionToken',
  environmentKey: 'your_spreedly_environment_key',
  paymentElements: {
    paypal: 'paypal-button',
    venmo: 'venmo-button'
  },
  onPaymentResult: handlePaymentResult,
  onButtonAction: handleButtonAction,
  style: {
    paypal: {
      color: 'gold',
      shape: 'rect',
      height: 45
    }
  }
});
```

### PayPal Button Style Options

```javascript
style: {
  paypal: {
    color: 'gold',    // 'gold', 'blue', 'silver', 'black', 'white'
    shape: 'rect',    // 'rect', 'pill'
    height: 45,       // 25-55
    layout: 'vertical' // 'vertical', 'horizontal'
  }
}
```

### Button Action Callback (PayPal only)

The `onButtonAction` callback receives state changes for the PayPal button:

```javascript
function handleButtonAction(action) {
  if (action.state === 'Initiated') {
    // Button has been rendered and is ready
    console.log('PayPal button initialized');
  } else if (action.state === 'Clicked') {
    // User clicked the PayPal button
    console.log('PayPal button clicked');
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `state` | string | `'Initiated'` when button renders, `'Clicked'` when user clicks |
| `data` | object | PayPal SDK data object |
| `actions` | object | PayPal SDK actions object |

---

## Step 4: Mount the Payment Buttons

```javascript
const result = await braintree.mount();

if (result.error) {
  console.error('Mount failed:', result.error);
  return;
}

// To check which buttons were rendered
if (result.paypalRendered) {
  console.log('PayPal button ready');
}
if (result.venmoRendered) {
  console.log('Venmo button ready');
}
```

### Mount Result

| Field | Type | Description |
|-------|------|-------------|
| `error` | string | Error message if mount failed |
| `paypalRendered` | boolean | Whether PayPal button was rendered |
| `venmoRendered` | boolean | Whether Venmo button was rendered |

---

## Step 5: Handle Payment Result

The `onPaymentResult` callback receives the payment result after the customer authorizes payment. Call the confirm endpoint for all states (Successful, Cancelled, or Failed) to finalize the transaction. 

By sending the payment method we can update the transactions if the initial payment method differs from the final one used. For example, in Step 1 you created a Purchase with payment_method_type: 'paypal'. You used that transaction token in Step 3 to render both Braintree payment elements, Venmo & PayPal. Your customer successfully completes the payment with Venmo and the hash returned to your callbackFunction is similar to the one below. You use the below hash when completing the transaction in Step 5. This final step will not only update the transaction state but also update the payment method type:

```javascript
async function handlePaymentResult(result) {
  const confirmResponse = await confirmTransaction(
    result.state,
    result.nonce,
    result.payment_method.payment_method_type
  );
  
  const transaction = confirmResponse.transaction;
  
  if (transaction?.succeeded) {
    showSuccessMessage(`Payment completed! Transaction: ${transaction.token}`);
  } else {
    showErrorMessage(transaction?.message || 'Transaction could not be completed.');
  }
}
```

### Payment Result Object

| Field | Type | Description |
|-------|------|-------------|
| `state` | string | `'Successful'`, `'Cancelled'`, or `'Failed'` |
| `nonce` | string | Braintree payment method nonce (on success) |
| `device_data` | string | Device data for fraud prevention |
| `username` | string | Venmo username (for Venmo payments) |
| `message` | string | Error message (on failure) |
| `payment_method.payment_method_type` | string | `'paypal'` or `'venmo'` |

---

## Step 6: Confirm Transaction

Confirm the transaction with Spreedly for all payment result states (Successful, Cancelled, or Failed). This finalizes the transaction on the Spreedly side.

### Frontend: Call Your Backend

```javascript
async function confirmTransaction(state, nonce, paymentMethodType) {
  const response = await fetch(`/api/transactions/${transactionToken}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      state: state,
      nonce: nonce,
      payment_method_type: paymentMethodType
    })
  });
  
  return await response.json();
}
```

### Backend: Confirm with Spreedly

```javascript
app.post('/api/transactions/:transactionToken/confirm', async (req, res) => {
  const { transactionToken } = req.params;
  const { state, nonce, payment_method_type } = req.body;
  
  const response = await fetch(
    `https://core.spreedly.com/v1/transactions/${transactionToken}/confirm.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${ENVIRONMENT_KEY}:${ACCESS_SECRET}`),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        state,
        nonce,
        payment_method: {
          payment_method_type
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
    "token": "BraintreeTransactionToken",
    "state": "succeeded",
    "succeeded": true,
    "amount": 1000,
    "currency_code": "USD"
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
  <script src="https://js.braintreegateway.com/web/3.97.0/js/client.min.js"></script>
  <script src="https://js.braintreegateway.com/web/3.97.0/js/paypal-checkout.min.js"></script>
  <script src="https://js.braintreegateway.com/web/3.97.0/js/venmo.min.js"></script>
  <script src="https://js.braintreegateway.com/web/3.97.0/js/data-collector.min.js"></script>
  <script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>
  <style>
    #venmo-button {
      width: 100%;
      padding: 12px 24px;
      background: #008CFF;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }
    #venmo-button:hover { background: #0074D4; }
    #venmo-button:disabled { background: #ccc; cursor: not-allowed; }
  </style>
</head>
<body>
  <h1>Choose Payment Method</h1>
  
  <div id="paypal-button"></div>
  <button id="venmo-button">Pay with Venmo</button>
  
  <div id="status"></div>

  <script src="checkout.js"></script>
</body>
</html>
```

### JavaScript (checkout.js)

```javascript
let transactionToken = null;

async function initializeCheckout() {
  const statusEl = document.getElementById('status');

  // 1. Create pending purchase
  const response = await fetch('/api/braintree-purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 1000, currency: 'USD' })
  });
  
  const data = await response.json();
  transactionToken = data.transaction.token;

  // 2. Initialize SDK
  const braintree = new SpreedlyBraintree({
    transactionToken,
    environmentKey: 'your_environment_key',
    paymentElements: {
      paypal: 'paypal-button',
      venmo: 'venmo-button'
    },
    onPaymentResult: async (result) => {
      statusEl.textContent = 'Processing payment...';
      
      // 3. Confirm transaction with Spreedly.
      const confirmResponse = await fetch(`/api/transactions/${transactionToken}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: result.state,
          nonce: result.nonce,
          payment_method_type: result.payment_method.payment_method_type
        })
      });
      
      const confirmData = await confirmResponse.json();
      
      if (confirmData.transaction?.succeeded) {
        statusEl.textContent = 'Payment successful!';
      } else {
        statusEl.textContent = 'Payment failed: ' + (confirmData.transaction?.message || result.message);
      }
    },
    style: {
      paypal: {
        color: 'gold',
        shape: 'rect',
        height: 45
      }
    }
  });

  // 4. Mount payment buttons
  const mountResult = await braintree.mount();
  
  if (mountResult.error) {
    statusEl.textContent = 'Error: ' + mountResult.error;
  }
}

initializeCheckout();
```

---

## PayPal Button Behavior

When clicked, the PayPal button redirects customers to Paypal's website where they:

1. Log into their PayPal account
2. Review and authorize the payment
3. Are returned to your site

The SDK handles the popup lifecycle and returns the authorization via the `onPaymentResult` callback.

---

## Venmo Button Behavior

Venmo behavior differs by device:

### Desktop

On desktop browsers, clicking the Venmo button displays a QR code. Customers:

1. Open the Venmo mobile app
2. Scan the QR code
3. Authorize the payment in the app

---

---

## Testing

### Braintree Sandbox

Use Braintree sandbox credentials for testing:

1. Create a Braintree sandbox account
2. Configure sandbox gateway in Spreedly
3. Use sandbox credentials in development

### PayPal Testing

1. Create PayPal sandbox accounts in the PayPal Developer Portal
2. Link PayPal in Braintree Sanbox portal.
2. Use sandbox buyer account to test payments

### Venmo Testing

Venmo testing requires:

1. Venmo enabled in Braintree sandbox
2. Venmo app installed
3. Use Braintree's test Venmo accounts

