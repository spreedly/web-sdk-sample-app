# Spreedly Web SDK — Getting Started

This sample application demonstrates how to integrate the Spreedly Web SDK into your payment flow. Use it as a reference implementation for collecting card data, recaching CVVs, processing 3D Secure authentication, handling offsite payments etc.
[`Live Sample app`](https://checkout-web-sample-app-049a3c617015.herokuapp.com/)
---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Loading the SDK](#loading-the-sdk)
4. [Authentication](#authentication)
5. [Choosing an Integration](#choosing-an-integration)
6. [Quick Start: Tokenize a Card](#quick-start-tokenize-a-card)
7. [Available Payment Flows](#available-payment-flows)
8. [Security](#security)
9. [Documentation](#documentation)
10. [Running the Sample App](#running-the-sample-app)

---

## Overview

The Spreedly Web SDK lets you collect payment card data securely without it ever touching your servers. Card numbers and CVVs are captured inside Spreedly-hosted iframes, tokenized through the Spreedly API, and returned to your page as a payment method token that you can use for transactions.

The SDK offers two integration options:

| Integration | Description | Best for |
|------------|-------------|----------|
| **Hosted Fields** | Individual secure input fields (card number, CVV) that you embed into your own form | Full control over form layout, styling, and UX |
| **Express Checkout** | A pre-built, drop-in payment form with built-in validation and styling | Quick integration with minimal front-end code |

Both options provide the same security guarantees — card data never touches your DOM.

### Latest version

The latest released version is **`1.2.0`**, available at:

- Hosted Fields: [`https://core.spreedly.com/checkout/sdk/1.2.0/index.js`](https://core.spreedly.com/checkout/sdk/1.2.0/index.js)
- Express Checkout: [`https://core.spreedly.com/checkout/elements/1.2.0/express-checkout.js`](https://core.spreedly.com/checkout/elements/1.2.0/express-checkout.js)

### Past Releases

Previous production releases of the SDK:

| Version | Packages |  Release Date  | Notes |
|---------|----------|----------------|-------|
| `1.0.1` | Hosted Fields (`https://core.spreedly.com/checkout/sdk/1.0.1/index.js`) and Express Checkout (`https://core.spreedly.com/checkout/elements/1.0.1/express-checkout.js`) | April 30, 2026 | —     |

---

## Prerequisites

Before integrating the SDK, you need a merchant account and then secure credentials
to load the SDKs:
[More details on Merchant Account](https://developer.spreedly.com/docs/merchant-onboarding-guide)
[More details on Securing the SDK](https://developer.spreedly.com/docs/using-certificates-iframe-security)
---

## Loading the SDK

Include the SDK via a `<script>` tag from the Spreedly CDN. Choose the script that matches your integration:

### Hosted Fields

```html
<script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>
```

### Express Checkout

```html
<script src="https://core.spreedly.com/checkout/elements/{version}/express-checkout.js"></script>
```

Replace `{version}` with:

| Channel | Description | Example |
|---------|-------------|---------|
| A specific version | Pinned release (recommended for production) | `1.2.0` |
| `rc` | Latest release candidate | `rc` |

---

## Authentication

The SDK uses certificate-based authentication. Each SDK initialization requires five parameters:

| Parameter | Description |
|-----------|-------------|
| `environment_key` | Your Spreedly environment key |
| `certificate_token` | Your certificate token |
| `nonce` | A unique value (UUID) generated per session |
| `timestamp` | Current UTC timestamp (seconds since epoch) |
| `signature` | HMAC signature of `nonce + timestamp + certificate_token`, signed with your private key |

### Example: Your Backend endpoint (Node.js)

```javascript
const crypto = require('crypto');

app.get('/api/auth', (req, res) => {
  const certificateToken = process.env.CERTIFICATE_TOKEN;
  const privateKey = process.env.PRIVATE_KEY;
  const environmentKey = process.env.ENVIRONMENT_KEY;

  const nonce = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);

  const sign = crypto.createSign('SHA256');
  sign.write(`${nonce}${timestamp}${certificateToken}`);
  const signature = sign.sign(privateKey, 'base64');

  res.json({
    environment_key: environmentKey,
    certificate_token: certificateToken,
    nonce,
    timestamp: String(timestamp),
    signature,
  });
});
```

### Example: Your Frontend fetching auth

```javascript
const authResponse = await fetch('/api/auth');
const authDetails = await authResponse.json();

// authDetails now contains: environment_key, certificate_token, nonce, timestamp, signature
```

---

## Choosing an Integration

| Consideration | Hosted Fields | Express Checkout |
|--------------|--------------|-----------------|
| **Form layout** | You build and control the entire form | Pre-built form provided by the SDK |
| **Styling** | CSS applied to field containers; input styles via SDK API | API-based customization (colors, typography, button, per-field styles) |
| **PCI scope** | Number and CVV in iframes; name, expiry on your page | All fields inside the iframe |
| **Submission** | You call `sdk.submit()` with form data | User clicks submit inside the iframe |
| **Render modes** | Inline fields only | Embedded in a container or as a modal dialog |

For a detailed comparison, see [Tokenization Overview](./docs/tokenization/OVERVIEW.md).

---

## Quick Start: Tokenize a Card

### Hosted Fields

```html
<!-- 1. Container elements for the secure fields -->
<div id="card-number"></div>
<div id="cvv"></div>
<input type="text" id="first-name" placeholder="First name" />
<input type="text" id="last-name" placeholder="Last name" />
<input type="text" id="month" placeholder="MM" />
<input type="text" id="year" placeholder="YYYY" />
<button id="pay-btn">Pay</button>

<!-- 2. Load the SDK -->
<script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>

<script>
  // 3. Fetch auth details from your backend
  fetch('/api/auth')
    .then(res => res.json())
    .then(authDetails => {
      // 4. Initialize the SDK
      const sdk = new SpreedlyHostedFields(authDetails);

      // 5. Listen for events
      sdk.on('ready', () => {
        console.log('SDK ready — fields are loaded');
      });

      sdk.on('tokenGenerated', (response) => {
        const token = response.tokenResponse.payment_method.token;
        console.log('Payment method token:', token);
        // Send this token to your backend to create a transaction
      });

      sdk.on('error', (error) => {
        console.error('Error:', error);
      });

      // 6. Mount the secure fields
      sdk.inAppElements({
        number: { containerId: 'card-number' },
        cvv: { containerId: 'cvv' },
      });

      // 7. Submit on button click
      document.getElementById('pay-btn').addEventListener('click', () => {
        sdk.submit({
          first_name: document.getElementById('first-name').value,
          last_name: document.getElementById('last-name').value,
          month: document.getElementById('month').value,
          year: document.getElementById('year').value,
        });
      });
    });
</script>
```

### Express Checkout

```html
<!-- 1. Container for the payment form -->
<div id="checkout-container"></div>

<!-- 2. Load the SDK -->
<script src="https://core.spreedly.com/checkout/elements/{version}/express-checkout.js"></script>

<script>
  // 3. Fetch auth details from your backend
  fetch('/api/auth')
    .then(res => res.json())
    .then(authDetails => {
      // 4. Initialize the SDK
      const sdk = new SpreedlyExpressCheckout(authDetails);

      // 5. Listen for events
      sdk.on('ready', () => {
        console.log('SDK ready — form is loaded');
      });

      sdk.on('tokenGenerated', (response) => {
        const token = response.tokenResponse.payment_method.token;
        console.log('Payment method token:', token);
        // Send this token to your backend to create a transaction
      });

      sdk.on('error', (error) => {
        console.error('Error:', error);
      });

      // 6. Mount the payment form
      sdk.expressCheckout({
        parentContainerId: 'checkout-container',
      });
    });
</script>
```

---

## Available Payment Flows

This sample app demonstrates the following payment flows:

| Flow | Description | Documentation |
|------|-------------|---------------|
| **Tokenize a Card** | Collect card details and create a payment method token | [Hosted Fields Guide](./docs/tokenization/hosted-fields/INTEGRATION_GUIDE.md), [Express Checkout Guide](./docs/tokenization/express-checkout/INTEGRATION_GUIDE.md) |
| **Recache CVV** | Update the CVV for a previously retained payment method | [Recaching Guide](./docs/recaching/INTEGRATION_GUIDE.md) |
| **Purchase with 3DS (Global)** | Purchase with Spreedly-managed 3D Secure authentication | [3DS Global Guide](./docs/three-ds/global/INTEGRATION_GUIDE.md) |
| **Purchase with 3DS (Gateway Specific)** | Purchase with gateway-managed 3D Secure | [3DS Gateway Specific Guide](./docs/three-ds/gateway-specific/INTEGRATION_GUIDE.md) |
| **Offsite Payments** | PayPal, PIX, Boleto via transparent redirect or API | [General Offsite Guide](./docs/offsite-payments/general/INTEGRATION_GUIDE.md) |
| **Braintree APM** | PayPal and Venmo via Braintree | [Braintree Guide](./docs/offsite-payments/braintree/INTEGRATION_GUIDE.md) |
| **Stripe APM** | iDEAL, Bancontact, SEPA via Stripe | [Stripe APM Guide](./docs/offsite-payments/stripe-apm/INTEGRATION_GUIDE.md) |

---

## Security

When integrating the SDK into your production application:

- **Use SRI (Subresource Integrity)** — Always include the `integrity` attribute when loading the SDK script to verify the file hasn't been tampered with. SRI hashes are published with each release.
- **Configure CSP (Content Security Policy)** — Allow `frame-src`, `script-src`, and `connect-src` for `https://core.spreedly.com`.
- **Serve over HTTPS** — The SDK requires a secure context.
- **Never expose your private key** — Auth credentials (`nonce`, `timestamp`, `signature`) must be generated on your backend.

```html
<script
  src="https://core.spreedly.com/checkout/sdk/{version}/index.js"
  integrity="sha384-{HASH_FROM_SRI_MANIFEST}"
  crossorigin="anonymous"
></script>
```

[See Security Guide](./SECURITY.md)

---

## Documentation

| Document | Description |
|----------|-------------|
| [Tokenization Overview](./docs/tokenization/OVERVIEW.md) | Compare Hosted Fields vs Express Checkout |
| [3DS Overview](./docs/three-ds/OVERVIEW.md) | Compare Global vs Gateway Specific 3DS |
| [Offsite Payments Overview](./docs/offsite-payments/OVERVIEW.md) | Compare General, Braintree APM, and Stripe APM |
| [Testing Guide](./docs/testing/TESTING_GUIDE.md) | Test card numbers and how to verify each flow |

---

## Running the Sample App

### Setup

1. Clone the repository:

```bash
git clone <repository-url>
cd web-sdk-sample-app
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run build
npm run start
```

4. Open `http://localhost:3000` in your browser.

### How the Sample App Works

- The landing page lets you choose between **Hosted Fields** and **Express Checkout**.
- Select a payment flow (tokenize, recache, purchase, 3DS, offsite)
- The app loads the appropriate SDK and renders the chosen flow
- Auth credentials are fetched from the sample app's backend (`/api/v1/auth/params`)
- Results (tokens, errors, transaction details) are displayed in the UI

### Test Card Numbers

| Card Type | Number | CVV | Expiry |
|-----------|--------|-----|--------|
| Visa | 4111111111111111 | 123 | Any future date |
| Mastercard | 5555555555554444 | 123 | Any future date |
| American Express | 378282246310005 | 1234 | Any future date |

For a complete list of test data, see [Spreedly Test Data](https://developer.spreedly.com/docs/test-data).

---
## Support
- **Support Home:** [Troubleshoot](https://support.spreedly.com/hc/en-us)
- **Help Center:** [Submit a request](https://support.spreedly.com/hc/en-us/requests/new)
- **Security Issues:** [See Security Document](./SECURITY.md)

## Legal

- [Terms of Service](https://legal.spreedly.com/#terms)
- [Privacy Policy](https://legal.spreedly.com/#privacy-policy)
- [License](./LICENSE) (Apache 2.0)

