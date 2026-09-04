# PPCP API Reference

`SpreedlyPPCP` renders PayPal, Venmo, Pay Later and PayPal Credit buttons using the PayPal Web SDK
v6, and wires each button click to a payment session.

This page is the complete lookup for the class. For a walkthrough of building an integration, read
the [Integration Guide](./INTEGRATION_GUIDE.md).

---

## Contents

- [Loading the class](#loading-the-class)
- [Class `SpreedlyPPCP`](#class-spreedlyppcp)
- [Configuration](#configuration)
- [Callbacks](#callbacks)
- [Results and return types](#results-and-return-types)
- [Types and unions](#types-and-unions)
- [Errors](#errors)
- [Validation](#validation)
- [What the SDK sends to PayPal](#what-the-sdk-sends-to-paypal)
- [`flow: 'vault'` — the full behaviour difference](#flow-vault--the-full-behaviour-difference)

---

## Loading the class

`SpreedlyPPCP` is a standalone class. It does not extend `SpreedlyWebSDK`, it takes no auth
details, and it works alongside any other Spreedly SDK class on the page.

Two scripts must be on the page before you call `mount()`: PayPal's v6 core, and one Spreedly
bundle.

```html
<!-- 1. PayPal Web SDK v6 core -->
<script src="https://www.paypal.com/web-sdk/v6/core"></script>
<!-- sandbox: https://www.sandbox.paypal.com/web-sdk/v6/core -->

<!-- 2. The Spreedly bundle you already load — one of these two. -->
<!-- Hosted Fields -->
<script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>
<!-- Express Checkout -->
<script src="https://core.spreedly.com/checkout/elements/{version}/express-checkout.js"></script>
```

Replace `{version}` with your pinned SDK version. Staging is `core-test.spreedly.com` with the same
paths.

Both bundles expose the class as `window.SpreedlyPPCP` and both re-export the same 17 TypeScript
types listed in [Types and unions](#types-and-unions). Load the one your checkout already uses.

```js
const ppcp = new window.SpreedlyPPCP({ /* config */ });
```

The class does not touch the DOM in its constructor and does not need `window.paypal` to exist
yet. `window.paypal` is looked up when `mount()` runs.

---

## Class `SpreedlyPPCP`

Four public members. Everything else on the class is private.

```ts
class SpreedlyPPCP {
  constructor(config: PPCPConfig);
  mount(): Promise<PPCPMountResult>;
  isMounted(): boolean;
  destroy(): void;
}
```

### `constructor(config: PPCPConfig)`

| | |
|---|---|
| **Returns** | a `SpreedlyPPCP` instance |
| **Throws** | `Error` — see [Constructor errors](#constructor-errors) |

A bad config throws error here, so wrap the call in a try/catch.


### `mount(): Promise<PPCPMountResult>`

| | |
|---|---|
| **Returns** | `Promise<PPCPMountResult>` |
| **Rejects** | never |

`mount()` resolves. It never rejects, so no need of a`try/catch` around `await ppcp.mount()`. Every failure comes back as `{ error: string }` on the resolved value, with no `rendered`
key.

Call it once the PayPal script has loaded and your container elements are in the DOM.

Buttons render in a fixed order — `paypal`, `venmo`, `payLater`, `payPalCredit` — whatever order you
listed them in `paymentElements`. That is also the key order of `PPCPMountResult.rendered`.

One button failing does not fail the mount. It comes back as `rendered[kind] = false` and the others
still render. A Pay Later messaging failure behaves the same way.

```js
const result = await ppcp.mount();

if (result.error) {
  // Nothing rendered.
  return;
}

// result.rendered === { paypal: true, venmo: false, payLater: true, payPalCredit: false }
// result.messagingRendered is present only when payLaterMessaging is configured.
```

### `isMounted(): boolean`

Returns `true` between a successful `mount()` and the next `destroy()`. `false` before the first
successful mount, and `false` after `destroy()`.

### `destroy(): void`

| | |
|---|---|
| **Returns** | nothing |
| **Throws** | never |

Call it before you re-mount, and before you remove the page section holding the buttons.

It removes every element the SDK added — the buttons and the Pay Later message — and sets
`isMounted()` back to `false`.

**Do not skip it before a re-mount.**

It is safe to call when nothing is mounted. After `destroy()` you can call `mount()` again on the
same instance.

Config values are read at mount time and at click time, not copied at construction. To change any
config value — including `savePayment` — call `destroy()`, then construct and mount a new instance.

---

## Configuration

```ts
interface PPCPConfig {
  clientId: string;
  environmentKey?: string;
  flow?: 'checkout' | 'vault';
  createOrder?: (context: PPCPOrderContext) => Promise<PPCPOrder>;
  createVaultSetupToken?: (context: PPCPOrderContext) => Promise<PPCPSetupToken>;
  onPaymentResult: (result: PPCPPaymentResult) => void;
  onRedirect?: (redirectUrl: string) => void;
  paymentElements: PPCPPaymentElements;
  currencyCode: string;
  amount?: string;
  countryCode?: string;
  merchantId?: string;
  partnerAttributionId?: string;
  locale?: string;
  testBuyerCountry?: string;
  pageType?: string;
  presentationMode?: PPCPPresentationMode;
  commit?: boolean;
  savePayment?: boolean;
  venmoSandbox?: boolean;
  fullPageOverlay?: boolean;
  buttonStyle?: PPCPButtonStyle;
  payLaterMessaging?: PPCPPayLaterMessaging;
}
```

### Every field

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `clientId` | `string` | Yes | — | Your PayPal client id. Sent to `createInstance()`. Must be a non-empty string. |
| `environmentKey` | `string` | No | `''` | Identifies your Spreedly environment so SDK activity can be attributed to your account. Highly recommended that you add it. It is not sent to PayPal. |
| `flow` | `'checkout' \| 'vault'` | No | `'checkout'` | `'vault'` saves a PayPal account without taking a payment. Any value other than the literal `'vault'` behaves as checkout. |
| `createOrder` | `(context: PPCPOrderContext) => Promise<PPCPOrder>` | Yes when `flow` is not `'vault'` | — | Returns the PayPal order id for the click. See [`createOrder`](#createordercontext-ppcpordercontext-promiseppcporder). |
| `createVaultSetupToken` | `(context: PPCPOrderContext) => Promise<PPCPSetupToken>` | Yes when `flow` is `'vault'` | — | Returns the approval session id for the click. See [`createVaultSetupToken`](#createvaultsetuptokencontext-ppcpordercontext-promiseppcpsetuptoken). |
| `onPaymentResult` | `(result: PPCPPaymentResult) => void` | Yes | — | The single terminal callback for approval, cancellation and failure. |
| `onRedirect` | `(redirectUrl: string) => void` | No | — | Supplying it turns off the SDK's automatic navigation and hands you the approval URL instead. |
| `paymentElements` | `PPCPPaymentElements` | Yes | — | Button kind to DOM element id. At least one entry must be truthy. |
| `currencyCode` | `string` | Yes | — | ISO 4217 code, for example `'USD'`. |
| `amount` | `string` | No | — | Decimal string, for example `'229.98'`. Used for eligibility only. It does not set the charge. |
| `countryCode` | `string` | No | — | Buyer country, for example `'US'`. |
| `merchantId` | `string` | No | — | Sent to `createInstance()` only when truthy. |
| `partnerAttributionId` | `string` | No | `'Spreedly_PCP'` | Partner attribution (BN) code. Sent verbatim to `createInstance()`. Case matters. |
| `locale` | `string` | No | — | Sent to `createInstance()` only when truthy. |
| `testBuyerCountry` | `string` | No | — | **Sandbox only.** Sent to `createInstance()` only when truthy. |
| `pageType` | `string` | No | `'checkout'` | Sent to `createInstance()` on every mount. The default is applied, not omitted. |
| `presentationMode` | `PPCPPresentationMode` | No | `'auto'` | How PayPal's approval screen opens. |
| `commit` | `boolean` | No | omitted | Forwarded to the payment session only when it is a boolean. |
| `savePayment` | `boolean` | No | omitted | Forwarded as the literal `true` only when truthy. |
| `venmoSandbox` | `boolean` | No | omitted | **Sandbox only, Venmo button only.** |
| `fullPageOverlay` | `boolean` | No | overlay shown | Only an explicit `false` does anything. |
| `buttonStyle` | `PPCPButtonStyle` | No | — | Label, colour and corner radius. |
| `payLaterMessaging` | `PPCPPayLaterMessaging` | No | — | Pay Later promotional message. Ignored when `flow` is `'vault'`. |

### `paymentElements`

```ts
interface PPCPPaymentElements {
  paypal?: string;
  venmo?: string;
  payLater?: string;
  payPalCredit?: string;
}
```

Each value is the id of an empty element you put on the page. The SDK appends PayPal's web
component inside it.

```html
<div id="paypal-button"></div>
<div id="paylater-button"></div>
```

```js
paymentElements: {
  paypal:   'paypal-button',
  payLater: 'paylater-button',
}
```

Ask only for the buttons you intend to use. Listing `payLater` and `payPalCredit` together only ever
renders Pay Later — PayPal returns one or the other. See
[Button eligibility](./INTEGRATION_GUIDE.md#which-buttons-a-buyer-sees).

Keys that are not one of those four are ignored. A `paymentElements` object with no truthy value —
and a missing `paymentElements` altogether — throws in the constructor.

**Venmo needs a popup-family `presentationMode`.** PayPal's Venmo session rejects
`presentationMode: 'redirect'` with `ERR_FLOW_UNSUPPORTED_PRESENTATION_MODE`. Use `'auto'` or
`'popup'` on a page that offers Venmo. Venmo is also unavailable in `flow: 'vault'`, where only the
PayPal button is mounted.

The set of configured kinds also decides which PayPal SDK components load and which payment
sources the eligibility check asks for. See
[What the SDK sends to PayPal](#what-the-sdk-sends-to-paypal).

### `currencyCode`

Required. It goes to three places:

- `findEligibleMethods({ currencyCode })`;
- `createPayPalMessages({ currencyCode })`, when Pay Later messaging is configured;
- the `currency-code` attribute on the `<paypal-message>` element.

### `amount`

`amount` is for eligibility. It is not the charge.

In checkout flow it is sent as `findEligibleMethods({ amount })`. Pay Later eligibility is
amount-banded, so leaving `amount` out means PayPal cannot decide and the Pay Later button does not
render. In vault flow `amount` is never sent.

`amount` is also the fallback for `payLaterMessaging.amount`, and reaches the `<paypal-message>`
element as its `amount` attribute.

The amount actually charged comes from the transaction your backend creates through Spreedly
Core's gateway API. If the two disagree, the buyer sees eligibility computed for one figure and is
charged the other.

### `countryCode`

Three uses: `findEligibleMethods({ countryCode })`, `createPayPalMessages({ buyerCountry })`, and
the `buyer-country` attribute on the `<paypal-message>` element.

### `presentationMode`

```ts
type PPCPPresentationMode = 'auto' | 'popup' | 'redirect' | 'payment-handler';
```

Sent on every `session.start()`. Defaults to `'auto'`. All four values work for taking a payment.

What differs is where your code resumes. In `'redirect'` the buyer leaves the page and comes back
through the return leg, which finalizes the transaction on the way. In the popup-family modes
`onPaymentResult` fires on your page with the order id, and the transaction is still pending — you
finalize it by navigating the buyer through Spreedly's return leg yourself.

`flow: 'vault'` requires `'redirect'`; see [`flow: 'vault'`](#flow-vault--the-full-behaviour-difference).
Venmo requires a popup-family mode.

`'modal'` is not supported as PayPal recommends it for WebView only.

In `'redirect'` mode the whole page navigates to PayPal. Your page is gone, so `onPaymentResult`
does not fire for an approval — the buyer comes back to the `redirect_url` your backend set on the
Spreedly transaction. In `'redirect'` mode `onPaymentResult` only ever fires with `'Cancelled'` or
`'Failed'`, both of which happen before the navigation.

### `commit`, `savePayment` and `fullPageOverlay`

Each uses a different rule for "is this set", so they behave differently when you pass `undefined`.

| Field | Rule | `true` | `false` | `undefined` |
|---|---|---|---|---|
| `commit` | `typeof commit === 'boolean'` | sends `commit: true` | sends `commit: false` | key omitted |
| `savePayment` | truthiness | sends `savePayment: true` | key omitted | key omitted |
| `fullPageOverlay` | `=== false` | key omitted | sends `fullPageOverlay: { enabled: false }` | key omitted |

`commit` changes PayPal's final button wording and nothing else. Neither value captures money.

`savePayment` tells PayPal the purchase also saves the payment method, so the buyer is asked to
agree. It does not vault anything on its own — the vaulting instruction goes on the transaction
your backend creates through Spreedly Core's gateway API.

`fullPageOverlay: true` PayPal covers your page while its popup is open, so the buyer cannot interact with your checkout until they finish. Passing fullPageOverlay: false removes it and leaves your page visible and usable behind the popup. Generally this won't be needed. 

### `venmoSandbox`

Sandbox only, and Venmo only. When `venmoSandbox` is truthy and the clicked button is `venmo`, the
session is started with `sandboxSupport: { enabled: true }`. That routes at Venmo's sandbox.

### `buttonStyle`

```ts
interface PPCPButtonStyle {
  label?: PPCPButtonLabel;
  paypalBorderRadius?: string;
  venmoBorderRadius?: string;
  color?: PPCPButtonColor;
}

type PPCPButtonLabel = 'checkout' | 'pay' | 'buynow' | 'subscribe' | 'donate';
type PPCPButtonColor = 'gold' | 'blue' | 'white' | 'black';
```

| Field | Applies to | How it is applied |
|---|---|---|
| `label` | `paypal` and `venmo` only | Set as the `type` attribute on the button element. Pay Later and PayPal Credit take `productCode` / `countryCode` instead and have no label control. |
| `color` | all buttons | Added as a CSS class, prefixed by button family: `paypal-<color>` for `paypal`, `payLater` and `payPalCredit`; `venmo-<color>` for `venmo`. So `color: 'blue'` becomes the class `paypal-blue` or `venmo-blue`. |
| `paypalBorderRadius` | all buttons | Sets the `--paypal-button-border-radius` CSS custom property on the element. |
| `venmoBorderRadius` | all buttons | Sets the `--venmo-button-border-radius` CSS custom property on the element. |

When `label` is unset, the `venmo` button gets an implicit label of `'pay'`. The `paypal` button
gets no `type` attribute at all.

Both radius properties are written onto every button element regardless of kind. Each component
reads only the property that matches it.

For `payLater` and `payPalCredit`, the SDK also copies `productCode` and `countryCode` from
PayPal's eligibility details onto the element as JavaScript properties, when PayPal supplied them.

### `payLaterMessaging`

```ts
interface PPCPPayLaterMessaging {
  elementId: string;
  amount?: string;
  logoType?: string;
  logoPosition?: string;
  textColor?: string;
  messageLength?: string;
  alternativePrefix?: string;
  offerTypes?: string[] | string;
  presentationMode?: string;
  fontSize?: string;
  textAlign?: string;
  onReady?: () => void;
  onContentReady?: (content: unknown) => void;
}
```

| Field | Type | Required | Default | How it is applied |
|---|---|---|---|---|
| `elementId` | `string` | Yes, within this object | — | Id of the container to append `<paypal-message>` into. Messaging is only attempted when this is truthy. |
| `amount` | `string` | No | `PPCPConfig.amount` | Set as the `amount` attribute, when either value is truthy. |
| `logoType` | `string` | No | — | `logo-type` attribute. |
| `logoPosition` | `string` | No | — | `logo-position` attribute. |
| `textColor` | `string` | No | — | `text-color` attribute. |
| `messageLength` | `string` | No | — | `message-length` attribute. |
| `alternativePrefix` | `string` | No | — | `alternative-prefix` attribute. |
| `offerTypes` | `string[] \| string` | No | — | `offer-types` attribute. An array is joined with `,`. A string is used as-is. |
| `presentationMode` | `string` | No | — | `presentation-mode` attribute. Also gates the learn-more listener — see below. This is a plain `string`, not `PPCPPresentationMode`. |
| `fontSize` | `string` | No | — | Sets the `--paypal-message-font-size` CSS custom property. |
| `textAlign` | `string` | No | — | Sets the `--paypal-message-text-align` CSS custom property. |
| `onReady` | `() => void` | No | — | See [`payLaterMessaging.onReady`](#paylatermessagingonready-void-and-paylatermessagingoncontentreadycontent-unknown-void). |
| `onContentReady` | `(content: unknown) => void` | No | — | Same. |

The seven attribute values are passed through unvalidated and unnarrowed. PayPal owns those values
and validates them itself; see
[PayPal's Pay Later reference](https://developer.paypal.com/pay-later/reference). Falsy values are
skipped, so an attribute you do not set is not written at all.

`presentationMode` here does two things. It becomes the `presentation-mode` attribute, and it is
the condition for attaching PayPal's learn-more listener: the SDK calls
`createLearnMore({ presentationMode })?.attachDefaultListener?.()` only when
`payLaterMessaging.presentationMode` is truthy. Leave it unset and the SDK attaches nothing.

Configuring `payLaterMessaging` also loads PayPal's `paypal-messages` component at
`createInstance()`. Without that component, `createPayPalMessages` is absent from the PayPal SDK
instance and the SDK logs `createPayPalMessages is not available on the PayPal SDK instance.`

The whole block is ignored when `flow` is `'vault'`.

---

## Callbacks

### `createOrder(context: PPCPOrderContext): Promise<PPCPOrder>`

| | |
|---|---|
| **Required** | when `flow` is not `'vault'` |
| **Fires** | synchronously inside the button's click handler, once per click, before the payment session starts |
| **Receives** | `PPCPOrderContext` — which button was clicked |
| **Must return** | `Promise<{ orderId: string }>` |

Your backend authorizes or purchases through Spreedly Core's gateway API, and the PayPal order id
comes back on that response as `transaction.setup_verification`. Resolve it as `orderId`.

```js
async function createOrder(context) {
  const wallet =
    context.payment_method.payment_method_type === 'venmo' ? 'venmo' : 'paypal';

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payment_method_type: wallet }),
  }).then(r => r.json());

  return { orderId: response.id };
}
```

The SDK does **not** await your promise. It hands the pending promise straight to PayPal's payment
session. Awaiting it would spend the click's user activation and the browser would block PayPal's
popup. Keep the callback fast — PayPal's approval is already open and waiting on it.

The `context` argument names the button the buyer clicked. A callback that takes no arguments is
valid.

| What happens | Result |
|---|---|
| Resolves with `{ orderId }` | PayPal proceeds with that order. |
| Rejects | PayPal's session sees the rejected promise and calls its `onError`, which routes to `onPaymentResult` with `state: 'Failed'`. |
| Throws synchronously | Caught by the click handler and routed to `onPaymentResult` with `state: 'Failed'`. |

### `createVaultSetupToken(context: PPCPOrderContext): Promise<PPCPSetupToken>`

| | |
|---|---|
| **Required** | when `flow` is `'vault'` |
| **Fires** | same as `createOrder` — synchronously in the click handler, once per click |
| **Receives** | `PPCPOrderContext` |
| **Must return** | `Promise<{ setupToken: string }>` |

Your backend runs a verify through Spreedly Core's gateway API. The approval session id is the
`approval_session_id` query parameter on the `checkout_url` that comes back. Resolve it as
`setupToken`.

The SDK renames it for PayPal: `{ setupToken }` becomes `{ vaultSetupToken }` before it reaches the
save session.

Not awaited, and the rejection and throw behaviour are identical to `createOrder`.

### `onPaymentResult(result: PPCPPaymentResult): void`

| | |
|---|---|
| **Required** | always |
| **Receives** | `PPCPPaymentResult` |
| **Returns** | nothing |

The single terminal callback. Five paths reach it.

| Path | `state` |
|---|---|
| PayPal's `onApprove` | `'Successful'` |
| PayPal's `onCancel` | `'Cancelled'` |
| PayPal's `onError` | `'Failed'` |
| A synchronous throw in the click handler, including a throw from `createOrder` / `createVaultSetupToken` | `'Failed'` |
| The promise returned by `session.start()` rejecting | `'Failed'` |

Every result carries `payment_method.payment_method_type` for the button that was clicked. Which
other fields are present is in [`PPCPPaymentResult`](#ppcppaymentresult).

In `presentationMode: 'redirect'`, and in `flow: 'vault'`, the page navigates to PayPal on approval
and never comes back to the same page instance. `onPaymentResult` fires there only for
`'Cancelled'` and `'Failed'`. Do not build success handling into it for those flows — handle
success on the return page your `redirect_url` points at.

Nothing catches an exception thrown by `onPaymentResult`. From `onApprove` and `onCancel` it
propagates into PayPal's session callback; from the failure path it propagates into whatever called
it.

### `onRedirect(redirectUrl: string): void`

| | |
|---|---|
| **Required** | no |
| **Receives** | the approval URL, already validated |
| **Returns** | nothing |

Supplying `onRedirect` is what starts the session with `autoRedirect: { enabled: false }`. That is
deliberate: you cannot switch off the SDK's automatic navigation and then forget to handle it,
stranding the buyer.

It fires only when both are true: you supplied it, and `session.start()` returned a thenable that
resolved with a `redirectURL`. In popup-family modes PayPal completes in place and the callback
never fires.

The URL is validated before it reaches you. It must parse, use `https:`, and have a hostname that
equals or ends in `.paypal.com` or `.venmo.com`. If it fails that check the SDK logs
`PayPal returned a redirect URL that is not an https PayPal or Venmo host. Not forwarding it to
onRedirect.` and returns. `onRedirect` is not called and **no** `'Failed'` result is emitted, so a
buyer waiting on your handler is left with nothing.

If `onRedirect` throws, the error is caught and logged as `onRedirect threw`. No `'Failed'` result
is emitted.

### `payLaterMessaging.onReady(): void` and `payLaterMessaging.onContentReady(content: unknown): void`

Both fire from inside PayPal's own content-ready callback, in this order:

1. PayPal renders the message,
2. `onReady()`,
3. `onContentReady(content)`.

PayPal calls one callback rather than two, which is why the SDK fires `onReady` from the same
place.

`onContentReady` is the only reliable "content rendered" signal. `messagingRendered` in the mount
result only means the element was appended.

Neither callback is guaranteed to fire. There is no failure callback and no timeout callback. If
PayPal's `fetchContent` rejects, the SDK logs `Failed to fetch Pay Later message content` and
stops. If PayPal simply never delivers content, nothing is logged at all, and a late delivery still
calls both callbacks. Treat the message as decoration: never gate a button, a layout or a checkout
step on
either callback.

If your `onReady` or `onContentReady` throws, the rejection is caught and logged as
`Failed to fetch Pay Later message content`. No result is emitted. A throw here is visible only in
logs.

---

## Results and return types

### `PPCPMountResult`

```ts
interface PPCPMountResult {
  error?: string;
  rendered?: Partial<Record<PPCPButtonKind, boolean>>;
  messagingRendered?: boolean;
}
```

| Field | Type | Present when |
|---|---|---|
| `error` | `string` | The mount failed. `rendered` and `messagingRendered` are both absent. |
| `rendered` | `Partial<Record<PPCPButtonKind, boolean>>` | The mount succeeded. One entry per kind the SDK processed. |
| `messagingRendered` | `boolean` | The mount succeeded **and** Pay Later messaging is configured — that is, `payLaterMessaging.elementId` is truthy and `flow` is not `'vault'`. |

`rendered[kind] === true` means the button element was appended and its click handler attached.

`rendered[kind] === false` means one of three things, and the returned object cannot tell them
apart: PayPal said the kind is not eligible, the container element id was not found in the DOM, or
setting the button up threw. A typo'd element id looks exactly like ineligibility here. The console
tells them apart: ineligibility logs `<kind> is not eligible for this session`, a missing container
logs `PayPal button container element not found: <elementId>`, and a throw logs
`Failed to set up <kind> button`. None of the three fails the mount.

`rendered` contains only the kinds the SDK processed. In checkout flow that is the kinds you named
in `paymentElements`. In vault flow it is `paypal` only — the other kinds are filtered out before
the render loop and get no key at all, not even `false`.

`messagingRendered: true` means the `<paypal-message>` element was appended. It is not proof PayPal
returned content. Use `payLaterMessaging.onContentReady` for that.

### `PPCPPaymentResult`

```ts
interface PPCPPaymentResult {
  state: 'Successful' | 'Cancelled' | 'Failed';
  payment_method: { payment_method_type: PPCPPaymentMethodType };
  orderId?: string;
  payerId?: string;
  vaultSetupToken?: string;
  message?: string;
  code?: string;
}
```

| Field | `Successful` (checkout) | `Successful` (vault) | `Cancelled` | `Failed` |
|---|---|---|---|---|
| `state` | `'Successful'` | `'Successful'` | `'Cancelled'` | `'Failed'` |
| `payment_method` | always | always | always | always |
| `orderId` | key always present, carrying whatever PayPal supplied | absent | present only when PayPal supplied one | **absent** |
| `payerId` | present only when PayPal supplied one | absent | absent | absent |
| `vaultSetupToken` | absent | key always present, carrying whatever PayPal supplied | absent | absent |
| `message` | absent | absent | absent | always a string |
| `code` | absent | absent | absent | present only when the error carried a `code` |

`orderId` is included on `'Cancelled'` because the order already exists by then — you need its id
to void it.

`message` on `'Failed'` is always a string. The SDK coerces whatever was thrown, in this order:
`Error.message`, then the value itself if it is a string, then its `message` property if it has
one, then `JSON.stringify(error)`, then `String(error)`.

`code` on `'Failed'` is PayPal's stable `ERR_*` identifier when the error object carried a
non-empty string `code`, or the stringified value when `code` was a number. Otherwise the key is
absent. Branch on `code`, never on `message` text.

---

## Types and unions

All 17 types below are re-exported from both bundles and are the public TypeScript surface. The
class itself is not a module export — it exists only as `window.SpreedlyPPCP`. In TypeScript,
declare the global once:

```ts
import type { PPCPConfig, PPCPMountResult } from '@spreedly/hosted-fields';

declare global {
  interface Window {
    SpreedlyPPCP: new (config: PPCPConfig) => {
      mount(): Promise<PPCPMountResult>;
      isMounted(): boolean;
      destroy(): void;
    };
  }
}
```

Put this in one file in your project. `window.SpreedlyPPCP` is typed everywhere after that.

```ts
import type {
  PPCPConfig,
  PPCPPaymentResult,
  PPCPMountResult,
  PPCPPaymentElements,
  PPCPButtonStyle,
  PPCPPayLaterMessaging,
  PPCPButtonLabel,
  PPCPButtonColor,
  PayPalStartResult,
  PPCPPresentationMode,
  PPCPOrder,
  PPCPOrderContext,
  PPCPSetupToken,
  PPCPApproveData,
  PPCPCancelData,
  PPCPButtonKind,
  PPCPPaymentMethodType,
} from '@spreedly/hosted-fields';
```

### Interfaces

| Type | Declaration | Documented at |
|---|---|---|
| `PPCPConfig` | see [Configuration](#configuration) | [Configuration](#configuration) |
| `PPCPPaymentResult` | see [`PPCPPaymentResult`](#ppcppaymentresult) | [Results](#results-and-return-types) |
| `PPCPMountResult` | see [`PPCPMountResult`](#ppcpmountresult) | [Results](#results-and-return-types) |
| `PPCPPaymentElements` | see [`paymentElements`](#paymentelements) | [Configuration](#configuration) |
| `PPCPButtonStyle` | see [`buttonStyle`](#buttonstyle) | [Configuration](#configuration) |
| `PPCPPayLaterMessaging` | see [`payLaterMessaging`](#paylatermessaging) | [Configuration](#configuration) |

```ts
interface PPCPOrder {
  orderId: string;
}
```
What `createOrder` must resolve to.

```ts
interface PPCPSetupToken {
  setupToken: string;
}
```
What `createVaultSetupToken` must resolve to. The SDK renames it to `vaultSetupToken` for PayPal.

```ts
interface PPCPOrderContext {
  payment_method: { payment_method_type: PPCPPaymentMethodType };
}
```
The single argument passed to `createOrder` and `createVaultSetupToken`. It names the button the
buyer clicked.

```ts
interface PPCPApproveData {
  orderId?: string;
  payerId?: string;
  vaultSetupToken?: string;
}
```
The payload PayPal hands the SDK on approval. The SDK reads it and builds `PPCPPaymentResult` from
it — you do not receive this object. It is exported so you can type against PayPal's shape.

```ts
interface PPCPCancelData {
  orderId?: string;
}
```
The payload PayPal hands the SDK on cancellation. Same note as `PPCPApproveData`.

```ts
interface PayPalStartResult {
  redirectURL?: string;
}
```
What PayPal's `session.start()` resolves to. `redirectURL` is present only when automatic
navigation is off, which is what supplying `onRedirect` does. The SDK reads `redirectURL` from it,
validates it, and passes the string to `onRedirect`.

### Unions

```ts
type PPCPButtonKind = 'paypal' | 'venmo' | 'payLater' | 'payPalCredit';
```
The camelCase names. Key `paymentElements` and `PPCPMountResult.rendered` by these.

```ts
type PPCPPaymentMethodType = 'paypal' | 'venmo' | 'paylater' | 'paypal_credit';
```
The lowercase names. These appear in `PPCPOrderContext` and `PPCPPaymentResult`.

The two are not interchangeable, and the difference is easy to miss:

| Button | `PPCPButtonKind` | `PPCPPaymentMethodType` |
|---|---|---|
| PayPal | `paypal` | `paypal` |
| Venmo | `venmo` | `venmo` |
| Pay Later | `payLater` | `paylater` |
| PayPal Credit | `payPalCredit` | `paypal_credit` |

```ts
type PPCPPresentationMode = 'auto' | 'popup' | 'redirect' | 'payment-handler';
```

```ts
type PPCPButtonLabel = 'checkout' | 'pay' | 'buynow' | 'subscribe' | 'donate';
```

```ts
type PPCPButtonColor = 'gold' | 'blue' | 'white' | 'black';
```

---

## Errors

### Constructor errors

The constructor throws a plain `Error`. The checks run in this order, and the first one that fails
throws.

| Order | Condition | Message |
|---|---|---|
| 1 | `clientId` is not a string, or is empty | `Required field 'clientId' was not supplied.` |
| 2 | `flow` is `'vault'` and `createVaultSetupToken` is missing or not a function | `For flow 'vault', 'createVaultSetupToken' must be a function.` |
| 3 | `flow` is not `'vault'` and `createOrder` is missing or not a function | `Required field 'createOrder' must be a function.` |
| 4 | `onPaymentResult` is missing or not a function | `Required field 'onPaymentResult' must be a function.` |
| 5 | `currencyCode` is falsy | `Required field 'currencyCode' was not supplied.` |
| 6 | `presentationMode` is `'modal'` | `presentationMode 'modal' is not recommended for desktop and hence not supported. Use 'auto', 'popup', 'redirect' or 'payment-handler'.` |
| 7 | `paymentElements` has no truthy `paypal`, `venmo`, `payLater` or `payPalCredit` entry | `Required field 'paymentElements' must specify at least one of 'paypal', 'venmo', 'payLater', 'payPalCredit'.` |

Checks 2 and 3 are mutually exclusive. Vault flow never requires `createOrder`; checkout flow never
requires `createVaultSetupToken`.

Check 7 also covers a missing `paymentElements` object. You get this message, not a `TypeError`.

### `mount()` errors

`mount()` returns them on the resolved value as `{ error }`. It never throws.

| Cause | `error` |
|---|---|
| The instance is already mounted | `PayPal (PPCP) buttons are already mounted` |
| `window.paypal.createInstance` is not a function, or there is no `window` | `The PayPal Web SDK v6 (window.paypal.createInstance) is not present on the page. Load https://www.paypal.com/web-sdk/v6/core (sandbox: https://www.sandbox.paypal.com/web-sdk/v6/core) before mounting.` |
| `createInstance()` rejected | that error's `message` |
| `findEligibleMethods()` rejected | that error's `message` |
| Either of those rejected with something that is not an `Error` | `Failed to mount PayPal (PPCP) buttons` |

Except for the already-mounted row, a failed `mount()` leaves the instance unmounted. `isMounted()`
is still `false`, so once you have fixed the cause you can call `mount()` again on the same
instance — you do not need `destroy()` first. The already-mounted error comes only from an instance
that mounted successfully and has not been destroyed.

### Log-only messages

These go to the logger. None of them reaches a callback. None of them makes `mount()`
return an `error`. If a button or a message silently fails to appear, look for these.

| Message | Cause |
|---|---|
| `PayPal button container element not found: <elementId>` | The kind was eligible but `document.getElementById` found nothing. Becomes `rendered[kind] = false`. |
| `<kind> is not eligible for this session` | PayPal's eligibility check said no. Becomes `rendered[kind] = false`. Logged at info level. |
| `Failed to set up <kind> button` | Rendering that button threw. Becomes `rendered[kind] = false`. The mount continues. |
| `Pay Later messaging container element not found: <elementId>` | Becomes `messagingRendered: false`. |
| `createPayPalMessages is not available on the PayPal SDK instance.` | PayPal's `paypal-messages` component is missing from the instance. Becomes `messagingRendered: false`. |
| `Failed to set up Pay Later messaging` | Messaging setup threw. Becomes `messagingRendered: false`. The mount continues. |
| `Failed to attach Pay Later learn-more listener` | `createLearnMore` or `attachDefaultListener` threw. Messaging still renders. |
| `Failed to fetch Pay Later message content` | PayPal's `fetchContent` rejected, or your `onReady` / `onContentReady` threw. |
| `Failed to detach Pay Later learn-more listener` | `destroy()` could not unbind PayPal's window listener. |
| `PayPal returned a redirect URL that is not an https PayPal or Venmo host. Not forwarding it to onRedirect.` | The approval URL failed validation. `onRedirect` is not called and no `'Failed'` result is emitted. |
| `onRedirect threw` | Your `onRedirect` threw. No `'Failed'` result is emitted. |

---

## What the SDK sends to PayPal

Useful when you are reading a network trace or a PayPal support ticket.

**`createInstance()`** receives `clientId`, `components`, `pageType`, `partnerAttributionId`, and
`merchantId` / `locale` / `testBuyerCountry` when each is truthy.

`components` is derived from your configured buttons, never configured directly:

| Kind | Component |
|---|---|
| `paypal` | `paypal-payments` |
| `payLater` | `paypal-payments` |
| `payPalCredit` | `paypal-payments` |
| `venmo` | `venmo-payments` |

plus `paypal-messages` when Pay Later messaging is configured.

**`findEligibleMethods()`** receives `currencyCode`, `paymentMethods`, `countryCode` when set, and
then either `paymentFlow: 'VAULT_WITHOUT_PAYMENT'` (vault flow) or `amount` (checkout flow, when
`amount` is set). The request is scoped to exactly the buttons you configured — asking wider
changes PayPal's answer.

The same button has three different names across the request, the response and the DOM, and they
are not interchangeable:

| Kind | Requested as | Answered under | Element rendered |
|---|---|---|---|
| `paypal` | `PAYPAL` | `paypal` | `<paypal-button>` |
| `venmo` | `VENMO` | `venmo` | `<venmo-button>` |
| `payLater` | `PAYPAL_PAY_LATER` | `paylater` | `<paypal-pay-later-button>` |
| `payPalCredit` | `PAYPAL_CREDIT` | `credit` | `<paypal-credit-button>` |

PayPal returns Pay Later **or** PayPal Credit, never both. When both are requested, Pay Later wins.
This is PayPal's behaviour, not the SDK's — the SDK requests and checks the two independently.

**The payment session** is created per button:

| Kind | Session |
|---|---|
| `paypal` | `createPayPalOneTimePaymentSession` |
| `venmo` | `createVenmoOneTimePaymentSession` |
| `payLater` | `createPayLaterOneTimePaymentSession` |
| `payPalCredit` | `createPayPalCreditOneTimePaymentSession` |
| any kind, `flow: 'vault'` | `createPayPalSavePaymentSession` |

Session options carry `onApprove`, `onCancel`, `onError`, plus `commit` and `savePayment` under the
rules in [`commit`, `savePayment` and `fullPageOverlay`](#commit-savepayment-and-fullpageoverlay).

**`session.start()`** receives `presentationMode`, plus `autoRedirect: { enabled: false }` when you
supplied `onRedirect`, `sandboxSupport: { enabled: true }` for a Venmo click with `venmoSandbox`
set, and `fullPageOverlay: { enabled: false }` when `fullPageOverlay` is exactly `false`. Its second
argument is the unresolved promise from your `createOrder` or `createVaultSetupToken`.

---

## `flow: 'vault'` — the full behaviour difference

`flow: 'vault'` saves a PayPal account without taking a payment. Nine things change.

1. `createVaultSetupToken` is required. `createOrder` is not consulted at all.
2. Only the `paypal` button is mounted. `venmo`, `payLater` and `payPalCredit` entries in
   `paymentElements` are filtered out before `createInstance()` and never appear in
   `PPCPMountResult.rendered` — not even as `false`.
3. Eligibility is asked with `paymentFlow: 'VAULT_WITHOUT_PAYMENT'`. `amount` is never sent.
4. Every click creates a `createPayPalSavePaymentSession`.
5. Your `{ setupToken }` is renamed to `{ vaultSetupToken }` before it reaches PayPal.
6. Pay Later messaging is suppressed — there is no purchase to promote financing against — so
   `messagingRendered` is absent from the mount result.
7. A successful approval returns `state: 'Successful'` with `vaultSetupToken`, and no `orderId` or
   `payerId`.
8. `presentationMode: 'redirect'` is required. The approval session completes by navigating rather
   than returning a result to the page.
9. Because of 8, `onPaymentResult` only ever sees `'Cancelled'` and `'Failed'`. Success is handled
   by the return page your `redirect_url` points at.

---

## See also

- [Integration Guide](./INTEGRATION_GUIDE.md) — building each flow end to end.
