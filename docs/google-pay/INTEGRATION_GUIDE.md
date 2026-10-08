# Google Pay — Integration Guide

Add a **Pay with Google Pay** button to your checkout using the Spreedly checkout SDK. The SDK
checks whether the shopper can pay, draws Google's own button, opens the payment sheet, and turns
Google's encrypted token into a **Spreedly payment method token** you charge from your server
like any other Spreedly token.

Card data never touch your page. Google seals the payment token for Spreedly
(`gateway: "spreedly"`), so only Spreedly can decrypt it — the SDK carries it to Spreedly Core
unopened. Once decrypted, the credential can be routed to any Google Pay-capable Spreedly gateway.

## Who this guide is for

Merchants/integrators wiring Google Pay into a web checkout. It assumes you already use (or can
use) Spreedly for payment methods and have a gateway that supports Google Pay.

## What you'll need

- A **Google Pay & Wallet Console** account (Terms of Service accepted with a business email on
  your own domain) and your **Google Merchant ID** — required only in `PRODUCTION`.
- Your **production domains registered** in the Wallet Console, and Google's
  [web integration checklist](https://developers.google.com/pay/api/web/guides/test-and-deploy/integration-checklist)
  completed before going live.
- For testing: your tester's Google account enrolled in Google's **test card suite** group.
- A **Spreedly environment** and a **server endpoint that signs auth params** (`nonce`,
  `timestamp`, `signature`, `certificate_token`, `environment_key`) — the same certificate-based
  auth the Hosted Fields card form uses.
- A **Spreedly gateway that supports Google Pay** (and, for recurring / stored credentials, one
  on Spreedly's Google Pay recurring list — see [Recurring transactions](#recurring-transactions)).

Unlike Apple Pay there is **no merchant validation call, no certificate for you to manage and no
domain association file** to host.

## How the pieces fit

| Piece | Role |
|-------|------|
| **Google `pay.js`** | Google's client. **You load it**; the SDK waits up to 10 s for it to define `window.google.payments.api` |
| **Google Pay button** | Drawn by Google's `createButton()`, so it follows Google's brand guidelines. **The SDK creates it** — you provide an empty container |
| **`SpreedlyGooglePay`** | The class you call: `on()`, `mount()`, `setTransactionInfo()`, `destroy()` |
| **Spreedly Core** | Decrypts the token and creates the payment method (the SDK calls it while the sheet is open) |
| **Your server** | Signs auth params, then runs the purchase/authorize with the returned token |

You interact almost entirely with `SpreedlyGooglePay`; the SDK handles Google. The payment method
is created **in the browser**, while the sheet is still open, so a Spreedly failure is shown to the
shopper inside the sheet and they can pick another card. Your server only runs the transaction.

> **Nothing can run between the tap and the sheet.** Google requires `loadPaymentData()` to be
> called while the browser is still handling the tap, so the SDK builds the request from what it
> already has. Keep the price current with `setTransactionInfo()` *before* the tap — see
> [step 5](#5-keep-the-price-current).

---

## Quick start

### 1. Load the scripts

Load Google's `pay.js`, then a Spreedly bundle that exposes `SpreedlyGooglePay` (Hosted Fields or
Express Checkout — both export the same global):

```html
<script async src="https://pay.google.com/gp/p/js/pay.js"></script>

<script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>
<!-- or Express Checkout: /checkout/elements/{version}/express-checkout.js -->
```

Replace `{version}` with your SDK version. `async` is fine — `mount()` waits for Google's API to
appear. With either bundle you can place the Google Pay button on your page next to your card
form. With Express Checkout, the form can also draw it above its card fields for you — see
[Google Pay inside Express Checkout](#google-pay-inside-express-checkout).

> Spreedly does **not** inject `pay.js`. Google's `TEST` and `PRODUCTION` environments use the
> same script; you choose the environment in the config.

### 2. Add a container for the button

Give the SDK an empty element to mount into. The SDK appends Google's button to it.

```html
<div id="google-pay-button-container"></div>
```

### 3. Create the instance and listen for events

```js
// authDetails come from your server: { environment_key, certificate_token, nonce, signature, timestamp }
const googlePay = new window.SpreedlyGooglePay({
  environment: 'TEST', // 'PRODUCTION' requires merchantInfo.merchantId
  authDetails,
  merchantInfo: { merchantName: 'Example Merchant' /*, merchantId: 'BCR2DN...' */ },
  transactionInfo: { totalPrice: '42.00', currencyCode: 'USD', countryCode: 'US' },
  button: { buttonType: 'pay', buttonColor: 'black' },
});

googlePay.on('googlePayReady', () => {
  // Google's button is on the page
});
googlePay.on('googlePayUnavailable', ({ reason }) => {
  // Nothing was drawn. Keep your card form as the payment option.
});
googlePay.on('googlePayTokenGenerated', async ({ token, googlePayType, cardNetwork, last4 }) => {
  await fetch('/checkout/purchase', { method: 'POST', body: JSON.stringify({ token, googlePayType }) });
});
googlePay.on('googlePayCancelled', () => {
  // Shopper closed the sheet. Not an error — they can tap again.
});
googlePay.on('googlePayError', ({ code, message, details }) => {
  console.error(`[${code}] ${message}`, details);
});
```

Register listeners **before** `mount()` so you do not miss `googlePayReady` /
`googlePayUnavailable`.

The constructor throws for configuration mistakes (missing fields, `merchantId` absent in
`PRODUCTION`, an invalid price) and does nothing else — no DOM, no network.
`gatewayMerchantId` is derived from `authDetails.environment_key`; you never type it.

### 4. Mount the button

```js
const { error } = await googlePay.mount('google-pay-button-container');
if (error) {
  // Google Pay is not available here; the card form stays the only option.
}
```

`mount()` calls Google's `isReadyToPay()` and draws the button **only** if the shopper can pay.
Otherwise nothing is drawn, `googlePayUnavailable` fires with the reason, and `{ error }` is
returned. A failed mount can be retried.

### 5. Keep the price current

Nothing can be awaited between the shopper's tap and Google opening the sheet, so the total must
be known *before* the tap. Update it whenever the cart changes:

```js
googlePay.setTransactionInfo({ totalPrice: '52.00', currencyCode: 'USD', countryCode: 'US' });
```

### 6. Charge from your server

The tap produces `googlePayTokenGenerated` with a Spreedly payment method token and
`googlePayType`. Send both to your backend, which runs the purchase — see
[Process payment from your backend](#process-payment-from-your-backend).

### 7. Start a new checkout

`authDetails` work as they do for the Hosted Fields card form: they are signed for one checkout
and fixed for the life of the instance. Spreedly expects a fresh `nonce` for each checkout, and
the `nonce` and `timestamp` expire after
[30 minutes](https://developer.spreedly.com/docs/iframe-api-lifecycle#security-requirements). When
the shopper starts another checkout on the same page (or the page has been open a long time),
replace the instance:

```js
googlePay.destroy();
const authDetails = await fetch('/checkout/auth-params').then(r => r.json());
googlePay = new window.SpreedlyGooglePay({ ...config, authDetails });
// register your on(...) handlers again, then:
await googlePay.mount('google-pay-button-container');
```

---

## Google Pay inside Express Checkout

With the Express Checkout bundle, the form can draw Google Pay for you instead of steps 2–4. Pass a
`googlePay` option to `expressCheckout()`. It takes the same configuration as `SpreedlyGooglePay`
except `authDetails`, which Express Checkout already has. The form then shows a wallet row above
the card fields: Google's button, then an "or pay with card" divider.

```js
const checkout = new window.SpreedlyExpressCheckout(authDetails);

checkout.on('googlePayTokenGenerated', ({ token, googlePayType }) => {
  // Send token and googlePayType to your server, as for the standalone button.
});
checkout.on('tokenGenerated', ({ tokenResponse }) => {
  // Card payments, unchanged.
});

checkout.expressCheckout({
  parentContainerId: 'payment-container',
  googlePay: {
    environment: 'TEST',
    merchantInfo: { merchantName: 'Example Merchant' },
    transactionInfo: { totalPrice: '42.00', currencyCode: 'USD', countryCode: 'US' },
    button: { buttonType: 'pay', buttonColor: 'black' },
  },
});

// When the cart changes, before the shopper taps:
checkout.setGooglePayTransactionInfo({ totalPrice: '52.00', currencyCode: 'USD', countryCode: 'US' });
```

- **Your page still loads `pay.js`** ([step 1](#1-load-the-scripts)). The row is drawn on your
  page, directly above the form's iframe. Google's script never runs inside the card form.
- **The row only appears when the shopper can pay.** It stays hidden until Google's
  `isReadyToPay()` passes. If Google Pay is unavailable, the row is removed and the card form is
  the only option.
- **Events arrive on the Express Checkout instance**, with the same names and payloads as
  `SpreedlyGooglePay`: `googlePayReady`, `googlePayTokenGenerated`, `googlePayError` and the rest.
  Card tokens still arrive on `tokenGenerated`. Register listeners before `expressCheckout()`.
- **Everything else works the same:** shipping, promo codes and `onPaymentDataChange`, billing
  address and email, `testCardNumber`. `button.buttonSizeMode` defaults to `'fill'`, so the button
  spans the row.
- **An invalid `googlePay` config doesn't stop card payments.** The form mounts without the row,
  and `googlePayError` and `googlePayUnavailable` fire with `DEVELOPER_ERROR`.
  `setGooglePayTransactionInfo()` does throw on an invalid price, like `setTransactionInfo()`.
- **Layout.** In embedded mode, give the container a fixed height: the row takes about 108 px and
  the form gets the rest. In dialog mode, the row sits above the form's title and close button.
  Styling and the divider copy (`walletDividerText`) are covered in the
  [Styling Guide](../tokenization/STYLING_GUIDE.md#google-pay-wallet-row).
- **Lifecycle.** `close()` and `setRecache()` remove the row and destroy the button, so close the
  form after `googlePayTokenGenerated`, not while the shopper may still be in Google's sheet. For a
  new checkout, create a new `SpreedlyExpressCheckout` with freshly signed auth params
  ([step 7](#7-start-a-new-checkout)).

---

## Process payment from your backend

The SDK stops at the Spreedly payment method token. Your server runs the transaction with your
environment key and access secret.

### Purchase with the payment method token

```
POST https://core.spreedly.com/v1/gateways/{gateway_token}/purchase.json
```

```json
{
  "transaction": {
    "amount": 4200,
    "currency_code": "USD",
    "payment_method_token": "PAYMENT_METHOD_TOKEN_FROM_SDK"
  }
}
```

### `googlePayType` and 3DS

| `googlePayType` | Comes from | Guidance |
|---|---|---|
| `TOKENIZED_CARD` | `CRYPTOGRAM_3DS` | Device token with cryptogram — authentication is already carried. Run the transaction without 3DS. |
| `NON_TOKENIZED_CARD` | `PAN_ONLY` | Card on file with Google, no cryptogram. May need a 3DS step-up depending on region and gateway — use 3DS Global (below). |

The SDK hands you `googlePayType` before your first transaction call, so your server can branch
on it (Spreedly's "tokenize first, then transact" option). On the web most payloads are
`PAN_ONLY` — device tokens come mainly from Chrome on Android. To avoid 3DS entirely, pass
`allowedAuthMethods: ['CRYPTOGRAM_3DS']`, at the cost of excluding shoppers whose card is not
tokenized on their device.

**Run 3DS through 3DS Global, not gateway-specific 3DS.** Send `sca_provider_key` and
`browser_info` (from the SDK's `serializeBrowserInfo()`) on the purchase, and run
`SpreedlyThreeDSLifecycle` when the transaction comes back `pending` — see Spreedly's
[3DS2 Global guide](https://developer.spreedly.com/docs/spreedly-3ds2-global-guide):

```json
{
  "transaction": {
    "amount": 4200,
    "currency_code": "USD",
    "payment_method_token": "PAYMENT_METHOD_TOKEN_FROM_SDK",
    "sca_provider_key": "YOUR_SCA_PROVIDER_KEY",
    "browser_info": "SERIALIZED_BROWSER_INFO"
  }
}
```

Spreedly refuses gateway-specific 3DS (`attempt_3dsecure: true`) for Google Pay payment methods,
on any gateway. The transaction carries the warning "attempt_3dsecure is not supported for this
payment method type. 3DS is only available for credit cards.", Spreedly drops `browser_info`,
and the gateway can then fail with "browser_info is required for 3D Secure 2 based transactions".
If you send `sca_provider_key` for a `TOKENIZED_CARD`, Spreedly skips 3DS and adds a warning.

The sample app implements this branching: `TOKENIZED_CARD` goes to `POST /api/v1/simple-purchase`,
and `NON_TOKENIZED_CARD` goes through a 3DS Global purchase and `SpreedlyThreeDSLifecycle`.

### Retaining payment methods

The SDK creates the payment method cached: it can be charged once, and Spreedly purges it after
~12 hours. To keep it, retain it from your server with
[`PUT /v1/payment_methods/<token>/retain`](https://developer.spreedly.com/reference/retain-payment-method),
or send `retain_on_success: true` with the first purchase. Spreedly ignores `retained` when the
payment method is created from the browser.

### Recurring transactions

Recurring Google Pay charges use Spreedly's
[stored credential framework](https://developer.spreedly.com/docs/stored-credentials). Retain the
payment method, then send `stored_credential_initiator` and `stored_credential_reason_type` on
your transactions — for example `cardholder` / `recurring` on the first charge while the shopper
is present, and `merchant` / `recurring` on later ones:

```json
{
  "transaction": {
    "amount": 999,
    "currency_code": "USD",
    "payment_method_token": "RETAINED_PAYMENT_METHOD_TOKEN",
    "stored_credential_initiator": "merchant",
    "stored_credential_reason_type": "recurring"
  }
}
```

Only some gateways support recurring Google Pay transactions (Spreedly lists Adyen, Checkout.com,
CyberSource, CyberSource REST, NMI, Stripe Payment Intents and WorldPay). On other gateways
Spreedly ignores the stored credential flags.

---

## Shipping address and options

Request shipping and recalculate the total while the sheet is open:

```js
const googlePay = new SpreedlyGooglePay({
  // ...
  shippingAddressRequired: true,
  shippingAddressParameters: { allowedCountryCodes: ['US'] },
  shippingOptionRequired: true,
  shippingOptionParameters: {
    defaultSelectedOptionId: 'standard',
    shippingOptions: [
      { id: 'standard', label: 'Standard (free)' },
      { id: 'express', label: 'Express ($10.00)' },
    ],
  },
  onPaymentDataChange: async ({ trigger, shippingAddress, shippingOptionId }) => {
    if (shippingAddress?.countryCode !== 'US') {
      return { error: { reason: 'SHIPPING_ADDRESS_UNSERVICEABLE', message: 'We ship to the US only' } };
    }
    const shipping = shippingOptionId === 'express' ? 10 : 0;
    return {
      transactionInfo: {
        totalPrice: (42 + shipping).toFixed(2),
        currencyCode: 'USD',
        countryCode: 'US',
      },
    };
  },
});
```

You return **data**; the SDK builds Google's update. Return the **full** `transactionInfo` —
Google replaces it rather than merging. The callback must settle within 20 s; if it throws or
times out the shopper sees an error in the sheet and `googlePayError` fires with
`PAYMENT_DATA_CHANGE_FAILED`. Google redacts the address (country, region, city, postal code)
until the shopper authorizes; the full address and the selected `shippingOptionId` arrive in
`googlePayPaymentAuthorized` and `googlePayTokenGenerated`. Charge that id — the last
`onPaymentDataChange` can be an earlier option.

## Billing address and email

```js
{ billingAddressRequired: true, billingAddressParameters: { format: 'FULL' }, emailRequired: true }
```

When requested, the billing name and address are sent to Spreedly on the `google_pay` payment
method (`first_name`, `last_name`, `address_1`, `address_2`, `city`, `state`, `zip`, `country`)
and the email on the payment method. Both are also returned to you in `googlePayTokenGenerated`.

## Promo codes (offers)

Declare the `OFFER` intent to show a promo-code field in the sheet. Validate the codes in
`onPaymentDataChange` and return the offers you accept together with the discounted total:

```js
const googlePay = new SpreedlyGooglePay({
  // ...
  callbackIntents: ['OFFER'],
  offerInfo: { offers: [] }, // optional: offers applied when the sheet opens
  onPaymentDataChange: async ({ trigger, redemptionCodes = [] }) => {
    const accepted = redemptionCodes.filter(code => code === 'SAVE10');
    if (trigger === 'OFFER' && accepted.length !== redemptionCodes.length) {
      return { error: { reason: 'OFFER_INVALID', message: 'This code is not valid.' } };
    }
    const discount = accepted.length ? 4.2 : 0;
    return {
      offerInfo: { offers: accepted.map(code => ({ redemptionCode: code, description: '10% off' })) },
      transactionInfo: {
        totalPrice: (42 - discount).toFixed(2),
        currencyCode: 'USD',
        countryCode: 'US',
        totalPriceLabel: 'Total',
        displayItems: [
          { label: 'Subtotal', type: 'SUBTOTAL', price: '42.00' },
          ...(discount ? [{ label: 'Promo', type: 'DISCOUNT', price: `-${discount.toFixed(2)}` }] : []),
        ],
      },
    };
  },
});
```

Offers don't change the price by themselves, so always return the recalculated
`transactionInfo`. `redemptionCodes` includes codes you already approved.

## Restricting cards and checking assurance

```js
{
  allowPrepaidCards: false,             // refuse prepaid cards
  allowCreditCards: false,              // debit only (e.g. UK gambling)
  allowedIssuerCountryCodes: ['US'],    // or blockedIssuerCountryCodes — not both
  assuranceDetailsRequired: true,       // adds assuranceDetails to googlePayTokenGenerated
}
```

`googlePayTokenGenerated` then carries `assuranceDetails: { accountVerified,
cardHolderAuthenticated }` and `cardFundingSource` (`CREDIT` / `DEBIT` / `PREPAID` / `UNKNOWN`).
When both assurance flags are `true`, Google says no step-up is needed. Otherwise apply your usual
risk checks, and 3DS where applicable. Use this alongside `googlePayType`.

## Sheet button label and transaction id

On `transactionInfo`:
- `checkoutOption: 'COMPLETE_IMMEDIATE_PURCHASE'` labels the sheet button "Pay now" (the total
  must be `FINAL`).
- `'CONTINUE_TO_REVIEW'` labels it "Review Order".
- `'DEFAULT'` lets Google choose.
- `transactionId` tags the attempt for Google's troubleshooting.

---

## Handling errors

`googlePayError` carries `{ code, message, details? }`. `details` is either a sanitized Spreedly
Core error (`{ message, status?, errors? }`) or Google's `{ statusCode, statusMessage }` — never
request data or the token. The most common cases:

- **`googlePayUnavailable`** (with `reason: 'NOT_READY_TO_PAY'`) is normal: the shopper's browser
  or account can't pay with Google Pay. Show your card form.
- **`TOKENIZATION_FAILED` / `TOKENIZATION_TIMEOUT`**: the sheet stays open so the shopper can pick
  another card. Key your order on your own order id, not the token.
- **`DEVELOPER_ERROR`**: Google rejected the request — check your Wallet Console setup and config.

Every code, with what to do about it, is in the [API reference](./API_REFERENCE.md#googlepayerror).

## Testing and go-live

Spreedly's [Google Pay testing guidelines](https://developer.spreedly.com/docs/google-pay#testing-guidelines)
run in three steps:

1. **Google test card suite**: `environment: 'TEST'`, with your tester enrolled in Google's test
   group. Don't set `testCardNumber` here.
2. **Real card, test override**: `environment: 'PRODUCTION'`, a real card in the Google account and
   `testCardNumber` set (for example `4111111111111111`). Spreedly decrypts the genuine payload
   but stores the test PAN, so the payment method can only be used on a test gateway. The SDK logs
   a warning while `testCardNumber` is set in `PRODUCTION`.
3. **Production micro-transaction** (around $1) on your live gateway, with `testCardNumber`
   removed.

Remove `testCardNumber` before going live. If it is left in, payment methods are created with the
test card and live charges fail.

---

## Content Security Policy (CSP)

Google Pay runs on your page, so your page's CSP has to allow it. Add these hosts to the
directives you already ship. Keep your existing Spreedly entries (`https://*.spreedly.com`).

| Directive | Add |
|---|---|
| `script-src` | `https://pay.google.com` |
| `frame-src` | `https://pay.google.com` |
| `connect-src` | `https://pay.google.com` `https://google.com` `https://www.google.com` `https://account.google.com` `https://core.spreedly.com` |
| `img-src` | `https://www.gstatic.com` |

`connect-src` for the Google hosts is what Google documents for the payment sheet
([FAQ](https://developers.google.com/pay/api/web/support/faq)). `https://www.gstatic.com` serves
the button images. If the sheet is still blocked, the browser's CSP report names the extra host —
add that host only.

With a nonce-based CSP, pass the nonce as `cspNonce`, which Google receives as its `nonce` option
and applies to the `<style>` and `<script>` it injects, including the button. Put the same `nonce`
attribute on your `pay.js` `<script>` tag. With that nonce you do not need `'unsafe-inline'` on
`style-src`. Without a nonce, those injected styles are blocked unless `style-src` allows them.

---

## Limitations

- The button is always drawn on your page, never inside Express Checkout's iframe (see
  [Google Pay inside Express Checkout](#google-pay-inside-express-checkout)).
- `SpreedlyGooglePay` always seals the token for Spreedly (`gateway: "spreedly"`).
  [Third Party Google Pay](https://developer.spreedly.com/docs/third-party-google-pay), where
  another gateway decrypts the token, is not supported by this class.

---

## Guide contents

- **[API_REFERENCE.md](./API_REFERENCE.md)** — constructor, config, methods, events, payloads, and
  error codes.
