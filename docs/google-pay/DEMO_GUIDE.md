# Google Pay — Demo Guide

The `/google-pay` flow demos `SpreedlyGooglePay`, which both SDK bundles expose, and the
`googlePay` option that draws it above the Express Checkout form. This guide covers the demo page
only. For the SDK itself, see the [Integration Guide](./INTEGRATION_GUIDE.md) and
[API Reference](./API_REFERENCE.md) (mirrored from the SDK repo's
[`docs/google-pay/`](https://github.com/spreedly/checkout-web-sdk/tree/main/docs/google-pay),
which also holds the architecture notes).

## What the page does

1. Loads Google's `pay.js` (`<script async>`) — the merchant's job — plus the SDK bundle chosen on
   the landing page (`?sdk=hosted-fields` or `?sdk=express-checkout`).
2. Fetches signed auth params from `GET /api/v1/auth/params`.
3. `new SpreedlyGooglePay({ environment: 'TEST', authDetails, merchantInfo, transactionInfo, … })`
   and `mount('google-pay-button-container')`. Google's own button is drawn only if
   `isReadyToPay` succeeds; otherwise the fallback note shows the `googlePayUnavailable` reason.
4. On tap, the SDK opens the sheet and tokenizes inside `onPaymentAuthorized`
   (`POST core.spreedly.com/v1/payment_methods.json`), then emits `googlePayTokenGenerated`.
5. The result card shows the token, `googlePayType` and the matching 3DS guidance.
6. **Purchase** branches on `googlePayType`, following Spreedly's "tokenize first, then branch on
   `google_pay_type`" option. It uses only existing backend routes:

   | `googlePayType` | Route |
   |---|---|
   | `TOKENIZED_CARD` | `POST /api/v1/simple-purchase`. The device cryptogram already carries authentication, so no 3DS. |
   | `NON_TOKENIZED_CARD`, or missing | A 3DS purchase with `serializeBrowserInfo()`. If the transaction comes back `pending`, the page runs `SpreedlyThreeDSLifecycle` (device fingerprint and/or the challenge modal), exactly as the 3DS demo pages do. |

   The **Purchase (3DS)** controls choose the 3DS route:
   - **3DS Global** (default): `POST /create-purchase-with-3ds` with the test SCA provider and a
     scenario (`challenge` / `authenticated` / `not_authenticated`). On the Spreedly test gateway,
     a Google Pay payment method goes `pending` with a 3DS authentication, as a card does.
   - **Gateway 3DS**: `POST /create-purchase-with-3ds-gateway-specific` with
     `attempt_3dsecure: true`, and `onTriggerCompletion` → `POST /transactions/:t/complete`. On the
     Spreedly test gateway, Spreedly refuses it for Google Pay payment methods with the warning
     "attempt_3dsecure is not supported for this payment method type. 3DS is only available for
     credit cards."
   - **No 3DS**: always `simple-purchase`.
   - **Run 3DS for every card** also sends `TOKENIZED_CARD` through 3DS. Spreedly documents that it
     then bypasses 3DS with the warning "Bypassing Spreedly 3DS authentication for GooglePay
     payment methods that are CRYPTOGRAM_3DS". The page logs any `transaction.warning` it gets back.
7. **New checkout** fetches fresh auth params and remounts (certificate auth is per checkout).

**Placement** (Express Checkout bundle only)
- **Inside the Express Checkout form** (default): `new SpreedlyExpressCheckout(authDetails)` and
  `expressCheckout({ parentContainerId, googlePay })` with the same config minus `authDetails`. The
  SDK draws Google's button and an "or pay with card" divider above the card-form iframe, only once
  `isReadyToPay` passes; otherwise the row never appears and the fallback note shows the reason.
  The page listens for the same `googlePay*` events on the Express Checkout instance.
  - **Form display**: both options mount the form in embedded mode (`parentContainerId`).
    - *Embedded* mounts it into the page right away.
    - *Merchant dialog* adds an **Open payment form** button that opens the page's own dialog and
      mounts the form there, so the wallet row and the card fields share one card. The SDK's dialog
      mode isn't used: it would put the row above the form's title and close button. The page
      closes its dialog (and the form, which destroys the Google Pay button) after a token, or on
      its close button, a backdrop click or Escape.
  - A card entered in the form arrives on `tokenGenerated`; the result card and **Purchase** use
    the same routes, with a card always going through the chosen 3DS route.
  - The order total also calls `setGooglePayTransactionInfo()` and updates the submit button text.
  - `?placement=standalone` opens the page on the standalone button instead.
  - If the loaded Express Checkout build has no `googlePay` option yet, the status line says so.
- **Standalone button**: steps 3–4 above, the button in its own container. The only placement on
  the Hosted Fields bundle.

**Layout**: controls and the event log on the left; the demo, result card and the config the page
passes to the SDK on the right. The config panel shows the `new SpreedlyGooglePay(…)` +
`mount()` call or the `expressCheckout({ googlePay })` call, updates on every remount and total
change, and has a copy button. `authDetails` are shown as a placeholder and callbacks by name.

**Controls**
- The order total calls `setTransactionInfo()` without a remount.
- Every other control rebuilds the instance (or the Express Checkout form):
  - auth methods and networks
  - billing, shipping and email
  - retain (the page retains the new payment method from the server, through
    `PUT /api/v1/payment_methods/:token/retain`, after `googlePayTokenGenerated` or `tokenGenerated`)
  - the card filters (refuse prepaid / credit, `assuranceDetailsRequired`)
  - `checkoutOption`
  - button style
  - `testCardNumber`

**Demos driven by `onPaymentDataChange`**
- **Shipping:** two synthetic options (Standard free / Express $10.00), US addresses only.
- **Promo codes** (the `OFFER` intent): the synthetic code `SAVE10` takes 10% off. Any other code
  returns `OFFER_INVALID`.

## Running it locally

The rc CDN bundles contain `SpreedlyGooglePay` only once the SDK change merges to `main` and
deploys. Until then, run the SDK locally:

1. In `checkout-web-sdk`: `npm run dev` (Hosted Fields on `:5000`, Express Checkout on `:5173`).
2. In this repo, temporarily uncomment the local-SDK block in `src/static/shared/utils.js`
   (`getSDKScriptUrl`) — do not commit it.
3. `npm run dev`, then open `http://localhost:3000/google-pay/index.html?sdk=hosted-fields` (or
   `?sdk=express-checkout`).

Google Pay needs a secure context: `localhost` or HTTPS (Heroku). A LAN IP over plain HTTP will not
work.

## Testing

- **Manual (real sheet):** Google `TEST` environment, signed in with a Google account enrolled in
  Google's test card suite group. The tokenize call then goes to Spreedly for real.
- **Automated:** `test/ui/testCases/google-pay.spec.ts` blocks `pay.js`, installs a **synthetic**
  `window.google.payments.api` stub, and fulfils the Spreedly call via `page.route`. It covers the
  landing card, the button + in-sheet tokenization on both bundles (request shape, `from` tag and
  result card), the button inside the Express Checkout form (row above the iframe, embedded and in
  the merchant dialog, `web/form` tokenization, and no row when Google Pay isn't ready), a Spreedly
  422 (in-sheet error, `TOKENIZATION_FAILED`) and the not-ready fallback. The purchase specs fulfil
  the purchase routes with synthetic transactions and check which route runs and what it sends:
  `NON_TOKENIZED_CARD` → gateway 3DS with browser info, `TOKENIZED_CARD` → `simple-purchase`,
  3DS Global → the test SCA provider and scenario. The real 3DS challenge (a `pending` transaction)
  needs Spreedly and stays a manual check. Specs skip themselves when the loaded SDK build has no
  `SpreedlyGooglePay`.
- **Manual 3DS on the Spreedly test gateway:**
  - 3DS Global's test SCA provider picks the outcome by scenario, whatever the card. Use it to see
    the challenge.
  - Gateway 3DS is refused for Google Pay (see above). The `test_card_number` override does reach
    the test gateway (the payment method stores the override card), but Spreedly drops the 3DS
    fields: with `4556761029983886` at `30.05` the purchase fails with "browser_info is required for
    3D Secure 2 based transactions".

  ```bash
  npm run test:e2e:local -- test/ui/testCases/google-pay.spec.ts
  ```
