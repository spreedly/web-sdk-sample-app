# Hosted Fields — Tokenization Integration Guide

Use Spreedly Hosted Fields (`SpreedlyHostedFields`) to build a fully custom payment form while keeping sensitive card data out of your PCI scope. The SDK injects secure iframes for the card number and CVV fields; you own everything else — layout, styling, and form logic.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Integration Flow](#integration-flow)
4. [Complete Usage Example](#complete-usage-example)
5. [Styling Hosted Fields](#styling-hosted-fields)
6. [Error Handling](#error-handling)
7. [Testing](#testing)
8. [API Reference](#api-reference)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **HTTPS** — required for secure payment processing
- **Spreedly account** with API credentials
- **Server-generated auth details** — see [Authentication](#authentication) below

### Authentication

Both the constructor and every tokenization request require `AuthDetails`. Generate these server-side — never expose your secret key to the browser.

Follow [this guide](https://developer.spreedly.com/docs/using-certificates-iframe-security) to generate credentials.

| Property | Type | Description |
|----------|------|-------------|
| `environment_key` | `string` | Your Spreedly environment key |
| `certificate_token` | `string` | Certificate token for iframe security |
| `nonce` | `string` | One-time random string |
| `timestamp` | `string` | UTC timestamp |
| `signature` | `string` | |

---

## Installation

Add the Hosted Fields script to your page:

```html
<!-- Production -->
<script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>

<!-- Staging (testing) -->
<script src="https://core-test.spreedly.com/checkout/sdk/{version}/index.js"></script>
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
const sdk = new SpreedlyHostedFields({
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
  console.log('Hosted fields are ready');
  document.getElementById('submit-btn').disabled = false;
});

sdk.on('tokenGenerated', (response) => {
  const token = response.tokenResponse.payment_method.token;
  console.log('Payment method token:', token);
  // Send this token to your server to create a transaction
});

sdk.on('error', (error) => {
  console.error('Error:', error);
});
```

### Step 3 — Mount the secure fields

Provide two empty `<div>` containers in your HTML. The SDK will inject iframes into them.

```html
<div id="card-number-field"></div>
<div id="cvv-field"></div>
```

```javascript
sdk.inAppElements({
  number: { containerId: 'card-number-field' },
  cvv: { containerId: 'cvv-field' }
});
```

### Step 4 — Configure field appearance (optional)

```javascript
sdk.setPlaceholder('number', 'Card Number');
sdk.setPlaceholder('cvv', 'CVV');

sdk.setFieldType('number', 'tel'); // numeric keyboard on mobile

sdk.setStyles('number', {
  fontSize: '16px',
  color: '#333',
  fontFamily: 'Arial, sans-serif'
});
```

### Step 5 — Submit for tokenization

Collect the non-sensitive fields yourself and call `submit()`:

```javascript
document.getElementById('payment-form').addEventListener('submit', (e) => {
  e.preventDefault();

  sdk.submit({
    first_name: document.getElementById('first-name').value,
    last_name: document.getElementById('last-name').value,
    month: document.getElementById('expiry-month').value,
    year: document.getElementById('expiry-year').value
  }, {
    metadata: { order_id: 'ORDER-123' },
  });
});
```

### Step 6 — Handle the token

The `tokenGenerated` callback fires on success:

```javascript
sdk.on('tokenGenerated', (response) => {
  const pm = response.tokenResponse.payment_method;
  console.log('Token:', pm.token);
  console.log('Card type:', pm.card_type);
  console.log('Last four:', pm.last_four_digits);

  // Send pm.token to your backend to create a purchase/auth
});
```

---

## Complete Usage Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Hosted Fields Tokenization</title>
  <style>
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
    .hosted-field { height: 40px; border: 1px solid #ccc; border-radius: 4px; }
    input, select { height: 40px; width: 100%; padding: 0 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
    .form-row { display: flex; gap: 12px; }
    .form-row > .form-group { flex: 1; }
    button { padding: 12px 24px; background: #0a0a0a; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; width: 100%; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    #result { margin-top: 20px; padding: 16px; border-radius: 6px; display: none; }
    #result.success { background: #f0fdf4; border: 1px solid #bbf7d0; display: block; }
    #result.error { background: #fef2f2; border: 1px solid #fecaca; display: block; }
  </style>
</head>
<body>
  <h1>Pay with Card</h1>

  <form id="payment-form">
    <div class="form-row">
      <div class="form-group">
        <label for="first-name">First Name</label>
        <input type="text" id="first-name" placeholder="John" required>
      </div>
      <div class="form-group">
        <label for="last-name">Last Name</label>
        <input type="text" id="last-name" placeholder="Doe" required>
      </div>
    </div>

    <div class="form-group">
      <label>Card Number</label>
      <div id="card-number-field" class="hosted-field"></div>
    </div>

    <div class="form-group">
      <label>CVV</label>
      <div id="cvv-field" class="hosted-field" style="max-width: 120px;"></div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="expiry-month">Month</label>
        <input type="text" id="expiry-month" placeholder="MM" maxlength="2" inputmode="numeric" required>
      </div>
      <div class="form-group">
        <label for="expiry-year">Year</label>
        <input type="text" id="expiry-year" placeholder="YYYY" maxlength="4" inputmode="numeric" required>
      </div>
    </div>

    <button type="submit" id="submit-btn" disabled>Create Payment Method</button>
  </form>

  <div id="result"></div>

  <script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>
  <script>
    // 1. Initialize
    const sdk = new SpreedlyHostedFields({
      environment_key: 'your_env_key',
      certificate_token: 'your_cert_token',
      nonce: 'your_nonce',
      signature: 'your_signature',
      timestamp: 'your_timestamp'
    });

    // 2. Event handlers
    sdk.on('ready', () => {
      document.getElementById('submit-btn').disabled = false;
    });

    sdk.on('tokenGenerated', (response) => {
      const pm = response.tokenResponse.payment_method;
      const result = document.getElementById('result');
      result.className = 'success';
      result.innerHTML = `
        <strong>Payment method created!</strong><br>
        Token: ${pm.token}<br>
        Card: ${pm.card_type} ending in ${pm.last_four_digits}<br>
        Expires: ${pm.month}/${pm.year}
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
      document.getElementById('submit-btn').disabled = false;
    });

    // 3. Mount secure fields
    sdk.inAppElements({
      number: { containerId: 'card-number-field' },
      cvv: { containerId: 'cvv-field' }
    });

    // 4. Configure appearance
    sdk.setPlaceholder('number', 'Card Number');
    sdk.setPlaceholder('cvv', 'CVV');
    sdk.setFieldType('number', 'tel');

    sdk.setStyles('number', { fontSize: '16px', fontFamily: 'inherit', color: '#333' });
    sdk.setStyles('cvv', { fontSize: '16px', fontFamily: 'inherit', color: '#333' });

    // 5. Submit
    document.getElementById('payment-form').addEventListener('submit', (e) => {
      e.preventDefault();
      document.getElementById('submit-btn').disabled = true;

      sdk.submit({
        first_name: document.getElementById('first-name').value,
        last_name: document.getElementById('last-name').value,
        month: document.getElementById('expiry-month').value,
        year: document.getElementById('expiry-year').value
      }, {
        metadata: { source: 'hosted-fields-example' },
      });
    });
  </script>
</body>
</html>
```

---

## Styling Hosted Fields

The iframe inputs accept a subset of CSS properties via `setStyles()`:

```javascript
sdk.setStyles('number', {
  fontSize: '16px',
  color: '#333',
  fontFamily: 'Arial, sans-serif',
  backgroundColor: '#fff'
});

sdk.setStyles('cvv', {
  fontSize: '16px',
  color: '#333'
});
```

You can style the **container** `<div>` directly with CSS:

```css
.hosted-field {
  height: 40px;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 0 4px;
}
```

---

## Error Handling

```javascript
sdk.on('error', (error) => {
  // Validation errors (e.g., invalid card number, expired date)
  if (error.errors && Array.isArray(error.errors)) {
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

Use `core-test.spreedly.com` for testing:

```html
<script src="https://core-test.spreedly.com/checkout/sdk/{version}/index.js"></script>
```

---

## API Reference

For the complete API reference — including the constructor, all methods and their
parameters, events, and payload/type definitions — see the dedicated
**[Hosted Fields API Reference](../../HOSTED_FIELDS_API_REFERENCE.md)**.

---

## Troubleshooting

### Hosted fields not appearing

- Ensure the container `<div>` elements exist in the DOM **before** calling `inAppElements()`.
- Wait for the `ready` event before enabling form interactions.

### CSP errors

Add Spreedly domains to your Content Security Policy:

```html
<meta http-equiv="Content-Security-Policy" content="
  frame-src https://core.spreedly.com https://core-test.spreedly.com;
  script-src https://core.spreedly.com https://core-test.spreedly.com;
  connect-src https://core.spreedly.com https://core-test.spreedly.com;
">
```

### Token not generating

1. Verify auth details are valid and not expired.
2. Ensure all required form fields are filled.
3. Check that the card data passes Luhn validation and is not expired.
4. Check the browser console for errors.

---

## See Also

- [Express Checkout Integration Guide](../express-checkout/INTEGRATION_GUIDE.md) — Pre-built form alternative
- [Recaching Integration Guide](../../recaching/INTEGRATION_GUIDE.md) — Update CVV for retained cards
- [3DS Overview](../../three-ds/OVERVIEW.md) — Add 3D Secure authentication
- [Security Guide](../../../SECURITY.md) — SRI, CSP, and security best practices
