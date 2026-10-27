# Cash App Pay — API Reference

`SpreedlyCashAppPay` is exposed as `window.SpreedlyCashAppPay` by both the Hosted Fields
(`index.js`) and Express Checkout (`express-checkout.js`) bundles. It is standalone: it doesn't
need a `SpreedlyHostedFields` or `SpreedlyExpressCheckout` instance.

> The token exchange is a **mock** until Spreedly Core's Cash App API ships. See the
> [Integration Guide](./INTEGRATION_GUIDE.md).

## `SpreedlyCashAppPay`

```javascript
new SpreedlyCashAppPay(config: CashAppPayConfig)
```

Throws `Error` if the config is invalid.

### Methods

#### `on(event, callback)`

Registers a callback for one of the [events](#events). Unknown event names are ignored with a
logged warning.

#### `setup(): Promise<CashAppPaySetupResult>`

Waits (up to 10 s) for the merchant-loaded Pay Kit, calls `CashApp.pay({ clientId })`, starts
listening for Pay Kit events and emits `cashAppReady`. Resolves `{}` or `{ error }`. Calling it
again returns the same result.

#### `beginCheckout(options): Promise<CashAppPayCheckoutResult>`

First call: creates the Pay Kit customer request and renders the button into `renderTarget`.
Later calls: update the amount / `referenceId` of the current request. Resolves `{}` or
`{ error }`.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `amount` | `number` | Yes | Positive integer in cents (`1234` = $12.34). |
| `currency` | `'USD'` | No | Defaults to USD, the only supported currency. |
| `referenceId` | `string` | No | Your order or cart ID, at most 1024 characters. Overrides the config value. |

#### `restart(): void`

Clears the current customer request and the Pay Kit UI so `beginCheckout()` can start a new one.

#### `isInitialized(): boolean`

`true` after a successful `setup()` and before `destroy()`.

#### `destroy(): void`

Removes Pay Kit listeners and UI and drops all callbacks. Later calls return an error.

## `CashAppPayConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `authDetails` | `AuthDetails` | Yes | `{ environment_key, certificate_token, nonce, signature, timestamp }`, signed server-side. Copied and frozen; a new checkout needs a new instance. |
| `clientId` | `string` | Yes | Cash App Client ID. A prefix that doesn't match `environment` logs a warning. |
| `merchantId` | `string` | Yes | Cash App Network API merchant ID (Pay Kit's payment `scopeId`). |
| `redirectURL` | `string` | Yes | Absolute `https` URL where mobile shoppers return. `http` only on localhost. |
| `renderTarget` | `string \| HTMLElement` | Yes | CSS selector or element for the button. |
| `environment` | `'sandbox' \| 'production'` | No | Default `'sandbox'`. Must match the Pay Kit script you load. |
| `referenceId` | `string` | No | Default reference for customer requests. |
| `button` | `CashAppPayButtonOptions` | No | Button presentation, below. |

### `CashAppPayButtonOptions`

| Field | Values (default first) |
|-------|------------------------|
| `label` | `cashAppPay`, `cashApp`, `pay`, `buy`, `cashOut`, `checkout`, `continue`, `connect` |
| `shape` | `round`, `semiround` |
| `size` | `medium`, `small` |
| `theme` | `dark`, `light`, `monochromeDark`, `monochromeLight`, `green` |
| `width` | `static`, `full` |

## Events

| Event | Payload | When |
|-------|---------|------|
| `cashAppReady` | — | `setup()` succeeded. |
| `cashAppApproved` | `CashAppPayApprovedEvent` | The shopper approved in Cash App. |
| `cashAppTokenGenerated` | `CashAppPayTokenGeneratedEvent` | The approval became a Spreedly payment method. |
| `cashAppDeclined` | — | The shopper declined in Cash App. |
| `cashAppDismissed` | — | The shopper closed the QR code / Pay Kit UI. |
| `cashAppError` | `CashAppPayError` | Any failure. |

`cashAppApproved` and `cashAppTokenGenerated` fire at most once per customer request.

### `CashAppPayApprovedEvent`

| Field | Type | Description |
|-------|------|-------------|
| `cashtag` | `string?` | The shopper's $Cashtag. |
| `expiresAt` | `string?` | ISO timestamp when the payment grant expires. |
| `referenceId` | `string?` | The request's `referenceId`. |

The grant ID is not exposed; the SDK exchanges it for the token.

### `CashAppPayTokenGeneratedEvent`

| Field | Type | Description |
|-------|------|-------------|
| `token` | `string` | Spreedly payment method token. Currently a mock, prefixed `mock_`. |
| `paymentMethod` | `object` | The payment method. Currently `{ token, payment_method_type: 'cash_app_pay', cashtag, storage_state, created_at, updated_at, mock: true }`. |

### `CashAppPayError`

`{ code: CashAppPayErrorCode, message: string, details?: unknown }`. Codes are listed in the
[Integration Guide](./INTEGRATION_GUIDE.md#errors).
