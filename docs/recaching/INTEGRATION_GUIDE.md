# CVV Recaching — Integration Guide

CVV recaching lets you update the CVV for a previously **retained** payment method without asking the customer to re-enter their full card details. 

Both `SpreedlyHostedFields` and `SpreedlyExpressCheckout` support recaching.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [How Recaching Works](#how-recaching-works)
3. [Hosted Fields Integration](#hosted-fields-integration)
4. [Express Checkout Integration](#express-checkout-integration)
5. [Complete Usage Examples](#complete-usage-examples)
6. [Error Handling](#error-handling)
7. [Testing](#testing)
8. [API Reference](#api-reference)

---

## Prerequisites

- A **retained** payment method — The `storage_state` must be `'retained'`.
- The payment method's **token** and **card details** (card type, last four digits, expiry). You typically retrieve these from your backend.
- **Server-generated auth details** — same as for tokenization. See the [Hosted Fields](../tokenization/hosted-fields/INTEGRATION_GUIDE.md#authentication) or [Express Checkout](../tokenization/express-checkout/INTEGRATION_GUIDE.md#authentication) guides.

---

## How Recaching Works

```
1. Initialize SDK with auth details
2. Mount the payment fields
3. SDK fires 'ready' event
4. Call sdk.setRecache(token, cardOptions)
   → Card number field shows the masked card
   → SDK fires 'recacheReady' event
5. Customer enters new CVV
6. Trigger recache:
   - Hosted Fields: call sdk.recache()
   - Express Checkout: customer submits the form (automatic)
7. SDK recaches the payment method.
8. SDK fires 'recacheSuccess' with the updated payment method
```

Key difference between the two SDKs:
- **Hosted Fields** — you must call `sdk.recache()` explicitly after the customer enters their CVV.
- **Express Checkout** — the form handles submission automatically when the customer clicks the submit button. There is no `recache()` method to call.

---

## Hosted Fields Integration

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
  console.log('Hosted fields mounted');
  // Now safe to call setRecache
});

sdk.on('recacheReady', ({ token, options }) => {
  console.log('Recache mode active for:', token);
  // Enable the "Update CVV" button
  document.getElementById('update-cvv-btn').disabled = false;
});

sdk.on('recacheSuccess', (response) => {
  console.log('CVV updated!', response);
  const pm = response.payment_method;
  console.log('Token:', pm.token);
  console.log('Card:', pm.card_type, pm.last_four_digits);
});

sdk.on('error', (error) => {
  console.error('Error:', error);
});
```

### Step 3 — Mount hosted fields

Both `number` and `cvv` containers must be provided. In recache mode, the number field will display the masked card number (disabled), and the CVV field will accept the new value.

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

### Step 4 — Enable recache mode (after `ready` fires)

Inside the `ready` event callback, Call `setRecache()` with the retained payment method token and its card details:

```javascript
sdk.on('ready', () => {
  sdk.setRecache('PAYMENT_METHOD_TOKEN', {
    card_type: 'visa',                // required 
    last_four_digits: '1111',         // required — displayed in the masked card number field
    first_six_digits: '411111',       // optional
    storage_state: 'retained',        // required — must be 'retained'
    month: '12',                      // required
    year: '2028',                     // required
    full_name: 'John Doe',            // optional
    allow_blank_name: false,          // optional — allow recache for cards tokenized without a name
    allow_expired_date: false,        // optional — allow recache for cards with an expired date
    allow_blank_date: false           // optional — allow recache for cards tokenized without an expiry
  });
});
```

After `setRecache()` is called:
- The card number field shows the masked card number and becomes disabled
- The SDK emits `recacheReady` with `{ token, options }`

### Step 5 — Submit the recache

After the customer enters their new CVV and the `recacheReady` event has fired, call `recache()`:

```javascript
document.getElementById('update-cvv-btn').addEventListener('click', () => {
  sdk.recache();
});
```

### Step 6 — Handle the result

```javascript
sdk.on('recacheSuccess', (response) => {
  // response.payment_method contains the updated payment method details
  console.log('CVV updated for:', response.token);
  console.log('Card type:', response.payment_method.card_type);
  // Proceed with your transaction using the same payment method token
});
```

---

## Express Checkout Integration

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
  console.log('Express Checkout ready');
  // Now safe to call setRecache
});

sdk.on('recacheReady', ({ token, options }) => {
  console.log('Recache mode active for:', token);
});

sdk.on('recacheSuccess', (response) => {
  console.log('CVV updated!', response);
  const pm = response.payment_method;
  console.log('Token:', pm.token);
});

sdk.on('error', (error) => {
  console.error('Error:', error);
});

sdk.on('close', () => {
  console.log('Checkout form closed');
});
```

### Step 3 — Launch the checkout form

```javascript
const checkout = sdk.expressCheckout({
  parentContainerId: 'checkout-container',
  uiConfig: {
    textConfig: {
      title: 'Update CVV',
      submitBtnText: 'Update CVV',
      processingText: 'Processing...'
    }
  }
});
```

### Step 4 — Enable recache mode (after `ready` fires)

```javascript
sdk.on('ready', () => {
  sdk.setRecache('PAYMENT_METHOD_TOKEN', {
    card_type: 'visa',
    last_four_digits: '1111',
    first_six_digits: '411111',
    storage_state: 'retained',
    month: '12',
    year: '2028',
    full_name: 'John Doe',
    allow_blank_name: false,
    allow_expired_date: false,
    allow_blank_date: false
  });
});
```

After `setRecache()` is called, the Express Checkout form switches to recache mode — it hides all fields except CVV, and only validates the CVV on submission.

### Step 5 — Customer submits

The customer enters their CVV and clicks the submit button in the Express Checkout form. No manual `recache()` call is needed — the form handles submission automatically.

On success, the SDK fires `recacheSuccess` and then auto-closes the form (firing the `close` event).

---

## Complete Usage Examples

### Hosted Fields — Complete Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Recache CVV — Hosted Fields</title>
  <style>
    .card-display { padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 16px; }
    .card-display .card-type { font-weight: 600; }
    .card-display .card-number { font-family: monospace; color: #6b7280; }
    .form-group { margin-bottom: 16px; }
    .form-group label { display: block; margin-bottom: 4px; font-weight: 500; }
    .hosted-field { height: 40px; border: 1px solid #ccc; border-radius: 4px; }
    button { padding: 12px 24px; background: #0a0a0a; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    #result { margin-top: 16px; padding: 16px; border-radius: 6px; display: none; }
    #result.success { background: #f0fdf4; border: 1px solid #bbf7d0; display: block; }
    #result.error { background: #fef2f2; border: 1px solid #fecaca; display: block; }
  </style>
</head>
<body>
  <h1>Update CVV</h1>

  <!-- Display the retained card info -->
  <div class="card-display">
    <div class="card-type">Visa</div>
    <div class="card-number">•••• •••• •••• 1111</div>
    <div>Expires 12/2028</div>
  </div>

  <!-- Hosted fields containers -->
  <div class="form-group">
    <label>Card Number</label>
    <div id="card-number-field" class="hosted-field"></div>
  </div>

  <div class="form-group">
    <label>New CVV</label>
    <div id="cvv-field" class="hosted-field" style="max-width: 120px;"></div>
  </div>

  <button id="update-cvv-btn" disabled>Update CVV</button>

  <div id="result"></div>

  <script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>
  <script>
    // The retained card to recache (fetched from your backend)
    const savedCard = {
      token: 'PAYMENT_METHOD_TOKEN',
      card_type: 'visa',
      last_four_digits: '1111',
      first_six_digits: '411111',
      storage_state: 'retained',
      month: '12',
      year: '2028',
      full_name: 'John Doe'
    };

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
      // 4. Enable recache mode
      sdk.setRecache(savedCard.token, {
        card_type: savedCard.card_type,
        last_four_digits: savedCard.last_four_digits,
        first_six_digits: savedCard.first_six_digits,
        storage_state: savedCard.storage_state,
        month: savedCard.month,
        year: savedCard.year,
        full_name: savedCard.full_name
      });
    });

    sdk.on('recacheReady', ({ token, options }) => {
      document.getElementById('update-cvv-btn').disabled = false;
    });

    sdk.on('recacheSuccess', (response) => {
      const result = document.getElementById('result');
      result.className = 'success';
      result.innerHTML = `
        <strong>CVV updated successfully!</strong><br>
        Token: ${response.token}<br>
        Card: ${response.payment_method.card_type} ending in ${response.payment_method.last_four_digits}
      `;
    });

    sdk.on('error', (error) => {
      const result = document.getElementById('result');
      result.className = 'error';
      result.textContent = error.message || 'Recache failed';
    });

    // 3. Mount hosted fields
    sdk.inAppElements({
      number: { containerId: 'card-number-field' },
      cvv: { containerId: 'cvv-field' }
    });

    // 5. Submit recache on button click
    document.getElementById('update-cvv-btn').addEventListener('click', () => {
      document.getElementById('update-cvv-btn').disabled = true;
      sdk.recache();
    });
  </script>
</body>
</html>
```

### Express Checkout — Complete Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Recache CVV — Express Checkout</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px; margin: 40px auto; padding: 0 20px; }
    .card-display { padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 16px; }
    .card-display .card-type { font-weight: 600; }
    .card-display .card-number { font-family: monospace; color: #6b7280; }
    #checkout-container { min-height: 200px; }
    #result { margin-top: 16px; padding: 16px; border-radius: 6px; display: none; }
    #result.success { background: #f0fdf4; border: 1px solid #bbf7d0; display: block; }
  </style>
</head>
<body>
  <h1>Update CVV</h1>

  <div class="card-display">
    <div class="card-type">Visa</div>
    <div class="card-number">•••• •••• •••• 1111</div>
    <div>Expires 12/2028</div>
  </div>

  <div id="checkout-container"></div>
  <div id="result"></div>

  <script src="https://core.spreedly.com/checkout/elements/{version}/express-checkout.js"></script>
  <script>
    const savedCard = {
      token: 'PAYMENT_METHOD_TOKEN',
      card_type: 'visa',
      last_four_digits: '1111',
      first_six_digits: '411111',
      storage_state: 'retained',
      month: '12',
      year: '2028',
      full_name: 'John Doe'
    };

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
      // 4. Enable recache mode
      sdk.setRecache(savedCard.token, {
        card_type: savedCard.card_type,
        last_four_digits: savedCard.last_four_digits,
        first_six_digits: savedCard.first_six_digits,
        storage_state: savedCard.storage_state,
        month: savedCard.month,
        year: savedCard.year,
        full_name: savedCard.full_name
      });
    });

    sdk.on('recacheReady', ({ token }) => {
      console.log('Ready — enter CVV and submit the form');
    });

    sdk.on('recacheSuccess', (response) => {
      const result = document.getElementById('result');
      result.className = 'success';
      result.innerHTML = `
        <strong>CVV updated successfully!</strong><br>
        Token: ${response.token}<br>
        Card: ${response.payment_method.card_type} ending in ${response.payment_method.last_four_digits}
      `;
    });

    sdk.on('error', (error) => {
      console.error('Error:', error);
    });

    sdk.on('close', () => {
      console.log('Form closed');
    });

    // 3. Launch checkout form
    sdk.expressCheckout({
      parentContainerId: 'checkout-container',
      uiConfig: {
        textConfig: {
          title: 'Update CVV',
          submitBtnText: 'Update CVV',
          processingText: 'Processing...'
        }
      }
    });
  </script>
</body>
</html>
```

---

## Error Handling

### Common recache errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `Payment method token is required for recaching` | Empty token passed to `setRecache()` | Provide a valid payment method token |
| `Payment method must be retained for recaching` | `storage_state` is not `'retained'` | Only retained payment methods can be recached. Tokenize with `retained: true` first |
| `SDK is not in recache mode. Call setRecache() first.` | `recache()` called before `setRecache()` | Ensure `setRecache()` is called after `ready` and before `recache()` |
| `CVV is required for recaching` | Customer did not enter a CVV | Prompt the customer to enter their CVV before submitting |

### Error event handling

```javascript
sdk.on('error', (error) => {
  // error.message contains the error description
  console.error('Recache error:', error.message);

  // For validation errors, error may also contain an attribute field
  if (error.attribute) {
    console.error('Related field:', error.attribute);
  }
});
```

---

## Testing

To test the recache flow end-to-end:

1. Tokenize a card with `retained: true` using the [Tokenization flow](../tokenization/OVERVIEW.md)
2. Note the returned payment method token and card details
3. Initialize the recache flow with that token

---

## API Reference

### `setRecache(token, options)`

Enables recache mode. Available on both `SpreedlyHostedFields` and `SpreedlyExpressCheckout`.

Must be called **after** the `ready` event fires.

| Parameter | Type | Description |
|-----------|------|-------------|
| `token` | `string` | The retained payment method token |
| `options` | `RecacheOptions` | Card details and configuration |

#### RecacheOptions

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `card_type` | `string` | Yes | Card type (`'visa'`, `'mastercard'`, `'american_express'`, etc.) |
| `last_four_digits` | `string` | Yes | Last 4 digits of the card number |
| `first_six_digits` | `string` | No | First 6 digits (BIN) of the card number |
| `storage_state` | `string` | Yes | Must be `'retained'` |
| `month` | `string` | Yes | Expiration month (e.g. `'12'`) |
| `year` | `string` | Yes | Expiration year (e.g. `'2028'`) |
| `full_name` | `string` | No | Cardholder name |
| `allow_blank_name` | `boolean` | No | Allow recache for cards tokenized without a name |
| `allow_expired_date` | `boolean` | No | Allow recache for cards with an expired date |
| `allow_blank_date` | `boolean` | No | Allow recache for cards tokenized without an expiry date |

```javascript
sdk.setRecache('56wyNnSmuA6CWYP7w0MiYCVIbW6', {
  card_type: 'visa',
  last_four_digits: '4242',
  first_six_digits: '411111',
  storage_state: 'retained',
  month: '12',
  year: '2028',
  full_name: 'John Doe'
});
```

---

### `recache()` (Hosted Fields only)

Triggers the CVV recache API call. Must be called:
- **After** `setRecache()` has been called
- **After** the `recacheReady` event has fired
- **After** the customer has entered a CVV value

This method is **not available** on `SpreedlyExpressCheckout` — Express Checkout handles submission automatically through its built-in form.

```javascript
sdk.on('recacheReady', () => {
  // Enable your submit button
});

document.getElementById('update-cvv-btn').addEventListener('click', () => {
  sdk.recache();
});
```

---

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `recacheReady` | `{ token, options }` | Recache mode is active; the card number field is prefilled and disabled, the CVV field is ready for input |
| `recacheSuccess` | `RecacheResponse` | CVV was successfully updated via the Spreedly API |
| `error` | `ErrorPayload` | An error occurred (see [Error Handling](#error-handling)) |

#### recacheReady payload

```javascript
{
  token: 'PAYMENT_METHOD_TOKEN',
  options: {
    card_type: 'visa',
    last_four_digits: '1111',
    storage_state: 'retained',
    month: '12',
    year: '2028',
    // ... other options passed to setRecache()
  }
}
```

#### recacheSuccess payload

```javascript
{
  message: 'CVV recached successfully',
  token: 'PAYMENT_METHOD_TOKEN',
  payment_method: {
    token: 'PAYMENT_METHOD_TOKEN',
    card_type: 'visa',
    last_four_digits: '1111',
    first_six_digits: '411111',
    month: 12,
    year: 2028,
    storage_state: 'retained'
    // ... other payment method fields from the Spreedly API
  }
}
```

---

## See Also

- [Tokenization Overview](../tokenization/OVERVIEW.md) — Tokenize a card with `retained: true` before recaching
- [Hosted Fields Integration Guide](../tokenization/hosted-fields/INTEGRATION_GUIDE.md) — Full Hosted Fields API reference
- [Express Checkout Integration Guide](../tokenization/express-checkout/INTEGRATION_GUIDE.md) — Full Express Checkout API reference
- [Security Guide](../../SECURITY.md) — SRI, CSP, and security best practices
