# Testing Guide — Merchant Developers

This guide covers how to test your Spreedly Web SDK integration end-to-end — from verifying the SDK loads correctly to confirming each payment flow works as expected.

---

## Table of Contents

1. [SDK Script URLs](#sdk-script-urls)
2. [Test Card Numbers](#test-card-numbers)
3. [Testing Tokenization](#testing-tokenization)
4. [Testing CVV Recaching](#testing-cvv-recaching)
5. [Testing 3D Secure](#testing-3d-secure)
6. [Testing Offsite Payments](#testing-offsite-payments)
7. [Content Security Policy](#content-security-policy)
8. [Troubleshooting](#troubleshooting)

---

## SDK Script URLs

Load the SDK from the Spreedly CDN:

| SDK | URL |
|-----|-----|
| **Hosted Fields** | `https://core.spreedly.com/checkout/sdk/{version}/index.js` |
| **Express Checkout** | `https://core.spreedly.com/checkout/elements/{version}/express-checkout.js` |

Replace `{version}` with a specific version (e.g., `1.0.0`), `rc` for the latest release candidate, or `stable` for the stable release.

```html
<!-- Hosted Fields -->
<script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>

<!-- Express Checkout -->
<script src="https://core.spreedly.com/checkout/elements/{version}/express-checkout.js"></script>
```

---

## Test Card Numbers

Use these card numbers with your Spreedly test environment. They will not result in real charges.

### Standard Test Cards

| Card Type | Number | CVV | Expiry |
|-----------|--------|-----|--------|
| Visa | 4111111111111111 | 123 | Any future date |
| Mastercard | 5555555555554444 | 123 | Any future date |
| American Express | 378282246310005 | 1234 | Any future date |
| Discover | 6011111111111117 | 123 | Any future date |

> **Note:** American Express uses a 4-digit CVV. All other card types use 3 digits.

### Additional test data

See [Spreedly Test Data](https://developer.spreedly.com/docs/test-data) for a complete list of test card numbers, bank accounts, and other payment methods.

---

## Testing Tokenization

Tokenization is the core flow — collecting card details and creating a payment method token.

### What to verify

1. **SDK loads successfully** — the `ready` event fires without errors.
2. **Valid card is accepted** — entering a test card and submitting produces a `tokenGenerated` event.
3. **Token response is correct** — `response.tokenResponse.payment_method.token` contains a valid token string.
4. **Card details are returned** — the response includes `card_type`, `last_four_digits`, `first_six_digits`, `month`, `year`.
5. **Invalid card is rejected** — entering an invalid card number triggers an `error` event with field-level validation errors.
6. **Expired date handling** — submitting an expired date triggers an error (unless `allow_expired_date` is set).
7. **Blank name handling** — submitting without a name triggers an error (unless `allow_blank_name` is set).

### Quick test (Hosted Fields)

```javascript
const sdk = new SpreedlyHostedFields({ /* auth details */ });

sdk.on('ready', () => console.log('PASS: SDK ready'));

sdk.on('tokenGenerated', (response) => {
  console.log('PASS: Token generated');
  console.log('  Token:', response.tokenResponse.payment_method.token);
  console.log('  Card type:', response.tokenResponse.payment_method.card_type);
  console.log('  Last four:', response.tokenResponse.payment_method.last_four_digits);
});

sdk.on('error', (error) => {
  console.log('ERROR:', error.message);
  if (error.errors) {
    error.errors.forEach(e => console.log(`  ${e.attribute}: ${e.message}`));
  }
});

sdk.inAppElements({
  number: { containerId: 'card-number' },
  cvv: { containerId: 'cvv' }
});
```

### Quick test (Express Checkout)

```javascript
const sdk = new SpreedlyExpressCheckout({ /* auth details */ });

sdk.on('ready', () => console.log('PASS: SDK ready'));

sdk.on('tokenGenerated', (response) => {
  console.log('PASS: Token generated');
  console.log('  Token:', response.tokenResponse.payment_method.token);
});

sdk.on('error', (error) => console.log('ERROR:', error));

sdk.expressCheckout({ parentContainerId: 'checkout-container' });
```

### Retained payment method

To test token retention (needed for recaching and recurring payments), pass `retained: true` in submit params:

```javascript
// Hosted Fields
sdk.submit({ first_name: 'John', last_name: 'Doe', month: '12', year: '2028' }, { retained: true });

// Express Checkout
sdk.expressCheckout({
  parentContainerId: 'checkout-container',
  submitParams: { retained: true }
});
```

Verify: `response.tokenResponse.payment_method.storage_state` should be `'retained'`.

---

## Testing CVV Recaching

Recaching updates the CVV for a previously retained payment method.

### Prerequisites

- A retained payment method token (tokenize a card with `retained: true` first)
- The card details (card_type, last_four_digits, month, year, storage_state)

### What to verify

1. **`recacheReady` event fires** — after calling `setRecache()`, the SDK should emit `recacheReady` with the token and options.
2. **Card number field is disabled** — in Hosted Fields, the number field should show a masked card number and be non-editable.
3. **New CVV is accepted** — entering a valid CVV and submitting produces a `recacheSuccess` event.
4. **Response contains payment method** — `response.payment_method.token` should match the original token.
5. **Invalid CVV is rejected** — leaving CVV empty should produce an error.

### Quick test (Hosted Fields)

```javascript
sdk.on('recacheReady', ({ token }) => {
  console.log('PASS: Recache ready for:', token);
  // Enter CVV in the hosted field, then:
  // sdk.recache();
});

sdk.on('recacheSuccess', (response) => {
  console.log('PASS: CVV updated');
  console.log('  Token:', response.token);
  console.log('  Card type:', response.payment_method.card_type);
});

// After 'ready' fires:
sdk.setRecache('RETAINED_TOKEN', {
  card_type: 'visa',
  last_four_digits: '1111',
  storage_state: 'retained',
  month: '12',
  year: '2028'
});
```

---

## Testing 3D Secure

3D Secure adds an authentication layer after tokenization. Testing depends on which 3DS approach you use.

### 3DS Test Amounts (Spreedly Test Gateway)

When using the Spreedly test gateway, the transaction amount determines which 3DS flow is simulated:

| Amount (cents) | Flow |
|---------------|------|
| 3001 | Frictionless — immediate success, no user interaction |
| 3003 | Device fingerprint → complete → success |
| 3004 | Device fingerprint → complete → challenge → success |
| 3005 | Direct challenge → success |
| 3103 | Device fingerprint → complete → failure |
| 3104 | Challenge → failure |

### What to verify

1. **Frictionless flow (amount: 3001)** — `onSuccess` callback fires without showing a challenge.
2. **Challenge flow (amount: 3004 or 3005)** — `onChallenge` callback fires, a challenge UI appears in the container, and after completion `onSuccess` fires.
3. **Failure flow (amount: 3103 or 3104)** — `onError` callback fires with error details.
4. **Timeout handling** — the SDK polls for up to 10 seconds. The Spreedly test gateway always takes the full 10 seconds.

### Quick test

```javascript
const lifecycle = new SpreedlyThreeDSLifecycle({
  environmentKey: 'your_env_key',
  transactionToken: 'transaction_token_from_auth',
  challengeIframeContainerId: 'challenge-container',
  hiddenIframeContainerId: 'hidden-iframe-container',
  onSuccess: (result) => console.log('PASS: 3DS success', result),
  onError: (error) => console.log('3DS error:', error),
  onChallenge: () => console.log('Challenge displayed'),
  onDeviceDataCollection: () => console.log('Device data collection started')
});

lifecycle.start();
```

### Gateway-specific testing

See the [3DS Gateway Specific Integration Guide](../../docs/three-ds/gateway-specific/INTEGRATION_GUIDE.md) for gateway-specific test scenarios.

---

## Testing Offsite Payments

### General Offsite (PayPal, PIX, Boleto, etc.)

Use the Spreedly test gateway with the `sprel` payment method type to simulate offsite flows without a live gateway:

```javascript
sdk.setupOffsitePayment({
  paymentMethodType: 'sprel'
});
```

The test gateway provides a mock checkout page that lets you simulate success, failure, and delayed settlement scenarios.

### Braintree APM (PayPal & Venmo)

1. Create a Braintree sandbox account.
2. Configure the sandbox gateway in Spreedly.
3. For PayPal: create PayPal sandbox buyer accounts in the PayPal Developer Portal, then link PayPal in the Braintree Sandbox portal.
4. For Venmo: enable Venmo in Braintree sandbox and use Braintree's test Venmo accounts.

### Stripe APM (iDEAL, Bancontact, SEPA, etc.)

Use Stripe test-mode credentials (`pk_test_...`). Stripe provides a simulated Payment Element that lets you complete flows without real bank interactions.

---

## Content Security Policy

If your page uses a Content Security Policy, allow the Spreedly CDN domain:

```html
<meta http-equiv="Content-Security-Policy" content="
  frame-src https://core.spreedly.com;
  script-src https://core.spreedly.com;
  connect-src https://core.spreedly.com;
">
```

---

## Troubleshooting

For issues during testing or in your integration, see the [Troubleshooting Guide](../TROUBLESHOOTING_GUIDE.md). It covers SDK loading failures, authentication errors, CSP configuration, tokenization and recache errors, 3DS issues, network problems, and browser DevTools tips.
