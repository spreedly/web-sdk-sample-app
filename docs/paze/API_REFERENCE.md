# Paze — API Reference

The `SpreedlyPaze` methods and events used by the sample app, plus the demo's HTTP endpoint.
Merchant integration steps and demo controls are in [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md).

`SpreedlyPaze` is a **standalone** class. Both Spreedly CDN bundles expose `window.SpreedlyPaze`.

## `SpreedlyPaze`

```js
const paze = new window.SpreedlyPaze(authDetails, config);
```

| Constructor param | Type | |
|-------------------|------|--|
| `authDetails` | `{ environment_key, certificate_token, nonce, signature, timestamp }` | From `SpreedlyUtils.fetchAuthParams()` in the demo. |
| `config` | `PazeConfig` | See [PazeConfig](#pazeconfig). |

The constructor **throws synchronously** on: invalid/incomplete `authDetails`, or missing
`clientConfig.id` / `clientConfig.name` / `clientConfig.profileId`.

The demo constructs this in `src/static/paze/paze.js` after loading the Spreedly script.

### Methods

#### `on(event, callback)`

Register an event handler. Unknown names are dropped with a logger warning. See [Events](#events).

```js
paze.on('pazeTokenGenerated', (payload) => { /* … */ });
```

#### `setup(): Promise<PazeSetupResult>`

Validates `window.DIGITAL_WALLET_SDK`, initializes Paze with `clientConfig`, emits `pazeReady`.
**Await it before `canCheckout` / `checkout`.** Missing script returns `{ error: string }` instead
of throwing. `initialize()` failures also emit `pazeError` (`INITIALIZATION_FAILED`).

#### `canCheckout(email): Promise<{ consumerPresent: boolean }>`

Wallet enrollment check. The demo calls this on email blur and, in dynamic button mode, hides
`<paze-button>` unless `consumerPresent` is true.

#### `checkout(options): Promise<void>`

Opens the Paze popup. Outcomes arrive as `pazeCheckoutComplete` or `pazeError`. Throws if
`setup()` has not succeeded.

The demo passes `emailAddress`, `transactionValue`, and optionally `intent: 'EXPRESS_CHECKOUT'`.
Change Card / Change Shipping use `actionCode` `'CHANGE_CARD'` / `'CHANGE_SHIPPING_ADDRESS'`.

#### `complete(options): Promise<void>`

Retrieves `securedPayload`. Emits `pazeTokenGenerated` or `pazeError`. Requires a prior
`checkout()` session.

The demo always sends `transactionType: 'PURCHASE'` and the same `transactionValue` as checkout.

#### `clear(): void`

Clears the in-memory session id.

#### `isInitialized(): boolean`

`true` after successful `setup()` until `destroy()`. The demo gates `canCheckout` on this.

#### `destroy(): void`

Terminal teardown. The demo calls this on `beforeunload`.

---

## `PazeConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientConfig.id` | `string` | Yes | Paze Client ID |
| `clientConfig.name` | `string` | Yes | Merchant display name |
| `clientConfig.profileId` | `string` | Yes | Paze Profile ID |
| `environment` | `'sandbox' \| 'production'` | No | Demo uses `'sandbox'` |

---

## `checkout()` options

| Option | Type | Description |
|--------|------|-------------|
| `transactionValue` | `{ transactionAmount: string, transactionCurrencyCode: string }` | Required. Demo uses `'10.00'` / `'USD'` (major units). |
| `emailAddress` | `string` | Shopper email (lowercase). Used on `START_FLOW`. |
| `intent` | `'EXPRESS_CHECKOUT'` | Express Pay. Demo still calls `complete()` after `pazeCheckoutComplete`. |
| `actionCode` | `'START_FLOW' \| 'CHANGE_CARD' \| 'CHANGE_SHIPPING_ADDRESS'` | Defaults to `'START_FLOW'`. |
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
| `pazeReady` | `undefined` | Paze initialized. Demo enables the payment section / button. |
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
| `NOT_INITIALIZED` | Called before `setup()`, after `destroy()`, or `complete()` before `checkout()` | Wait for `pazeReady`; call methods in order |
| `CHECKOUT_INCOMPLETE` | Popup closed or timed out | Retry |
| `CHECKOUT_FAILED` | `checkout()` threw | Check popup blockers |
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
