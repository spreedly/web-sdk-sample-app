# ACH Hosted Fields — API Reference

`SpreedlyACHFields` — secure hosted fields for collecting a US/Canadian bank account. Exposed
as `window.SpreedlyACHFields` from the Hosted Fields bundle. Standalone: it does not extend
`SpreedlyHostedFields`/`SpreedlyExpressCheckout` and needs no other SDK instance.

See the [Integration Guide](./INTEGRATION_GUIDE.md) for the end-to-end flow.

## Constructor

### `new SpreedlyACHFields(authDetails)`

Creates an instance. Throws if any auth field is missing.

| `authDetails` field | Type     | Required |
| ------------------- | -------- | -------- |
| `environment_key`   | `string` | yes      |
| `certificate_token` | `string` | yes      |
| `nonce`             | `string` | yes      |
| `signature`         | `string` | yes      |
| `timestamp`         | `string` | yes      |

## Lifecycle

### `inAppElements(config): void`

Mounts the two secure iframes into your containers. Fires `ready` once both are loaded
and connected. Warns and skips a field whose container is missing. A second call while the
fields are mounted is ignored with a warning — use `reload()` to start over.

Both fields take digits only. Other characters are blocked as they're typed, so they never
appear; pasted text keeps only its digits. (Same behavior as the card number and CVV fields.)

```ts
ach.inAppElements({
  routing: { containerId: 'ach-routing' },
  account: { containerId: 'ach-account' },
});
```

| `config` field       | Type                    | Required | Notes                                    |
| -------------------- | ----------------------- | -------- | ---------------------------------------- |
| `routing.containerId`| `string`                | yes      | id of the element to host the routing iframe |
| `account.containerId`| `string`                | yes      | id of the element to host the account iframe |

### `reload(): void`

Removes both iframes and mounts new ones in the same containers. Keeps the instance, the
auth details and your `on()` callbacks; `ready` fires again. Typed values are discarded with
the old iframes and `set*` customizations are reset, so apply them again in your `ready` callback. Ignored
before `inAppElements()` and after `destroy()`.

### `isLoaded(): boolean`

`true` while the fields are mounted and the instance is active. Doesn't wait for `ready`.
Always `false` after `destroy()`.

### `destroy(): void`

Removes both iframes (the bank data in them is discarded with them) and the message
listener, and drops all callbacks. The instance cannot be reused after this.

## Tokenization

### `submit(formData?): void`

Tokenizes the bank account entered in the secure fields. Emits `tokenGenerated` on
success (and securely clears the fields), `error` on failure. Throttled to one call per
2 seconds. The routing and account numbers are read from the iframes — any bank number
keys in `formData` are ignored.

| `formData` field        | Type                       | Required | Notes                                          |
| ----------------------- | -------------------------- | -------- | ---------------------------------------------- |
| `fullName`              | `string`                   | †        | Either `fullName` OR (`firstName` AND `lastName`) |
| `firstName` / `lastName`| `string`                   | †        | See above                                      |
| `bankName`              | `string`                   | no       |                                                |
| `bankAccountType`       | `'checking' \| 'savings'`  | no       |                                                |
| `bankAccountHolderType` | `'personal' \| 'business'` | no       |                                                |
| `metadata`              | `Record<string, string>`   | no       | Forwarded to Spreedly                          |
| `mandate`               | `object`                   | no       | Forwarded to Spreedly                          |

### `validate(): void`

Posts a one-off validation snapshot on the `validation` event (see event shape below).

## Field configuration

### `toggleMask(): void`

Reveals or re-masks the account number field (it mounts masked).

### `setPlaceholder(field, placeholder): void`
### `setLabel(field, label): void`
### `setStyles(field, styles): void`
### `transferFocus(field): void`

Customize one hosted field. `field` is `'routing'` or `'account'`. `setStyles` takes a
`Record<string, string>` of camelCase CSS properties; `setLabel` sets `aria-label` and
`title`.

### `setPlaceholderStyles(styles): void`

Styles the placeholder text of both fields. Same as the card hosted fields' method. Allowed
properties: `color`, `fontFamily`, `fontSize`, `fontStyle`, `fontWeight`, `letterSpacing`,
`lineHeight`, `opacity`, `textAlign`. Anything else, or a value containing CSS syntax, is
ignored. Each call replaces the previous placeholder styles.

### `resetFields(): void`

Clears both inputs and securely wipes the held values.

## Events — `on(event, callback)`

`removeHandlers()` removes every callback registered with `on()`. The fields keep working.

| Event             | Payload                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `ready`           | `{ message: string }` — both fields mounted and connected               |
| `tokenGenerated`  | `{ message: 'Token generated', tokenResponse }` — `tokenResponse` is the whole Spreedly transaction, same as card hosted fields. Token: `tokenResponse.payment_method.token`. Bank numbers are masked by Spreedly (`routing_number: "021*"`, `account_number: "*3210"`). |
| `error`           | A string for SDK-side failures: `'Routing number is invalid'`, `'Account number is invalid'`, `'Please wait before submitting again'`, `'Auth credentials cannot be changed after initial use'`. Spreedly's error body when Spreedly rejects the request. |
| `validation`      | `ACHValidation` (below) — from `validate()` or a blocked submit         |
| `fieldStateChange`| `ACHValidation` + `{ action, field, focused }` — streamed as the customer types |

`ACHValidation`:

| Field           | Type      | Notes                                              |
| --------------- | --------- | -------------------------------------------------- |
| `validRouting`  | `boolean` | 9 digits and passes the US ABA checksum, or 9 digits starting with `0` (sent to Spreedly to check; may be Canadian) |
| `validAccount`  | `boolean` | 4–17 digits                                        |
| `routingLength` | `number`  | current length — never the value                   |
| `accountLength` | `number`  | current length — never the value                   |

On `fieldStateChange`, `field` is `'routing' | 'account'`, `action` is
`'input' | 'focus' | 'blur' | 'enter'`, and `focused` is a boolean.

## Telemetry

`SpreedlyACHFields` emits its own `ach.*` events, never the card ones: `ach.initialized`,
`ach.iframe.loaded`, `ach.tokenization.completed`, `ach.tokenization.throttled`,
`ach.api.response`, `ach.error.emitted`, `ach.method_invoked` and a few more. None carries a
bank number. See the ACH section of
[TELEMETRY_EVENTS_REFERENCE](https://github.com/spreedly/checkout-web-sdk/blob/main/docs/monitoring/TELEMETRY_EVENTS_REFERENCE.md#ach).

## Notes

- ACH data is not PCI-scoped (bank accounts are not cardholder data). The hosted fields
  keep the numbers out of your application state, reducing Nacha data-security exposure.
- The deprecated merchant-collected API (`setupACHPayment` / `submitACHPayment` /
  `clearACHPayment`) is documented in [DEPRECATED_API.md](../DEPRECATED_API.md).
