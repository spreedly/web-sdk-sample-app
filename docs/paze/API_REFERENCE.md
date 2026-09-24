# Paze — API Reference

The `SpreedlyPaze` methods and events used by the sample app, plus the demo's HTTP endpoint.
Merchant integration steps and demo controls are in [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md).

`SpreedlyPaze` is a **standalone** class. Both Spreedly CDN bundles expose `window.SpreedlyPaze`.

## `SpreedlyPaze`

```js
const paze = new window.SpreedlyPaze(config);
```

| Constructor param | Type | |
|-------------------|------|--|
| `config` | `PazeConfig` | See [PazeConfig](#pazeconfig). |

The constructor **throws synchronously** on missing `clientConfig.id` / `clientConfig.name` /
`clientConfig.profileId` / `paymentElements.paze`, or a non-function `getCheckoutOptions`.

The demo constructs this in `src/static/paze/paze.js` (`createAndMountPaze()`) after loading the
Spreedly script.

### Methods

#### `on(event, callback)`

Register an event handler. Unknown names are dropped with a logger warning. See [Events](#events).

```js
paze.on('pazeTokenGenerated', (payload) => { /* … */ });
```

#### `setup(): Promise<PazeSetupResult>`

Validates `window.DIGITAL_WALLET_SDK`, initializes Paze with `clientConfig`, emits `pazeReady`.
**Await it before `mount` / `canCheckout`.** Missing script returns `{ error: string }` instead
of throwing. `initialize()` failures also emit `pazeError` (`INITIALIZATION_FAILED`).

#### `mount(): Promise<PazeMountResult>`

Creates the SDK-owned `<paze-button>` inside `paymentElements.paze` and wires its click to the
Paze checkout. Returns `{ error?: string }`; failures also emit `pazeError` with `MOUNT_FAILED`
(container missing) or `BUTTON_UNAVAILABLE` (the Paze script never registered the element).

The demo mounts into the empty `#paze-button-container` in `src/static/paze/index.html`. It never
creates a `<paze-button>` of its own.

#### `isMounted(): boolean`

`true` between a successful `mount()` and `destroy()`.

#### `canCheckout(email): Promise<{ consumerPresent: boolean }>`

Wallet enrollment check. The demo calls this on email blur; in dynamic display mode this is what
reveals the SDK's button (and records the impression).

#### `checkout(options): Promise<void>`

Reopens the popup to change card or shipping. Outcomes arrive as `pazeCheckoutComplete` or
`pazeError`. Throws if `setup()` has not succeeded.

`actionCode` must be `'CHANGE_CARD'` or `'CHANGE_SHIPPING_ADDRESS'` — the demo's Change Card /
Change Shipping Address buttons. Starting a flow (`'START_FLOW'`, or omitting `actionCode`) is
rejected with `pazeError` / `UNSUPPORTED_ACTION`; the mounted button starts flows, using the
`getCheckoutOptions` callback the demo supplies for `emailAddress`, `transactionValue`, and the
optional `intent: 'EXPRESS_CHECKOUT'`.

#### `complete(options): Promise<void>`

Retrieves `securedPayload`. Emits `pazeTokenGenerated` or `pazeError`. Requires a prior
`checkout()` session.

The demo always sends `transactionType: 'PURCHASE'` and the same `transactionValue` as checkout.

#### `clear(): void`

Clears the in-memory session id.

#### `isInitialized(): boolean`

`true` after successful `setup()` until `destroy()`. The demo gates `canCheckout` on this.

#### `destroy(): void`

Terminal teardown; removes the `<paze-button>` the SDK mounted. The demo calls this on
`beforeunload`, and again in `rebuildPazeInstance()` — `displayMode` and `buttonStyle` are read
once at `mount()`, so the display/color/shape controls destroy the instance and build a new one.

---

## `PazeConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientConfig.id` | `string` | Yes | Paze Client ID |
| `clientConfig.name` | `string` | Yes | Merchant display name |
| `clientConfig.profileId` | `string` | Yes | Paze Profile ID |
| `paymentElements.paze` | `string` | Yes | Container element id. Demo uses `'paze-button-container'`. |
| `getCheckoutOptions` | `() => PazeCheckoutOptions` | Yes | Called on each button click. **Must be synchronous** — awaiting would spend the click's user activation and Paze's popup would be blocked. Demo returns the current email, `TRANSACTION_VALUE`, and the selected `intent`. |
| `displayMode` | `'static' \| 'dynamic'` | No | Defaults to `'static'`. Demo binds it to the Button Display control. |
| `buttonStyle` | `{ color?, shape?, disableMaxHeight? }` | No | Demo binds it to the Color / Shape / Disable max height controls. |
| `environmentKey` | `string` | No | Masked onto telemetry. Demo reads it from `GET /api/v1/auth/params`. |
| `environment` | `'sandbox' \| 'production'` | No | Demo uses `'sandbox'` |

---

## `checkout()` options

Also the shape `getCheckoutOptions` returns, minus `actionCode`.

| Option | Type | Description |
|--------|------|-------------|
| `transactionValue` | `{ transactionAmount: string, transactionCurrencyCode: string }` | Required. Demo uses `'10.00'` / `'USD'` (major units). |
| `emailAddress` | `string` | Shopper email (lowercase). Demo supplies it from `getCheckoutOptions`. |
| `intent` | `'EXPRESS_CHECKOUT'` | Express Pay. Demo still calls `complete()` after `pazeCheckoutComplete`. |
| `actionCode` | `'CHANGE_CARD' \| 'CHANGE_SHIPPING_ADDRESS'` | Required on `checkout()`. `'START_FLOW'` (the default when omitted) is rejected — the mounted button starts flows. |
| `shippingPreference` | `'NONE' \| string` | Forwarded to Paze when set. |

---

## `complete()` options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `transactionType` | `'PURCHASE' \| 'CARD_ON_FILE' \| 'BOTH'` | Yes | Demo uses `'PURCHASE'`. |
| `transactionValue` | `{ transactionAmount: string, transactionCurrencyCode: string }` | Yes | Same as checkout. |
| `billingPreference` | `'ALL' \| 'NONE' \| 'ZIP_ONLY'` | No | SDK default `'ALL'`. |
| `merchantCategoryCode` | `string` | No | SDK default `'5999'`. |

---

## Events

| Event | Payload | Fires when |
|-------|---------|-----------|
| `pazeReady` | `undefined` | Paze initialized. Demo is then safe to `mount()`. |
| `pazeButtonClicked` | `undefined` | Shopper clicked the SDK-owned button. Demo resets review/result panels and shows "Opening Paze checkout...". |
| `pazeCheckoutComplete` | `PazeCheckoutResult` | Popup completed. Demo shows the review panel, or auto-`complete()` in Express Pay. |
| `pazeTokenGenerated` | `PazeCompleteResult` | `securedPayload` ready. Demo POSTs `/api/v1/paze-payment-method`. |
| `pazeError` | `PazeError` | Flow error. Demo shows `code` + `message`. |

### `PazeCompleteResult`

| Field | Type | Description |
|-------|------|-------------|
| `securedPayload` | `string` | Encrypted payload for Spreedly |
| `sessionId` | `string` | Session id |
| `payloadId` | `string` | Payload id |

### `PazeError`

```ts
{ code: PazeErrorCode; message: string; details?: unknown }
```

| Error code | Scenario | Recommended action |
|-----------|----------|-------------------|
| `INITIALIZATION_FAILED` | `initialize()` threw | Verify client config / Paze sandbox health |
| `NOT_INITIALIZED` | Called before `setup()`, after `destroy()`, or `complete()` before checkout | Wait for `pazeReady`; call methods in order |
| `MOUNT_FAILED` | `mount()` could not find `#paze-button-container` | Render the container before mounting |
| `BUTTON_UNAVAILABLE` | Paze script never registered `<paze-button>` (10 s) | Check the Paze script tag and CSP |
| `UNSUPPORTED_ACTION` | `checkout()` called with `START_FLOW` / no `actionCode` | Let the mounted button start the flow |
| `CHECKOUT_INCOMPLETE` | Popup closed or timed out | Retry |
| `CHECKOUT_FAILED` | The checkout threw, `getCheckoutOptions` threw, or the button reported an error | Check popup blockers; keep `getCheckoutOptions` synchronous |
| `COMPLETE_FAILED` | `complete()` failed | Retry or another payment method |
| `NO_SECURED_PAYLOAD` | Complete JWT missing payload | Contact support |

---

## Sample app HTTP API

### `POST /api/v1/paze-payment-method`

Creates a Spreedly payment method from the Paze `securedPayload`.

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md#post-apiv1paze-payment-method) for the request
body, Spreedly mapping, and response shape.

### Env used by the server

| Variable | Purpose |
|----------|---------|
| `PAZE_CERTIFICATE_TOKEN` | `third_party_network_token.certificate_token` |
| `PAZE_CLIENT_ID` / `PAZE_CLIENT_NAME` / `PAZE_PROFILE_ID` | Loaded in `src/config.ts` (page client config is in `paze.js`) |
