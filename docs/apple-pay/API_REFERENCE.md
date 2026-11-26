# Apple Pay — API Reference

> **Preview.** Apple Pay in Spreedly's checkout SDK is in final testing and not yet released, so no published SDK version includes it yet. Method names, options and behaviour may change before release. Payments have been tested end to end in desktop Chrome with an iPhone scanning Apple's code and in Safari on a Mac; testing in Safari on iPhone is in progress.

The `SpreedlyApplePay` class, its configuration, the callbacks you supply, its events and error
codes, and the `applePay` option of Express Checkout. Setup and integration steps are in
[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md).

`SpreedlyApplePay` is a standalone class: it does not extend `SpreedlyHostedFields` or
`SpreedlyExpressCheckout`. Both CDN bundles (Hosted Fields `index.js` and Express Checkout
`express-checkout.js`) put it on the page as `window.SpreedlyApplePay`, and both re-export its
TypeScript types. Your page loads Apple's Apple Pay JS script itself
(`https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js`); the SDK never injects it. The
SDK draws Apple's button, runs the Apple Pay session on the page that loads the SDK, and sends Apple's
encrypted token to Spreedly to create a payment method. You can't open the sheet from your own
button: the SDK always draws Apple's button and opens the sheet from it. Express Checkout can also create the instance for you and
draw the button above its card form; see [In Express Checkout](#in-express-checkout).

## `SpreedlyApplePay`

```js
const applePay = new window.SpreedlyApplePay({
  environmentKey: 'your_environment_key',
  merchantIdentifier: 'merchant.com.example',
  countryCode: 'US',
  currencyCode: 'USD',
  total: { label: 'Example Shop', amount: '42.00' },
  onValidateMerchant: ({ validationURL }) =>
    fetch('/api/apple-pay/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ validationURL }),
    }).then(res => {
      if (!res.ok) throw new Error('Merchant validation failed');
      return res.json();
    }),
  getAuthDetails: () => fetch('/api/spreedly/auth-params').then(res => res.json()),
});
```

| Constructor param | Type | |
|-------------------|------|--|
| `config` | `ApplePayConfig` | See [ApplePayConfig](#applepayconfig). |

The constructor checks the whole config synchronously and throws a plain `Error` on the first
field that is wrong. Messages name the field. Most use one of two forms,
`Required field '<field>' was not supplied.` or `Invalid field '<field>': <reason>`; a missing or
non-function `onValidateMerchant` or `getAuthDetails` throws
`Required field '<field>' must be a function.` A missing
config object throws `SpreedlyApplePay requires a config object.` Construct inside a try/catch if
the config may be incomplete.

The constructor draws nothing, runs no availability check, and doesn't call Apple or Spreedly's
API. It sets the SDK's telemetry environment from `environmentKey` and sends one log line to
Spreedly.

Config keys the SDK doesn't know are ignored, not rejected.

### Methods

#### `on(event, callback): void`

Registers a handler for one of the [eight Apple Pay events](#events). The callback receives the
event's payload. You can register several handlers for one event.

```js
applePay.on('applePayTokenGenerated', ({ token }) => {
  // Send token to your server.
});
```

- An unknown event name is ignored and a warning is logged.
- A handler that throws is caught. The other handlers still run, and the SDK logs only the
  error's name, never its message or stack.
- Events go only to handlers registered when they fire; nothing is queued or replayed.
  `applePayReady`, `applePayUnavailable` and the `API_NOT_LOADED` and `MOUNT_FAILED` errors fire
  during `mount()`, so register handlers before you call it.
- After `destroy()`, `on()` does nothing.
- In TypeScript, `on()` types the payload as `unknown`. Cast it to the event's payload type:
  `applePay.on('applePayTokenGenerated', payload => { const { token } = payload as ApplePayTokenResult; })`.
  Annotating the parameter instead (`({ token }: ApplePayTokenResult) =>`) doesn't compile.

#### `mount(containerId): Promise<ApplePayMountResult>`

Checks whether Apple Pay can be offered and, only if it can, draws Apple's button inside the
element with id `containerId`. The checks run in this order:

1. Apple's script: the `<apple-pay-button>` custom element is registered within 10 s, and
   `window.ApplePaySession` exists.
2. HTTPS: `window.isSecureContext` is not `false` and the page's protocol is `https:`. Plain-HTTP
   `localhost` fails this check, because Apple's script refuses it.
3. `ApplePaySession.canMakePayments()` returns `true`.
4. The browser supports an Apple Pay JS version that this config needs, with at least one of
   the listed networks. See [Apple Pay JS version](#apple-pay-js-version).
5. Only with `checkPaymentCredentialStatus: true`: Apple's `applePayCapabilities()`, waited for
   up to 3 s. See [`checkPaymentCredentialStatus`](#checkpaymentcredentialstatus).

Then it looks up the container with `document.getElementById`, appends the button, emits
`applePayReady` and resolves `{}`. The container is looked up only after the checks finish (up to
10 s plus 3 s), so it must exist by then, not necessarily when you call `mount()`. Because of
`getElementById`, the container can't be inside a shadow root.

With `checkPaymentCredentialStatus` off, the button is drawn whenever `canMakePayments()` is
`true`, even when the shopper has no card in Wallet.

```js
const { error } = await applePay.mount('apple-pay-button');
if (error) showCardFormOnly();
```

`ApplePayMountResult` is `{ error?: string }`. `mount()` never throws. Every failure resolves
`{ error }` and draws nothing:

| Case | `error` | Events |
|------|---------|--------|
| A check failed | The reason's message (see [Unavailable reasons](#unavailable-reasons)) | `applePayUnavailable`; for `API_NOT_LOADED` also `applePayError` |
| No element with id `containerId` | `Apple Pay container '#<containerId>' was not found.` | `applePayError` with `MOUNT_FAILED` |
| Already mounting or mounted (including two overlapping calls) | `SpreedlyApplePay is already mounted.` | None |
| `destroy()` ran during `mount()` | `SpreedlyApplePay was destroyed while mounting.` | None |
| Called after `destroy()` | `SpreedlyApplePay has been destroyed. Create a new instance.` | None |

After an unavailable result or `MOUNT_FAILED`, the instance can be mounted again.

The button is Apple's `<apple-pay-button>` element. The SDK sets its `type`, `buttonstyle` and
`locale` attributes and its `--apple-pay-button-*` CSS variables from
[`button`](#applepaybuttonoptions), and listens for `click` on it. A tap opens the sheet
synchronously inside the click, because Apple only lets a session start from the shopper's
gesture. A tap while a sheet is already open does nothing.

#### `setTotal(update): void`

Replaces the total used by the **next** tap. Call it whenever the cart changes: nothing can be
awaited between the tap and the sheet opening, so the total must already be current.

```js
applePay.setTotal({ total: { label: 'Example Shop', amount: '52.00' } });
```

- `update` is `ApplePayTotalUpdate`: `{ total: ApplePayLineItem }`. Only `total` is read.
- Throws on invalid input, with the same rules as the config's `total` (see
  [ApplePayLineItem](#applepaylineitem)). A non-object throws
  `Invalid field 'update': must be an object with a total.`
- A sheet that is already open keeps the total it opened with.
- Can be called before `mount()`.
- After `destroy()` it does nothing and does not throw, even for invalid input.

A zero total needs Apple Pay JS version 4. The SDK chooses the version once, at `mount()`, from
the constructor's `total`. A zero total passed later to `setTotal()` doesn't change that choice.

#### `destroy(): void`

Removes the instance for good. It aborts an open Apple Pay session (no event fires for it), removes the
button element the SDK created, and drops all handlers. Late callbacks from Apple and late results
from Spreedly or from your callbacks are ignored. Afterwards `on()` and `setTotal()` do nothing and
`mount()` resolves `{ error }`. A second call does nothing. Create a new `SpreedlyApplePay` to start
again.

---

## `ApplePayConfig`

| Field | Type | Required | Default | What it does |
|-------|------|----------|---------|--------------|
| `environmentKey` | `string` | Yes | | Your Spreedly environment key, the same one your auth details carry. Tags the SDK's telemetry from the first event. Not a secret. Express Checkout sets it for you. |
| `merchantIdentifier` | `string` | Yes | | Your Apple Merchant ID. Used only for `applePayCapabilities()` when `checkPaymentCredentialStatus` is `true`. Never sent to Spreedly. |
| `countryCode` | `string` | Yes | | Two letters (ISO 3166-1 alpha-2), either case, passed to Apple unchanged. Apple: the country of the merchant's principal place of business; ask your payment processor which code to use. |
| `currencyCode` | `string` | Yes | | Three letters (ISO 4217), either case, passed to Apple unchanged. |
| `total` | `ApplePayLineItem` | Yes | | The total for the first tap. Change it with `setTotal()`. A zero amount needs Apple Pay JS version 4. See [ApplePayLineItem](#applepaylineitem). |
| `onValidateMerchant` | `(request: { validationURL: string }) => Promise<unknown>` | Yes | | Gets a merchant session from Apple through your server. See [onValidateMerchant](#onvalidatemerchant). |
| `getAuthDetails` | `() => Promise<AuthDetails>` | Yes | | Returns freshly signed Spreedly auth details. See [getAuthDetails](#getauthdetails). |
| `processPayment` | `(result: ApplePayTokenResult) => Promise<ApplePayPaymentOutcome>` | No | | Charges while the sheet is still open, so the sheet shows the real result. See [processPayment](#processpayment). |
| `checkPaymentCredentialStatus` | `boolean` | No | `false` | Asks Apple whether the shopper has a card in Wallet that can pay you. See [below](#checkpaymentcredentialstatus). |
| `supportedNetworks` | `string[]` | No | `visa`, `masterCard`, `amex`, `discover`, `jcb`, `maestro`, `elo`, `cartesBancaires`, `interac`, `mada`, `bancontact`, `dankort` | Apple network names, in the order you prefer. From iOS 15.4 and macOS 12.3, Apple makes the first one listed the default network for a co-badged card. Most merchants should set this: list only networks your gateway processes, or the shopper can approve a card your gateway then declines. Names aren't checked against a list. A network too new for the browser is left out. See [Apple Pay JS version](#apple-pay-js-version). China Union Pay isn't in the defaults: to take it, list `chinaUnionPay` and add `supportsEMV` to `merchantCapabilities`, once you've checked that Spreedly and your gateway handle it. |
| `merchantCapabilities` | `string[]` | No | `['supports3DS']` | Must include `'supports3DS'`. Other values go to Apple unchecked. |
| `supportedCountries` | `string[]` | No | | Two-letter codes, either case. Apple limits cards to those issued in these countries. A bad entry throws rather than being dropped. |
| `requiredBillingContactFields` | `ApplePayContactField[]` | No | | What Apple returns in `billingContact` after the shopper approves. See [Contacts](#contacts). |
| `requiredShippingContactFields` | `ApplePayContactField[]` | No | | What Apple returns in `shippingContact` after the shopper approves. |
| `billingContact` | `ApplePayPaymentContact` | No | | A billing address on file, shown as the sheet's default. Needs `'postalAddress'` in `requiredBillingContactFields`; without it, the constructor throws. Sent to Apple only. |
| `shippingContact` | `ApplePayPaymentContact` | No | | A shipping contact on file, shown as the sheet's default. Needs a non-empty `requiredShippingContactFields`; without it, the constructor throws. Sent to Apple only. |
| `shippingType` | `'shipping' \| 'delivery' \| 'storePickup' \| 'servicePickup'` | No | Apple's `'shipping'` | How the items reach the shopper (Apple: it "indicates how to ship purchased items"). Sent only when set. |
| `recurringPaymentRequest` | `ApplePayRecurringPaymentRequest` | No | | Asks Apple for a merchant token. Needs Apple Pay JS version 14. See [Recurring payments](#recurring-payments). |
| `button` | `ApplePayButtonOptions` | No | See [below](#applepaybuttonoptions) | Apple's button. Read once, at `mount()`. |
| `testCardNumber` | `string` | No | | 12 to 19 digits; spaces are allowed and removed. Sent as `apple_pay.test_card_number`. Remove before going live. |
| `metadata` | `Record<string, string>` | No | | Stored on the payment method. An empty object isn't sent. Spreedly's [create payment method](https://developer.spreedly.com/reference/create-payment-method) reference limits metadata to 25 keys, keys to 50 characters and values to 500. The SDK doesn't check these limits: if Spreedly rejects the request, `applePayError` fires with `TOKENIZATION_FAILED` and Spreedly's error. |

`AuthDetails` is `{ environment_key, certificate_token, nonce, signature, timestamp }`, all
strings, signed by your server.

### `ApplePayLineItem`

Used for `total` and for the recurring billing items.

| Field | Type | Required | Rule |
|-------|------|----------|------|
| `label` | `string` | Yes | Not empty. Apple: for the total, use the business name the shopper sees on their card statement. |
| `amount` | `string` | Yes | No decimals or exactly two, e.g. `'42'` or `'42.00'`; not `'42.5'`. Not negative. Numbers are rejected. |
| `type` | `'final' \| 'pending'` | No | Passed to Apple unchanged. Apple's default is `'final'`; with `'pending'` the sheet shows "pending" instead of the amount. |

### `checkPaymentCredentialStatus`

Off by default. When `true`, `mount()` calls Apple's
`ApplePaySession.applePayCapabilities(merchantIdentifier)` and waits up to 3 s:

- `applePayUnsupported`: no button. `applePayUnavailable` fires with `APPLE_PAY_UNSUPPORTED`.
- `paymentCredentialsAvailable`, `paymentCredentialStatusUnknown` or
  `paymentCredentialsUnavailable`: the button is drawn and the value is passed on as
  `paymentCredentialStatus` in `applePayReady`.
- Any other value, a rejection, a missing method or no answer within 3 s: the button is drawn
  with no status.

When the option is off, `applePayCapabilities()` is never called and `applePayReady` carries no
status.

Apple limits when you may make this call: "You can only call this method if you want to default to
Apple Pay during your checkout flow, or if you want to add an Apple Pay button to your product
detail page." Apple's guidance for each status:

| Status | Apple's guidance |
|--------|------------------|
| `paymentCredentialsAvailable` | "Show an Apple Pay button and offer Apple Pay as the primary, but not necessarily sole, payment option." |
| `paymentCredentialStatusUnknown` | "Show an Apple Pay button and offer Apple Pay as a possible payment option." Apple returns this in browsers other than Safari, including when Apple's script runs in its sandbox environment (Apple Pay JS 1.3.5 and later). |
| `paymentCredentialsUnavailable` | "Offer Apple Pay as a payment option, but don't make it the sole or default payment option." |

In browsers other than Safari, Apple's script also reports `applePayUnsupported` for a merchant ID
or domain that Apple doesn't have registered, so with this option on the button isn't drawn there.

With the option off, Apple's script in browsers other than Safari sends an empty `merchantId` when
the payment starts. Payments still succeed: desktop Chrome with an iPhone scanning the code has
completed payments with the option off.

### `ApplePayButtonOptions`

| Field | Type | Default | What it does |
|-------|------|---------|--------------|
| `type` | `ApplePayButtonType` | `'plain'` | The label on the button: `'add-money'`, `'book'`, `'buy'`, `'check-out'`, `'continue'`, `'contribute'`, `'donate'`, `'order'`, `'pay'`, `'plain'`, `'reload'`, `'rent'`, `'subscribe'`, `'support'`, `'tip'` or `'top-up'`. `'plain'` is the Apple Pay logo only. Apple's `'set-up'` is rejected: it prompts the shopper to set up a card, not to pay. Apple says `'donate'` is for approved nonprofit organizations. |
| `style` | `ApplePayButtonStyle` | `'black'` | `'black'`, `'white'` or `'white-outline'`. Apple: black on white or light backgrounds; white on dark backgrounds; white-outline on light backgrounds without enough contrast. |
| `locale` | `string` | Apple's default: the browser's language and region | One of Apple's button locales, such as `'en-US'`. Not checked by the SDK. |
| `width` | `string` | `'100%'` | A CSS length. A px value below Apple's minimum (100px for `'plain'`, 140px for other types) is raised to it, with a warning. Other units pass unchanged. |
| `height` | `string` | `'44px'` | A CSS length. A px value below 30px, Apple's minimum, is raised to 30px, with a warning. |
| `borderRadius` | `string` | Apple's 4px | A CSS length. |
| `padding` | `string` | Apple's 0 | Padding on each side of the button. |
| `boxSizing` | `string` | | A CSS `box-sizing` value, e.g. `'border-box'`. |

Every string option must be non-empty when set. These options are read once, at `mount()`. To
change them, `destroy()` the instance and construct a new one.

The SDK's warnings, here and elsewhere in this reference, go through its logger. Production builds
print nothing to the browser console and send the warnings to Spreedly, so you won't see them
yourself: check your configuration against the rules in this reference.

### Contacts

`ApplePayContactField` is `'postalAddress' | 'name' | 'phoneticName' | 'phone' | 'email'`. An
unknown value in `requiredBillingContactFields` or `requiredShippingContactFields` throws. Apple
returns the shopper's name with a requested postal address.

`ApplePayPaymentContact` is Apple's contact object. Every field is optional:

| Field | Type |
|-------|------|
| `givenName`, `familyName` | `string` |
| `phoneticGivenName`, `phoneticFamilyName` | `string` |
| `emailAddress`, `phoneNumber` | `string` |
| `addressLines` | `string[]` |
| `locality`, `subLocality` | `string` |
| `administrativeArea`, `subAdministrativeArea` | `string` |
| `postalCode`, `country`, `countryCode` | `string` |

For the prefilled `billingContact` and `shippingContact`, an unknown key throws (so a typo such as
`email` for `emailAddress` is caught), and so does a value of the wrong type. The error message
names the key, never the value. Prefilled contacts go to Apple only: they never appear in an SDK
event, a log line, telemetry or the request to Spreedly. What Spreedly receives comes from the
contacts Apple returns after the shopper approves.

### Recurring payments

`ApplePayRecurringPaymentRequest` asks Apple for a merchant token. Apple: "Apple Pay issues an
Apple Pay Merchant Token if the user's payment network supports merchant-specific payment tokens.
Otherwise, Apple Pay issues a device token for the payment request." The SDK passes the object to
Apple unchanged. Setting it makes the SDK require Apple Pay JS version 14; an older browser gets
`UNSUPPORTED_VERSION`.

| Field | Type | Required | Rule |
|-------|------|----------|------|
| `paymentDescription` | `string` | Yes | Not empty. Shown in the sheet. |
| `regularBilling` | `ApplePayRecurringLineItem` | Yes | Checked with the [line item](#applepaylineitem) rules. |
| `managementURL` | `string` | Yes | Not empty. Apple: a page where the shopper can update or delete the payment method. |
| `trialBilling` | `ApplePayRecurringLineItem` | No | Not checked. |
| `billingAgreement` | `string` | No | Not checked. Apple's maximum is 500 characters. |
| `tokenNotificationURL` | `string` | No | Not checked. Apple sends merchant-token life-cycle notifications here. |

`ApplePayRecurringLineItem` is an `ApplePayLineItem` plus `paymentTiming` (set it to
`'recurring'`; Apple requires it), and Apple's optional `recurringPaymentStartDate` and `recurringPaymentEndDate` (`Date`),
`recurringPaymentIntervalUnit` (`'year' | 'month' | 'day' | 'hour' | 'minute'`) and
`recurringPaymentIntervalCount` (`number`). Apple says `regularBilling` and `trialBilling` must set
`paymentTiming: 'recurring'` "to avoid an error"; the SDK doesn't check it.

When you set `recurringPaymentRequest` and the result is still a device token
(`isMerchantToken: false`), the SDK logs a warning that later
charges you start without the shopper may be declined. The payment still succeeds, and no event
carries the warning.

### Apple Pay JS version

You can't set the Apple Pay JS version. At `mount()` the SDK picks the highest version the browser
supports from 15, 14, 12, 4 and 3, but uses 15 only when a network you listed needs it. The chosen
version must be at least what the config needs: 14 with `recurringPaymentRequest`, 4 with a zero
`total`, otherwise 3. Every tap of the instance uses that version.

Each network needs a minimum version, from Apple's supported networks table. A listed network the
chosen version is too old for is left out of the request and the button is still drawn; the SDK
logs a warning only when you set `supportedNetworks` yourself. If no listed network is left,
`mount()` reports `UNSUPPORTED_VERSION`.

### How the SDK talks to Apple's sheet

- The payment request holds only the fields above. A field you don't set is left out rather than
  sent empty.
- When the shopper picks another card in the sheet, the SDK answers Apple's
  `onpaymentmethodselected` at once with the total the sheet opened with. The total can't change
  while the sheet is open.
- The SDK tells Apple the result with `completePayment()`: success, or failure with Apple errors
  that keep the sheet open (see [Event order](#event-order)).

---

## Merchant callbacks

A synchronous throw from any of these callbacks is treated the same as a rejected promise.

| Callback | Called | Must settle within | On throw, reject or bad return |
|----------|--------|--------------------|--------------------------------|
| `onValidateMerchant` | Once per tap, when Apple asks | 20 s | `MERCHANT_VALIDATION_FAILED` (or `_TIMEOUT`); the SDK closes the sheet |
| `getAuthDetails` | Once per approval, before each Spreedly call | 20 s, shared with the Spreedly call | `AUTH_DETAILS_FAILED`; the sheet stays open |
| `processPayment` | Once per approval, after Spreedly returns the token | 120 s | `PAYMENT_PROCESSING_FAILED` (or `_TIMEOUT`); the SDK closes the sheet |

The 20 s limits are SDK choices under the 30 s Apple allows. Apple's TN3174: "each event handler
has a thirty (30) second timeout. If the related completion method is not invoked within 30
seconds from the start of the event, the payment sheet will dismiss with an error."

### `onValidateMerchant`

```js
onValidateMerchant: ({ validationURL }) =>
  fetch('/api/apple-pay/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ validationURL }),
  }).then(res => {
    if (!res.ok) throw new Error('Merchant validation failed');
    return res.json();
  }),
```

- Receives `ApplePayValidateMerchantRequest`: `{ validationURL }`, the value from Apple's
  `onvalidatemerchant` event.
- Your server requests a merchant session from Apple. Before it does, it must check that
  `validationURL` is HTTPS and that its host is one of Apple's validation hosts, and reject anything
  else; see [Merchant validation](./INTEGRATION_GUIDE.md#21-merchant-validation). Resolve with Apple's merchant session
  object, unchanged and parsed (an object, not a JSON string). The SDK passes it to Apple's
  `completeMerchantValidation()` without reading, logging, emitting or storing it.
- Apple: a merchant session can be used once and "expires five minutes after it is created", so
  request a new one for each transaction.
- Resolving with something that isn't a non-null object, throwing or rejecting gives
  `MERCHANT_VALIDATION_FAILED`. Taking longer than 20 s gives `MERCHANT_VALIDATION_TIMEOUT`, and a
  session that arrives later is ignored. In both cases the SDK closes the sheet with `abort()`, no
  `applePayCancelled` follows, and the button works again.
- If the shopper closes the sheet while your callback is running, the session that arrives later
  is not passed to Apple.

### `getAuthDetails`

```js
getAuthDetails: () => fetch('/api/spreedly/auth-params').then(res => res.json()),
```

- Called after each approval and before each call to Spreedly, never at tap time. A second
  approval in the same sheet calls it again.
- Resolve with `AuthDetails`: `environment_key`, `certificate_token`, `nonce`, `signature` and
  `timestamp`, all non-empty, signed by your server. `environment_key` must be the config's
  `environmentKey`.
- Return a new set every time. Spreedly accepts each nonce once, even when the request fails: a
  reused nonce gets `401 errors.replayed_tokenization_nonce`. Spreedly's docs: "Your `timestamp`
  and `nonce` will expire after 30 minutes."
- Throwing, rejecting, resolving with a missing or empty field or a different `environment_key`,
  or not resolving before the 20 s limit gives `AUTH_DETAILS_FAILED`. Spreedly is not called, and
  the sheet stays open so the shopper can approve again.

### `processPayment`

Optional. Without it, the SDK tells Apple the payment succeeded as soon as Spreedly returns a
token, so the sheet shows success before you charge. With it, you charge while the sheet is open
and the sheet shows your result.

```js
processPayment: async ({ token }) => {
  const res = await fetch('/api/orders/pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (res.ok) return { success: true };
  return { success: false, message: 'Your card was declined.' };
},
```

- Receives the [`ApplePayTokenResult`](#applepaytokenresult) (without `sheetClosedEarly`).
- Resolve with `ApplePayPaymentOutcome`:
  - `{ success: true }`: the sheet shows success, then `applePayTokenGenerated` fires. You have
    already charged the token, so don't charge it again in your `applePayTokenGenerated` handler.
  - `{ success: false, errors?: ApplePaySheetError[], message?: string }`: a decline.
    `applePayError` fires with `PAYMENT_DECLINED`, and the sheet stays open so the shopper can
    approve again. The next approval gets new auth details, a new token and a new
    `processPayment` call.
- Throwing, rejecting, or resolving with anything else (including a decline with invalid `errors`)
  gives `PAYMENT_PROCESSING_FAILED`. Taking longer than 120 s gives `PAYMENT_PROCESSING_TIMEOUT`,
  and a later result is ignored. In both cases the charge may have happened, so the SDK closes
  the sheet with `abort()` to stop a second approval. Check your order state.

On a decline, `message` is the reason for the shopper. It becomes the `applePayError` message
(trimmed; without one, "The payment was declined."). When `errors` is empty or missing, the SDK
puts `message` in the sheet as an Apple `unknown` error. When `errors` is set, the sheet gets only
the `errors`. The SDK never sends `message` to telemetry.

In Chrome with an iPhone scanning the code, the sheet shows only that the payment failed, not the
`message`. In Mac Safari, confirmed on an iPhone, the sheet shows Apple's own "Try Again", not the
`message`. Show it on your page from `applePayError`.

`ApplePaySheetError` points Apple's sheet at what's wrong:

| Field | Type | Values |
|-------|------|--------|
| `code` | `ApplePaySheetErrorCode` | `'shippingContactInvalid'`, `'billingContactInvalid'`, `'addressUnserviceable'`, `'unknown'` |
| `contactField` | `ApplePaySheetErrorContactField` | Optional. `'phoneNumber'`, `'emailAddress'`, `'name'`, `'phoneticName'`, `'postalAddress'`, `'addressLines'`, `'locality'`, `'subLocality'`, `'postalCode'`, `'administrativeArea'`, `'subAdministrativeArea'`, `'country'`, `'countryCode'` |
| `message` | `string` | Optional. |

```js
return {
  success: false,
  errors: [{ code: 'shippingContactInvalid', contactField: 'postalCode', message: 'We do not ship to this postal code.' }],
};
```

In a device test (Chrome, iPhone scanning the code), a decline with `addressUnserviceable` on the shipping `postalAddress` pointed the sheet at the address, and the shopper could edit it and pay, although the SDK has no contact-change handler.

If Apple closes the sheet while `processPayment` is running, `applePaySheetClosedEarly` fires and
the SDK keeps waiting for your result (up to 120 s). It then reports it without touching the sheet:
`applePayTokenGenerated` with `sheetClosedEarly: true`, or a final `applePayError`. No
`applePayCancelled` fires. Apple's `onpaymentauthorized` reference says the page must call
`completePayment` "before the 30 second timeout, after which a message appears stating that the
payment couldn't be completed."

In device tests (Chrome with an iPhone scanning the code, and Mac Safari), a 40-second `processPayment` made Apple close the sheet at 30 seconds; `applePaySheetClosedEarly` fired then, and the result arrived later with `sheetClosedEarly: true`.

---

## Events

Register with `applePay.on(name, callback)`. In Express Checkout, register on the Express Checkout
instance instead.

| Event | Payload | Fires when |
|-------|---------|-----------|
| `applePayReady` | `ApplePayReadyPayload` | `mount()` drew the button. |
| `applePayUnavailable` | `ApplePayUnavailablePayload` | `mount()` drew nothing. Offer your other payment methods. |
| `applePayButtonClicked` | `undefined` | The shopper tapped and the sheet is opening. Once per tap. |
| `applePayPaymentAuthorized` | `ApplePayPaymentSummary` | The shopper approved in the sheet; auth and tokenization are starting. Fires again for each approval in the same sheet. There's no token yet, so use it only to update your page. |
| `applePayTokenGenerated` | `ApplePayTokenResult` | The payment finished with a Spreedly payment method. Without `processPayment`, after Spreedly returned the token; with it, after it resolved `{ success: true }`. |
| `applePayCancelled` | `undefined` | The shopper closed the sheet before success. Not an error; the button works again. |
| `applePaySheetClosedEarly` | `undefined` | Only with `processPayment`: Apple closed the sheet while it was running. The real result follows. At most once per payment. |
| `applePayError` | `ApplePayError` | Any failure. See [Error codes](#error-codes). |

The event names are plain strings. The constant objects the SDK uses internally
(`ApplePayErrorCodes` and the like) are not on `window` in either bundle.

### Event order

A successful tap without failures fires `applePayButtonClicked`, then `applePayPaymentAuthorized`,
then `applePayTokenGenerated`.

Each tap ends with one final outcome: `applePayTokenGenerated`, `applePayCancelled`, or a final
`applePayError`. These errors are not final: `AUTH_DETAILS_FAILED`, `TOKENIZATION_FAILED`,
`TOKENIZATION_TIMEOUT`, and `PAYMENT_DECLINED` while the sheet is open. For those, the SDK tells
Apple the approval failed with Apple's `unknown` error, which Apple documents as one after which
"The user can attempt authorization again". The sheet stays open, each failed approval emits its
own `applePayError`, and the tap ends later with one of the final outcomes.

In device tests (Chrome with an iPhone scanning the code, and Mac Safari), the sheet stayed open after a failed `getAuthDetails` and the second approval succeeded.

If the browser has no `window.ApplePayError`, the SDK can't keep the sheet open after a failure:
the failure becomes final, you get one `applePayError`, and the button works again.

`applePayCancelled` fires when the shopper closes the sheet during merchant validation, before
approving, or after a failed approval.

If the sheet closes while the SDK is getting auth details and calling Spreedly, you get a final
`applePayError` with `SHEET_CLOSED_BEFORE_CHARGE` instead, as in Spreedly's iOS SDK. The shopper
can't close the sheet then (in Chrome with an iPhone scanning the code and in Mac Safari, its Cancel
button is disabled), so Apple closed it, for example at its 30-second limit. Nothing was charged. A
token that arrives later is dropped and never emitted, but a payment method may still have been
created at Spreedly.

`applePayCancelled` does not fire after `destroy()`, after the SDK closed the sheet itself
(merchant validation or `processPayment` failure), or while `processPayment` is running (then
`applePaySheetClosedEarly` fires).

### `ApplePayReadyPayload`

`{ paymentCredentialStatus?: ApplePayPaymentCredentialStatus }`. The field is present only with
`checkPaymentCredentialStatus: true`, and only when Apple answered within 3 s with
`'paymentCredentialsAvailable'`, `'paymentCredentialStatusUnknown'` or
`'paymentCredentialsUnavailable'`.

### `ApplePayUnavailablePayload`

`{ reason: ApplePayUnavailableReason }`. See [Unavailable reasons](#unavailable-reasons).

### `ApplePayPaymentSummary`

The `applePayPaymentAuthorized` payload. Display data from Apple only; it never holds the
encrypted token. Fields Apple didn't send are left out.

| Field | Type | Source |
|-------|------|--------|
| `displayName` | `string` | Apple's `paymentMethod.displayName` |
| `cardNetwork` | `string` | Apple's `paymentMethod.network` |
| `paymentMethodType` | `'debit' \| 'credit' \| 'prepaid' \| 'store'` | Apple's `paymentMethod.type` |
| `billingContact` | `ApplePayPaymentContact` | As Apple returned it |
| `shippingContact` | `ApplePayPaymentContact` | As Apple returned it |

### `ApplePayTokenResult`

The `applePayTokenGenerated` payload, also passed to `processPayment`. All the
`ApplePayPaymentSummary` fields, plus:

| Field | Type | Description |
|-------|------|-------------|
| `token` | `string` | The Spreedly payment method token. Send it to your server. |
| `cardType` | `string` | Spreedly's `card_type`, e.g. `'visa'`. Left out when Spreedly doesn't return it. |
| `last4` | `string` | Spreedly's `last_four_digits`, when returned: the last four digits of the device account number Apple created for the card, not of the card itself. Wallet shows the card's own digits, so for display prefer `displayName` (for example "MasterCard 1234"). |
| `isMerchantToken` | `boolean` | Always present. `true` when Apple issued a merchant token, which you can charge for later merchant-initiated payments; `false` for a device token. |
| `merchantTokenIdentifier` | `string` | `mpan_metadata.merchant_token_identifier`, when there is one. |
| `mpanMetadata` | `Record<string, unknown>` | Spreedly's `mpan_metadata`, when it isn't empty. Spreedly returns `{}` for a device token, and the SDK then leaves this out. Use `isMerchantToken` to tell the token type. |
| `paymentMethod` | `Record<string, unknown>` | Spreedly's payment method as returned, unfiltered. Card numbers are masked, but it can hold the shopper's name, addresses, email and phone. |
| `sheetClosedEarly` | `boolean` | Only on `applePayTokenGenerated`, and only when Apple closed the sheet before `processPayment` returned; then it is `true`. |

`isMerchantToken` is `true` only when `mpan_metadata.merchant_token_identifier` is a non-blank
string.

With `testCardNumber` set, `cardType` and `last4` describe that test number, not the card in Wallet:
Spreedly uses the test number in place of the one in Apple's payment data.

### `ApplePayError`

```ts
{ code: ApplePayErrorCode; message: string; details?: unknown }
```

`details` is one of:
- `{ name, message }` of the thrown `Error`, for `SESSION_FAILED`, `MERCHANT_VALIDATION_FAILED`,
  `AUTH_DETAILS_FAILED` and `PAYMENT_PROCESSING_FAILED`. Left out when the thrown value isn't an
  `Error`.
- A sanitized Spreedly error `{ message, status?, errors? }`, for `TOKENIZATION_FAILED`. `status`
  is the HTTP status and `errors` is Spreedly's array of `{ key, message }`.
- Left out for the `*_TIMEOUT` codes, for `AUTH_DETAILS_FAILED` when `getAuthDetails` ran past
  20 s, and for `PAYMENT_DECLINED`, `MOUNT_FAILED`, `API_NOT_LOADED` and `DEVELOPER_ERROR`.

No payload holds Apple's encrypted payment data, the merchant session or your auth details.

---

## Error codes

| Code | When | Sheet | What to do |
|------|------|-------|------------|
| `API_NOT_LOADED` | `mount()`: `<apple-pay-button>` not registered within 10 s, or no `window.ApplePaySession`. Fires after `applePayUnavailable`. | Not open | Load `apple-pay-sdk.js` on the page and allow `applepay.cdn-apple.com` in your Content Security Policy. |
| `MOUNT_FAILED` | `mount()`: no element with id `containerId` after the checks passed. | Not open | Render the container before the checks finish; check the id. `mount()` can be called again. |
| `SESSION_FAILED` | A tap: Apple's `ApplePaySession` constructor or `begin()` threw. | Not open | See `details`. The button stays usable. |
| `MERCHANT_VALIDATION_FAILED` | `onValidateMerchant` threw, rejected, or resolved with something other than an object. | Closed by the SDK | See `details` and your server's call to Apple. Final for this tap. |
| `MERCHANT_VALIDATION_TIMEOUT` | `onValidateMerchant` took longer than 20 s. | Closed by the SDK | Final for this tap. |
| `AUTH_DETAILS_FAILED` | `getAuthDetails` threw, rejected, returned incomplete auth or auth for a different `environment_key`, or didn't resolve within 20 s. | Stays open | Fix your auth endpoint. The shopper can approve again. |
| `TOKENIZATION_FAILED` | The call to Spreedly failed, or its response had no payment method token. | Stays open | Read `details.errors[].key`. The shopper can approve again. |
| `TOKENIZATION_TIMEOUT` | The 20 s limit ran out while the SDK was waiting for Spreedly. A late reply is ignored. | Stays open | A payment method may still have been created. The shopper can approve again. |
| `SHEET_CLOSED_BEFORE_CHARGE` | The sheet closed while the SDK was getting auth details or calling Spreedly, for example at Apple's 30 s limit. A late reply is ignored. | Closed | Nothing was charged; a payment method may still have been created. Final; the shopper can tap the button again. |
| `PAYMENT_DECLINED` | `processPayment` resolved `{ success: false }`. `message` is yours, or "The payment was declined." | Stays open if Apple hasn't closed it; otherwise final | The shopper can approve again while the sheet is open. |
| `PAYMENT_PROCESSING_FAILED` | `processPayment` threw, rejected, or resolved with an invalid outcome. | Closed by the SDK | The charge may have happened; check your order state. Final. |
| `PAYMENT_PROCESSING_TIMEOUT` | `processPayment` took longer than 120 s. A late result is ignored. | Closed by the SDK | The charge may have happened; check your order state. Final. |
| `DEVELOPER_ERROR` | Express Checkout only: the `applePay` option failed the constructor's checks. `message` is the constructor's message. | Not open | Fix the config. `applePayUnavailable` follows. |

After a final error, the shopper can tap the button again.

Error keys we have seen from Spreedly for Apple Pay include `errors.apple_pay.certificate_not_found`,
`errors.apple_pay.decryption_failed`, `errors.apple_pay.json_invalid`,
`errors.missing_tokenization_parameters`, `errors.invalid_tokenization_signature` and
`errors.replayed_tokenization_nonce`. This is not a complete list.

### Unavailable reasons

`applePayUnavailable` carries one of these. `mount()` resolves `{ error }` with the message shown.

| Reason | When | `error` message |
|--------|------|-----------------|
| `API_NOT_LOADED` | `<apple-pay-button>` not registered within 10 s, or no `window.ApplePaySession`. `applePayError` follows. | "Apple's JS SDK script did not load. Add apple-pay-sdk.js to the page and allow applepay.cdn-apple.com in your Content Security Policy." |
| `INSECURE_CONTEXT` | The page isn't served over HTTPS, including plain-HTTP `localhost`. | "Apple Pay needs a page served over HTTPS." |
| `CANNOT_MAKE_PAYMENTS` | `ApplePaySession.canMakePayments()` returned `false` or threw. | "This device or browser cannot use Apple Pay." |
| `UNSUPPORTED_VERSION` | The browser doesn't support the version the config needs (4 for a zero total, 14 for `recurringPaymentRequest`), or supports none of the listed networks. | "This browser does not support the Apple Pay version this configuration needs." |
| `APPLE_PAY_UNSUPPORTED` | Only with `checkPaymentCredentialStatus: true`: Apple's `applePayCapabilities()` answered `applePayUnsupported`. | "Apple Pay is not supported here." |
| `DEVELOPER_ERROR` | Express Checkout only: invalid `applePay` option. Follows `applePayError`. | Not returned by `mount()` |

---

## What the SDK sends to Spreedly

After each approval the SDK posts to `https://core.spreedly.com/v1/payment_methods.json` from your
page, with the header `spreedly-environment-key` and this JSON body:

- The five `AuthDetails` fields from `getAuthDetails`, at the top level.
- `payment_method.apple_pay.payment_data`: Apple's encrypted `paymentData`, unchanged.
- `payment_method.apple_pay.test_card_number`: `testCardNumber` without spaces, when set.
- `payment_method.apple_pay`: the contact fields below, when Apple returned them.
- `payment_method.email`: the billing `emailAddress`, else the shipping one.
- `payment_method.metadata`: your `metadata`, when not empty.
- `payment_method.from`: `web/fields` from the Hosted Fields bundle, `web/form` from Express
  Checkout.
- `payment_method.v`: the SDK version.

`merchantIdentifier` and the prefilled contacts are never sent. Contact values are trimmed and
blank ones are left out.

| Spreedly field (inside `apple_pay`) | From Apple's contacts |
|-------------------------------------|-----------------------|
| `first_name`, `last_name` | Billing `givenName`, `familyName`; the shipping name when billing has neither |
| `address1`, `address2` | Billing `addressLines`: the first line, then the rest joined with `', '` |
| `city`, `state`, `zip` | Billing `locality`, `administrativeArea`, `postalCode` |
| `country` | Billing `countryCode` in uppercase, else `country` |
| `phone_number` | Billing `phoneNumber`, else shipping `phoneNumber` |
| `shipping_address1`, `shipping_address2`, `shipping_city`, `shipping_state`, `shipping_zip`, `shipping_country` | The same rules, from the shipping contact |
| `shipping_phone_number` | Shipping `phoneNumber` |

The SDK sends every field Apple returns. In real web payments, Spreedly stored the name, billing
address, phone and shipping phone on the payment method, and the email. What Spreedly does with the
fields after that, such as passing them to a gateway, is Spreedly's behaviour, not the SDK's.

---

## In Express Checkout

`SpreedlyExpressCheckout` draws Apple Pay above its card form when `expressCheckout()` gets an
`applePay` option. It creates, mounts and destroys the `SpreedlyApplePay` instance itself. The
Express Checkout bundle also exposes `window.SpreedlyApplePay` if you prefer to place the button
yourself.

```js
const sdk = new window.SpreedlyExpressCheckout(authDetails);
sdk.on('applePayTokenGenerated', ({ token }) => {
  // Send token to your server.
});
sdk.expressCheckout({
  parentContainerId: 'payment-container',
  applePay: {
    merchantIdentifier: 'merchant.com.example',
    countryCode: 'US',
    currencyCode: 'USD',
    total: { label: 'Example Shop', amount: '42.00' },
    onValidateMerchant: ({ validationURL }) =>
      fetch('/api/apple-pay/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validationURL }),
      }).then(res => {
        if (!res.ok) throw new Error('Merchant validation failed');
        return res.json();
      }),
    getAuthDetails: () => fetch('/api/spreedly/auth-params').then(res => res.json()),
  },
});
```

| API | Description |
|-----|-------------|
| `expressCheckout({ applePay })` | `ExpressCheckoutApplePayConfig`: an [`ApplePayConfig`](#applepayconfig) without `environmentKey`, which comes from the Express Checkout instance's auth details and overrides any value you pass. `getAuthDetails` is still required: Apple Pay can't share the card form's auth details, because Spreedly accepts each nonce once. Works in embedded mode (`parentContainerId`) and dialog mode. |
| Invalid `applePay` | Doesn't throw. The card form mounts without Apple Pay, an error is logged, and the instance emits `applePayError` with `DEVELOPER_ERROR` and then `applePayUnavailable` with `DEVELOPER_ERROR`, both during `expressCheckout()`. Register handlers before calling it. |
| `setApplePayTotal(update)` | Same as [`setTotal()`](#settotalupdate-void), and keeps the total for the next `expressCheckout()` call. Throws if `update` is invalid, even before the button exists. Logs a warning and does nothing without an `applePay` option. |
| `on('applePay…', callback)` | All eight [events](#events), with the same payloads, emitted by the Express Checkout instance. Events from an Apple Pay instance that was replaced or torn down are not passed on. Card tokens still arrive on `tokenGenerated`. |
| `updateAuthDetails()` | Doesn't affect Apple Pay, which calls `getAuthDetails` for every approval. |
| `submitParams`, `updateSubmitParams()` | Card tokens only. `applePay.metadata` is the only metadata on Apple Pay payment methods. |
| `updateTextElement('walletDividerText', text)` | Changes the divider under the wallet buttons. Default: "or pay with card". Also settable as `uiConfig.textConfig.walletDividerText`. |
| `close()`, `close(true)`, a successful `setRecache()`, another `expressCheckout()` call | Destroy the Apple Pay instance and remove its button. Closing during a payment aborts Apple's sheet, and no event fires for it. |

Where the button goes: Express Checkout puts a wallet row on your page, above the card-form
iframe (never inside it). The row holds Apple Pay first, then Google Pay if configured, then the
divider. The Apple Pay slot has the id `spreedly-ec-apple-pay-<n>` and a minimum height of 44px.
The row and the slot stay hidden until `applePayReady`; Express Checkout shows them before passing
`applePayReady` on to you. On `applePayUnavailable` or a `mount()` error the Apple Pay slot is
removed, and the row goes when no wallet is left. The card form stays.

The row takes its background from `uiConfig.styles.paper.backgroundColor`, its font from
`uiConfig.styles.typography.fontFamily`, and the divider colour from
`uiConfig.styles.typography.elements.body2.color`.

In dialog mode, while an Apple Pay payment runs, Express Checkout lowers the dialog's z-index to
`2147483646` so Apple's window stays above it, and restores it afterwards.

---

## TypeScript types

Both bundles re-export these Apple Pay types:

`ApplePayButtonOptions`, `ApplePayButtonStyle`, `ApplePayButtonType`, `ApplePayConfig`,
`ApplePayContactField`, `ApplePayError`, `ApplePayErrorCode`, `ApplePayLineItem`,
`ApplePayLineItemType`, `ApplePayMountResult`, `ApplePayPaymentContact`,
`ApplePayPaymentCredentialStatus`, `ApplePayPaymentMethodType`, `ApplePayPaymentOutcome`,
`ApplePayPaymentSummary`, `ApplePayReadyPayload`, `ApplePayRecurringLineItem`,
`ApplePayRecurringPaymentRequest`, `ApplePaySheetError`, `ApplePaySheetErrorCode`,
`ApplePaySheetErrorContactField`, `ApplePayShippingType`, `ApplePayTokenResult`,
`ApplePayTotalUpdate`, `ApplePayUnavailablePayload`, `ApplePayUnavailableReason`,
`ApplePayValidateMerchantRequest`.

Express Checkout also exports `ExpressCheckoutApplePayConfig`.
