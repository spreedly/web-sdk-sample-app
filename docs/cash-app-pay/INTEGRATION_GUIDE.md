# Cash App Pay — Integration Guide

Add **Cash App Pay** (Block, Inc.) to your checkout with the Spreedly checkout SDK. The shopper
approves the payment in Cash App: by scanning a QR code on desktop, or in the Cash App app on
mobile. The SDK turns that approval into a **Spreedly payment method token**, which your server
charges like any other token.

> **Status: pending Spreedly Core.** Core's Cash App payment-method API and the `cash_app`
> gateway are not available yet. Until they are, the SDK returns a **mock** payment method
> (`mock: true`, token prefixed `mock_`) and no Spreedly API call is made. The browser flow, the
> events and the public API described here are final; only the token exchange will change. Don't
> use this in production yet.

## What you'll need

- **Cash App Pay partner onboarding** — a Client ID (`CAS-CI_…` sandbox, `CA-CI_…` production)
  and a Merchant ID created through Cash App's Network API.
- **Spreedly auth details** (`environment_key`, `certificate_token`, `nonce`, `signature`,
  `timestamp`), signed on your server, the same as for Hosted Fields or Express Checkout.
- A **server endpoint** that charges the payment method token (see
  [Charge the token](#5-charge-the-token)).

## How the pieces fit

| Piece | Role |
|-------|------|
| **Pay Kit `pay.js`** | Block's client. **You load it**; the SDK drives `window.CashApp` |
| **Cash App Pay button / QR code** | Rendered by Pay Kit into your `renderTarget` |
| **`SpreedlyCashAppPay`** | The class you call: `setup`, `beginCheckout`, `restart`, events |
| **Your server** | Signs auth details and charges the token |

## Quick start

### 1. Load the scripts

Load Pay Kit, then a Spreedly bundle. Both the Hosted Fields and Express Checkout bundles expose
`window.SpreedlyCashAppPay`. Pay Kit must come from Block's CDN; it can't be bundled or
self-hosted.

```html
<!-- Sandbox -->
<script async src="https://sandbox.kit.cash.app/v1/pay.js"></script>
<!-- Production -->
<!-- <script async src="https://kit.cash.app/v1/pay.js"></script> -->

<script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>

<div id="cash-app-pay"></div>
```

`setup()` waits up to 10 seconds for `window.CashApp`, so an `async` tag is fine.

### 2. Create the instance and listen for events

```javascript
const cashApp = new SpreedlyCashAppPay({
  authDetails,                       // from your server
  clientId: 'CAS-CI_YOUR_CLIENT_ID',
  merchantId: 'YOUR_CASH_APP_MERCHANT_ID',
  redirectURL: 'https://shop.example/checkout', // where mobile shoppers return
  renderTarget: '#cash-app-pay',
  environment: 'sandbox',
  button: { shape: 'semiround', width: 'full' }, // optional
});

cashApp.on('cashAppReady', () => {});
cashApp.on('cashAppApproved', ({ cashtag }) => showProcessing(cashtag));
cashApp.on('cashAppTokenGenerated', ({ token }) => chargeOnServer(token));
cashApp.on('cashAppDeclined', () => offerOtherPaymentMethods());
cashApp.on('cashAppDismissed', () => {});
cashApp.on('cashAppError', ({ code, message }) => console.error(code, message));
```

Register handlers **before** `setup()`. See [Mobile redirect](#mobile-redirect).

### 3. Set up and begin checkout

```javascript
await cashApp.setup();
await cashApp.beginCheckout({ amount: 1234, currency: 'USD', referenceId: 'order-789' }); // $12.34
```

`amount` is an integer in **cents**. Only USD is supported. `beginCheckout()` creates the Cash
App customer request and renders the button.

If the cart total changes before the shopper interacts, call `beginCheckout()` again with the new
amount; the request is updated in place. Once the shopper has scanned the QR code or been
redirected, Pay Kit refuses changes and you get `cashAppError` / `UPDATE_REJECTED`. Call
`restart()` and then `beginCheckout()` to start over.

### 4. The shopper approves

- **Desktop:** clicking the button shows a QR code. The shopper scans it with their phone and
  approves in Cash App.
- **Mobile:** the shopper is sent to the Cash App app, approves, and returns to `redirectURL`.

The SDK then emits `cashAppApproved` (a summary: `cashtag`, `expiresAt`, `referenceId`) followed by
`cashAppTokenGenerated` with the Spreedly payment method.

### 5. Charge the token

Send `token` to your server and run a purchase with it, as for any Spreedly payment method. The
Cash App grant behind it is single-use and short-lived, so charge promptly.

> Pending Core: the gateway and request details will be documented here once the `cash_app`
> gateway is available. Today the token is a mock and can't be charged.

## Mobile redirect

On mobile the shopper leaves your page. When they come back to `redirectURL`, create the instance
again with the same config, register handlers, and call `setup()`. Pay Kit reports the approval
almost immediately, and `cashAppApproved` / `cashAppTokenGenerated` fire without another
`beginCheckout()`:

```javascript
// on the redirectURL page
const cashApp = new SpreedlyCashAppPay(sameConfig);
cashApp.on('cashAppTokenGenerated', ({ token }) => chargeOnServer(token));
await cashApp.setup();
```

Pointing `redirectURL` at the checkout page itself works well: the same code handles both cases.
`redirectURL` must be `https` (http is allowed only on `localhost` for development).

## Single-page apps

Call `restart()` when the shopper navigates away from checkout, and `destroy()` when you no
longer need the instance. Pay Kit allows a new customer request only after `restart()`.

## Content Security Policy

| Directive | Sandbox | Production |
|-----------|---------|------------|
| `script-src` | `https://sandbox.kit.cash.app` | `https://kit.cash.app` |
| `connect-src` | `https://sandbox.kit.cash.app` | `https://kit.cash.app` |
| `frame-src` | `https://sandbox.kit.cash.app` | `https://kit.cash.app` |

These are the hosts in the RFC. Confirm them in your browser's network panel during sandbox
testing, since Pay Kit may call other Block hosts.

## Errors

`cashAppError` carries `{ code, message, details? }`. Methods also return `{ error?: string }`.

| Code | Meaning |
|------|---------|
| `SDK_LOAD_FAILED` | `window.CashApp` didn't appear within 10 s. Check the Pay Kit script tag. |
| `INITIALIZATION_FAILED` | `CashApp.pay({ clientId })` rejected, e.g. an unknown Client ID. |
| `NOT_INITIALIZED` | `beginCheckout()` before a successful `setup()`. |
| `INVALID_CHECKOUT_OPTIONS` | `amount` isn't a positive integer, `currency` isn't USD, or `referenceId` is invalid. |
| `CUSTOMER_REQUEST_FAILED` | Pay Kit rejected the customer request, or reported the request failed. |
| `RENDER_FAILED` | Pay Kit couldn't render into `renderTarget`. |
| `UPDATE_REJECTED` | The amount can't change any more. Call `restart()`. |
| `TOKENIZATION_FAILED` | The approval couldn't be turned into a Spreedly payment method. |

Configuration mistakes (missing `clientId`, bad `redirectURL`, invalid auth details) throw from
the constructor.

See [API_REFERENCE.md](./API_REFERENCE.md) for the full surface.
