# Migration Guide — Legacy iFrame SDK → Checkout Web SDK

A side-by-side API map for merchants moving from the legacy `Spreedly.*` iFrame
library to the new Checkout Web SDK (`SpreedlyHostedFields` /
`SpreedlyExpressCheckout`).

**Conventions used in this doc**

- ✅ — direct equivalent
- ⚠️ — equivalent exists but the signature, event name, or payload changed
- 🆕 — new in Checkout Web SDK (no legacy counterpart)

---

## TL;DR — minimum changes to migrate

If your legacy integration only uses `init` + a few field setters + `tokenizeCreditCard`,
the migration is small. In order:

1. Swap the [script tag](#script-tag).
2. Replace `Spreedly.init(envKey, { nonce, timestamp, certificateToken, signature, numberEl, cvvEl })`
   with `new SpreedlyHostedFields({...})` + `sdk.inAppElements({...})` —
   see [Initialization & lifecycle](#initialization--lifecycle).
3. Rename event handlers:
   - `Spreedly.on('paymentMethod', cb)` → `sdk.on('tokenGenerated', cb)`
     **payload changed** (now `{ message, tokenResponse: { token, succeeded, payment_method } }`).
   - `Spreedly.on('errors', cb)` → `sdk.on('error', cb)` **payload changed**
     (now an object `{ message, errors? }`).
   - See [Events](#events) for the full list.
4. Replace `Spreedly.tokenizeCreditCard()` with `sdk.submit(formData, submitParams)` —
   see [Tokenization (submit)](#tokenization-submit).
5. Move `Spreedly.setParam(...)` calls inline:
   - Cardholder / billing / shipping fields (`first_name`, `address1`, `shipping_*`, `eligible_for_card_updater`, …)
     → `formData` (typed [`HostedFieldsFormData`](#typed-formdata-surface)).
   - Flags (`metadata`, `allow_blank_name`, `allow_blank_date`, `allow_expired_date`)
     → `submitParams`.

If you also used `setRecache` / `recache`, see [Recaching](#recaching).
If you used 3DS, see [3DS — Global / Forter](#3ds--global--forter).

---

## Table of Contents

1. [Script tag](#script-tag)
2. [Initialization & lifecycle](#initialization--lifecycle)
3. [Field configuration](#field-configuration)
4. [Tokenization (submit)](#tokenization-submit)
5. [Recaching](#recaching)
6. [Events](#events)
7. [3DS — Global / Forter](#3ds--global--forter)
8. [3DS — Gateway-Specific](#3ds--gateway-specific)
9. [Offsite payments — PayPal & redirect-style](#offsite-payments--paypal--redirect-style)
10. [Offsite payments — Stripe APM](#offsite-payments--stripe-apm)
11. [Offsite payments — Braintree (PayPal/Venmo)](#offsite-payments--braintree-paypalvenmo)
12. [ACH payments 🆕](#ach-payments-)
13. [Express Checkout 🆕](#express-checkout-)
14. [Not yet migrated](#not-yet-migrated)

---

## Script tag

| Legacy iFrame | Checkout Web SDK |
|---|---|
| `<script src="https://core.spreedly.com/iframe/iframe-v1.min.js">` | `<script src="https://core.spreedly.com/checkout/sdk/{version}/index.js">` (Hosted Fields) |
| `<script src="https://core.spreedly.com/iframe/express-3.min.js">` | `<script src="https://core.spreedly.com/checkout/elements/{version}/express-checkout.js">` (Express Checkout) |

Reference: `web-sdk-sample-app/src/static/shared/utils.js` (`getSDKScriptUrl`)

---

## Initialization & lifecycle

| Legacy iFrame | Checkout Web SDK | Status | Notes |
|---|---|---|---|
| `Spreedly.init(envKey, { nonce, timestamp, certificateToken, signature, numberEl, cvvEl })` | `new SpreedlyHostedFields({ environment_key, nonce, timestamp, certificate_token, signature })` + `sdk.inAppElements({ number: { containerId }, cvv: { containerId } })` | ⚠️ | Auth fields are now snake_case and passed to the constructor; iframe mount is a separate explicit call. `data-environment-key` / `data-number-id` / `data-cvv-id` HTML attributes are no longer used. |
| _(global singleton `Spreedly`)_ | _(per-instance `sdk`)_ | ⚠️ | The new SDK is class-based; you can hold multiple instances. |
| `Spreedly.unload()` | `sdk.destroy()` | ⚠️ | Renamed. Removes the iframes, clears `on()` callbacks, and emits `'close'`. Idempotent. After destroy, other SDK methods no-op with a warning. |
| `Spreedly.reload()` | `sdk.reload()` | ✅ | Same name. Internally tears down current iframes and re-mounts using the same `inAppElements()` config; merchant `on('ready', …)` callbacks fire again. |
| `Spreedly.removeHandlers()` | `sdk.removeHandlers()` | ✅ | Same name; clears all callbacks registered via `on()`. |
| `Spreedly.isLoaded()` | `sdk.isLoaded()` | ✅ | Same name; returns `true` if iframes are mounted and the instance hasn't been destroyed. The `'ready'` event is still the recommended entry point. |

Reference: `web-sdk-sample-app/src/static/purchase/purchase.js`,
`web-sdk-sample-app/src/static/tokenize/tokenize.js`

---

## Field configuration

All of these are **Hosted Fields only** in the new SDK; Express Checkout
manages its own UI via `sdk.expressCheckout({...})` configuration
(see [Express Checkout](#express-checkout-)).

| Legacy iFrame | Checkout Web SDK | Status | Notes |
|---|---|---|---|
| `Spreedly.setPlaceholder(field, text)` | `sdk.setPlaceholder('number' \| 'cvv', text)` | ✅ | |
| `Spreedly.setStyle(field, css)` (CSS string) | `sdk.setStyles('number' \| 'cvv', { fontSize, color, ... })` (object) | ⚠️ | Renamed (`setStyle` → `setStyles`); pass a plain object of camelCase CSS properties instead of a CSS string. |
| `Spreedly.setFieldType(field, type)` | `sdk.setFieldType('number' \| 'cvv', 'text' \| 'tel' \| 'number' \| 'password')` | ✅ | |
| `Spreedly.setLabel(field, value)` | `sdk.setLabel('number' \| 'cvv', value)` | ✅ | Sets `aria-label` on the hosted input. HTML-like tags are stripped (same as legacy). |
| `Spreedly.setTitle(field, value)` | `sdk.setTitle('number' \| 'cvv', value)` | ✅ | Sets the `title` attribute on the hosted input. |
| `Spreedly.setInputMode(field, value)` | `sdk.setInputMode('number' \| 'cvv', value)` | ✅ | Allowed: `'none' \| 'text' \| 'numeric' \| 'decimal' \| 'tel' \| 'search' \| 'email' \| 'url'`. |
| `Spreedly.setRequiredAttribute(field)` | `sdk.setRequiredAttribute('number' \| 'cvv', required = true)` | ⚠️ | New SDK accepts a second `required` boolean (default `true`) so you can also _remove_ the attribute. |
| `Spreedly.setNumberFormat('prettyFormat' \| 'plainFormat' \| 'maskedFormat')` | `sdk.setNumberFormat(format)` | ✅ | |
| `Spreedly.toggleAutoComplete()` | `sdk.toggleAutoComplete()` | ✅ | |
| `Spreedly.toggleMask()` | `sdk.toggleMask()` | ✅ | |
| `Spreedly.transferFocus(field)` | `sdk.transferFocus('number' \| 'cvv' \| 'iframe')` | ✅ | `'iframe'` parks focus on the iframe document (same as legacy). |
| `Spreedly.validate()` | `sdk.validate(options?)` | ⚠️ | Now async — payload arrives via `sdk.on('validation', payload => …)`. Optional `options.allow_blank_name` / `options.allow_expired_date` mirror legacy submit flags. The same `validation` event fires when `submit()` is blocked client-side (followed by `error`). For continuous live state (typing, focus, hover, keys), use `sdk.on('fieldStateChange', …)`. |
| `Spreedly.resetFields()` | `sdk.resetFields()` | ✅ | Clears both inputs. In recache mode the prefilled disabled number stays — only CVV is cleared. |
| `Spreedly.setValue('number' \| 'cvv', value)` | _(none — setting card values from the parent page is not supported)_ | ❌ | Intentionally not migrated. Hosted Fields exists to keep card values in the iframe; setting from the parent page would break PCI scope. |
| `Spreedly.setParam(name, value)` | Pass via `sdk.submit(formData, submitParams)` | ⚠️ | See [Tokenization (submit)](#tokenization-submit) — params are passed at submit time, not set ahead. |

Reference: `web-sdk-sample-app/src/static/tokenize/tokenize.js`

---

## Tokenization (submit)

> Hosted Fields. For the Express Checkout flow (single-iframe form), the merchant
> doesn't call `submit()` — see [Express Checkout — Legacy `setParam` parity](#legacy-setparam-parity)
> for how the same legacy `setParam` fields map onto `uiConfig.cardPaymentFormFields` + `submitParams`.

```js
// Legacy
Spreedly.setParam('first_name', 'John');
Spreedly.setParam('last_name',  'Doe');
Spreedly.setParam('month',      '12');
Spreedly.setParam('year',       '2028');
Spreedly.setParam('email',      'john@example.com');
Spreedly.setParam('address1',   '123 Main St');
Spreedly.setParam('shipping_city', 'Boston');
Spreedly.setParam('eligible_for_card_updater', true);
Spreedly.setParam('metadata',   { order_id: 'ORDER-123' });
Spreedly.setParam('allow_blank_name', true);
Spreedly.tokenizeCreditCard();
```

```js
// Checkout Web SDK — every legacy setParam field has a typed slot
sdk.submit(
  {
    first_name: 'John',
    last_name:  'Doe',
    month:      '12',
    year:       '2028',
    email:      'john@example.com',
    address1:   '123 Main St',
    shipping_city: 'Boston',
    eligible_for_card_updater: true,
  },
  {
    metadata: { order_id: 'ORDER-123' },
    allow_blank_name: true,
  }
);
```

| Legacy iFrame | Checkout Web SDK | Status |
|---|---|---|
| `Spreedly.tokenizeCreditCard(opts?)` | `sdk.submit(formData, submitParams?)` | ✅ |
| `Spreedly.setParam('first_name' \| 'last_name' \| 'full_name' \| 'month' \| 'year' \| 'email' \| 'address1' \| ... \| 'shipping_*', val)` | `formData` (typed `HostedFieldsFormData`; mandatory: `first_name`, `last_name`, `month`, `year`) | ✅ | Every legacy `permittedStringParams` field has a typed slot on `formData` — see [the typed `HostedFieldsFormData` surface](#typed-formdata-surface) below. Unknown keys are dropped server-side and the SDK logs a console warning listing the offending keys so typos (e.g. `address_1` vs `address1`) surface fast. |
| `Spreedly.setParam('metadata', {...})` | `submitParams.metadata` | ✅ |
| `Spreedly.setParam('allow_blank_name' \| 'allow_blank_date' \| 'allow_expired_date', true)` | `submitParams.allow_blank_name` / `submitParams.allow_blank_date` / `submitParams.allow_expired_date` | ✅ |
| `Spreedly.setParam('eligible_for_card_updater', true)` | `formData.eligible_for_card_updater` (boolean) | ✅ | Legacy boolean flag; lives on `formData` because it ends up on `payment_method.credit_card` server-side, alongside billing/shipping. |
| Token via `'paymentMethod'` event | Token via `'tokenGenerated'` event — payload is `{ message, tokenResponse: { token, succeeded, payment_method: { token, card_type, last_four_digits, ... } } }` | ✅ | Payload shape changed; see [Events](#events). |

Reference: `web-sdk-sample-app/src/static/tokenize/tokenize.js`,
`checkout-web-sdk/docs/tokenization/hosted-fields/INTEGRATION_GUIDE.md`

### Typed `formData` surface

`sdk.submit(formData, submitParams)` accepts the typed `HostedFieldsFormData` interface
exported from `@spreedly/core/types`. It mirrors the legacy `Spreedly.setParam(...)` allow-list
one-to-one:

```ts
type HostedFieldsFormData = {
  // Mandatory (matches legacy)
  first_name: string;
  last_name:  string;
  month:      string;     // 'MM'
  year:       string;     // 'YYYY'

  // Cardholder
  full_name?:    string;
  email?:        string;
  company?:      string;
  phone_number?: string;

  // Billing address
  address1?: string;
  address2?: string;
  city?:     string;
  state?:    string;
  zip?:      string;
  country?:  string;

  // Shipping address (every legacy `shipping_*` field)
  shipping_address1?:    string;
  shipping_address2?:    string;
  shipping_city?:        string;
  shipping_state?:       string;
  shipping_zip?:         string;
  shipping_country?:     string;
  shipping_phone_number?: string;

  // Legacy boolean flag (was `permittedBooleanParams` in the iframe)
  eligible_for_card_updater?: boolean;
};
```

Card number and CVV are NEVER passed here — they live exclusively in the hosted iframes
for PCI scope.

Pass any unknown key (e.g. `address_1` instead of `address1`) and the SDK logs a single
`console.warn` listing the offending keys plus the full whitelist, so typos are easy to
spot in development.

---

## Recaching

```js
// Legacy
Spreedly.setRecache('RETAINED-PM-TOKEN', { last_four_digits: '4242', card_type: 'visa' });
Spreedly.on('recacheReady', () => { /* prompt for CVV */ });
Spreedly.recache();
Spreedly.on('recache', (token, pm) => { /* success */ });
```

```js
// Checkout Web SDK (Hosted Fields)
sdk.setRecache('RETAINED-PM-TOKEN', {
  card_type: 'visa',
  last_four_digits: '4242',
  storage_state: 'retained',
  month: '12',
  year: '2028',
});
sdk.on('recacheReady', () => { /* prompt for CVV */ });
sdk.recache();
sdk.on('recacheSuccess', (response) => { /* response.payment_method... */ });
```

| Legacy iFrame | Checkout Web SDK | Status | Notes |
|---|---|---|---|
| `Spreedly.setRecache(token, { last_four_digits?, card_type? })` | `sdk.setRecache(token, RecacheOptions)` | ✅ | New SDK requires `card_type`, `last_four_digits`, `storage_state: 'retained'`, `month`, `year`. |
| `Spreedly.recache()` | `sdk.recache()` (Hosted Fields)  /  Form auto-submit (Express Checkout) | ✅ | Express Checkout handles recache submission via its own submit button — no `recache()` call needed. |
| `Spreedly.on('recacheReady', cb)` | `sdk.on('recacheReady', cb)` | ✅ |
| `Spreedly.on('recache', (token, pm) => …)` | `sdk.on('recacheSuccess', (response) => …)` | ✅ | Event renamed; payload is the recache response object. |

Reference: `web-sdk-sample-app/src/static/recache/recache.js`,
`checkout-web-sdk/docs/recaching/INTEGRATION_GUIDE.md`

---

## Events

All events are subscribed via `sdk.on(eventName, callback)`, same shape as legacy. The
**event name** and the **callback argument shape** changed for several events — those rows
are marked ⚠️.

| Legacy iFrame event | Checkout Web SDK event | Status | Notes |
|---|---|---|---|
| `'ready'` | `'ready'` | ✅ | |
| `'paymentMethod'` `(token, pm)` | `'tokenGenerated'` `(payload)` | ⚠️ | Renamed and payload changed. Payload is `{ message, tokenResponse: { token, succeeded, payment_method: { token, card_type, last_four_digits, ... } } }`. |
| `'errors'` `(errorsArray)` | `'error'` `(errorPayload)` | ⚠️ | Renamed (singular) and payload changed: a single object `{ message, errors? }` instead of an array. |
| `'validation'` `(payload)` | `'validation'` `(payload)` | ✅ | Fired in response to `sdk.validate()` and again when `submit()` is blocked client-side. Payload includes `cardType`, `validNumber`, `validCvv`, `cvvLength`, `numberLength`, `luhnValid`, `iin?`, `maskedNumber?`, `allow_blank_name?`, `allow_expired_date?`. |
| `'fieldEvent'` `(name, type, ...)` | `'fieldStateChange'` `(payload)` | ⚠️ | Renamed; single object payload. Includes the same numeric snapshot as `validation` plus `field`, `action` (`focus` \| `blur` \| `input` \| `mouseover` \| `mouseout` \| `enter` \| `escape` \| `tab` \| `shiftTab`), `focused`, `hovered?`. Opt in to PAN-prefix `iin` via `sdk.setFieldStateReporting({ includeIin: true })`. |
| `'consoleError'` `(error)` | `'consoleError'` `(payload)` | ⚠️ | Same name; payload shape is now `{ msg, url, line, col, error, field: 'number' \| 'cvv' }`. Fired when an uncaught error occurs inside one of the hosted iframes. |
| `'numberSet'` / `'cvvSet'` / `'sourceSet'` | _(none)_ | ❌ | Mirror legacy `setValue` / `source` flows that aren't supported (intentionally — see Field configuration). |
| `'recacheReady'` | `'recacheReady'` | ✅ | |
| `'recache'` `(token, pm)` | `'recacheSuccess'` `(response)` | ⚠️ | Renamed; payload is the recache response object `{ message, token, payment_method }`. |
| _(none)_ | `'cvvExpired'` (subset of `'error'`) | 🆕 | New SDK clears CVV after PCI DSS 3.2.3 TTL (3 minutes) and emits an `error` with `{ message: 'CVV expired after 3 minutes', reason: 'PCI DSS 3.2.3 TTL compliance' }`. |
| `'3ds:status'` `(event)` (single dispatcher; switch on `event.action`) | Typed callbacks on the `SpreedlyThreeDSLifecycle` constructor | ⚠️ | See [3DS](#3ds--global--forter) — replaced by `callbacks: { onChallenge, onSuccess, onError, onDeviceFingerprint?, onTriggerCompletion? }`. |
| _none_ | `'offsiteTokenGenerated'` / `'offsitePaymentError'` | 🆕 | See [Offsite payments](#offsite-payments--paypal--redirect-style). |
| _none_ | `'achTokenGenerated'` / `'achPaymentError'` | 🆕 | See [ACH payments](#ach-payments-). |

---

## 3DS — Global / Forter

```js
// Legacy
Spreedly.on('3ds:status', (event) => {
  switch (event.action) {
    case 'challenge':  /* show modal */ break;
    case 'succeeded':  /* success */    break;
    case 'error':      /* failure */    break;
  }
});
const lifecycle = new Spreedly.ThreeDS.Lifecycle({
  environmentKey,
  hiddenIframeLocation:    'device-fingerprint',
  challengeIframeLocation: 'challenge',
  transactionToken,
});
lifecycle.start();
```

```js
// Checkout Web SDK
const lifecycle = new SpreedlyThreeDSLifecycle({
  transactionToken,
  hiddenIframeLocation:    'device-fingerprint',
  challengeIframeLocation: 'challenge-container',
  environmentKey,
  callbacks: {
    onChallenge: (e) => { /* show modal */ },
    onSuccess:   (e) => { /* success */    },
    onError:     (e) => { /* failure */    },
  },
});
lifecycle.start();
```

| Legacy iFrame | Checkout Web SDK | Status | Notes |
|---|---|---|---|
| `new Spreedly.ThreeDS.Lifecycle({ environmentKey, hiddenIframeLocation, challengeIframeLocation, transactionToken, challengeIframeClasses? })` | `new SpreedlyThreeDSLifecycle({ transactionToken, hiddenIframeLocation, challengeIframeLocation, environmentKey, callbacks, challengeIframeClasses? })` | ✅ | Constructor moved to a top-level class (no `Spreedly.ThreeDS` namespace). |
| `Spreedly.on('3ds:status', handler)` (single dispatcher with `event.action`) | `callbacks: { onChallenge, onSuccess, onError, onDeviceFingerprint?, onTriggerCompletion? }` (typed callbacks) | ✅ | Replaced by named callbacks on the constructor. |
| `lifecycle.start()` | `lifecycle.start()` | ✅ |
| `Spreedly.ThreeDS.serialize(challengeWindowSize, acceptHeader)` | `serializeBrowserInfo(challengeWindowSize, acceptHeader)` (global) | ✅ | Renamed; same signature. |
| _(none)_ | `lifecycle.stop()` | 🆕 | Cancel/cleanup helper. |

Reference: `web-sdk-sample-app/src/static/purchase-with-3ds/purchase-with-3ds.js`,
`checkout-web-sdk/docs/three-ds/global/INTEGRATION_GUIDE.md`

---

## 3DS — Gateway-Specific

| Legacy iFrame | Checkout Web SDK | Status | Notes |
|---|---|---|---|
| `new Spreedly.ThreeDS.Lifecycle({ ... })` (same call; backend uses `attempt_3dsecure: true` + `three_ds_version: '2'` instead of `sca_provider_key`) | `new SpreedlyThreeDSLifecycle({ ..., callbacks: { onDeviceFingerprint, onChallenge, onSuccess, onError, onTriggerCompletion } })` | ✅ | Same lifecycle class; gateway-specific flow is driven by the backend payload (no `sca_provider_key`) and uses the additional `onDeviceFingerprint` / `onTriggerCompletion` callbacks not fired in Forter mode. |

Reference: `web-sdk-sample-app/src/static/purchase-with-3ds-gateway-specific/purchase-with-3ds-gateway-specific.js`,
`checkout-web-sdk/docs/three-ds/gateway-specific/INTEGRATION_GUIDE.md`

---

## Offsite payments — PayPal & redirect-style

The legacy approach was a **transparent-redirect HTML form** posting to
`https://core.spreedly.com/v1/payment_methods` directly. The new SDK exposes
a programmatic API that calls the same endpoint without a page navigation.

```html
<!-- Legacy: hand-built form -->
<form action="https://core.spreedly.com/v1/payment_methods" method="POST">
  <input name="environment_key" value="..." />
  <input name="payment_method_type" value="paypal" />
  <input name="redirect_url" value="https://merchant/handle-redirect" />
  ...
</form>
```

```js
// Checkout Web SDK — API flow (recommended)
sdk.on('offsiteTokenGenerated', ({ token, paymentMethodType }) => {
  // POST token to your backend → run the gateway purchase
});
sdk.on('offsitePaymentError', (err) => { /* ... */ });

sdk.setupOffsitePayment({
  paymentMethodType: 'paypal', // or 'pix', 'boleto_bancario', 'oxxo', 'nupay', ...
  email: 'customer@example.com',
  fullName: 'Ana Santos',
  // ... optional billing/contact fields
});
sdk.submitOffsitePayment();
```

| Legacy iFrame / Spreedly form | Checkout Web SDK | Status |
|---|---|---|
| Hand-built `<form action="…/v1/payment_methods" method="POST">` | `sdk.setupOffsitePayment(config)` + `sdk.submitOffsitePayment()` | ✅ |
| Transparent-redirect (browser navigates to Spreedly) | API flow (no navigation) — emits `'offsiteTokenGenerated'` with token | ✅ |
| Form-based redirect with `redirect_url` | Pass `redirectUrl` in `setupOffsitePayment` config (form submission still supported as a legacy fallback) | ✅ |
| _none_ | `sdk.clearOffsitePayment()` | 🆕 |

Reference: `web-sdk-sample-app/src/static/offsite-payments/offsite-payments.js`,
`checkout-web-sdk/docs/offsite-payments/general/INTEGRATION_GUIDE.md`

---

## Offsite payments — Stripe APM

```js
// Legacy
const element = Spreedly.createStripePaymentElement({
  publishableKey,
  clientSecret,
  transactionToken,
  paymentElement: '#payment-element',
  appearance,
});
element.confirmPayment();
```

```js
// Checkout Web SDK
const stripeApm = new SpreedlyStripeAPM({
  publishableKey,
  clientSecret,
  transactionToken,
  paymentElement: 'stripe-payment-element', // element ID, not selector
  appearance,
});
stripeApm.mount();
await stripeApm.confirmPayment();
```

| Legacy iFrame | Checkout Web SDK | Status | Notes |
|---|---|---|---|
| `Spreedly.createStripePaymentElement(opts)` | `new SpreedlyStripeAPM(opts)` | ✅ | OO API. |
| _(implicit mount inside the call above)_ | `stripeApm.mount()` | ✅ | Mount is now an explicit step. |
| `element.confirmPayment()` | `stripeApm.confirmPayment()` | ✅ | Now async; returns `{ error? }`. |
| `paymentElement: '#selector'` | `paymentElement: 'element-id'` | ⚠️ | Pass the element **ID** without `#`. |

Reference: `web-sdk-sample-app/src/static/offsite-payments/stripe-apm/stripe-apm.js`,
`checkout-web-sdk/docs/offsite-payments/stripe-apm/INTEGRATION_GUIDE.md`

---

## Offsite payments — Braintree (PayPal/Venmo)

```js
// Legacy
Spreedly.createBraintreePaymentElements({
  callbackFunction:  handlePaymentResult,
  transactionToken,
  paymentElements:   { paypal: 'paypal-button', venmo: 'venmo-button' },
  environmentKey,
});
```

```js
// Checkout Web SDK
const braintree = new SpreedlyBraintree({
  transactionToken,
  environmentKey,
  paymentElements: { paypal: 'paypal-button', venmo: 'venmo-button' },
  onPaymentResult: handlePaymentResult,
  onButtonAction:  handleButtonAction, // optional
  style:           { paypal: { color: 'gold', shape: 'rect', height: 45 } }, // optional
});
const result = await braintree.mount();
```

| Legacy iFrame | Checkout Web SDK | Status | Notes |
|---|---|---|---|
| `Spreedly.createBraintreePaymentElements({ callbackFunction, transactionToken, paymentElements, environmentKey })` | `new SpreedlyBraintree({ transactionToken, environmentKey, paymentElements, onPaymentResult, onButtonAction?, style? })` | ✅ | OO API; `callbackFunction` → `onPaymentResult`. |
| _(implicit mount)_ | `await braintree.mount()` | ✅ | Returns `{ paypalRendered?, venmoRendered?, error? }`. |
| _(no styling hooks)_ | `style: { paypal: { color, shape, height, layout } }` | 🆕 |
| _(no button-action callback)_ | `onButtonAction({ state: 'Initiated' \| 'Clicked', data, actions })` | 🆕 |

Reference: `web-sdk-sample-app/src/static/offsite-payments/braintree/braintree.js`,
`checkout-web-sdk/docs/offsite-payments/braintree/INTEGRATION_GUIDE.md`

---

## ACH payments 🆕

No equivalent in the legacy iFrame SDK (legacy used a hand-built transparent-redirect
form posting `payment_method_type=bank_account` to
`https://core.spreedly.com/v1/payment_methods`).

```js
// Checkout Web SDK
sdk.on('achTokenGenerated', ({ token, last4 }) => {
  // POST token to your backend → run the gateway purchase
});
sdk.on('achPaymentError', (err) => { /* ... */ });

sdk.setupACHPayment({
  bankRoutingNumber:     '021000021',
  bankAccountNumber:     '9876543210',
  fullName:              'Bob Smith',           // OR firstName + lastName
  bankAccountType:       'checking',            // 'checking' | 'savings'
  bankAccountHolderType: 'personal',            // 'personal' | 'business'
});
sdk.submitACHPayment();
```

| Legacy iFrame | Checkout Web SDK | Status |
|---|---|---|
| Hand-built `<form>` posting `payment_method_type=bank_account` | `sdk.setupACHPayment(config)` + `sdk.submitACHPayment()` + `sdk.clearACHPayment()` | 🆕 |
| _none_ | Events: `'achTokenGenerated'` (`{ token, last4 }`), `'achPaymentError'` | 🆕 |

Reference: `web-sdk-sample-app/src/static/ach-payments/ach-payments.js`,
`checkout-web-sdk/docs/ach-payments/INTEGRATION_GUIDE.md`

---

## Express Checkout 🆕

Pre-built single-iframe checkout form. No equivalent in the legacy iFrame SDK
(legacy `express-3.min.js` was the same Hosted-Fields-style two-iframe API,
just bundled differently).

```js
const sdk = new SpreedlyExpressCheckout({
  environment_key, certificate_token, nonce, signature, timestamp,
});

sdk.on('ready',          () => {});
sdk.on('tokenGenerated', (resp) => {});
sdk.on('error',          (err)  => {});
sdk.on('close',          () => {});

const checkout = sdk.expressCheckout({
  containerId: 'checkout-container',  // or omit for modal
  amount: 9900,
  currencyCode: 'USD',
});

sdk.updateTextElement('title',          'Complete Your Purchase');
sdk.updateTextElement('submitBtnText',  'Pay $99.00');
sdk.addField('phone_number', { /* ... */ });
sdk.removeField('company');
sdk.setFieldConfig('first_name', { /* ... */ });

sdk.close(true);
```

### Legacy `setParam` parity

In legacy, `Spreedly.setParam('first_name' | 'address1' | 'shipping_*' | …, val)` set
field values into a parent-page Hosted-Fields-style form. **Express Checkout doesn't
work that way** — the iframe IS the entire form, so the merchant doesn't supply field
values; they configure which fields the iframe should *render*. The shopper fills them
in, and they're submitted with the tokenization request.

Map legacy `setParam` to Express Checkout like this:

| Legacy `setParam(name, value)` | Express Checkout equivalent | Status |
|---|---|---|
| `'first_name' / 'last_name' / 'month' / 'year'` (mandatory) | Rendered by default in `uiConfig.cardPaymentFormFields` | ✅ |
| `'full_name' / 'company' / 'email' / 'phone_number'` | Add to `uiConfig.cardPaymentFormFields` (typed via `AdditionalCardPaymentFormFields`) | ✅ |
| `'address1' / 'address2' / 'city' / 'state' / 'zip' / 'country'` | Add to `uiConfig.cardPaymentFormFields` | ✅ |
| All `'shipping_*'` variants | Add to `uiConfig.cardPaymentFormFields` | ✅ |
| `'metadata'` (object) | `submitParams.metadata` | ✅ |
| `'allow_blank_name' / 'allow_blank_date' / 'allow_expired_date'` (boolean) | `submitParams.allow_blank_name` / `…blank_date` / `…expired_date` | ✅ |
| `'eligible_for_card_updater'` (boolean) | `submitParams.eligible_for_card_updater` | ✅ |

Example — render an `email` input and tokenize as eligible for the Card Updater:

```js
sdk.expressCheckout({
  containerId: 'checkout-container',
  uiConfig: {
    cardPaymentFormFields: {
      // Default mandatory fields are merged in automatically; just add the extras.
      email:    { fieldName: 'email',    label: 'Email',    isRequired: true,  size: 12, isMasked: false, placeholder: 'you@example.com', styles: {} },
      address1: { fieldName: 'address1', label: 'Address 1', isRequired: false, size: 12, isMasked: false, placeholder: '123 Main St',     styles: {} },
    },
  },
  submitParams: {
    metadata: { order_id: 'ORDER-123' },
    eligible_for_card_updater: true,
  },
});
```

### API surface

| API | Status |
|---|---|
| `new SpreedlyExpressCheckout(authDetails)` | 🆕 |
| `sdk.expressCheckout({ containerId?, amount, currencyCode, ... })` | 🆕 |
| `sdk.updateTextElement(key, value)` | 🆕 |
| `sdk.addField(name, config)` / `sdk.removeField(name)` / `sdk.setFieldConfig(name, config)` | 🆕 |
| `sdk.close(force?)` | 🆕 |
| Event: `'close'` | 🆕 |

Reference: `web-sdk-sample-app/src/static/tokenize/tokenize.js?sdk=express-checkout`,
`checkout-web-sdk/docs/tokenization/express-checkout/INTEGRATION_GUIDE.md`
