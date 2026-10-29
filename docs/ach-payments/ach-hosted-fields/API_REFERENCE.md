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
and connected. Both containers must be in the DOM: if either is missing, nothing is mounted
and a warning names it — call it again once both exist. A second call while the
fields are mounted is ignored with a warning — use `reload()` to start over.

Both fields take digits only. Other characters are blocked as they're typed, so they never
appear. Pasted text keeps all its digits (so `1234-5678-9012-3456` becomes 16 digits), cut to
9 for routing and 17 for account.

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
auth details and your `on()` callbacks. On reload, the `ready` event fires again.

The typed values are discarded with the old iframes. Field customizations go back to their
defaults: for example, values set with `setLabel`, `setPlaceholder`, `setStyles` and
`setPlaceholderStyles` are reset, and the account number is masked again. Apply them again in
your `ready` callback. Ignored before `inAppElements()` and after `destroy()`.

### `isLoaded(): boolean`

Tells you whether the two iframes are mounted on the page. Returns `true` once
`inAppElements()` has added them, even before `ready` fires. Returns `false` before
`inAppElements()` and always after `destroy()`.

### `destroy(): void`

Removes both iframes (the bank data in them is discarded with them) and the message
listener, and drops all callbacks. The instance cannot be reused after this.

## Tokenization

### `submit(formData?, submitParams?): void`

Tokenizes the bank account entered in the secure fields. Emits `tokenGenerated` on
success (and securely clears the fields), `error` on failure. A submit that passes
validation starts a 2-second window in which further submits are rejected; a submit while a
request is still running is ignored. The routing and account numbers are read from the
iframes — any bank number keys in `formData` are ignored.

`formData` uses the `bank_account` field names of the Spreedly API, like the card `submit()`. Other keys are
ignored.

| `formData` field             | Type                       | Required | Notes |
| ---------------------------- | -------------------------- | -------- | ----- |
| `full_name`                  | `string`                   | †        | Either `full_name` OR (`first_name` AND `last_name`) |
| `first_name` / `last_name`   | `string`                   | †        | See above |
| `bank_name`                  | `string`                   | no       | |
| `bank_account_type`          | `'checking' \| 'savings'`  | no       | |
| `bank_account_holder_type`   | `'personal' \| 'business'` | no       | |
| `email`, `phone_number`      | `string`                   | no       | |
| `address1`, `address2`, `city`, `state`, `zip`, `country` | `string` | no | Billing address. `country` is a two-letter code (`US` or `CA`) |

| `submitParams` field | Type                     | Notes                 |
| -------------------- | ------------------------ | --------------------- |
| `metadata`           | `Record<string, string>` | Sent to the Spreedly tokenization API |
| `mandate`            | `object`                 | Sent to the Spreedly tokenization API |

### `updateAuthDetails(authDetails): void`

Replaces the auth details used by later `submit()` calls. Call it with new auth details from your
backend when `error` has the key `errors.replayed_tokenization_nonce` or
`errors.invalid_tokenization_timestamp`. Takes the same five fields as the constructor;
`environment_key` and `certificate_token` must not change. Throws if a field is missing or one of
those two changed. See [Refreshing the auth details](./INTEGRATION_GUIDE.md#refreshing-the-auth-details).

### `validate(): void`

Checks the routing and account numbers the customer has typed, without submitting. The
result arrives on the `validation` event: whether each number is valid, and how many digits
each has (see `ACHValidationPayload` below). It never includes the numbers themselves, and it
doesn't show any error in the fields.

To show an error on a field, such as a red border, see
[Styling the fields](./INTEGRATION_GUIDE.md#styling-the-fields) in the integration guide.

## Field configuration

### `toggleMask(): void`

Reveals or re-masks the account number field (it mounts masked).

### `setPlaceholder(field, placeholder): void`
### `setLabel(field, label): void`
### `setStyles(field, styles): void`
### `transferFocus(field): void`

Customize one hosted field. `field` is `'routing'` or `'account'`. `setStyles` takes a
`Record<string, string>` of camelCase CSS properties; `setLabel` sets `aria-label` and
`title`; HTML tags are stripped, the text is trimmed and cut to 256 characters, and an
empty label is ignored (same as the card fields).

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
| `tokenGenerated`  | `{ message: 'Token generated', tokenResponse }` — `tokenResponse` is the whole transaction returned by the Spreedly tokenization API, same as card hosted fields. Token: `tokenResponse.payment_method.token`. The API masks the bank numbers (`routing_number: "021*"`, `account_number: "*3210"`). |
| `error`           | A string for SDK-side failures: `'Routing number is invalid'`, `'Account number is invalid'`, `'Please wait before submitting again'`, `'Auth credentials cannot be changed after initial use'`, `'No payment method token received from ACH API'`, or a network error message (`'ACH tokenization failed'` when there is none). The error response body when the Spreedly tokenization API rejects the request. The typed bank numbers are masked in either case, in case an error ever echoes them. |
| `validation`      | `ACHValidationPayload` (below) — from `validate()` or a blocked submit  |
| `fieldStateChange`| `ACHValidationPayload` + `{ action, field, focused }` — streamed as the customer types |

`ACHValidationPayload`:

| Field           | Type      | Notes                                              |
| --------------- | --------- | -------------------------------------------------- |
| `validRouting`  | `boolean` | `true` for a valid US routing number, or a Canadian one (9 digits starting with `0`) |
| `validAccount`  | `boolean` | 4–17 digits                                        |
| `routingLength` | `number`  | current length — never the value                   |
| `accountLength` | `number`  | current length — never the value                   |

On `fieldStateChange`, `field` is `'routing' | 'account'`, `action` is
`'input' | 'focus' | 'blur' | 'enter'`, and `focused` is a boolean.

## Notes

- The deprecated merchant-collected API (`setupACHPayment` / `submitACHPayment` /
  `clearACHPayment`) is documented in [DEPRECATED_API.md](../DEPRECATED_API.md).
