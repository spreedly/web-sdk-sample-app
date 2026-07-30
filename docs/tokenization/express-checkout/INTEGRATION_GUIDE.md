# Express Checkout — Tokenization Integration Guide

Use Spreedly Express Checkout (`SpreedlyExpressCheckout`) to drop a complete, pre-built payment form into your page with minimal code. The form can render as an embedded component or a modal dialog — you customize text, fields, and styling through the SDK API.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Integration Flow](#integration-flow)
4. [Complete Usage Example](#complete-usage-example)
5. [Display Modes](#display-modes)
6. [Customizing the Form](#customizing-the-form)
7. [Error Handling](#error-handling)
8. [Testing](#testing)
9. [API Reference](#api-reference)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **HTTPS** — required for secure payment processing
- **Spreedly account** with API credentials
- **Server-generated auth details** — see [Authentication](#authentication) below

### Authentication

The constructor requires `AuthDetails`. Generate these server-side — never expose your secret key to the browser.

Follow [this guide](https://developer.spreedly.com/docs/using-certificates-iframe-security) to generate credentials.

| Property | Type | Description |
|----------|------|-------------|
| `environment_key` | `string` | Your Spreedly environment key |
| `certificate_token` | `string` | Certificate token for iframe security |
| `nonce` | `string` | One-time random string |
| `timestamp` | `string` | UTC timestamp |
| `signature` | `string` | Server-generated HMAC signature |

---

## Installation

Add the Express Checkout script to your page:

```html
<!-- Production -->
<script src="https://core.spreedly.com/checkout/elements/{version}/express-checkout.js"></script>

<!-- Staging (testing) -->
<script src="https://core-test.spreedly.com/checkout/elements/{version}/express-checkout.js"></script>
```

| Channel | Description | Example |
|---------|-------------|---------|
| `{version}` | Specific version | `1.0.0` |
| `rc` | Release candidate | `rc` |
| `stable` | Stable release | `stable` |

> For SRI hashes and CSP configuration, see [SECURITY.md](../../../SECURITY.md).

---

## Integration Flow

### Step 1 — Initialize the SDK

```javascript
const sdk = new SpreedlyExpressCheckout({
  environment_key: 'your_env_key',
  certificate_token: 'your_cert_token',
  nonce: 'your_nonce',
  signature: 'your_signature',
  timestamp: 'your_timestamp'
});
```

### Step 2 — Register event handlers

```javascript
sdk.on('ready', () => {
  console.log('Checkout form is ready');
});

sdk.on('tokenGenerated', (response) => {
  const token = response.tokenResponse.payment_method.token;
  console.log('Payment method token:', token);
  // Send this token to your server to create a transaction
});

sdk.on('error', (error) => {
  console.error('Error:', error);
});

sdk.on('close', () => {
  console.log('Checkout form was closed');
});
```

### Step 3 — Launch the checkout form

**Embedded mode** — renders inside a container on your page:

```html
<div id="checkout-container"></div>
```

```javascript
const checkout = sdk.expressCheckout({
  parentContainerId: 'checkout-container',
  uiConfig: {
    textConfig: {
      title: 'Payment Details',
      submitBtnText: 'Pay Now'
    }
  },
  submitParams: {
    metadata: { order_id: 'ORDER-123' },
  }
});
```

**Dialog mode** — opens as a modal overlay (omit `parentContainerId`):

```javascript
const checkout = sdk.expressCheckout({
  uiConfig: {
    textConfig: {
      title: 'Secure Checkout',
      submitBtnText: 'Complete Purchase'
    }
  }
});
```

### Step 4 — Handle the token

The user fills in the pre-built form and clicks submit. On success the `tokenGenerated` event fires:

```javascript
sdk.on('tokenGenerated', (response) => {
  const pm = response.tokenResponse.payment_method;
  console.log('Token:', pm.token);
  console.log('Card type:', pm.card_type);
  console.log('Last four:', pm.last_four_digits);

  // Send pm.token to your backend to create a purchase/auth
});
```

### Step 5 — Clean up (optional)

```javascript
// Destroy the form, keeping event listeners for re-launch
checkout.destroy();

// Or fully clean up everything
sdk.close(true);
```

---

## Complete Usage Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Express Checkout Tokenization</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 40px auto; padding: 0 20px; }
    h1 { margin-bottom: 8px; }
    p.subtitle { color: #666; margin-bottom: 24px; }
    #checkout-container { min-height: 400px; border: 1px solid #e5e7eb; border-radius: 8px; }
    #result { margin-top: 20px; padding: 16px; border-radius: 6px; display: none; }
    #result.success { background: #f0fdf4; border: 1px solid #bbf7d0; display: block; }
    #result.error { background: #fef2f2; border: 1px solid #fecaca; display: block; }
  </style>
</head>
<body>
  <h1>Express Checkout</h1>
  <p class="subtitle">Complete, pre-built payment form</p>

  <div id="checkout-container"></div>
  <div id="result"></div>

  <script src="https://core.spreedly.com/checkout/elements/{version}/express-checkout.js"></script>
  <script>
    // 1. Initialize
    const sdk = new SpreedlyExpressCheckout({
      environment_key: 'your_env_key',
      certificate_token: 'your_cert_token',
      nonce: 'your_nonce',
      signature: 'your_signature',
      timestamp: 'your_timestamp'
    });

    // 2. Event handlers
    sdk.on('ready', () => {
      console.log('Form ready');
    });

    sdk.on('tokenGenerated', (response) => {
      const pm = response.tokenResponse.payment_method;
      const result = document.getElementById('result');
      result.className = 'success';
      result.innerHTML = `
        <strong>Payment method created!</strong><br>
        Token: ${pm.token}<br>
        Card: ${pm.card_type} ending in ${pm.last_four_digits}<br>
        Expires: ${pm.month}/${pm.year}<br>
        Storage: ${pm.storage_state}
      `;
    });

    sdk.on('error', (error) => {
      const result = document.getElementById('result');
      result.className = 'error';
      if (error.errors) {
        result.innerHTML = error.errors
          .map(e => `<strong>${e.attribute}:</strong> ${e.message}`)
          .join('<br>');
      } else {
        result.textContent = error.message || 'An error occurred';
      }
    });

    sdk.on('close', () => {
      console.log('Form closed');
    });

    // 3. Launch embedded checkout
    const checkout = sdk.expressCheckout({
      parentContainerId: 'checkout-container',
      uiConfig: {
        textConfig: {
          title: 'Payment Details',
          submitBtnText: 'Create Payment Method',
          footerText: 'Secure payment powered by Spreedly',
          processingText: 'Processing...'
        },
        styles: {
          button: {
            backgroundColor: '#0a0a0a',
            borderRadius: '8px',
            hover: { backgroundColor: '#262626' }
          }
        }
      },
      submitParams: {
        metadata: { source: 'express-checkout-example' },
      }
    });
  </script>
</body>
</html>
```

---

## Display Modes

### Embedded Mode

Renders the form inside a specified container element. Use this when you want the form to appear inline within your page layout.

```javascript
const checkout = sdk.expressCheckout({
  parentContainerId: 'checkout-container'
});
```

### Dialog Mode

Opens the form as a modal overlay. Use this for a focused checkout experience.

```javascript
const checkout = sdk.expressCheckout();

// Close programmatically
checkout.destroy();
```

---

## Customizing the Form

### Text elements

```javascript
sdk.updateTextElement('title', 'Complete Your Purchase');
sdk.updateTextElement('submitBtnText', 'Pay $99.00');
sdk.updateTextElement('footerText', 'Secured by Spreedly');
sdk.updateTextElement('processingText', 'Processing payment...');
```

### Adding and removing fields

Express Checkout starts with the mandatory fields (first name, last name, card number, CVV, expiry month/year). You can add optional fields dynamically:

```javascript
sdk.addField('company', {
  label: 'Company Name',
  placeholder: 'Enter company name',
  isRequired: false,
  size: 12
});

sdk.addField('phone_number', {
  label: 'Phone Number',
  placeholder: '+1 (555) 123-4567',
  isRequired: true
});

// Remove a field
sdk.removeField('company');
```

### Configuring existing fields

```javascript
sdk.setFieldConfig('first_name', {
  label: 'Given Name',
  placeholder: 'Enter your first name',
  isRequired: true
});

sdk.setFieldConfig('number', {
  styles: {
    borderColor: '#007bff',
    fontSize: '16px'
  }
});
```

### Updating submit params after initialization

```javascript
sdk.updateSubmitParams({
  metadata: { order_id: 'ORDER-456', customer_id: 'CUST-789' },
});
```

---

## Error Handling

```javascript
sdk.on('error', (error) => {
  if (error.errors && Array.isArray(error.errors)) {
    // Validation errors from the Spreedly API
    error.errors.forEach(err => {
      console.error(`${err.attribute}: ${err.message}`);
    });
    return;
  }

  // General errors
  console.error(error.message);
});
```

### Error payload shape

```javascript
{
  message: 'Unable to create payment method',
  errors: [
    { attribute: 'number', key: 'errors.invalid', message: 'is invalid' },
    { attribute: 'month', key: 'errors.expired', message: 'is expired' }
  ]
}
```

---

## Testing

### Test Card Numbers

| Card Type | Number | CVV | Expiry |
|-----------|--------|-----|--------|
| Visa | 4111111111111111 | 123 | Any future date |
| Mastercard | 5555555555554444 | 123 | Any future date |
| Amex | 378282246310005 | 1234 | Any future date |
| Discover | 6011111111111117 | 123 | Any future date |

### Staging Environment

```html
<script src="https://core-test.spreedly.com/checkout/elements/{version}/express-checkout.js"></script>
```

---

## API Reference

For the complete API reference — including the constructor, all methods and their
parameters, events, and payload/type definitions — see the dedicated
**[Express Checkout API Reference](../../EXPRESS_CHECKOUT_API_REFERENCE.md)**.

---

## Troubleshooting

### Form not appearing

- Ensure the container element exists before calling `expressCheckout()` with `parentContainerId`.
- In dialog mode, check that no CSS is hiding the modal overlay (`z-index` conflicts).

### CSP errors

Add Spreedly domains to your Content Security Policy:

```html
<meta http-equiv="Content-Security-Policy" content="
  frame-src https://core.spreedly.com https://core-test.spreedly.com;
  script-src https://core.spreedly.com https://core-test.spreedly.com;
  connect-src https://core.spreedly.com https://core-test.spreedly.com;
">
```

### SDK not loading

```javascript
if (typeof SpreedlyExpressCheckout === 'undefined') {
  console.error('SDK failed to load. Check network and CSP settings.');
}
```

---

## See Also

- [Hosted Fields Integration Guide](../hosted-fields/INTEGRATION_GUIDE.md) — Custom form alternative
- [Recaching Integration Guide](../../recaching/INTEGRATION_GUIDE.md) — Update CVV for retained cards
- [3DS Overview](../../three-ds/OVERVIEW.md) — Add 3D Secure authentication
- [Security Guide](../../../SECURITY.md) — SRI, CSP, and security best practices
