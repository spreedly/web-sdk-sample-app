# Paze — Integration Guide

This sample app shows how to add **Paze** (Early Warning digital wallet) using `SpreedlyPaze` from
the Spreedly checkout SDK. A shopper can be recognized by email, pick a card in Paze's popup, and
the demo creates a Spreedly `third_party_network_token` payment method from the `securedPayload`.

Card data never touch the page — they stay inside Paze's hosted UI. Spreedly only orchestrates
`window.DIGITAL_WALLET_SDK`.

The SDK API (methods, events, error codes) is documented in [API_REFERENCE.md](./API_REFERENCE.md).
The checkout-web-sdk copies of these docs live at `checkout-web-sdk/docs/paze/`.

## Who this guide is for

Merchants/integrators wiring Paze into a web checkout, using this repo as the reference
implementation. It assumes you can use Spreedly for payment methods and have a gateway that
supports `third_party_network_token` transactions.

## What you'll need

- **Paze merchant onboarding** — Client ID, Client Name, and Profile ID (the demo ships sandbox
  values in `src/static/paze/paze.js` and `.env`).
- **`PAZE_CERTIFICATE_TOKEN`** in the sample app environment — Spreedly certificate used when
  creating the payment method on the server.
- A **gateway with network tokenization** if you charge the token outside this demo (the demo UI
  stops at payment method creation).

## How the pieces fit

| Piece | Role |
|-------|------|
| **Paze `digitalwallet-sdk.js`** | Loaded at the end of `src/static/paze/index.html` |
| **`<paze-button>`** | Paze branded button, **created by the SDK** in `mount()`. The page only supplies an empty `#paze-button-container` |
| **`SpreedlyPaze`** | Orchestrator in `src/static/paze/paze.js` |
| **Sample app server** | `POST /api/v1/paze-payment-method`, and `GET /api/v1/auth/params` for the environment key |

The demo does not build a `<paze-button>` or call `checkout()` to start a flow — the SDK owns
both so it can count how often the Paze option was presented (`paze.button_rendered`).

---

## Quick start (run the demo)

1. Configure `.env` with Spreedly credentials and `PAZE_CERTIFICATE_TOKEN` (optional:
   `PAZE_CLIENT_ID`, `PAZE_CLIENT_NAME`, `PAZE_PROFILE_ID` — the page currently uses the client
   config hardcoded in `paze.js` for the Paze `initialize` call).
2. `npm run build && npm run start`, open the app, choose **Paze Digital Wallet**.
3. Confirm the Paze sandbox script is in the page (end of `index.html`).
4. Use a Paze-enrolled sandbox email (the demo prefills `integrations@spreedly.com`).

### Scripts on the demo page

```html
<script src="https://checkout.wallet.cat.earlywarning.io/web/resources/js/digitalwallet-sdk.js"></script>
<script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
<script src="../shared/utils.js"></script>
<script src="./paze.js"></script>
```

`SpreedlyUtils.loadSDKScript()` then loads the Spreedly Hosted Fields / Express Checkout bundle
from the sample app's configured CDN. `window.SpreedlyPaze` must exist after that load.

### Demo flow in `paze.js`

```
GET /api/v1/auth/params                      // environmentKey, for telemetry only
new SpreedlyPaze({ clientConfig, paymentElements: { paze: 'paze-button-container' },
                   displayMode, buttonStyle, environmentKey, getCheckoutOptions })
  → on(pazeReady / pazeButtonClicked / pazeCheckoutComplete / pazeTokenGenerated / pazeError)
  → setup()
  → mount()              // SDK creates <paze-button> in the empty container
  → canCheckout(email)   // on blur; in dynamic mode this is what reveals the button
  → [shopper clicks the SDK's button] → pazeButtonClicked → SDK reads getCheckoutOptions() → Paze popup
  → [Review & Pay] Complete button  or  [Express Pay] auto complete()
  → POST /api/v1/paze-payment-method
```

`getCheckoutOptions()` returns the current email, the fixed `TRANSACTION_VALUE`, and the selected
`intent`. It is synchronous by requirement — the SDK calls it inside the click handler, and an
await there would cost the click's user activation and get Paze's popup blocked. The demo resets
its review/result panels from `pazeButtonClicked`, not from a DOM click on `#paze-button-container`.

Emails are trimmed and lowercased before `canCheckout` / checkout (Paze expects RFC 5322
lowercase).

---

## Demo controls

| Control | Behavior |
|---------|----------|
| **Button Display — Static** | `displayMode: 'static'`; `mount()` shows the button straight away |
| **Button Display — Dynamic** | `displayMode: 'dynamic'`; the button stays hidden until `canCheckout` returns `consumerPresent` |
| **Checkout Intent — Review & Pay** | After the popup, show the review panel and **Complete Payment** |
| **Checkout Intent — Express Pay** | `getCheckoutOptions` returns `intent: 'EXPRESS_CHECKOUT'`; on `pazeCheckoutComplete` auto-calls `complete()` |
| **Retain payment method** | Sends `retained: true` and `provisionNetworkToken: true` on create |
| **Color / Shape / Disable max height** | Feeds `buttonStyle`. Read once at `mount()`, so changing one destroys the instance and remounts (`rebuildPazeInstance()`) |
| **Change Card** | `checkout({ actionCode: 'CHANGE_CARD', transactionValue })` |
| **Change Shipping Address** | `checkout({ actionCode: 'CHANGE_SHIPPING_ADDRESS', transactionValue })` |
| **Reset** | Reloads the page (`destroy()` also runs on `beforeunload`) |

Transaction amount in the demo is fixed at `10.00 USD`.

---

## Process payment (sample app backend)

The demo **creates a payment method only**. It does not call Spreedly purchase.

### `POST /api/v1/paze-payment-method`

Implemented in `src/controllers/payments.ts` (`createPazePaymentMethod`). Proxies to Spreedly
`POST /v1/payment_methods.json` with Basic auth.

Browser helper: `SpreedlyUtils.createPazePaymentMethod` in `src/static/shared/utils.js`.

**Request body**

| Field | Required | Description |
|-------|----------|-------------|
| `securedPayload` | Yes | From `pazeTokenGenerated` |
| `sessionId` | No | From `pazeTokenGenerated` |
| `payloadId` | No | From `pazeTokenGenerated` |
| `shippingAddress` | No | Snake_case shipping fields mapped from `pazeCheckoutComplete.shippingAddress` |
| `retained` | No | When true, sets `payment_method.retained` |
| `provisionNetworkToken` | No | When true, sets `payment_method.provision_network_token` |

Shipping is included only when checkout returned `shippingAddress.line1`. Mapping:

| Paze field | Spreedly field |
|------------|----------------|
| `line1` | `shipping_address1` |
| `city` | `shipping_city` |
| `countryCode` | `shipping_country` |
| `state` | `shipping_state` |
| `zip` | `shipping_zip` |

**Spreedly body the server sends**

```json
{
  "payment_method": {
    "third_party_network_token": {
      "certificate_token": "<PAZE_CERTIFICATE_TOKEN>",
      "secured_payload": "...",
      "session_id": "...",
      "payload_id": "...",
      "source": "paze",
      "shipping_address1": "..."
    },
    "retained": true,
    "provision_network_token": true
  }
}
```

`certificate_token` comes from env, not from the browser.

**Response (200)**

```json
{
  "success": true,
  "payment_method_token": "...",
  "payment_method": {},
  "transaction": {}
}
```

Missing `securedPayload` returns **400**. Spreedly errors are forwarded with their status.

To **purchase** after create, call Spreedly from your own server:

```
POST /v1/gateways/{gateway_token}/purchase.json
{ "transaction": { "payment_method_token": "...", "amount": 1000, "currency_code": "USD" } }
```

Pass-through purchase (token on the transaction, no prior PM) is documented in the SDK
integration guide; this sample app does not expose that route.

### Retaining / returning users

Retain: check **Retain payment method** in the demo (Advanced Vault + TRID required on the
Spreedly side). Returning charges with a stored token should send `attempt_network_token: true`
on purchase.

---

## Content Security Policy

`src/middlewares/cspMiddleware.ts` allows sandbox and production Paze hosts on `script-src`,
`connect-src`, and `frame-src`:

- `https://checkout.wallet.cat.earlywarning.io`
- `https://checkout.paze.com`

---

## Guide contents

- **[API_REFERENCE.md](./API_REFERENCE.md)** — `SpreedlyPaze` methods/events plus this app's HTTP API.
- Canonical demo: `src/static/paze/{index.html,paze.js}`.
