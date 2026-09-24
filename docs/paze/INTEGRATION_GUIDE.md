# Paze — Integration Guide

Add **Paze** (Early Warning digital wallet) to your checkout using the Spreedly checkout SDK. A
shopper can be recognized by email, pick a card in Paze's popup, and you get back a
**`securedPayload`**. Your server turns that into a Spreedly `third_party_network_token` payment
method you charge like any other Spreedly token.

Card data never touch your page — they stay inside Paze's hosted UI. Spreedly only orchestrates
the Paze SDK (`window.DIGITAL_WALLET_SDK`) and returns the encrypted payload.

## Who this guide is for

Merchants/integrators wiring Paze into a web checkout. It assumes you already use (or can use)
Spreedly for payment methods and have a gateway that supports `third_party_network_token`
transactions.

## What you'll need

- **Paze merchant onboarding** — Client ID, Client Name, and Profile ID from Paze.
- A **Spreedly certificate** (`certificate_token`) for Paze / third-party network tokens — used on
  your server when creating the payment method, not by `SpreedlyPaze` in the browser.
- A **gateway with network tokenization** enabled.
- A **server endpoint** that creates the Spreedly payment method from `securedPayload` (see
  [Process payment from your backend](#process-payment-from-your-backend)).

## How the pieces fit

| Piece | Role |
|-------|------|
| **Paze `digitalwallet-sdk.js`** | Paze's client — you load it; the SDK drives `initialize` / `canCheckout` / `checkout` / `complete` |
| **`<paze-button>`** | Paze's branded button. **Spreedly creates and owns it** — you provide an empty container and call `mount()` |
| **`SpreedlyPaze`** | The orchestrator you call: `setup`, `mount`, `complete`, events |
| **Your server** | Creates the payment method and later runs the purchase |

You interact almost entirely with `SpreedlyPaze`; the SDK handles Paze. Payment method creation
is **your backend**, not a browser tokenization call.

> **Custom CTAs are not supported.** The Paze flow must start from the button `mount()` creates,
> so Spreedly can report how often the Paze option was presented to shoppers (Paze TPV Exposure).
> Creating your own `<paze-button>` and calling `checkout()` to start a flow is rejected with
> `pazeError` / `UNSUPPORTED_ACTION`.

---

## Quick start

### 1. Load the scripts

Put the **Paze** script at the **end of `<body>`** (with `defer` recommended) **before** calling
`SpreedlyPaze.setup()`. The Paze SDK appends UI elements to `document.body` on load — do not place
it in `<head>` before the body exists. Then load a Spreedly bundle that exposes `SpreedlyPaze`
(Hosted Fields or Express Checkout — both export the same global):

```html
<!-- Sandbox — place before closing </body> -->
<script defer src="https://checkout.wallet.cat.earlywarning.io/web/resources/js/digitalwallet-sdk.js"></script>

<!-- Production -->
<!-- <script defer src="https://checkout.paze.com/web/resources/js/digitalwallet-sdk.js"></script> -->

<script src="https://core-test.spreedly.com/checkout/sdk/{version}/index.js"></script>
<!-- or Express Checkout: /checkout/elements/{version}/express-checkout.js -->
```
Replace the version with your SDK version. Paze is available as an offering above versions 1.5.1.

> Use the Early Warning sandbox host for testing and `checkout.paze.com` for live. Spreedly does
> **not** inject the Paze script.

### 2. Add a container for the button

Give the SDK an empty element to mount into. Do **not** put a `<paze-button>` inside it — the SDK
creates that element itself.

```html
<div id="paze-button-container"></div>
```

### 3. Create the orchestrator and set up Paze

```js
const paze = new window.SpreedlyPaze({
  clientConfig: {
    id: 'YOUR_PAZE_CLIENT_ID',
    name: 'YOUR_MERCHANT_NAME',
    profileId: 'YOUR_PAZE_PROFILE_ID',
  },
  environment: 'sandbox', // or 'production'
  environmentKey: 'YOUR_SPREEDLY_ENVIRONMENT_KEY',
  paymentElements: { paze: 'paze-button-container' },
  displayMode: 'static', // or 'dynamic' — see step 5
  buttonStyle: { color: 'pazeblue', shape: 'default' },
  // Read on every click, so a changing cart total or email is always current.
  // Must be synchronous — see below.
  getCheckoutOptions: () => ({
    emailAddress: emailInput.value.trim().toLowerCase(),
    transactionValue: {
      transactionAmount: '10.00',
      transactionCurrencyCode: 'USD',
    },
  }),
});

paze.on('pazeReady', () => {
  // Safe to call mount / canCheckout
});
paze.on('pazeButtonClicked', () => {
  // Shopper pressed the SDK-owned button; checkout has started
});
paze.on('pazeCheckoutComplete', (data) => {
  // data.maskedCard, data.consumer, data.shippingAddress — show a review step, or call complete()
});
paze.on('pazeTokenGenerated', (data) => {
  // Send data.securedPayload, data.sessionId, data.payloadId to your backend
});
paze.on('pazeError', (error) => {
  console.error(`[${error.code}] ${error.message}`);
});

const result = await paze.setup();
if (result.error) {
  console.error(result.error); // typically: Paze script not on the page
}
```

Register listeners **before** `setup()` so you do not miss `pazeReady`.

> `getCheckoutOptions` must return synchronously. Awaiting inside a click handler spends the
> browser's user-activation token and Paze's popup gets blocked — read values you already have
> rather than fetching. `environmentKey` is only used to tag telemetry, and it is masked before
> it is sent.

### 4. Mount the button

```js
const { error } = await paze.mount();
if (error) {
  console.error(error); // container missing, or the Paze script never registered <paze-button>
}
```

`mount()` creates the branded `<paze-button>` in your container, applies `buttonStyle`, and wires
the click to the Paze checkout. Shoppers start the flow by pressing it; you do not call
`checkout()` yourself.

### 5. Show the button only to enrolled shoppers (optional)

With `displayMode: 'dynamic'`, `mount()` inserts the button hidden and `canCheckout()` reveals it.
**Call `mount()` before `canCheckout()`** — the SDK does not cache eligibility results, so a
`canCheckout()` that resolves before `mount()` has run has nothing to reveal, and the button stays
hidden until you call `canCheckout()` again. Emails should be **lowercase** (RFC 5322).

```js
// displayMode: 'dynamic'
await paze.canCheckout('customer@example.com'); // shows the button when a wallet is found
```

The returned `{ consumerPresent }` is still yours to use — with `displayMode: 'static'` the button
stays visible either way and you can drive your own messaging from it.

Every `canCheckout()` resolution also emits `pazeEligibilityChecked` with `{ eligible }`,
regardless of display mode. In `dynamic` mode this is the SDK's own button visibility changing —
the SDK only ever toggles `display` on the `<paze-button>` element it created, so if your page
wraps that container in its own box (margin, border, a "pay with" heading), an ineligible
shopper is left looking at an empty box. Listen for the event and collapse your own wrapper
instead:

```js
paze.on('pazeEligibilityChecked', ({ eligible }) => {
  document.getElementById('paze-button-container').classList.toggle('hidden', !eligible);
});
```

### 6. Complete the flow

The button click produces `pazeCheckoutComplete`. Then ask Paze for the credentials:

**Review & Pay** (shopper confirms on your page after the popup):

```js
paze.on('pazeCheckoutComplete', async (data) => {
  // show data.maskedCard / data.shippingAddress, then on confirm:
  await paze.complete({
    transactionType: 'PURCHASE',
    transactionValue: {
      transactionAmount: '10.00',
      transactionCurrencyCode: 'USD',
    },
  });
});
```

**Express Pay** — return `intent: 'EXPRESS_CHECKOUT'` from `getCheckoutOptions` and Paze skips
extra review in the wallet; call `complete()` as soon as `pazeCheckoutComplete` arrives.

To change card or shipping **mid-flow** (same session), call `checkout()` with
`actionCode: 'CHANGE_CARD'` or `'CHANGE_SHIPPING_ADDRESS'` — omit `emailAddress`; the SDK reuses
the session the button started.

```js
await paze.checkout({
  actionCode: 'CHANGE_CARD',
  transactionValue: { transactionAmount: '10.00', transactionCurrencyCode: 'USD' },
});
```

Both checkout and complete resolve into events (`pazeCheckoutComplete` / `pazeTokenGenerated` or
`pazeError`) — see [API_REFERENCE.md](./API_REFERENCE.md).

### 7. Charge from your server

The SDK stops at `securedPayload`. Your backend creates the payment method, then purchases.

---

## Process payment from your backend

Spreedly recommends creating a payment method first, then purchasing with the returned token.

### Primary flow: Create payment method, then purchase

**Create payment method**

```
POST https://core.spreedly.com/v1/payment_methods.json
```

```json
{
  "payment_method": {
    "third_party_network_token": {
      "certificate_token": "YOUR_SPREEDLY_CERTIFICATE_TOKEN",
      "session_id": "SESSION_ID_FROM_SDK",
      "payload_id": "PAYLOAD_ID_FROM_SDK",
      "secured_payload": "SECURED_PAYLOAD_FROM_SDK",
      "source": "paze"
    }
  }
}
```

**Purchase with payment method token**

```
POST https://core.spreedly.com/v1/gateways/{gateway_token}/purchase.json
```

```json
{
  "transaction": {
    "amount": 1000,
    "currency_code": "USD",
    "payment_method_token": "PAYMENT_METHOD_TOKEN_FROM_CREATE"
  }
}
```

The sample app implements create via `POST /api/v1/paze-payment-method` (it does not purchase in
the demo UI).

### Alternative: Pass-through purchase (single API call)

You can include `third_party_network_token` directly on the purchase:

```json
{
  "transaction": {
    "amount": 1000,
    "currency_code": "USD",
    "third_party_network_token": {
      "certificate_token": "YOUR_SPREEDLY_CERTIFICATE_TOKEN",
      "session_id": "SESSION_ID_FROM_SDK",
      "payload_id": "PAYLOAD_ID_FROM_SDK",
      "secured_payload": "SECURED_PAYLOAD_FROM_SDK",
      "source": "paze"
    }
  }
}
```

### Retaining payment methods

When retaining, include `retained: true` and `provision_network_token: true` on payment method
creation, or `retain_on_success: true` and `provision_network_token: true` on purchase. Requires
Advanced Vault and a TRID configured with Spreedly.

### Returning users

For subsequent purchases with a stored Paze payment method token, include
`attempt_network_token: true`:

```json
{
  "transaction": {
    "amount": 1000,
    "currency_code": "USD",
    "payment_method_token": "STORED_PAYMENT_METHOD_TOKEN",
    "attempt_network_token": true
  }
}
```

---

## Content Security Policy (CSP)

Allow Paze's hosts in `script-src`, `connect-src`, and `frame-src`:

- **Sandbox:** `https://checkout.wallet.cat.earlywarning.io`
- **Production:** `https://checkout.paze.com`

```
script-src: https://checkout.wallet.cat.earlywarning.io https://checkout.paze.com
connect-src: https://checkout.wallet.cat.earlywarning.io https://checkout.paze.com
frame-src: https://checkout.wallet.cat.earlywarning.io https://checkout.paze.com
```

Also keep your existing Spreedly CSP (`https://*.spreedly.com` / `https://core.spreedly.com`).

---

## Guide contents

- **[API_REFERENCE.md](./API_REFERENCE.md)** — constructor, methods, events, options, and error codes.
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — how `SpreedlyPaze` is implemented in the SDK (internal).
- Sample app: `web-sdk-sample-app/src/static/paze/` and that repo's `docs/paze/`.
