# Google Pay — Demo Guide

The `/google-pay` flow demos `SpreedlyGooglePay`, which both SDK bundles expose. The SDK repo's
[`docs/google-pay/`](https://github.com/spreedly/checkout-web-sdk/tree/main/docs/google-pay) is
canonical — integration guide, API reference and architecture live there.

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
   - **Gateway 3DS** (default): `POST /create-purchase-with-3ds-gateway-specific` with
     `attempt_3dsecure: true`, and `onTriggerCompletion` → `POST /transactions/:t/complete`. This is
     the route Spreedly's Google Pay docs describe.
   - **3DS Global**: `POST /create-purchase-with-3ds` with the test SCA provider and a scenario
     (`challenge` / `authenticated` / `not_authenticated`). Spreedly's Google Pay docs don't
     mention `sca_provider_key`, so treat this as an experiment.
   - **No 3DS**: always `simple-purchase`.
   - **Run 3DS for every card** also sends `TOKENIZED_CARD` through 3DS. Spreedly documents that it
     then bypasses 3DS with the warning "Bypassing Spreedly 3DS authentication for GooglePay
     payment methods that are CRYPTOGRAM_3DS". The page logs any `transaction.warning` it gets back.
7. **New checkout** fetches fresh auth params and remounts (certificate auth is per checkout).

**Controls**
- The order total calls `setTransactionInfo()` without a remount, for one-time payments only.
- Every other control rebuilds the instance:
  - auth methods and networks
  - billing, shipping and email
  - retain
  - the card filters (refuse prepaid / credit, `assuranceDetailsRequired`)
  - `checkoutOption`
  - the transaction type: one-time, or a synthetic subscription with a 7-day trial / deferred charge / auto-reload enrollment
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
  result card), a Spreedly
  422 (in-sheet error, `TOKENIZATION_FAILED`) and the not-ready fallback. The purchase specs fulfil
  the purchase routes with synthetic transactions and check which route runs and what it sends:
  `NON_TOKENIZED_CARD` → gateway 3DS with browser info, `TOKENIZED_CARD` → `simple-purchase`,
  3DS Global → the test SCA provider and scenario. The real 3DS challenge (a `pending` transaction)
  needs Spreedly and stays a manual check. Specs skip themselves when the loaded SDK build has no
  `SpreedlyGooglePay`.
- **Manual 3DS on the Spreedly test gateway:**
  - Gateway 3DS uses card `4556761029983886` and magic amounts: `30.01` frictionless, `30.05`
    challenge (the 3DS demo's `3001` / `3005` cents). Put the card in the `test_card_number` override.
    Spreedly's docs don't say whether the override also drives the 3DS test behaviour.
  - 3DS Global's test SCA provider picks the outcome by scenario, whatever the card.

  ```bash
  npm run test:e2e:local -- test/ui/testCases/google-pay.spec.ts
  ```
