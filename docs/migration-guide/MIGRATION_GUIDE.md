# Migration Guide — Legacy iFrame SDK → Checkout Web SDK

A side-by-side API map for merchants moving from the legacy `Spreedly.*` iFrame
library to the new Checkout Web SDK (`SpreedlyHostedFields` /
`SpreedlyExpressCheckout`).

**Conventions used in this doc**

- ✅ — direct equivalent
- 🆕 — new in Checkout Web SDK (no legacy counterpart)
- ❌ TODO — exists in legacy, not yet in Checkout Web SDK

> Click to Pay (legacy `c2p*`) and Stripe Radar (legacy `Spreedly.stripeRadar`)
> are **out of scope** for this guide.

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
| `Spreedly.init(envKey, { nonce, timestamp, certificateToken, signature, numberEl, cvvEl })` | `new SpreedlyHostedFields({ environment_key, nonce, timestamp, certificate_token, signature })` + `sdk.inAppElements({ number: { containerId }, cvv: { containerId } })` | ✅ | Auth fields are now snake_case and passed in the constructor; iframe mount is a separate explicit call. `data-environment-key` / `data-number-id` / `data-cvv-id` HTML attributes are no longer used. |
| _(global singleton `Spreedly`)_ | _(per-instance `sdk`)_ | ✅ | The new SDK is class-based; you can hold multiple instances. |
| `Spreedly.unload()` | _(none — drop SDK reference)_ | ❌ TODO | No public unmount method on Hosted Fields today. For Express Checkout, see `sdk.close()`. |
| `Spreedly.reload()` | _(re-instantiate the class)_ | ❌ TODO | |
| `Spreedly.removeHandlers()` | _(re-instantiate; `on()` listeners do not currently support removal)_ | ❌ TODO | |
| `Spreedly.isLoaded()` | _(none)_ | ❌ TODO | Use the `'ready'` event instead. |

Reference: `web-sdk-sample-app/src/static/purchase/purchase.js`,
`web-sdk-sample-app/src/static/tokenize/tokenize.js`

---

## Field configuration

All of these are **Hosted Fields only** in the new SDK; Express Checkout
manages its own UI via `sdk.expressCheckout({...})` configuration
(see [Express Checkout](#express-checkout-)).

| Legacy iFrame | Checkout Web SDK | Status |
|---|---|---|
| `Spreedly.setPlaceholder(field, text)` | `sdk.setPlaceholder('number' \| 'cvv', text)` | ✅ |
| `Spreedly.setStyle(field, css)` (CSS string) | `sdk.setStyles('number' \| 'cvv', { fontSize, color, ... })` (object) | ✅ |
| `Spreedly.setFieldType(field, type)` | `sdk.setFieldType('number' \| 'cvv', 'text' \| 'tel' \| 'number' \| 'password')` | ✅ |
| `Spreedly.setLabel(field, value)` | _(none)_ | ❌ TODO |
| `Spreedly.setTitle(field, value)` | _(none)_ | ❌ TODO |
| `Spreedly.setInputMode(field, value)` | _(none)_ | ❌ TODO |
| `Spreedly.setRequiredAttribute(field)` | _(none)_ | ❌ TODO |
| `Spreedly.setNumberFormat('prettyFormat' \| 'plainFormat' \| 'maskedFormat')` | _(none)_ | ❌ TODO |
| `Spreedly.toggleAutoComplete()` | _(none)_ | ❌ TODO |
| `Spreedly.toggleMask()` | _(none)_ | ❌ TODO |
| `Spreedly.transferFocus(field)` | _(none)_ | ❌ TODO |
| `Spreedly.validate()` | _(none — validation runs on `submit()`)_ | ❌ TODO | |
| `Spreedly.resetFields()` | _(none)_ | ❌ TODO |
| `Spreedly.setValue('number' \| 'cvv', value)` | _(none — setting card values from the parent page is not supported)_ | ❌ TODO |
| `Spreedly.setParam(name, value)` | Pass via `sdk.submit(formData, submitParams)` | ✅ | See [Tokenization (submit)](#tokenization-submit) below — params are passed at submit time, not set ahead. |

Reference: `web-sdk-sample-app/src/static/tokenize/tokenize.js`

---

## Tokenization (submit)

```js
// Legacy
Spreedly.setParam('first_name', 'John');
Spreedly.setParam('last_name',  'Doe');
Spreedly.setParam('month',      '12');
Spreedly.setParam('year',       '2028');
Spreedly.setParam('metadata',   { order_id: 'ORDER-123' });
Spreedly.setParam('allow_blank_name', true);
Spreedly.tokenizeCreditCard();
```

```js
// Checkout Web SDK
sdk.submit(
  { first_name: 'John', last_name: 'Doe', month: '12', year: '2028' },
  { metadata: { order_id: 'ORDER-123' }, allow_blank_name: true }
);
```

| Legacy iFrame | Checkout Web SDK | Status |
|---|---|---|
| `Spreedly.tokenizeCreditCard(opts?)` | `sdk.submit(formData, submitParams?)` | ✅ |
| `Spreedly.setParam('first_name' \| 'last_name' \| 'full_name' \| 'month' \| 'year' \| 'email' \| 'address1' \| ... \| 'shipping_*', val)` | `formData` (mandatory: `first_name`, `last_name`, `month`, `year`) — additional fields not yet supported in `formData` | ⚠️ Partial | Most billing/shipping fields don't yet round-trip through Hosted Fields; track as ❌ TODO if your integration uses them. |
| `Spreedly.setParam('metadata', {...})` | `submitParams.metadata` | ✅ |
| `Spreedly.setParam('allow_blank_name' \| 'allow_blank_date' \| 'allow_expired_date', true)` | `submitParams.allow_blank_name` / `submitParams.allow_blank_date` / `submitParams.allow_expired_date` | ✅ |
| `Spreedly.setParam('eligible_for_card_updater', true)` | _(none)_ | ❌ TODO |
| Token via `'paymentMethod'` event | Token via `'tokenGenerated'` event — payload is `{ message, tokenResponse: { token, succeeded, payment_method: { token, card_type, last_four_digits, ... } } }` | ✅ | Payload shape changed; see [Events](#events). |

Reference: `web-sdk-sample-app/src/static/tokenize/tokenize.js`,
`checkout-web-sdk/docs/tokenization/hosted-fields/INTEGRATION_GUIDE.md`

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

| Legacy iFrame event | Checkout Web SDK event | Status | Notes |
|---|---|---|---|
| `'ready'` | `'ready'` | ✅ |
| `'paymentMethod'` (args: `token, pm`) | `'tokenGenerated'` (arg: `{ message, tokenResponse: { token, payment_method } }`) | ✅ | Renamed; payload is now an object. |
| `'errors'` (array) | `'error'` (object: `{ message, errors?: [...] }`) | ✅ | Renamed; single object payload that may contain a per-field `errors` array. |
| `'validation'` | _(none)_ | ❌ TODO | |
| `'fieldEvent'` (focus/blur/input) | _(none)_ | ❌ TODO |
| `'consoleError'` | _(none)_ | ❌ TODO | |
| `'numberSet'` / `'cvvSet'` / `'sourceSet'` | _(none)_ | ❌ TODO | These mirror legacy `setValue` / `source` flows that aren't supported. |
| `'recacheReady'` | `'recacheReady'` | ✅ |
| `'recache'` | `'recacheSuccess'` | ✅ |
| `'3ds:status'` | Callbacks on the `SpreedlyThreeDSLifecycle` instance | ✅ | See [3DS](#3ds--global--forter). |
| `'fraud:token'` | _(none — Spreedly Fraud client not ported)_ | ❌ TODO | |
| _none_ | `'close'` (Express Checkout only) | 🆕 |
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

---

## Not yet migrated

The following legacy iFrame APIs do **not** have an equivalent in Checkout Web
SDK today. Track each as a TODO when planning your migration.

### Field-level controls
`setLabel`, `setTitle`, `setInputMode`, `setRequiredAttribute`,
`setNumberFormat`, `toggleAutoComplete`, `toggleMask`, `transferFocus`,
`validate`, `resetFields`, `setValue`.

### Lifecycle helpers
`Spreedly.unload()`, `Spreedly.reload()`, `Spreedly.removeHandlers()`,
`Spreedly.isLoaded()`.

### Tokenization params
`setParam('eligible_for_card_updater', true)` and the broader
billing/shipping `setParam(...)` surface (`address1`, `city`, `state`, `zip`,
`country`, `phone_number`, `company`, `shipping_*`, etc.) are **not** yet
accepted by `sdk.submit(formData, submitParams)` for Hosted Fields.

### Events
`'validation'`, `'fieldEvent'`, `'consoleError'`, `'numberSet'`, `'cvvSet'`,
`'sourceSet'`, `'fraud:token'`.

### Other
`Spreedly.Fraud` (built-in fraud client).
