# Paze — API Reference

The `SpreedlyPaze` methods, events, and types. Integration steps are in
[INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md).

`SpreedlyPaze` is a **standalone** class (it does not extend `SpreedlyHostedFields` /
`SpreedlyExpressCheckout`). Both CDN bundles expose it as `window.SpreedlyPaze`.

## `SpreedlyPaze`

```js
const paze = new window.SpreedlyPaze(config);
```

| Constructor param | Type | |
|-------------------|------|--|
| `config` | `PazeConfig` | See [PazeConfig](#pazeconfig). |

The constructor **throws synchronously** on missing `clientConfig.id` / `clientConfig.name` /
`clientConfig.profileId` / `paymentElements.paze`, and when `getCheckoutOptions` is not a
function. Construct inside a try/catch if config may be incomplete.

### Methods

#### `on(event, callback)`

Register an event handler. Event names are validated against the list in [Events](#events) —
unknown names are dropped with a console/logger warning.

```js
paze.on('pazeTokenGenerated', (payload) => { /* … */ });
```

#### `setup(): Promise<PazeSetupResult>`

Validates that `window.DIGITAL_WALLET_SDK` is present, calls Paze `initialize` with
`clientConfig`, and emits `pazeReady` on success. **Await it (and/or wait for `pazeReady`) before
any other call.**

It does not reject for a missing script: failures return `{ error: string }` and, when
`initialize()` throws, also emit `pazeError` with `code: 'INITIALIZATION_FAILED'`.

`PazeSetupResult` is `{ error?: string }`. An empty object means success.

#### `mount(): Promise<PazeMountResult>`

Creates the Spreedly-owned `<paze-button>` inside the element named by `paymentElements.paze`,
applies `buttonStyle`, and binds its click to the Paze checkout. **Call it after `setup()`
succeeds** — mounting is the only supported way to start a Paze flow.

```js
await paze.setup();
const { error } = await paze.mount();
if (error) console.error(error);
```

- **`displayMode: 'static'`** (default) — the button is visible straight away.
- **`displayMode: 'dynamic'`** — the button is inserted hidden and revealed by the first
  `canCheckout()` that reports `consumerPresent: true`.

`PazeMountResult` is `{ error?: string }`. It does not throw; failures return `{ error }` and
emit `pazeError` with `NOT_INITIALIZED` (no `setup()`), `MOUNT_FAILED` (container not in the
DOM), or `BUTTON_UNAVAILABLE` (the Paze script never registered `<paze-button>` within 10 s).
Calling `mount()` on an already-mounted instance returns `{ error }` and records no extra
impression.

The SDK only ever touches the element it created inside your container — it never reaches for
the `<paze-button>` the Paze script injects into `document.body`.

#### `isMounted(): boolean`

`true` between a successful `mount()` and `destroy()`.

#### `canCheckout(email): Promise<{ consumerPresent: boolean }>`

Checks whether the email is enrolled in a Paze wallet. Requires a successful `setup()`.
`consumerPresent` is always a boolean (`false` if Paze omits it).

In `dynamic` display mode this also drives the mounted button: it is shown when `consumerPresent`
is true and hidden again when it is false.

Regardless of display mode, every resolution also emits `pazeEligibilityChecked` with
`{ eligible }` — listen for it if your page needs to react to the same pass/fail result (for
example, collapsing your own button container's layout space when the SDK hides its button, so
the eligibility check doesn't leave an empty hole in the page).

#### `checkout(options): Promise<void>`

Reopens the Paze popup to **change the card or shipping address** on the session the button
started — see [checkout() options](#checkout-options).

`actionCode` must be `'CHANGE_CARD'` or `'CHANGE_SHIPPING_ADDRESS'`. Starting a flow
(`'START_FLOW'`, which is also the default when `actionCode` is omitted) is **not supported**:
the mounted button owns that path, and calling it emits `pazeError` with `UNSUPPORTED_ACTION`
without contacting Paze.

`checkout()` itself does not throw for Paze popup outcomes; those surface as `pazeError`. It
**does** throw if `setup()` has not succeeded (`NOT_INITIALIZED`).

#### `complete(options): Promise<void>`

Asks Paze for payment credentials (`securedPayload`). Emits `pazeTokenGenerated` or `pazeError`.
Requires a prior `checkout()` that established a session id.

#### `clear(): void`

Drops the in-memory session id. Call `checkout()` with `START_FLOW` again to begin a new session.

#### `isInitialized(): boolean`

`true` once `setup()` has completed successfully and `destroy()` has not been called.

#### `destroy(): void`

**Terminal** teardown: removes the `<paze-button>` the SDK created, unbinds its click handler,
marks the instance destroyed, clears session state, and resets handlers. Further calls fail
(`setup()` and `mount()` return `{ error }`; other methods emit `NOT_INITIALIZED` and throw).
Create a new `SpreedlyPaze` to start again.

---

## `PazeConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientConfig.id` | `string` | Yes | Paze Client ID |
| `clientConfig.name` | `string` | Yes | Merchant display name |
| `clientConfig.profileId` | `string` | Yes | Paze Profile ID |
| `paymentElements.paze` | `string` | Yes | Id of the element the SDK mounts `<paze-button>` into. |
| `getCheckoutOptions` | `() => PazeCheckoutOptions` | Yes | Read on **every** button click to build the checkout call. See below. |
| `displayMode` | `'static' \| 'dynamic'` | No | Defaults to `'static'`. See [mount()](#mount-promisepazemountresult). |
| `buttonStyle` | `PazeButtonStyle` | No | `<paze-button>` presentation — see [PazeButtonStyle](#pazebuttonstyle). |
| `environmentKey` | `string` | No | Your Spreedly environment key. Sent **masked** on telemetry so Paze activity can be attributed to your environment. |
| `environment` | `'sandbox' \| 'production'` | No | Defaults to `'sandbox'`. Informational (logging); you still choose the Paze script URL. |

### `getCheckoutOptions`

Returns the same shape as [checkout() options](#checkout-options) — minus `actionCode`, which the
SDK sets to `'START_FLOW'`. Because it runs on each click, a cart total or email that changed
since `mount()` is always current.

**It must be synchronous.** Awaiting inside a click handler spends the browser's user-activation
token, and Paze's popup is then blocked. Read values you already have; do not fetch here.

```js
getCheckoutOptions: () => ({
  emailAddress: emailInput.value.trim().toLowerCase(),
  transactionValue: { transactionAmount: cart.total, transactionCurrencyCode: 'USD' },
})
```

If it throws, the SDK emits `pazeError` with `CHECKOUT_FAILED` and the popup does not open.

### `PazeButtonStyle`

| Field | Type | Description |
|-------|------|-------------|
| `color` | `'pazeblue' \| 'midnightblack' \| 'white' \| 'whitewithoutline'` | Paze `color` attribute. Defaults to Paze's own (`pazeblue`). |
| `shape` | `'default' \| 'rectangle' \| 'pill'` | Paze `shape` attribute. |
| `label` | `'checkout' \| 'check out with' \| 'Donate with'` | Paze `label` attribute. Unset uses Paze's own default. |
| `disableMaxHeight` | `boolean` | Sets Paze's `disableMaxHeight` attribute so the button fills a taller container. |

These are read once, at `mount()`. To change them, `destroy()` the instance and construct a new one.

---

## `checkout()` options

`transactionValue` is required. Other fields are optional.

| Option | Type | Description |
|--------|------|-------------|
| `transactionValue` | `{ transactionAmount: string, transactionCurrencyCode: string }` | Amount in **major units** (dollars), e.g. `'10.00'`, plus ISO currency. |
| `emailAddress` | `string` | Shopper email. Use lowercase. Needed when starting a flow (supply it from `getCheckoutOptions`). |
| `intent` | `'EXPRESS_CHECKOUT'` | Express Pay — Paze reduces in-wallet review. Still call `complete()` after `pazeCheckoutComplete`. |
| `actionCode` | `'CHANGE_CARD' \| 'CHANGE_SHIPPING_ADDRESS'` | Required on `checkout()`. `'START_FLOW'` (the default when omitted) is rejected with `UNSUPPORTED_ACTION` — the mounted button starts flows. |
| `sessionId` | `string` | Unused by the adaptor today — the SDK always sends its own generated session id. |
| `shippingPreference` | `'NONE' \| string` | Forwarded to Paze when set. |

---

## `complete()` options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `transactionType` | `'PURCHASE' \| 'CARD_ON_FILE' \| 'BOTH'` | Yes | Paze transaction type. |
| `transactionValue` | `{ transactionAmount: string, transactionCurrencyCode: string }` | Yes | Same shape as checkout (major units). |
| `billingPreference` | `'ALL' \| 'NONE' \| 'ZIP_ONLY'` | No | Defaults to `'ALL'`. |
| `merchantCategoryCode` | `string` | No | Defaults to `'5999'`. |

The adaptor always sends `payloadTypeIndicator: 'PAYMENT'` inside `transactionOptions`.

---

## Events

Register with `paze.on(name, cb)`.

| Event | Payload | Fires when |
|-------|---------|-----------|
| `pazeReady` | `undefined` | `setup()` initialized the Paze SDK. |
| `pazeEligibilityChecked` | `{ eligible: boolean }` | Every `canCheckout()` resolution, in either display mode. In `dynamic` mode this coincides with the SDK showing/hiding its button — use it to also toggle your own button container so no empty hole is left when the button is hidden. |
| `pazeButtonClicked` | `undefined` | Shopper clicked the SDK-owned `<paze-button>`. Checkout starts immediately after. Use this for merchant UI (status, locking a review panel) — do not listen on the container. |
| `pazeCheckoutComplete` | `PazeCheckoutResult` | Shopper finished the popup with `result === 'COMPLETE'`. |
| `pazeTokenGenerated` | `PazeCompleteResult` | `complete()` returned `securedPayload`. Send this to your server. |
| `pazeError` | `PazeError` | Any Paze flow error. |

### `PazeCheckoutResult` (typical fields)

All nested fields are optional; Paze may omit them.

| Field | Description |
|-------|-------------|
| `maskedCard` | Brand, last four, expiry, `digitalCardId`, billing address, card art URI |
| `consumer` | Name, email, mobile, country |
| `shippingAddress` | Address lines plus optional delivery contact |
| `sessionId` | Session id from the checkout JWT |

### `PazeCompleteResult`

| Field | Type | Description |
|-------|------|-------------|
| `securedPayload` | `string` | Encrypted payload for Spreedly `third_party_network_token.secured_payload` |
| `sessionId` | `string` | Session id for `session_id` |
| `payloadId` | `string` | Payload id for `payload_id` |

### `PazeError`

```ts
{ code: PazeErrorCode; message: string; details?: unknown }
```

| Error code | Scenario | Recommended action |
|-----------|----------|-------------------|
| `INITIALIZATION_FAILED` | `DIGITAL_WALLET_SDK.initialize()` threw | Verify client config. Sandbox 503 on `/api/v1/iwa/messages` is a Paze environment issue — retry or contact Paze. |
| `NOT_INITIALIZED` | Method called before `setup()`, after `destroy()`, missing script at call time, or `complete()` before checkout | Load the Paze script, await `pazeReady`, then call methods in order |
| `MOUNT_FAILED` | `mount()` could not find the element named by `paymentElements.paze` | Render the container before calling `mount()` |
| `BUTTON_UNAVAILABLE` | The Paze script did not register `<paze-button>` within 10 s | Check the Paze script tag is present at the end of `<body>` and not blocked by CSP |
| `UNSUPPORTED_ACTION` | `checkout()` was called with `actionCode: 'START_FLOW'` (or no `actionCode`) | Start flows from the mounted button; use `checkout()` only for `CHANGE_CARD` / `CHANGE_SHIPPING_ADDRESS` |
| `CHECKOUT_INCOMPLETE` | User closed the popup or session timed out (`result` other than `COMPLETE`) | Show retry |
| `CHECKOUT_FAILED` | The Paze checkout threw, `getCheckoutOptions` threw, or the button reported an error | Check popup blockers and that `getCheckoutOptions` is synchronous and total |
| `COMPLETE_FAILED` | `complete()` failed | Retry or use another payment method |
| `NO_SECURED_PAYLOAD` | Complete JWT has no `securedPayload` | Contact support |

If `setup()` returns `{ error }` without emitting `pazeError`, the Paze SDK script is not on the
page. Add the script tag from the [integration guide](./INTEGRATION_GUIDE.md).
