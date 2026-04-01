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

### Constructor

```javascript
new SpreedlyExpressCheckout(authDetails)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `authDetails` | `AuthDetails` | Authentication credentials (see [Authentication](#authentication)) |

---

### Static Properties

#### `SpreedlyExpressCheckout.AdditionalCardFormFields`

Field names you can pass to `addField()` / `removeField()`:

```javascript
{
  FullName: 'full_name',
  Company: 'company',
  Address1: 'address1',
  Address2: 'address2',
  City: 'city',
  State: 'state',
  Zip: 'zip',
  Country: 'country',
  PhoneNumber: 'phone_number',
  ShippingAddress1: 'shipping_address1',
  ShippingAddress2: 'shipping_address2',
  ShippingCity: 'shipping_city',
  ShippingState: 'shipping_state',
  ShippingZip: 'shipping_zip',
  ShippingCountry: 'shipping_country',
  ShippingPhoneNumber: 'shipping_phone_number'
}
```

#### `SpreedlyExpressCheckout.MandatoryCardFormFields`

Fields included by default:

```javascript
{
  FirstName: 'first_name',
  LastName: 'last_name',
  CardNumber: 'number',
  Cvv: 'verification_value',
  ExpiryMonth: 'month',
  ExpiryYear: 'year'
}
```

#### `SpreedlyExpressCheckout.TextElement`

Keys for `updateTextElement()`:

```javascript
{
  Title: 'title',
  SubmitBtnText: 'submitBtnText',
  FooterText: 'footerText',
  ProcessingText: 'processingText'
}
```

---

### Methods

#### `on(event, callback)`

Registers a callback for an SDK event.

| Parameter | Type | Description |
|-----------|------|-------------|
| `event` | `string` | Event name (see [Events](#events)) |
| `callback` | `function` | Handler function |

```javascript
sdk.on('ready', () => { /* ... */ });
sdk.on('tokenGenerated', (response) => { /* ... */ });
sdk.on('error', (error) => { /* ... */ });
sdk.on('close', () => { /* ... */ });
```

---

#### `expressCheckout(options?)`

Initializes and displays the payment form. Returns an object with a `destroy()` function.

| Parameter | Type | Description |
|-----------|------|-------------|
| `options` | `CheckoutOptions` | (Optional) Configuration |

**CheckoutOptions:**

| Property | Type | Description |
|----------|------|-------------|
| `parentContainerId` | `string` | Container element ID. If omitted, opens as a dialog |
| `id` | `string` | ID attribute for the iframe element |
| `className` | `string` | CSS class for the iframe element |
| `uiConfig` | `Partial<UIConfig>` | UI customization (see below) |
| `submitParams` | `SubmitParams` | Tokenization parameters |

**UIConfig:**

```typescript
{
  textConfig?: {
    title?: string;
    submitBtnText?: string;
    footerText?: string;
    processingText?: string;
  };
  twoDigitExpiry?: boolean;         // Use MM/YY format
  showSaveCardCheckbox?: boolean;   // Show "Save card" checkbox
  styles?: {
    button?: {
      backgroundColor?: string;
      borderRadius?: string;
      hover?: { backgroundColor?: string };
    };
  };
  cardPaymentFormFields?: Record<string, FormField>;
}
```

**SubmitParams:**

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `metadata` | `Record<string, string>` | — | Custom key-value metadata |
| `allow_expired_date` | `boolean` | `false` | Accept past expiration dates |
| `allow_blank_name` | `boolean` | `false` | Allow empty cardholder name |
| `allow_blank_date` | `boolean` | `false` | Allow empty expiration date |

**Returns:**

```typescript
{ destroy: (hardDestroy?: boolean) => void }
```

```javascript
const checkout = sdk.expressCheckout({
  parentContainerId: 'checkout-container',
  uiConfig: {
    textConfig: { title: 'Pay', submitBtnText: 'Submit' }
  },
});

// Later
checkout.destroy();
```

---

#### `setFieldConfig(fieldName, config)`

Updates the configuration of an existing form field.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fieldName` | `string` | Field name (from MandatoryCardFormFields or AdditionalCardFormFields) |
| `config` | `Partial<FormField>` | Partial field configuration |

**FormField:**

| Property | Type | Description |
|----------|------|-------------|
| `label` | `string` | Label text |
| `placeholder` | `string` | Placeholder text |
| `isRequired` | `boolean` | Whether the field is required |
| `size` | `number` | Grid width (1–12 columns) |
| `isMasked` | `boolean` | Mask input like a password |
| `styles` | `TextfieldStyles` | Custom CSS styles |

```javascript
sdk.setFieldConfig('first_name', {
  label: 'Given Name',
  placeholder: 'Enter your first name'
});
```

---

#### `updateTextElement(textKey, textString)`

Updates a text element in the form UI.

| Parameter | Type | Description |
|-----------|------|-------------|
| `textKey` | `string` | One of `'title'`, `'submitBtnText'`, `'footerText'`, `'processingText'` |
| `textString` | `string` | New text content |

```javascript
sdk.updateTextElement('submitBtnText', 'Pay $99.00');
```

---

#### `addField(fieldName, config)`

Adds an optional field to the payment form.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fieldName` | `string` | Field name from `AdditionalCardFormFields` |
| `config` | `Partial<FormField>` | Field configuration |

```javascript
sdk.addField('phone_number', {
  label: 'Phone',
  placeholder: '+1 (555) 123-4567',
  isRequired: true
});
```

---

#### `removeField(fieldName)`

Removes a previously added optional field.

| Parameter | Type | Description |
|-----------|------|-------------|
| `fieldName` | `string` | Field name to remove |

```javascript
sdk.removeField('phone_number');
```

---

#### `updateSubmitParams(submitParams)`

Updates submission parameters after the form has been initialized.

| Parameter | Type | Description |
|-----------|------|-------------|
| `submitParams` | `SubmitParams` | New parameters (merged with existing) |

```javascript
sdk.updateSubmitParams({
  metadata: { order_id: 'ORDER-456' },
});
```

---

#### `setRecache(token, options)`

Enables recache mode for updating the CVV of a retained payment method. When in recache mode, the form only shows the CVV field and relevant card info. See the [Recaching Integration Guide](../../recaching/INTEGRATION_GUIDE.md) for the full flow.

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | `string` | Payment method token to recache |
| `options` | `RecacheOptions` | Card details for the payment method |

---

#### `close(hardDestroy?)`

Closes and cleans up the checkout form.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hardDestroy` | `boolean` | `false` | If `true`, also removes all event listeners |

```javascript
sdk.close();       // can re-launch later
sdk.close(true);   // full cleanup
```

---

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `ready` | — | Form is rendered and ready for interaction |
| `tokenGenerated` | `TokenResponse` | Payment method was successfully tokenized |
| `error` | `ErrorPayload` | An error occurred |
| `close` | — | Form was closed (dialog dismissed or `close()` called) |
| `recacheReady` | `{ token, options }` | Recache mode is active |
| `recacheSuccess` | `RecacheResponse` | CVV was successfully updated |

#### tokenGenerated payload

```javascript
{
  message: 'Token generated',
  tokenResponse: {
    token: 'transaction_token',
    succeeded: true,
    payment_method: {
      token: 'payment_method_token',   // Use this token for transactions
      card_type: 'visa',
      last_four_digits: '1111',
      first_six_digits: '411111',
      month: 12,
      year: 2028,
      storage_state: 'cached'          
    }
  }
}
```

#### error payload

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
