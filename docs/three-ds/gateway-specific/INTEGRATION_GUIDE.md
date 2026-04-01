# 3DS2 Gateway Specific - Integration Guide

This guide covers integrating gateway-managed 3DS2 authentication where the payment gateway handles the 3DS flow.

## Prerequisites

- Spreedly account with a gateway that supports 3DS2 (e.g., test gateway, Braintree, Worldpay)
- **Do NOT use** `sca_provider_key` - that triggers the Forter flow
- Verify your gateway can successfully make a purchase **without** 3DS first - this helps limit troubleshooting to 3DS-specific changes
- Generate or use an existing payment method token

---

## Step 1: Include Spreedly JavaScript Library

Include the Spreedly Web SDK on your checkout page:

**Hosted Fields**
```html
<head>
  <script src="https://core-test.spreedly.com/checkout/sdk/rc/index.js"></script>
</head>
```

**Express Checkout**
```html
<head>
  <script src="https://core-test.spreedly.com/checkout/elements/rc/express-checkout.js"></script>
</head>
```

---

## Step 2: Prepare Your HTML Structure

Set up the DOM elements that Spreedly will use for 3DS authentication:

```html
<head>
  <style>
    .hidden {
      display: none;
    }
    #challenge-modal {
      /* Style your modal container */
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 1px solid #ccc;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 1000;
    }
  </style>
</head>
<body>
  <!-- Hidden container for device fingerprinting -->
  <!-- Spreedly injects content into this div, do not nest the challenge div inside of it -->
  <div id="device-fingerprint" style="display: none;"></div>

  <!-- Modal container for challenge authentication -->
  <div id="challenge-modal" class="hidden">
    <div id="challenge-container"></div>
  </div>
</body>
```

---

## Step 3: Generate Payment Method Token

Ensure you have a payment method token ready. You can generate this using:

- Spreedly's Hosted Fields
- Spreedly's Express Checkout
- Direct API calls to Spreedly
- A previously stored payment method

---

## Step 4: Collect Browser Information and Initiate Transaction

When your customer is ready to complete their purchase, collect the required browser information and send the transaction to your backend:

```javascript
// serializeBrowserInfo is available globally after loading the SDK script

// Configure challenge window size for your application
// This determines the size of the challenge iframe presented to users
// Options: '01' (250x400), '02' (390x300), '03' (500x600), '04' (600x400), '05' (fullscreen)
const challengeWindowSize = '04';

// Get the accept header from your server-rendered page
// You'll need to inject this value into your page template
const acceptHeader = 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8';

// Capture browser data using Spreedly's helper function
const browserInfo = serializeBrowserInfo(challengeWindowSize, acceptHeader);

// Send transaction request to your backend
fetch('/api/process-payment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    payment_method_token: 'your-payment-method-token',
    amount: 3004, // Amount in cents (use test amounts for testing)
    browser_info: browserInfo,
    // Note: Parameters must match exact casing with underscores
    // browser_info will work, browserInfo will NOT
  })
});
```

---

## Step 5: Backend Transaction Processing

In your backend, create the transaction with Spreedly. All of the following transaction fields are **required**:

```
POST /v1/gateways/<gateway_token>/purchase.json HTTPS/1.1
Host: core.spreedly.com
Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==
Content-Type: application/json

{
  "transaction": {
    "payment_method_token": "<payment_method_token>",
    "amount": 3004,
    "currency_code": "USD",
    "browser_info": "<browser_info_from_frontend>",
    "three_ds_version": "2",
    "attempt_3dsecure": true,
    "redirect_url": "<your_redirect_url>",
    "callback_url": "<your_callback_url>"
  }
}
```

**Required Fields:**
- `payment_method_token` - The tokenized payment method
- `amount` - Amount in cents
- `currency_code` - ISO currency code
- `browser_info` - Value from `serializeBrowserInfo()`
- `three_ds_version` - Must be `"2"`
- `attempt_3dsecure` - Must be `true`
- `redirect_url` - Where the customer is redirected back after authenticating on the issuer's offsite page
- `callback_url` - Provides another way to receive notice of transaction state changes via POST

Your backend should return the transaction response to your frontend. Make note of `transaction.token` - you'll need it for the next step.

### Backend Complete Endpoint

You'll also need a backend endpoint to call Spreedly's complete API:

```javascript
// Backend: POST /api/complete/:token
app.post('/api/complete/:token', async (req, res) => {
  const response = await axios.post(
    `https://core.spreedly.com/v1/transactions/${req.params.token}/complete.json`,
    {},
    { headers: { Authorization: getAuthHeader() } }
  );
  res.json(response.data);
});
```

---

## Step 6: Handle the Authentication Flow

### Check Transaction State

First, check the transaction state returned from your backend:

```javascript
const { transaction } = response;

if (transaction.state === 'succeeded') {
  // Frictionless flow - no 3DS needed, payment complete
  window.location.href = '/payment-success';
} else if (transaction.state === 'pending') {
  // 3DS authentication required - start the lifecycle
  start3DSLifecycle(transaction.token);
} else if (transaction.state === 'failed') {
  // Transaction failed - cannot be retried, create a new transaction
  alert('Payment failed: ' + transaction.message);
}
```

**Important:** Transactions that have failed cannot be updated or used to challenge the cardholder again. If you would like to present a cardholder with a new challenge upon failure, a new transaction should be created.

### Initialize and Start the Lifecycle

Create a function to initialize the 3DS lifecycle with all necessary callbacks:

```javascript
// SpreedlyThreeDSLifecycle is available globally after loading the SDK script

let lifecycle = null;

function start3DSLifecycle(transactionToken) {
  lifecycle = new SpreedlyThreeDSLifecycle({
    // Required: Transaction token from Spreedly API response
    transactionToken: transactionToken,

    // Required: DOM element IDs for 3DS process
    hiddenIframeLocation: 'device-fingerprint',
    challengeIframeLocation: 'challenge-container',

    // Optional but highly recommended
    environmentKey: 'your-environment-key',

    // Optional: CSS classes for styling the challenge iframe
    // NOTE: The challenge iframe size should match the browserSize you selected
    // in serializeBrowserInfo(). For '04', use classes with width: 600px, height: 400px
    challengeIframeClasses: 'challenge-iframe-styles',

    // Required: Event callbacks
    callbacks: {
      onTriggerCompletion: async (event) => {
        // This event fires when:
        // 1. Transaction status was updated due to a callback in the cardholder's iframe, OR
        // 2. 10 seconds have elapsed during polling
        //
        // You MUST call your backend to complete the transaction

        const response = await fetch(`/api/complete/${event.token}`, {
          method: 'POST'
        });
        const data = await response.json();

        if (data.transaction.state === 'succeeded') {
          // Payment complete
          window.location.href = '/payment-success';
        } else if (data.transaction.state === 'pending') {
          // Challenge required - continue the flow
          event.finalize(data.transaction);
        } else {
          // Payment failed
          alert('Payment failed: ' + data.transaction.message);
        }
      },

      onChallenge: (event) => {
        // Challenge required - show the challenge modal
        // The challenge iframe will be injected into challengeIframeLocation
        document.getElementById('challenge-modal').classList.remove('hidden');
      },

      onSuccess: (event) => {
        // Authentication successful - redirect to success page
        document.getElementById('challenge-modal').classList.add('hidden');
        window.location.href = '/payment-success';
      },

      onError: (event) => {
        // Authentication failed - show error message
        document.getElementById('challenge-modal').classList.add('hidden');

        let errorMsg = event.context;
        if (errorMsg === 'messages.failed_sca_authentication') {
          errorMsg = 'Payment authentication failed. Please try again.';
        }
        alert(errorMsg);
      },

      onFinalizationTimeout: (event) => {
        // Occurs 10-15 minutes after presenting a challenge without the transaction state changing
        // It is recommended to attempt a manual completion here
        document.getElementById('challenge-modal').classList.add('hidden');
        console.log('Challenge timed out - attempting manual completion');
        attemptManualCompletion(event.token);
      },
    },
  });

  // Start the authentication process immediately
  // (within 30 seconds per 3DS specification requirements)
  lifecycle.start();
}
```

---

## The `onTriggerCompletion` Flow

This is the critical callback that differentiates Gateway Specific from Forter flow:

```
Device Fingerprint
      │
      ▼
  Polling (~10s)
      │
      ▼
onTriggerCompletion  ←── You receive this callback
      │
      ├─ Call /complete endpoint (your backend)
      │
      ├─ If succeeded → Show success
      │
      ├─ If pending → event.finalize(data)
      │                    │
      │                    ▼
      │              onChallenge
      │
      └─ If failed → Show error
```

---

## Gateway Specific 3DS2 Flow Descriptions

The 3DS2 specification introduces new transaction flows to help verify the validity of a customer with as little interruption as possible:

### 3DS2 Fully Frictionless
This flow represents the smoothest path through to transaction success. During the authorize or purchase flow, the transaction, along with collected browser data, is deemed enough to verify the purchaser. No further action is required.

### 3DS2 Direct Challenge
This occurs when a transaction is deemed risky. The customer will be presented with an authentication form from the issuing bank, rendered in an iframe, typically a modal.

### 3DS2 Device Fingerprint with Direct Authorize
If the initial transaction and collected browser data require more context, the fingerprint flow with direct authorize is attempted. A hidden iframe is injected into the merchant's page (at a specified location) and is submitted to the issuer in the background. Then, the SDK will poll for up to 10 seconds, but responses are typically faster.

**Note:** The Spreedly test gateway will always take 10 seconds as it is a simulated gateway to assist in preparing for 3D Secure 2.

### 3DS2 Device Fingerprint to Challenge
This occurs when the initial transaction and browser data is collected, the hidden iframe is injected and polled, and further information is required. The 3DS2 authentication form is rendered on the merchant's site in an iframe, typically in a modal.

### 3DS2 Denied
If authentication fails, is rejected or denied, the transaction will be marked as failed and it is up to the merchant to retry the transaction or deny it.

### 3DS Not Enrolled/Supported
Spreedly falls back to standard transaction processing and submits the payment.

---

## Redirects

The Spreedly SDK will redirect the customer to an offsite page that is produced by the issuer and is then redirected back to the merchant's site to complete the order (using the `redirect_url`). In the event that a transaction is not immediately successful, your application should still handle callbacks in order to be updated if the customer leaves the checkout form.

---

## Callbacks

In a best case scenario, a customer's browser will always come back to your site after a successful payment, but in the real world, there are various reasons the redirect might not occur as designed. The `callback_url` you specified when creating the purchase provides another way to receive notice of transaction state.

The callback URL will receive a POST of all transactions that have changed since the last callback. In most cases, you'll receive the redirect and a callback, and the order of the two is not guaranteed. Generally, you'll just want to pay attention to the first one and ignore the second one, since you've already handled the transaction.

---

## Configuration Options

| Option | Required | Description |
|--------|----------|-------------|
| `transactionToken` | Yes | Transaction token from purchase response |
| `hiddenIframeLocation` | Yes | DOM element ID for device fingerprint iframe |
| `challengeIframeLocation` | Yes | DOM element ID for challenge iframe |
| `callbacks` | Yes | Event callbacks object |
| `environmentKey` | No | Optional but highly recommended |
| `challengeIframeClasses` | No | CSS classes to apply to challenge iframe (should match browserSize dimensions) |

---

## Callbacks Reference

| Callback | When Fired | Required Action |
|----------|-----------|-----------------|
| `onDeviceFingerprint` | Hidden iframe injected | Optional: show loading |
| `onTriggerCompletion` | After ~10s polling OR iframe callback | **Call `/complete` endpoint** |
| `onChallenge` | Challenge form ready | Show challenge container |
| `onSuccess` | Transaction succeeded | Hide modal, show success |
| `onError` | Transaction failed | Hide modal, show error |
| `onFinalizationTimeout` | 10-15 min after challenge with no state change | Attempt manual completion |

---

## Transaction States

| State | Description |
|-------|-------------|
| `succeeded` | The transaction has succeeded and funds have been received |
| `processing` | The transaction has been accepted. Funds have not yet been received |
| `pending` | The transaction needs further processing (typically 3DS challenge or redirect) |
| `failed` | The transaction failed (invalid payment method, redacted, etc.) |
| `gateway_processing_failed` | The transaction failed because the gateway declined the charge |
| `gateway_processing_result_unknown` | Difficulty communicating with the service, result unknown (timeouts, connection errors) |
| `gateway_setup_failed` | The transaction failed because the attempt to setup the transaction on the offsite gateway failed |

---

## Test Amounts (Spreedly Test Gateway)

| Amount (cents) | Flow |
|---------------|------|
| 3001 | Frictionless (immediate success) |
| 3003 | Device fingerprint → complete → success |
| 3004 | Device fingerprint → complete → challenge → success |
| 3005 | Direct challenge → success |
| 3103 | Device fingerprint → complete → failure |
| 3104 | Challenge → failure |

---

## Worldpay Gateway Note

Worldpay uses postMessages to notify when authentication needs to progress to the next step. The SDK handles this automatically, but if you need the context parameters, they are available in `event.context`:

```javascript
{
  "MessageType": "profile.completed",
  "SessionId": "d3197c02-6f63-4ab2-801c-83633d097e32",
  "Status": true
}
```

---

## Braintree Gateway

If your gateway is **Braintree**, you must load the Braintree SDK before initiating 3DS:

```html
<script src="https://js.braintreegateway.com/web/3.97.1/js/client.min.js"></script>
<script src="https://js.braintreegateway.com/web/3.97.1/js/three-d-secure.js"></script>
<script src="https://js.braintreegateway.com/web/3.97.1/js/hosted-fields.min.js"></script>
```

The SDK expects `window.braintree` to be available. If not loaded, you'll receive an error:
> "Braintree SDK not loaded. Please include the Braintree client and 3D Secure scripts."

---

## Lifecycle Methods

```javascript
// Start the 3DS flow
lifecycle.start();

// Cancel/stop the flow (cleanup)
lifecycle.stop();
```

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Getting `managed_order_token` | Using `sca_provider_key` | Remove it from request |
| `onTriggerCompletion` not firing | SDK not started | Check `lifecycle.start()` |
| Challenge not showing | Wrong container ID | Check `challengeIframeLocation` |
| `/complete` fails | Missing backend route | Add complete endpoint |
| Braintree SDK not loaded | Missing scripts | Add Braintree script tags |
| `browserInfo` not working | Wrong casing | Use `browser_info` (with underscore) |
| Challenge iframe wrong size | CSS mismatch | Match `challengeIframeClasses` to `browserSize` |
