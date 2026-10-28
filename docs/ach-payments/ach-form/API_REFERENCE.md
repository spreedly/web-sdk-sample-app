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

Shows the form. With `parentContainerId` (the same option name as the card form's
`expressCheckout()`), the form is embedded and fills that element, so give the element a
height (at least ~600 px). Without it, the form opens as a dialog: a centered card (up to
560 px wide, sized to its content) over a dimmed page, with a close button. Warns and does
nothing if the container isn't in the DOM or the form is already mounted.

| `options` field | Type                  | Required | Notes                                   |
| --------------- | --------------------- | -------- | --------------------------------------- |
| `parentContainerId` | `string`          | no       | Omit for dialog mode                    |
| `id`            | `string`              | no       | `id` for the iframe element             |
| `className`     | `string`              | no       | CSS class for the iframe element        |
| `uiConfig`      | `ACHFormUIConfig`     | no       | See below                               |
| `submitParams`  | `ACHFormSubmitParams` | no       | See below                               |

### `close(hardDestroy?): void`

Removes the form. Your `on()` callbacks stay, so you can call `mount()` again. With `true`,
same as `destroy()`.

### `destroy(): void`

Removes the form, the message listener and all callbacks. The instance can't be reused.

### `updateAuthDetails(authDetails): void`

Replaces the auth details the form uses for later submits. Call it with new auth details from your
backend when `error` has the key `errors.replayed_tokenization_nonce` or
`errors.invalid_tokenization_timestamp`. Takes the same five fields as the constructor;
`environment_key` and `certificate_token` must not change. Throws if a field is missing or one of
those two changed. See [Refreshing the auth details](./INTEGRATION_GUIDE.md#refreshing-the-auth-details).

## `uiConfig`

| Field                      | Type      | Default                                  | Notes |
| -------------------------- | --------- | ---------------------------------------- | ----- |
| `styles`                   | object    | `{}`                                     | Colors, fonts and borders for the form. See [Styling](./INTEGRATION_GUIDE.md#styling) |
| `textConfig.title`         | `string`  | `'Bank account'`                         | |
| `textConfig.submitBtnText` | `string`  | `'Submit'`                               | |
| `textConfig.footerText`    | `string`  | `'Powered by Spreedly'`                  | |
| `textConfig.processingText`| `string`  | `'Processing...'`                        | Shown on the button while tokenizing |
| `achFormFields`            | object    | see Fields                               | Per-field settings, keyed by field name |
| `showSaveAccountCheckbox`  | `boolean` | `false`                                  | Shows the "save this account" checkbox. Its value comes back as `shouldRetain` |
| `saveAccountCheckboxLabel` | `string`  | `'Save this account for future payments'`| |

Values of the wrong type are ignored and the default is used.

### Fields

Keys are the `bank_account` field names of the Spreedly API. Each field takes:

- `label` and `placeholder`.
- `isRequired` and `isHidden`.
- `size`: how much of a row the field takes. Each row is 12 columns wide, so `12` is the full
  width, `6` is half and `4` is a third. Fields fill each row from left to right and wrap to
  the next row when it's full.
- `styles`: styles for this field only. See [Styling](./INTEGRATION_GUIDE.md#styling).

Defaults are listed as label / placeholder / size.

| Field                      | Shown   | Required | Defaults | Notes |
| -------------------------- | ------- | -------- | -------- | ----- |
| `full_name`                | always  | always   | "Account holder name" / "Joe Jones" / 12 | Max 350 characters. Letters (including accented letters, such as é or ñ), digits, spaces and `& . ' - , ( ) /`, so business names like "AT&T Inc." or "Acme Holdings (USA) LLC" work. |
| `bank_routing_number`      | always  | always   | "Routing number" / "9 digits" / 6 | A valid US routing number, or a Canadian one (9 digits starting with `0`). |
| `bank_account_number`      | always  | always   | "Account number" / "Account number" / 6 | 4–17 digits. Masked, with a show/hide toggle. |
| `bank_account_type`        | yes     | no       | "Account type" / none / 6 | `checking` or `savings`. Nothing preselected. |
| `bank_account_holder_type` | yes     | no       | "Account holder type" / none / 6 | `personal` or `business`. Nothing preselected. |
| `bank_name`                | yes     | no       | "Bank name" / "Bank name" / 12 | Max 500 characters. Letters (including accented letters, such as é or ñ), digits, spaces and `& . ' - , ( ) /` only. Not sent when left empty. |
| `email`                    | no      | no       | "Email" / "name@example.com" / 6 | Max 254 characters. Must look like an email address. |
| `phone_number`             | no      | no       | "Phone number" / "Phone number" / 6 | Max 15 characters. Digits, spaces and `+ - ( ) .`. |
| `address1`, `address2`     | no      | no       | "Address line 1" / "Street address" / 12; "Address line 2" / "Apartment, suite, etc." / 12 | Max 500 characters each. |
| `city`, `state`            | no      | no       | "City" / "City" / 6; "State / province" / "State" / 6 | Max 500 characters each. |
| `zip`                      | no      | no       | "ZIP / postal code" / "ZIP code" / 6 | Max 15 characters. |
| `country`                  | no      | no       | "Country" / "US" / 6 | Max 100 characters. The Spreedly API supports `US` and `CA`. |

`isHidden` and `isRequired` are ignored for the name, routing and account number fields.
The contact and address fields (`email` to `country`) are hidden by default: set
`isHidden: false` to show one. The customer fills them in; they're sent only when filled.

A change containing a character the field doesn't accept is ignored, including a whole paste
(no error is shown). The routing and account number fields keep only digits: a pasted
`1234-5678-9012-3456` becomes 16 digits, cut to 9 for routing and 17 for account.
`placeholder` has no effect on the two dropdowns (`bank_account_type`,
`bank_account_holder_type`).

## `submitParams`

Sent with the tokenization request. Other keys are dropped.

| Field      | Type                     | Notes                                          |
| ---------- | ------------------------ | ---------------------------------------------- |
| `metadata` | `Record<string, string>` | Sent to the Spreedly tokenization API          |
| `mandate`  | `object`                 | Sent to the Spreedly tokenization API          |

## Events — `on(event, callback)`

| Event            | Payload |
| ---------------- | ------- |
| `ready`          | `{ message: string }` — the form iframe has loaded |
| `tokenGenerated` | `{ message: 'Token generated', tokenResponse, shouldRetain: boolean }` — `tokenResponse` is the whole transaction returned by the Spreedly tokenization API, same as the Express Checkout card form (token: `tokenResponse.payment_method.token`; the API masks the bank numbers). `shouldRetain` is whether the buyer ticked the save-account checkbox; `false` when it isn't shown. |
| `error`          | A string for SDK-side failures: `'Please wait before submitting again'`, `'No payment method token received from ACH API'`. The error response body when the Spreedly tokenization API rejects the request. The typed bank numbers are masked in either case, in case an error ever echoes them. Field errors show inside the form and don't fire `error`. |
| `close`          | `{ message: string }` — the customer closed the dialog |

Submits are limited to one every 2 seconds. A submit inside that window emits `error` with
`'Please wait before submitting again'`.

## Notes

- For fields you lay out yourself, see [`SpreedlyACHFields`](../ach-hosted-fields/API_REFERENCE.md).
