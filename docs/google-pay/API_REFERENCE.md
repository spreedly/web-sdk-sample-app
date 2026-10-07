# Google Pay — API Reference

The `SpreedlyGooglePay` methods, events, and types. Integration steps are in
[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md).

`SpreedlyGooglePay` is a **standalone** class (it does not extend `SpreedlyHostedFields` /
`SpreedlyExpressCheckout`). Both CDN bundles expose it as `window.SpreedlyGooglePay`, and both
re-export its types (`GooglePayConfig`, `GooglePayTokenResult`, …). Express Checkout can also
create one for you and draw it above its card form — see
[In Express Checkout](#in-express-checkout).

## `SpreedlyGooglePay`

```js
const googlePay = new window.SpreedlyGooglePay(config);
```

| Constructor param | Type | |
|-------------------|------|--|
| `config` | `GooglePayConfig` | See [GooglePayConfig](#googlepayconfig). |

The constructor **throws synchronously** (`Error` with a message naming the field) on any
configuration mistake: a missing required field, `merchantInfo.merchantId` absent in
`PRODUCTION`, an invalid price format, or callback intents without the flags and callback they
need. It has no other side effects — no DOM access
and no network calls. Construct inside a try/catch if config may be incomplete.

### Methods

#### `on(event, callback)`

Register an event handler. Event names are validated against the list in [Events](#events) —
unknown names are dropped with a logger warning.

```js
googlePay.on('googlePayTokenGenerated', (result) => { /* … */ });
```

#### `mount(containerId): Promise<GooglePayMountResult>`

Checks eligibility and, only if the shopper can pay, draws Google's button:

1. Waits up to 10 s for `window.google.payments.api` (your `pay.js` may load `async`).
2. Creates the `PaymentsClient` and calls `isReadyToPay()`.
3. Appends Google's button to the element with id `containerId` and emits `googlePayReady`.

```js
const { error } = await googlePay.mount('google-pay-button-container');
if (error) showCardFormOnly();
```

`GooglePayMountResult` is `{ error?: string }`. It does not throw; every failure returns
`{ error }` and draws nothing:

- **Google Pay unavailable** — `googlePayUnavailable` fires with the reason. For
  `API_NOT_LOADED` and `PAYMENTS_CLIENT_ERROR`, `googlePayError` fires as well; `NOT_READY_TO_PAY`
  is a normal outcome and is not an error.
- **Container missing, or Google could not draw the button** — `googlePayError` fires with
  `MOUNT_FAILED`.

A failed mount leaves the instance mountable, so you can retry. Calling `mount()` again while it
is mounting or already mounted, or after `destroy()`, returns `{ error }`.

#### `setTransactionInfo(info): void`

Replaces the transaction info used by the **next** tap. Call it whenever the cart changes:
nothing may be awaited between the tap and the sheet opening, so the price must already be
current.

```js
googlePay.setTransactionInfo({ totalPrice: '52.00', currencyCode: 'USD', countryCode: 'US' });
```

Throws if `info` is incomplete or invalid.

#### `destroy(): void`

**Terminal** teardown: removes the button, drops all callbacks, and ignores any later taps or
late Google callbacks. `mount()` then returns `{ error }`. Create a new `SpreedlyGooglePay` to
start again — for example for a new checkout, with freshly signed `authDetails`.

---

## `GooglePayConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `environment` | `'TEST' \| 'PRODUCTION'` | Yes | Google Pay environment. |
| `authDetails` | `{ environment_key, certificate_token, nonce, signature, timestamp }` | Yes | Signed by your server. `environment_key` becomes `gatewayMerchantId`. Fixed for the life of the instance, as with `SpreedlyHostedFields`; create a new instance for each checkout. |
| `merchantInfo.merchantName` | `string` | Yes | Shown in the sheet. |
| `merchantInfo.merchantId` | `string` | `PRODUCTION` only | Google Merchant ID. Omitted from the request in `TEST`. |
| `transactionInfo` | `GooglePayTransactionInfo` | Yes | The payment. See [below](#googlepaytransactioninfo). Update later with `setTransactionInfo()`. |
| `allowedAuthMethods` | `('PAN_ONLY' \| 'CRYPTOGRAM_3DS')[]` | No | Default: both. |
| `allowedCardNetworks` | `('AMEX' \| 'DISCOVER' \| 'INTERAC' \| 'JCB' \| 'MASTERCARD' \| 'VISA' \| 'ELECTRON' \| 'MAESTRO' \| 'ELO' \| 'ELO_DEBIT')[]` | No | Any subset of Google's networks. Default: `AMEX`, `DISCOVER`, `JCB`, `MASTERCARD`, `VISA`. `ELECTRON`, `MAESTRO`, `ELO`, `ELO_DEBIT` are Brazilian combo-card networks and need `transactionInfo.countryCode: 'BR'` with both the credit and debit network listed. `DISCOVER` and `JCB` never return `CRYPTOGRAM_3DS`. List only networks your gateway can process. |
| `allowPrepaidCards` | `boolean` | No | `false` refuses prepaid cards. Omitted = Google's default (allowed). |
| `allowCreditCards` | `boolean` | No | `false` refuses credit cards (required for UK gambling merchants). |
| `allowedIssuerCountryCodes` | `string[]` | No | Only cards issued in these ISO 3166-1 alpha-2 countries. Exclusive with `blockedIssuerCountryCodes`. |
| `blockedIssuerCountryCodes` | `string[]` | No | No cards issued in these countries. |
| `assuranceDetailsRequired` | `boolean` | No | Returns `assuranceDetails` on the token result. |
| `billingAddressRequired` | `boolean` | No | Billing is sent to Spreedly and returned to you. |
| `billingAddressParameters` | `{ format?: 'MIN' \| 'FULL' \| 'FULL-ISO3166'; phoneNumberRequired?: boolean }` | No | `FULL-ISO3166` adds `iso3166AdministrativeArea`. |
| `shippingAddressRequired` | `boolean` | No | |
| `shippingAddressParameters` | `{ allowedCountryCodes?: string[]; phoneNumberRequired?: boolean; format?: 'FULL' \| 'FULL-ISO3166' }` | No | |
| `shippingOptionRequired` | `boolean` | No | Requires `shippingAddressRequired`, `shippingOptionParameters` and `onPaymentDataChange`. |
| `shippingOptionParameters` | `{ shippingOptions: {id, label, description?}[]; defaultSelectedOptionId? }` | With shipping options | |
| `emailRequired` | `boolean` | No | Email is sent on the payment method and returned to you. |
| `offerInfo` | `{ offers: { redemptionCode, description }[] }` | No | Offers applied when the sheet opens. With `onPaymentDataChange`, enables the `OFFER` intent. |
| `callbackIntents` | `('OFFER' \| 'SHIPPING_ADDRESS' \| 'SHIPPING_OPTION' \| 'PAYMENT_AUTHORIZATION')[]` | No | Intents to declare. `PAYMENT_AUTHORIZATION` is always added by the SDK. When omitted, derived from the shipping flags and `offerInfo` whenever `onPaymentDataChange` is set. See [Callback intents](#callback-intents). |
| `onPaymentDataChange` | `(change) => GooglePayDataUpdate \| Promise<…>` | No | Shipping address / option changes and promo codes. Must settle within 20 s. See [below](#onpaymentdatachange). |
| `button` | `GooglePayButtonOptions` | No | Passed to Google's `createButton()`. See [GooglePayButtonOptions](#googlepaybuttonoptions). |
| `existingPaymentMethodRequired` | `boolean` | No | Also asks whether the shopper already has a matching card; reported on `googlePayReady`. Always `true` in `TEST`. |
| `cspNonce` | `string` | No | Google's `nonce` option: the CSP nonce Google applies to the `<style>` / `<script>` it injects. Put the same nonce on your `pay.js` tag. |
| `testCardNumber` | `string` | No | Sent as `test_card_number`: Spreedly decrypts the payload but stores this test PAN, so the payment method only works on a test gateway. For the real-card testing step, with `PRODUCTION` (a warning is logged). Remove before going live. |
| `metadata` | `Record<string, string>` | No | Stored on the payment method. |

### `GooglePayTransactionInfo`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `totalPrice` | `string` | Yes | Matches `^[0-9]+(\.[0-9][0-9])?$`, e.g. `'42.00'`. Numbers are rejected. |
| `currencyCode` | `string` | Yes | ISO 4217. |
| `countryCode` | `string` | Yes | ISO 3166-1 alpha-2 of the acquirer. Google only requires it for EEA / SCA (and `'BR'` for Brazilian combo cards); the SDK always requires it. |
| `totalPriceStatus` | `'FINAL' \| 'ESTIMATED'` | No | Default `'FINAL'`. |
| `totalPriceLabel` | `string` | With `displayItems` | |
| `displayItems` | `{ label, type, price, status? }[]` | No | `type` is one of `LINE_ITEM`, `SUBTOTAL`, `TAX`, `DISCOUNT`, `SHIPPING_OPTION`. `price` may be negative. `status` is `'FINAL'` (default) or `'PENDING'`. |
| `transactionId` | `string` | No | A unique id per attempt; Google encourages it for troubleshooting. |
| `checkoutOption` | `'DEFAULT' \| 'COMPLETE_IMMEDIATE_PURCHASE' \| 'CONTINUE_TO_REVIEW'` | No | The sheet's submit button: Google's choice, "Pay now" (`FINAL` only) or "Review Order". |

### `onPaymentDataChange`

The callback receives `GooglePayPaymentDataChange`: `{ trigger, shippingAddress?, shippingOptionId?, redemptionCodes? }`.
- `trigger` is one of `'INITIALIZE'`, `'SHIPPING_ADDRESS'`, `'SHIPPING_OPTION'` or `'OFFER'`.
  `INITIALIZE` can fire more than once, for example when the shopper switches account.
- `shippingAddress` is redacted by Google to `countryCode`, `administrativeArea`, `locality` and
  `postalCode` (plus `iso3166AdministrativeArea` with `format: 'FULL-ISO3166'`).
- `redemptionCodes` is every promo code entered in the sheet, including already-approved ones.

Return `GooglePayDataUpdate`: `{ transactionInfo?, shippingOptionParameters?, offerInfo?, error? }`.
- `transactionInfo` must be the full, recalculated info. Offers don't change prices by
  themselves, so return a new `transactionInfo` with any discount.
- `offerInfo` is the set of offers now applied.
- `error` is `{ reason, message }`, where `reason` is one of `OFFER_INVALID`,
  `SHIPPING_ADDRESS_INVALID`, `SHIPPING_ADDRESS_UNSERVICEABLE`, `SHIPPING_OPTION_INVALID` or
  `OTHER_ERROR`. The SDK reports it against a declared intent.

If the callback throws, returns an invalid `transactionInfo` or takes longer than 20 s, the
shopper sees a generic error in the sheet and `googlePayError` fires with
`PAYMENT_DATA_CHANGE_FAILED`.

### Callback intents

`PAYMENT_AUTHORIZATION` is always declared, because the SDK tokenizes inside that callback. The
other intents route to `onPaymentDataChange`, so they need it:

| Intent | Also requires |
|--------|---------------|
| `SHIPPING_ADDRESS` | `shippingAddressRequired: true` |
| `SHIPPING_OPTION` | `shippingOptionRequired: true` (the two go together), `shippingAddressRequired: true`, `shippingOptionParameters` |
| `OFFER` | — (`offerInfo` is optional) |

Passing `callbackIntents` explicitly turns off the derivation, so list every intent you need.

### `GooglePayButtonOptions`

| Field | Type | Description |
|-------|------|-------------|
| `buttonColor` | `'default' \| 'black' \| 'white'` | Google's button colour. |
| `buttonType` | `'book' \| 'buy' \| 'checkout' \| 'donate' \| 'order' \| 'pay' \| 'plain' \| 'subscribe'` | The label next to the Google Pay mark. |
| `buttonSizeMode` | `'static' \| 'fill'` | `fill` sizes the button to its container. |
| `buttonLocale` | `string` | ISO 639-1. Defaults to the browser language. |
| `buttonRadius` | `number` | Corner radius in px, 0 to half the button height. |
| `buttonBorderType` | `'default_border' \| 'no_border'` | |

These are read once, at `mount()`. To change them, `destroy()` the instance and construct a new one.

### Fields the SDK owns

These `PaymentDataRequest` fields can't be configured:
- `apiVersion` / `apiVersionMinor`: fixed at `2` / `0` by Google's spec.
- `allowedPaymentMethods[].type`: `'CARD'`, the only value Google accepts.
- `tokenizationSpecification`: gateway `spreedly`, with `gatewayMerchantId` taken from your
  environment key.
- The `PAYMENT_AUTHORIZATION` intent.

Every other field maps 1:1 to the config above.

---

## In Express Checkout

`SpreedlyExpressCheckout` draws Google Pay above its card form when `expressCheckout()` gets a
`googlePay` option. It creates and manages the `SpreedlyGooglePay` instance itself.

| API | Description |
|-----|-------------|
| `expressCheckout({ googlePay })` | `ExpressCheckoutGooglePayConfig`: a [`GooglePayConfig`](#googlepayconfig) without `authDetails`, which come from the Express Checkout instance. `button.buttonSizeMode` defaults to `'fill'`. Draws a wallet row above the iframe (Google's button, then a divider), shown only after `googlePayReady`. Does not throw for an invalid config: the form mounts without the row, and `googlePayError` and `googlePayUnavailable` fire with `DEVELOPER_ERROR`. |
| `setGooglePayTransactionInfo(info)` | Same as [`setTransactionInfo()`](#settransactioninfoinfo-void), and keeps `info` for the next `expressCheckout()` call. Throws if `info` is invalid. Logs a warning and does nothing without a `googlePay` option. |
| `on('googlePay…', cb)` | The [events](#events) below, with the same payloads, emitted by the Express Checkout instance. Card tokens still arrive on `tokenGenerated`. |
| `updateTextElement('walletDividerText', text)` | Changes the divider copy. Default: "or pay with card". Also settable as `uiConfig.textConfig.walletDividerText`. |
| `close()`, `setRecache()` | Remove the row and destroy the button. |

The row is removed, not disabled, when `googlePayUnavailable` fires or Google's button can't be
drawn. It takes the form's `styles.paper.backgroundColor` and `styles.typography.fontFamily`.

---

## Events

Register with `googlePay.on(name, cb)`.

| Event | Payload | Fires when |
|-------|---------|-----------|
| `googlePayReady` | `{ paymentMethodPresent? }` | `mount()` drew Google's button. `paymentMethodPresent` only with `existingPaymentMethodRequired`. |
| `googlePayUnavailable` | `{ reason: 'NOT_READY_TO_PAY' \| 'API_NOT_LOADED' \| 'PAYMENTS_CLIENT_ERROR' \| 'DEVELOPER_ERROR' }` | `mount()` drew nothing. Show your card form. `DEVELOPER_ERROR` only comes from Express Checkout, for an invalid `googlePay` config. |
| `googlePayButtonClicked` | `undefined` | Shopper tapped the button; the sheet is opening. Use it for merchant UI — do not listen on the container. |
| `googlePayPaymentAuthorized` | `GooglePayPaymentSummary` | Shopper approved in the sheet; tokenization is starting. Display only. |
| `googlePayTokenGenerated` | `GooglePayTokenResult` | The sheet closed with a Spreedly payment method. Send `token` to your server. |
| `googlePayCancelled` | `undefined` | Shopper closed the sheet. Not an error — they can tap again. |
| `googlePayError` | `GooglePayError` | Any failure. See [GooglePayError](#googlepayerror). |

### `GooglePayTokenResult`

| Field | Type | Description |
|-------|------|-------------|
| `token` | `string` | Spreedly payment method token. |
| `googlePayType` | `'TOKENIZED_CARD' \| 'NON_TOKENIZED_CARD'` | Drives the 3DS decision server-side. |
| `cardNetwork` | `string` | e.g. `'VISA'`, from Google. |
| `last4` | `string` | From Google's `cardDetails`. |
| `cardFundingSource` | `string` | `'CREDIT'`, `'DEBIT'`, `'PREPAID'` or `'UNKNOWN'`. |
| `assuranceDetails` | `{ accountVerified?, cardHolderAuthenticated? }` | With `assuranceDetailsRequired`. When both are `true`, Google says no step-up is needed. |
| `billingAddress` / `shippingAddress` | `GooglePayAddress` | When requested. |
| `email` | `string` | When requested. |
| `paymentMethod` | `object` | The Spreedly payment method as returned by Core (masked card fields). |

### `GooglePayPaymentSummary`

The `googlePayPaymentAuthorized` payload: the display fields of `GooglePayTokenResult`
(`cardNetwork`, `last4`, `cardFundingSource`, `assuranceDetails`, `billingAddress`,
`shippingAddress`, `email`), all optional, with no token.

### `GooglePayAddress`

| Field | Description |
|-------|-------------|
| `name` | Full name |
| `address1`, `address2`, `address3` | Address lines |
| `locality`, `administrativeArea`, `postalCode`, `countryCode`, `sortingCode` | City, region, postal code, ISO 3166-1 alpha-2 country, sorting code |
| `phoneNumber` | With `phoneNumberRequired` |
| `iso3166AdministrativeArea` | ISO 3166-2 region code, with `format: 'FULL-ISO3166'` |

### `GooglePayError`

```ts
{ code: GooglePayErrorCode; message: string; details?: unknown }
```

`details` is either a sanitized Spreedly Core error (`{ message, status?, errors? }`) or Google's
`{ statusCode, statusMessage }` — never request data or the token.

| Error code | Scenario | Recommended action |
|-----------|----------|-------------------|
| `API_NOT_LOADED` | `pay.js` did not define `window.google.payments.api` within 10 s | Check the `<script>` tag and your CSP. `googlePayUnavailable` also fires. |
| `NOT_READY_TO_PAY` | Only as a `googlePayUnavailable` reason: the shopper or browser can't pay | Normal — show the card form. |
| `MOUNT_FAILED` | The container element is missing, or Google could not draw the button | Render the container before calling `mount()`; check the id. |
| `DEVELOPER_ERROR` | Google rejected the request (e.g. merchant info), or the request could not be built. In Express Checkout, also an invalid `googlePay` config | Check the Wallet Console setup and config. |
| `TOKENIZATION_FAILED` | Spreedly could not create the payment method | See `details`. The sheet stays open so the shopper can pick another card. |
| `TOKENIZATION_TIMEOUT` | Spreedly did not answer within 20 s | Same as above. Key your order on your own order id, not the token. |
| `PAYMENT_DATA_CHANGE_FAILED` | Your `onPaymentDataChange` threw, timed out or returned an invalid total | Fix the callback; the shopper sees a generic error in the sheet. |
| `PAYMENTS_CLIENT_ERROR` | Any other Google failure (raw `statusCode` in `details`) | Retry or fall back to the card form. |
