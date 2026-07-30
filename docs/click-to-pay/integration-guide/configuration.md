# Configuration

Every option passed to `new SpreedlyClickToPay(authDetails, config)`. Only `c2pConfig` and `cardsEl`
are required; everything else has a sensible default.

```js
const c2p = new window.SpreedlyClickToPay(authDetails, {
  fields: { number: { containerId: '…' }, cvv: { containerId: '…' } }, // see §0
  c2pConfig: { /* Mastercard init config — see §1 */ },
  cardsEl: 'c2p-card-list',
  otpEl: 'c2p-otp-input',
  checkoutPresentation: 'popup',
  doLookup: true,
  rememberMe: false,
  displayCards: { /* … */ },
  customer: { /* … */ },
  isSandbox: false,
});
```

> Per-checkout options (`creditCard`, `complianceSettings`, `dpaTransactionOptions`,
> `paymentMethodOptions`, `tokenize`) are passed to **`checkout()`**, not here — see
> [api-reference.md](./api-reference.md) and [tokenization.md](./tokenization.md).

---

## 0. `fields` — the hosted card fields (recommended)

Container ids for the SDK's two secure card iframes. When set, the SDK **creates and manages its
own `SpreedlyHostedFields` instance**: the fields mount during `init()`, tokenization runs inside
the number iframe automatically (no `tokenize` callback), and the instance is exposed as
`c2p.hostedFields` (full public API — styling, events, `encryptCardForClickToPay`).

```js
fields: {
  number: { containerId: 'card-number-field' }, // may sit in a hidden section (saved-card-only UIs)
  cvv:    { containerId: 'cvv-field' },
}
```

Both fields are always required — the number iframe is the tokenization engine and the CVV holder,
even when card entry isn't visible. Hide its container with CSS if your UI never shows card entry.

**Advanced alternative — `hostedFields`:** if you manage your own `SpreedlyHostedFields` instance,
pass it here instead of `fields` (mutually exclusive — passing both throws) to get the same
automatic in-iframe tokenization. Or skip both and wire `checkout({ tokenize })` per call.

## 1. `c2pConfig` — Mastercard init config (required)

Passed through to Mastercard's `Click2Pay.init()`.

```js
c2pConfig: {
  dpaData: { dpaPresentationName: 'Your Store', dpaName: 'YourStoreLegalName' },
  dpaTransactionOptions: {
    dpaLocale: 'en_US',
    transactionAmount: { transactionAmount: 42.0, transactionCurrencyCode: 'USD' },
    dpaBillingPreference: 'FULL',
  },
  cardBrands: ['mastercard', 'visa', 'amex', 'discover'],
}
```

| Field | Type | Notes |
|-------|------|-------|
| `dpaData.dpaPresentationName` | `string` | Store name shown inside Mastercard's checkout window |
| `dpaData.dpaName` | `string` | Your registered DPA name |
| `dpaTransactionOptions.dpaLocale` | `string` | e.g. `'en_US'` |
| `dpaTransactionOptions.transactionAmount` | `{ transactionAmount: number, transactionCurrencyCode: string }` | Amount shown in Mastercard's checkout window. **In the currency unit (dollars for USD), not cents** — `$42` is `42.0`, not `4200`. |
| `dpaTransactionOptions.dpaBillingPreference` | `'NONE' \| 'FULL' \| 'POSTAL_COUNTRY'` | How much billing address Mastercard collects. Default `'NONE'`; use `'FULL'` to have the checkout window collect a full billing address. |
| `dpaTransactionOptions.paymentOptions` | `Array<{ dynamicDataType: string }>` | Advanced: dynamic-data (DSRP) options. Usually omit. |
| `cardBrands` | `('mastercard'\|'visa'\|'amex'\|'discover')[]` | Brands you accept. |
| `srcDpaId` | `string` | **Optional here** — the SDK reads it from the `lib.js` script tag's `?srcDpaId=`. Only set it to override. |
| `recognitionToken` | `string` | See [§7](#7-recognitiontoken). |

> **The amount is set twice, in different units, on purpose.** Mastercard's window (`c2pConfig`)
> wants **dollars** (`42.0`); Spreedly's later purchase call wants the smallest unit — **cents**
> (`4200`). This is expected. For a cart amount that isn't known until checkout, override it
> per-checkout (see [§8](#8-updating-the-amount-at-checkout)).

## 2. Element IDs

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `cardsEl` | `string` | **Yes** | ID of your `<src-card-list>` element. The SDK drives it when the saved-card list is ready. |
| `otpEl` | `string` | No | ID of your `<src-otp-input>` element. When set, the SDK drives the OTP UI for you on OTP initiation. Omit it to drive OTP yourself (via `otp-initiated` / `submitOtp` / `resendOtp`). |
| `checkoutContainerEl` | `string` | Only for `drawer` | ID of the element the SDK mounts the checkout iframe into (see [§4](#4-checkout-presentation)). |
| `c2pFrameEl` | `string` | No | Window/iframe name used for the checkout popup/drawer. |

See [components.md](./components.md) for the markup these IDs point at.

## 3. Behavior

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `doLookup` | `boolean` | `true` | Run `lookup()` automatically right after `init()`. Set `false` to trigger lookup yourself (e.g. from a "Continue" button once the shopper types their email). |
| `rememberMe` | `boolean` | `false` | Request device recognition at checkout, so this browser is recognized next time (subject to the shopper's consent and browser cookie policy — see the recognition note in [flows.md](./flows.md)). |
| `isSandbox` | `boolean` | `false` | Verbose logging + sandbox tokenization. Use in test. |

## 4. Checkout presentation

Controls how Mastercard's checkout window (the DCF) appears.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `checkoutPresentation` | `'popup' \| 'drawer'` | `'popup'` | `'popup'` opens a `window.open` popup. `'drawer'` renders the checkout inside an **on-page iframe** (no popup blockers). |
| `checkoutContainerEl` | `string` | — | **Required for `'drawer'`** — the element the SDK fills with the checkout iframe. If it can't be resolved, the SDK falls back to a popup. |
| `c2pFrameStyle` | `string` | `'width=600,height=720'` | Popup window features (popup mode only). |

> **Drawer mode:** the SDK only mounts the iframe and makes it fill your container. The drawer chrome
> — panel, backdrop, open/close animation, and showing/hiding it on the `checkout-window-open` /
> `checkout-window-close` events — is **yours** to build. See [components.md](./components.md).

## 5. `displayCards` — saved-card list options

Passed to Mastercard's `<src-card-list>`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `displaySignOut` | `boolean` | `true` | Show the "not your cards" / sign-out link. |
| `displayPreferredCard` | `boolean` | `true` | Highlight the shopper's preferred card. |
| `displayAddCard` | `boolean` | `true` | Show the "add a card" link. |
| `cardSelectionType` | `'radioButton' \| 'gridView'` | `'radioButton'` | Card list layout. |

## 6. `customer` — prefilled identity for lookup

Optional. If you already know the shopper's email/mobile, prefill it so `lookup()` can run without
extra input.

| Field | Type | Description |
|-------|------|-------------|
| `email` | `string` | Shopper email. |
| `phone` | `{ number: string, countryCode: string }` | Shopper mobile. |
| `mainLookupMethod` | `'email' \| 'phoneNumber'` | Which identifier to try first when both are present. Default prefers **email**; `'phoneNumber'` tries phone first. |

> You can also pass identity directly to `lookup({ email })` / `lookup({ phone })` at call time —
> see [api-reference.md](./api-reference.md).

## 7. `recognitionToken`

A recognition token (JWT) replayed on `init()` so a previously-enrolled shopper is recognized
**without** lookup/OTP — and it works regardless of third-party-cookie policy.

**Important:** Mastercard does **not** return this token in the client-side checkout response, so
the SDK can't capture it for you. It must be obtained **server-side** (through Spreedly) and supplied
here. Today nothing in the SDK produces it — this option is the documented hook for when that
server-side support is available. See the recognition note in [flows.md](./flows.md).

## 8. Updating the amount at checkout

`c2pConfig.dpaTransactionOptions.transactionAmount` is set at `init()` (page load), which is often
before the final cart total is known. To show the **real** amount in Mastercard's window, pass the
current amount at checkout time — it's merged over the init config:

```js
await c2p.checkout({
  /* … */
  dpaTransactionOptions: {
    transactionAmount: { transactionAmount: getCartTotal(), transactionCurrencyCode: 'USD' }, // dollars
  },
});
```

Details in [tokenization.md](./tokenization.md).
