# ACH Form (Express Checkout) — API Reference

`SpreedlyACHForm` — Spreedly's prebuilt bank account form. Exposed as
`window.SpreedlyACHForm` from the Express Checkout bundle. Standalone: it does not extend
`SpreedlyExpressCheckout`/`SpreedlyHostedFields` and needs no other SDK instance.

See the [Integration Guide](./INTEGRATION_GUIDE.md) for the end-to-end flow.

## Constructor

### `new SpreedlyACHForm(authDetails)`

Creates an instance. Throws if any auth field is missing.

| `authDetails` field | Type     | Required |
| ------------------- | -------- | -------- |
| `environment_key`   | `string` | yes      |
| `certificate_token` | `string` | yes      |
| `nonce`             | `string` | yes      |
| `signature`         | `string` | yes      |
| `timestamp`         | `string` | yes      |

## Lifecycle

### `mount(options?): void`

Shows the form. With `containerId`, the form is embedded and fills that element, so give
the element a height (at least ~600 px). Without it, the form opens as a dialog: a centered
card (up to 560 px wide, sized to its content) over a dimmed page, with a close button. Warns and does nothing if the container isn't in the DOM or the form is
already mounted.

| `options` field | Type                  | Required | Notes                                   |
| --------------- | --------------------- | -------- | --------------------------------------- |
| `containerId`   | `string`              | no       | Omit for dialog mode                    |
| `id`            | `string`              | no       | `id` for the iframe element             |
| `className`     | `string`              | no       | CSS class for the iframe element        |
| `uiConfig`      | `ACHFormUIConfig`     | no       | See below                               |
| `submitParams`  | `ACHFormSubmitParams` | no       | See below                               |

### `close(hardDestroy?): void`

Removes the form. Your `on()` callbacks stay, so you can call `mount()` again. With `true`,
same as `destroy()`.

### `destroy(): void`

Removes the form, the message listener and all callbacks. The instance can't be reused.

## `uiConfig`

| Field                      | Type      | Default                                  | Notes |
| -------------------------- | --------- | ---------------------------------------- | ----- |
| `styles`                   | object    | `{}`                                     | Same shape as the Express Checkout card form's `uiConfig.styles` |
| `textConfig.title`         | `string`  | `'Bank account'`                         | |
| `textConfig.submitBtnText` | `string`  | `'Submit'`                               | |
| `textConfig.footerText`    | `string`  | `'Powered by Spreedly'`                  | |
| `textConfig.processingText`| `string`  | `'Processing...'`                        | Shown on the button while tokenizing |
| `achFormFields`            | object    | see Fields                               | Per-field settings, keyed by field name |
| `showSaveAccountCheckbox`  | `boolean` | `false`                                  | Shows the "save this account" checkbox. Its value comes back as `shouldRetain` |
| `saveAccountCheckboxLabel` | `string`  | `'Save this account for future payments'`| |

Values of the wrong type are ignored and the default is used.

### Fields

Keys are Spreedly `bank_account` field names. Each takes `label`, `placeholder`,
`isRequired`, `isHidden`, `size` (grid width, 1–12) and `styles` (same keys as the card
form's per-field styles). Defaults are listed as label / placeholder / size.

| Field                      | Shown   | Required | Defaults | Notes |
| -------------------------- | ------- | -------- | -------- | ----- |
| `full_name`                | always  | always   | "Account holder name" / "Joe Jones" / 12 | Account holder name. Max 350 characters. Letters (incl. accented), spaces, hyphens and apostrophes only — the same rule as the card form's name fields. Spreedly rejects a bank account without one. |
| `bank_routing_number`      | always  | always   | "Routing number" / "9 digits" / 6 | 9 digits. US: ABA checksum. A 9-digit number starting with `0` is passed to Spreedly to check (Canadian). |
| `bank_account_number`      | always  | always   | "Account number" / "Account number" / 6 | 4–17 digits. Masked, with a show/hide toggle. |
| `bank_account_type`        | yes     | no       | "Account type" / none / 6 | `checking` or `savings`. Nothing preselected. |
| `bank_account_holder_type` | yes     | no       | "Account holder type" / none / 6 | `personal` or `business`. Nothing preselected. |
| `bank_name`                | yes     | no       | "Bank name" / "Bank name" / 12 | Max 500 characters. Letters (incl. accented), digits, spaces and `& . ' - ,` only. Not sent when left empty. |

`isHidden` and `isRequired` are ignored for the name, routing and account number fields.
Characters a field doesn't accept are ignored as they're typed (no error is shown); the routing
and account number fields take digits only.
`placeholder` has no effect on the two dropdowns (`bank_account_type`,
`bank_account_holder_type`).

## `submitParams`

Sent with the tokenization request. Other keys are dropped.

| Field      | Type                     | Notes                                          |
| ---------- | ------------------------ | ---------------------------------------------- |
| `metadata` | `Record<string, string>` | Forwarded to Spreedly                          |
| `mandate`  | `object`                 | Forwarded to Spreedly                          |

## Events — `on(event, callback)`

| Event            | Payload |
| ---------------- | ------- |
| `ready`          | `{ message: string }` — the form iframe has loaded |
| `tokenGenerated` | `{ message: 'Token generated', tokenResponse, shouldRetain: boolean }` — `tokenResponse` is the whole Spreedly transaction, same as the Express Checkout card form (token: `tokenResponse.payment_method.token`; bank numbers masked by Spreedly). `shouldRetain` is whether the buyer ticked the save-account checkbox; `false` when it isn't shown. |
| `error`          | A string for SDK-side failures: `'Please wait before submitting again'`, `'No payment method token received from ACH API'`. Spreedly's error body when Spreedly rejects the request. Field errors show inside the form and don't fire `error`. |
| `close`          | `{ message: string }` — the customer closed the dialog |

Submits are limited to one every 2 seconds. A submit inside that window emits `error` with
`'Please wait before submitting again'`.

## Telemetry

`SpreedlyACHForm` emits its own `ach.*` events, never the card ones: `ach.initialized`,
`ach.iframe.loaded` (with `render_mode`), `ach.tokenization.completed`,
`ach.tokenization.throttled`, `ach.api.response`, `ach.error.emitted`, `ach.method_invoked`,
`ach.form.closed` and a few more. None carries a bank number. See the ACH section of
[TELEMETRY_EVENTS_REFERENCE](https://github.com/spreedly/checkout-web-sdk/blob/main/docs/monitoring/TELEMETRY_EVENTS_REFERENCE.md#ach).

## Notes

- ACH data is not PCI-scoped (bank accounts are not cardholder data). The form keeps the
  numbers out of your page, reducing Nacha data-security exposure.
- You must get the customer's authorization for the debit. The form doesn't collect it.
- For fields you lay out yourself, see [`SpreedlyACHFields`](../ach-hosted-fields/API_REFERENCE.md).
