# Click to Pay — Integration Guide

Add **Mastercard Click to Pay** (Secure Remote Commerce) to your checkout using the Spreedly
checkout SDK. A shopper can be recognized by email/mobile, pick a saved card (or enter a new one),
complete Mastercard's verification, and you get back a **Spreedly payment-method token** you charge
like any other card.

The raw card number and CVV never touch your page — they stay inside Spreedly's hosted-field iframes
and Mastercard's encrypted card, so this keeps your PCI scope minimal.

## Who this guide is for

Merchants/integrators wiring Click to Pay into a web checkout. It assumes you already use (or can
use) Spreedly for payment tokenization and have a gateway configured to run transactions.

## What you'll need

- A **Spreedly environment with Click to Pay enabled** (talk to Spreedly to enable it).
- A **Mastercard DPA ID** (`srcDpaId`) for your environment.
- A **server endpoint** that returns Spreedly signed auth params (see step 2) — the SDK never holds
  your secret API credentials.
- A **gateway** in Spreedly to actually charge the resulting token (see
  [tokenization.md](./tokenization.md)).

## How the pieces fit

| Piece | Role |
|-------|------|
| **Mastercard `lib.js`** | Mastercard's SRC client — the SDK drives it for you |
| **Mastercard SRC UI kit** | Embedded web components (`<src-card-list>`, `<src-otp-input>`) the SDK drives for the saved-card list and OTP |
| **`SpreedlyHostedFields`** | The card-number + CVV iframes (PCI-safe entry, in-frame encryption) |
| **`SpreedlyClickToPay`** | The orchestrator you call: `init`, `lookup`, `checkout`, events |
| **Your server** | Returns signed auth params, and later runs the purchase with the token |

You interact almost entirely with `SpreedlyClickToPay` + a few `SpreedlyHostedFields` calls; the SDK
handles Mastercard.

---

## Quick start

### 1. Load the scripts

In your checkout page `<head>` — Mastercard's UI kit + Click to Pay library, then the Spreedly SDK:

```html
<!-- Mastercard SRC UI kit (the card-list / OTP web components) -->
<script type="module"
  src="https://sandbox.src.mastercard.com/srci/integration/components/src-ui-kit/src-ui-kit.esm.js"></script>
<link rel="stylesheet"
  href="https://sandbox.src.mastercard.com/srci/integration/components/src-ui-kit/src-ui-kit.css" />

<!-- Mastercard Click to Pay library. The SDK reads srcDpaId + locale off this tag. -->
<script
  src="https://sandbox.src.mastercard.com/srci/integration/2/lib.js?srcDpaId=YOUR_DPA_ID&locale=en_US"></script>

<!-- Spreedly checkout SDK (rc = release-candidate channel; use the channel Spreedly gives you) -->
<script src="https://core-test.spreedly.com/checkout/sdk/rc/index.js"></script>
```

> Use the `sandbox.src.mastercard.com` host for testing and Mastercard's production host for live.
> The `srcDpaId` and `locale` on the `lib.js` tag are how the SDK discovers them — don't pass them
> again in config.

### 2. Get signed auth params from your server

Tokenization requires short-lived signed credentials. Your backend produces them with your Spreedly
secret; the browser only ever receives the signed result:

```js
const auth = await fetch('/your-server/spreedly-auth').then((r) => r.json());
const authDetails = {
  environment_key: auth.environmentKey,
  certificate_token: auth.certificateToken,
  nonce: auth.nonce,
  signature: auth.signature,
  timestamp: auth.timestamp,
};
```

### 3. Add containers for the secure card fields

```html
<div id="card-number-field"></div>  <!-- can live in a hidden section for saved-card-only UIs -->
<div id="cvv-field"></div>
```

The SDK mounts its two secure iframes (card number + CVV) into these. **Both are always
required** — the number iframe is the tokenization engine and holds the CVV — even if your UI
only ever shows saved cards. In that case simply keep the number container visually hidden
(CSS); only the CVV field needs to be visible next to the card list.

### 4. Create the orchestrator and initialize (single entry point)

```js
const c2p = new window.SpreedlyClickToPay(authDetails, {
  fields: {
    number: { containerId: 'card-number-field' },
    cvv: { containerId: 'cvv-field' },
  },
  c2pConfig: {
    dpaData: { dpaPresentationName: 'Your Store', dpaName: 'YourStoreLegalName' },
    dpaTransactionOptions: {
      dpaLocale: 'en_US',
      transactionAmount: { transactionAmount: 42.0, transactionCurrencyCode: 'USD' }, // dollars, not cents
    },
    cardBrands: ['mastercard', 'visa', 'amex', 'discover'],
  },
  cardsEl: 'c2p-card-list', // your <src-card-list id="c2p-card-list">
  otpEl: 'c2p-otp-input',   // your <src-otp-input id="c2p-otp-input">
  doLookup: false,          // we trigger lookup ourselves from a "Continue" button
});

await c2p.init(); // mounts the card fields, then initializes Click to Pay
```

With `fields` set, the SDK creates and manages its own hosted card fields and **tokenizes inside
the secure number iframe automatically** — no extra wiring. The instance is exposed as
`c2p.hostedFields` (full API: styling, `on('fieldStateChange')`, `encryptCardForClickToPay`).
See [configuration.md](./configuration.md) for every option.

### 5. Handle the flow with events, then look up the shopper

```js
c2p.on('c2p-verified-user', () => {/* recognized device → cards render next */});
c2p.on('display-cards-ready', () => {/* <src-card-list> is populated; show your "Pay" button */});
c2p.on('c2p-existing-user', () => {/* known shopper, new device → OTP follows */});
c2p.on('otp-initiated', () => {/* reveal your <src-otp-input>; the SDK drives it */});
c2p.on('c2p-new-user', () => {/* no profile → show your new-card form */});
c2p.on('tokenGenerated', (p) => {/* p.tokenResponse.token → send to your server */});
c2p.on('error', (e) => {/* surface e */});

// Kick off lookup when the shopper enters their email/mobile and clicks Continue:
c2p.lookup({ email: 'shopper@example.com' }); // or { phone: { number, countryCode } }
```

### 6. Check out → get a token

- **Saved card:** after `setSelectedCard(id)` (wired from the card list), collect the CVC, then:
  ```js
  await c2p.checkout({
    withSelectedCard: true,
    cardholder: { firstName, lastName },
  });
  // Tokenization runs inside the secure number iframe automatically; the CVC the
  // shopper typed is injected there (never on your page).
  ```
- **New card:** encrypt in-iframe, then check out:
  ```js
  // encryptCardForClickToPay takes snake_case fields (+ expiry + accepted brands)
  const { encryptedCard, cardBrand } = await c2p.hostedFields.encryptCardForClickToPay({
    first_name: firstName,
    last_name: lastName,
    month, // 'MM'
    year,  // 'YYYY'
    available_card_brands: ['mastercard', 'visa', 'amex', 'discover'],
  });
  await c2p.checkout({
    encryptedCard, cardBrand,
    cardholder: { firstName, lastName }, // checkout's cardholder is camelCase
  });
  ```

Both resolve into a `tokenGenerated` event with your Spreedly payment-method token.

### 7. Charge the token (your server)

The SDK stops at tokenization. Your backend runs the purchase against your gateway:

```
POST https://core.spreedly.com/v1/gateways/{gateway_token}/purchase.json
{ "transaction": { "payment_method_token": "...", "amount": 4200, "currency_code": "USD" } }
```

Full detail in [tokenization.md](./tokenization.md).

---

## The three shopper scenarios (at a glance)

| Scenario | What happens |
|----------|--------------|
| **New user** | `lookup` finds no profile → your new-card form → encrypt → checkout → token |
| **Returning, this browser not recognized** | `lookup` finds the profile → OTP (`<src-otp-input>`) → saved cards → checkout |
| **Returning, recognized** | `lookup` returns cards immediately (no OTP) → checkout |

Full sequence for each in [flows.md](./flows.md).

## Guide contents

- **[configuration.md](./configuration.md)** — every `SpreedlyClickToPay` option.
- **[flows.md](./flows.md)** — the three scenarios, step by step.
- **[api-reference.md](./api-reference.md)** — methods, events, and hosted-field helpers.
- **[components.md](./components.md)** — the Mastercard UI components + presentation (popup vs drawer, consent).
- **[tokenization.md](./tokenization.md)** — the token body, CVV handling, and running the purchase.
- **[migrating-from-legacy.md](./migrating-from-legacy.md)** — field-by-field guide from the legacy
  `Spreedly.c2pInit` integration (config mapping, event/payload deltas, error-handling rewrite).
