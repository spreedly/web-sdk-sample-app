# 3DS2 Global (Forter) - Integration Guide

This guide covers integrating Spreedly's Forter-managed 3DS2 authentication.

## Prerequisites

- Spreedly account with 3DS enabled
- **SCA Provider Key** from Spreedly dashboard
- Gateway that supports 3DS

---

## Step 1: Include Spreedly JavaScript Library

Include the Spreedly Web SDK on your checkout page. Choose either Hosted Fields or Express Checkout based on your implementation:

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
  <!-- Required by SDK but not used in Forter flow (Forter handles fingerprinting internally) -->
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
    amount: 10000, // Amount in cents
    browser_info: browserInfo,
    // Add any other parameters your backend needs
  })
});
```

---

## Step 5: Backend Transaction Processing

In your backend, create the transaction with Spreedly using the collected browser information:

```
POST /v1/gateways/<gateway_token>/purchase.json HTTPS/1.1
Host: core.spreedly.com
Authorization: Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ==
Content-Type: application/json

{
  "transaction": {
    "sca_provider_key": "<your_sca_provider_key>",
    "payment_method_token": "<payment_method_token>",
    "amount": 10000,
    "currency_code": "EUR",
    "browser_info": "<browser_info_from_frontend>"
  }
}
```

Your backend should return the transaction response to your frontend. The transaction will typically have a `state` of `"pending"` when 3DS authentication is required.

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
} else {
  // Transaction failed
  alert('Payment failed: ' + transaction.message);
}
```

### Initialize and Start the Lifecycle

Create a function to initialize the 3DS lifecycle and handle all authentication events:

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

    // Optional: CSS classes for styling the challenge iframe
    challengeIframeClasses: 'custom-challenge-styles',

    // Optional but highy recommended
    environmentKey: 'your-environment-key',

    // Required: Event callbacks
    callbacks: {
      onChallenge: (event) => {
        // Challenge required - show the challenge modal
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
        
        // Handle common error message
        let errorMsg = event.context;
        if (errorMsg === 'messages.failed_sca_authentication') {
          errorMsg = 'Payment authentication failed. Please try again.';
        }
        alert(errorMsg);
      },
    },
  });

  // Start the authentication process
  lifecycle.start();
}
```

**Important:** Call `lifecycle.start()` immediately after receiving a pending transaction (within 30 seconds per 3DS specification requirements).

---

## Configuration Options

| Option | Required | Description |
|--------|----------|-------------|
| `transactionToken` | Yes | Transaction token from purchase response |
| `hiddenIframeLocation` | Yes | DOM element ID for hidden iframes (required but unused by Forter) |
| `challengeIframeLocation` | Yes | DOM element ID where challenge iframe is injected |
| `callbacks` | Yes | Event callbacks object |
| `challengeIframeClasses` | No | CSS classes to apply to challenge iframe |
| `environmentKey` | No | Optional but highly recommended |

---

## Callbacks Reference

| Callback | When Fired | Action |
|----------|-----------|--------|
| `onChallenge` | Challenge iframe ready | Show challenge container |
| `onSuccess` | Authentication succeeded | Hide modal, redirect to success |
| `onError` | Authentication failed | Hide modal, show error message |

**Note:** `onDeviceFingerprint` and `onTriggerCompletion` callbacks are NOT fired in the Forter flow - these are for Gateway Specific 3DS only.

---

## Event Structure

All callbacks receive a consistent event object:

```javascript
{
  action: string,      // 'challenge' | 'succeeded' | 'error'
  context: object,     // Transaction status or error message
  token: string,       // Transaction token
  finalize: function,  // Not used in Forter flow
}
```

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
| No `managed_order_token` in response | Missing `sca_provider_key` | Add `sca_provider_key` to backend purchase request |
| Challenge not showing | Wrong container ID | Verify `challengeIframeLocation` matches DOM element ID |
| SDK not loading | Forter CDN blocked | Check network tab, verify CSP allows Forter domains |
| `messages.failed_sca_authentication` | User failed challenge | Show user-friendly error, let them retry |
| Challenge modal appears but is empty | Container not visible | Ensure modal is shown before challenge fires |
