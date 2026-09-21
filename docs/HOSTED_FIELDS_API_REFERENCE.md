# SpreedlyHostedFields

SpreedlyHostedFields — the SDK for collecting card data with secure hosted fields.

This class provides functionality for creating and managing secure iframe-based
payment fields (card number and CVV) that are hosted by Spreedly. It handles
iframe creation, communication with hosted fields, and field customization.

## Contents

Methods are grouped into the sections below; type definitions follow.

| Section | What it covers |
| --- | --- |
| [Lifecycle](#lifecycle) | Create, mount, reload, and tear down the SDK instance, and subscribe to events. |
| [Field Configuration](#field-configuration) | Customize the hosted card-number and CVV fields — labels, placeholders, styles, number format, input mode, focus, masking, and the card-type badge. |
| [Validation](#validation) | Trigger client-side validation and configure what the `validation` / `fieldStateChange` events report. |
| [Tokenization](#tokenization) | Submit the collected card data to create a Spreedly payment method token. |
| [Recache](#recache) | Update the CVV on an already-retained (previously tokenized) payment method. |
| [Offsite Payments](#offsite-payments) | Redirect-style / alternative payment methods, inherited from the shared SDK — see the dedicated Offsite Payments reference. |
| [ACH](#ach) | Bank-account (ACH) tokenization, inherited from the shared SDK — see the dedicated ACH reference. |
| [Stripe Radar](#stripe-radar) | Create a Stripe Radar fraud session and get its session id, inherited from the shared SDK — see the dedicated Stripe Radar guide. |
| [Type Definitions](#type-definitions) | The parameter and return types used throughout the API. |

## Example

```javascript
const hostedFields = new SpreedlyHostedFields(authDetails);

hostedFields.inAppElements({
  number: { containerId: 'card-number-container' },
  cvv: { containerId: 'cvv-container' }
});

hostedFields.on('ready', () => {
  hostedFields.setPlaceholder('number', 'Enter card number');
  hostedFields.setStyles('cvv', { borderColor: '#007bff' });
});
```

## Properties

### AdditionalCardFormFields

> `static` **AdditionalCardFormFields**: `Readonly`\<\{ `Address1`: `"address1"`; `Address2`: `"address2"`; `City`: `"city"`; `Company`: `"company"`; `Country`: `"country"`; `Email`: `"email"`; `FullName`: `"full_name"`; `HouseNumberOrName`: `"house_number_or_name"`; `PhoneNumber`: `"phone_number"`; `PhoneNumberAreaCode`: `"phone_number_area_code"`; `PhoneNumberCountryCode`: `"phone_number_country_code"`; `ShippingAddress1`: `"shipping_address1"`; `ShippingAddress2`: `"shipping_address2"`; `ShippingCity`: `"shipping_city"`; `ShippingCountry`: `"shipping_country"`; `ShippingHouseNumberOrName`: `"shipping_house_number_or_name"`; `ShippingPhoneNumber`: `"shipping_phone_number"`; `ShippingPhoneNumberAreaCode`: `"shipping_phone_number_area_code"`; `ShippingPhoneNumberCountryCode`: `"shipping_phone_number_country_code"`; `ShippingState`: `"shipping_state"`; `ShippingStreet`: `"shipping_street"`; `ShippingStreetLine2`: `"shipping_street_line2"`; `ShippingZip`: `"shipping_zip"`; `State`: `"state"`; `Street`: `"street"`; `StreetLine2`: `"street_line2"`; `Zip`: `"zip"`; \}\> = `AdditionalCardPaymentFormFields`

Additional card form fields that can be mounted via `inAppElements`.

***

### CombinedExpiryField

> `static` **CombinedExpiryField**: `"expiry"`

Combined `MM/YY` expiry catalogue field (Hosted Fields only).

***

### HostedCvvField

> `static` **HostedCvvField**: `"cvv"`

CVV iframe key for `inAppElements` (`cvv`, not `verification_value`).

***

### HostedSubmitButton

> `static` **HostedSubmitButton**: `"submit"`

Optional hosted submit button key for `inAppElements` (`submit`).

***

### MandatoryCardFormFields

> `static` **MandatoryCardFormFields**: `Readonly`\<\{ `CardNumber`: `"number"`; `Cvv`: `"verification_value"`; `ExpiryMonth`: `"month"`; `ExpiryYear`: `"year"`; `FirstName`: `"first_name"`; `LastName`: `"last_name"`; \}\> = `MandatoryCardPaymentFormFields`

Mandatory card form fields shared with Express Checkout. For `inAppElements`,
use [SpreedlyHostedFields.HostedCvvField](#hostedcvvfield) (`cvv`) rather than
`MandatoryCardFormFields.Cvv` (`verification_value`) for the CVV iframe.

***

### SpreedlySDKCallbacks

> `static` **SpreedlySDKCallbacks**: `Readonly`\<\{ `ACHPaymentError`: `"achPaymentError"`; `ACHTokenGenerated`: `"achTokenGenerated"`; `C2PAddNewCard`: `"add-new-card"`; `C2PCheckoutCancelled`: `"checkout-cancelled"`; `C2PCheckoutDifferentPm`: `"checkout-different-pm"`; `C2PCheckoutError`: `"checkout-error"`; `C2PCheckoutWindowClose`: `"checkout-window-close"`; `C2PCheckoutWindowOpen`: `"checkout-window-open"`; `C2PDisplayCardsReady`: `"display-cards-ready"`; `C2PExistingUser`: `"c2p-existing-user"`; `C2PInitialized`: `"c2p-initialized"`; `C2PNewUser`: `"c2p-new-user"`; `C2POtpInitiated`: `"otp-initiated"`; `C2POtpNotYou`: `"otp-not-you"`; `C2POtpResend`: `"otp-resend"`; `C2POtpResponse`: `"otp-response"`; `C2PSessionDeleted`: `"c2p-session-deleted"`; `C2PVerifiedUser`: `"c2p-verified-user"`; `Close`: `"close"`; `ConsoleError`: `"consoleError"`; `Error`: `"error"`; `FieldStateChange`: `"fieldStateChange"`; `OffsitePaymentError`: `"offsitePaymentError"`; `OffsiteTokenGenerated`: `"offsiteTokenGenerated"`; `PazeCheckoutComplete`: `"pazeCheckoutComplete"`; `PazeError`: `"pazeError"`; `PazeReady`: `"pazeReady"`; `PazeTokenGenerated`: `"pazeTokenGenerated"`; `Ready`: `"ready"`; `RecacheReady`: `"recacheReady"`; `RecacheSuccess`: `"recacheSuccess"`; `SubmitClick`: `"submitClick"`; `TokenGenerated`: `"tokenGenerated"`; `Validation`: `"validation"`; \}\>

Available SDK callback events that merchants can listen to

***

### VERSION

> `static` **VERSION**: `string`

Current SDK version

## Methods

### Lifecycle

#### destroy()

> **destroy**(): `void`

Tears down the mounted hosted-field iframes (card number and CVV), removes the SDK's global message listener, emits the `close` event with `{ reason: 'destroy' }`, and then clears all registered event callbacks. Because `close` is emitted before the callback queues are cleared, an `on('close', ...)` handler still fires. Call this when you are unmounting the payment form (for example, closing a checkout modal or navigating away) to release resources and stop receiving iframe messages. It is idempotent and safe to call multiple times — after the first call the instance is marked destroyed and most other SDK methods (the ones guarded by the internal active-check, e.g. `inAppElements`, `submit`, `setStyles`, `resetFields`, `reload`) become no-ops that log a warning, while `isLoaded()` returns `false`. To mount fields again, create a fresh `SpreedlyHostedFields` instance with valid auth credentials.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

sdk.inAppElements({
  number: { containerId: 'card-number-container' },
  cvv: { containerId: 'cvv-container' },
});

sdk.on('ready', () => {
  // fields are mounted and interactive
});

// later, when unmounting the checkout form:
sdk.destroy();
```

***

#### inAppElements()

> **inAppElements**(`inAppElement`): `void`

Mounts hosted-field iframes into the DOM containers you specify. Always mounts the two PCI
iframes (`number` and `cvv`); optionally mounts one catalogue iframe per extra key (expiry,
name, address, …) and an optional hosted submit button. This is the first lifecycle call after
constructing a `SpreedlyHostedFields` instance — PAN and CVV are entered only inside the
Spreedly-hosted number and CVV iframes so they never enter your PCI scope. Catalogue frames
hold non-PCI data. The passed config is retained so `reload()` can remount the same fields
later; wait for the `ready` event before calling field-customization methods. Warns and skips
a field if its `containerId` is missing or not found in the DOM. Combined `expiry` and
separate `month`/`year` cannot both mount — if both are configured, `expiry` wins and the
separate fields are ignored (a warning is logged). No-ops with a warning if the instance has
already been destroyed.

##### Parameters

###### inAppElement

[`HostedFieldsConfig`](#hostedfieldsconfig)

Field and button container configuration. Required.
  number - `{ containerId: string; styles?: Partial<CSSStyleDeclaration> }` for the card-number PCI iframe. `containerId` (required) is the id of the DOM element that will host the iframe; `styles` is optional CSS applied to the hosted input on `ready`.
  cvv - `{ containerId: string; styles?: Partial<CSSStyleDeclaration> }` for the CVV PCI iframe. Same shape as `number`.
  [catalogue type] - Optional. Any extra [HostedFormFieldType](#hostedformfieldtype) key (`expiry`, `month`, `year`, `first_name`, `last_name`, `full_name`, billing/shipping fields, …) mounts that field as its own iframe. Each value is a [HostedFieldInput](#hostedfieldinput): `containerId` (required), `styles` (optional, applied on `ready`), `isRequired` (optional — gates submit-time validation for every field except the default-required `first_name`/`last_name` and `expiry`/`month`/`year`, and sets HTML `required` + `aria-required` on the hosted input at mount). Combined `expiry` (`MM/YY`) is mutually exclusive with separate `month` + `year`.
  submit - Optional [HostedSubmitButtonInput](#hostedsubmitbuttoninput): `{ containerId: string; text?: string; styles?: Partial<CSSStyleDeclaration> }`. A click emits `submitClick`; you must call `submit()` from that handler. The `submitClick` payload is informational — do not pass it back to `submit()`, whose `formData` is for fields you did **not** mount.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

sdk.inAppElements({
  number: { containerId: 'card-number-container', styles: { fontSize: '16px' } },
  cvv: { containerId: 'cvv-container' },
  expiry: { containerId: 'expiry-container' },
  full_name: { containerId: 'name-container' },
  submit: { containerId: 'submit-container', text: 'Pay now' },
});

sdk.on('ready', () => {
  // iframes are mounted and ready — now safe to customize the fields
  sdk.setPlaceholder('number', 'Card number');
  sdk.setPlaceholder('expiry', 'MM/YY');
});
```

***

#### isLoaded()

> **isLoaded**(): `boolean`

Reports whether the hosted-fields iframes are currently mounted in the DOM. Returns `true` only
after `inAppElements()` has attached at least one of the card-number or CVV iframes to its
container and the instance has not been destroyed. Use it to guard code that depends on the
fields being live — for example before calling `submit()`, `reload()`, or `transferFocus()`. Once
`destroy()` has been called this always returns `false`, mirroring the legacy `Spreedly.isLoaded()`.

##### Returns

`boolean`

`true` if the number or CVV iframe is mounted and the SDK is active; otherwise `false`.

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

sdk.on('ready', () => {
  console.log(sdk.isLoaded()); // true — iframes are mounted
});

// Mounting the fields is what makes isLoaded() eventually return true.
sdk.inAppElements({
  number: { containerId: 'card-number-container' },
  cvv: { containerId: 'cvv-container' },
});

// ...later, when you are finished with the fields:
sdk.destroy();
console.log(sdk.isLoaded()); // false — instance has been torn down
```

***

#### on()

> **on**(`event`, `callback`): `void`

Registers event callbacks for SDK events

Allows merchants to listen to various SDK events such as ready state,
errors, form closure, and token generation.

##### Parameters

###### event

`TSpreedlySDKCallbacks`

The event to listen for

###### callback

`SpreedlySDKCallback`

The callback function to execute when the event occurs

##### Returns

`void`

##### Example

```javascript
sdk.on('ready', () => {
  console.log('Payment form is ready');
});

sdk.on('tokenGenerated', (token) => {
  console.log('Payment token:', token);
  // Process the payment with the token
});

sdk.on('error', (error) => {
  console.error('Payment error:', error);
});

sdk.on('validation', (payload) => {
  console.log('Hosted fields validation snapshot:', payload);
});

sdk.on('submitClick', (formFields) => {
  // Hosted Fields only: required when inAppElements({ submit }) is mounted.
  // `formFields` is a read-only snapshot of what the shopper typed into the
  // mounted hosted fields. Do not pass it back to submit() — those values are
  // read from the iframes. Send only fields you did not mount as hosted fields.
  console.log('hosted fields filled:', Object.keys(formFields));
  sdk.submit({ email: document.getElementById('email').value });
});

sdk.on('close', () => {
  console.log('Payment form was closed');
});
```

***

#### reload()

> **reload**(): `void`

Unmounts the current hosted-field iframes and remounts them into the same containers, mirroring
the legacy `Spreedly.reload()`. Call this to force a fresh start of the card number and CVV fields
without recreating the SDK instance — for example after your page re-renders the mount points or you
need to reset the iframe state. Internally it removes the existing iframes and regenerates both
fields from the config you originally passed to `inAppElements()` (it does not call `inAppElements()`
itself); your existing `on('ready', ...)` (and other) handlers are preserved and fire again once the
new iframes finish loading. This is a no-op if `inAppElements()` was never called (a warning is
logged) or if the instance has already been destroyed.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);
sdk.inAppElements(hostedFieldsConfig);

sdk.on('ready', () => {
  // Fields are mounted and ready; this fires again after each reload().
});

// Later, re-mount the fields into their original containers:
sdk.reload();
```

***

#### removeHandlers()

> **removeHandlers**(): `void`

Removes all registered event listeners (legacy `Spreedly.removeHandlers()` parity).

Does not remove the window `message` listener — use `destroy()` on hosted fields or
`close(true)` on express checkout for full teardown.

##### Returns

`void`

### Field Configuration

#### resetFields()

> **resetFields**(): `void`

Clears the hosted field inputs in place without unmounting the iframes
(the modern equivalent of the legacy `Spreedly.resetFields()`). Call this to reset the
form after a failed attempt or when starting a new checkout, without rebuilding the
fields. In the normal (non-recache) case the card number is cleared and its card-type
icon is reset, the CVV is cleared, and the pending CVV auto-clear timer is cancelled.
In recache mode the number field is prefilled and disabled, so it (and its card-type
icon) is left untouched and only the CVV is cleared and its auto-clear timer cancelled.
Use `destroy()` instead when you need to fully tear down and remount the fields. After
the instance has been destroyed this method is a no-op and logs a warning.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

sdk.on('ready', () => {
  // Clear the shopper's entries, e.g. after a validation error
  sdk.resetFields();
});
```

***

#### setDisable()

> **setDisable**(`elementType`, `disabled`): `void`

Enables or disables the hosted submit button. The SDK does **not** auto-disable the
button during `submit()` — call this from `submitClick` / `tokenGenerated` / `error`
if you want a loading or locked state. No-op with a warning if the instance has been
destroyed. The button starts disabled until `ready`.

##### Parameters

###### elementType

`"submit"`

Must be `'submit'`.

###### disabled

`boolean`

`true` to disable, `false` to enable.

##### Returns

`void`

##### Example

```javascript
sdk.on('submitClick', () => {
  sdk.setDisable('submit', true);
  // Pass only fields you did not mount as hosted fields — mounted values
  // are read from their iframes, not from this argument.
  sdk.submit({}, { metadata: { order_id: 'ORDER-123' } });
});
sdk.on('error', () => sdk.setDisable('submit', false));
```

***

#### setFieldType()

> **setFieldType**(`elementType`, `fieldType`): `void`

Sets the HTML input type of a hosted card-number or CVV field, controlling how it behaves and what
on-screen keyboard is shown. Call this after the fields are mounted (inside `sdk.on('ready', ...)`)
to, for example, surface a numeric/telephone keypad on mobile or mask the CVV like a password. The
change is sent to the targeted iframe (`number` or `cvv`); the sensitive PAN/CVV values never leave
that iframe. If the instance has been destroyed this method is a no-op (it logs a warning and returns).

##### Parameters

###### elementType

`HostedFieldElementType`

Which hosted field to modify: the card-number field or the CVV field. Required.

###### fieldType

`"number"` \| `"text"` \| `"tel"` \| `"password"`

The underlying input type to apply to that field. Required.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

sdk.on('ready', () => {
  // Show a telephone keypad on the card-number field for better mobile entry
  sdk.setFieldType('number', 'tel');

  // Mask the CVV field like a password
  sdk.setFieldType('cvv', 'password');
});
```

***

#### setInputMode()

> **setInputMode**(`elementType`, `inputMode`): `void`

Sets the HTML `inputmode` attribute on the card number or CVV hosted-field input. Call it after the
fields are mounted (inside `on('ready', ...)`) to hint which virtual keyboard mobile browsers should
show — for example `'numeric'` for an all-digits number pad. The value is applied inside the field's
iframe; unrecognized values are ignored there (a warning is logged and the attribute is left unchanged).
If the instance has already been destroyed this method is a no-op.

##### Parameters

###### elementType

`HostedFieldElementType`

Which hosted field to update: the card number field or the CVV field. Required.

###### inputMode

[`SpreedlyInputMode`](#spreedlyinputmode)

The HTML `inputmode` value to apply; one of `'none' | 'text' | 'numeric' | 'decimal' | 'tel' | 'search' | 'email' | 'url'`. Required; any other value is ignored inside the iframe.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);
sdk.on('ready', () => {
  sdk.setInputMode('number', 'numeric');
  sdk.setInputMode('cvv', 'numeric');
});
```

***

#### setLabel()

> **setLabel**(`elementType`, `label`): `void`

Sets the accessible name (`aria-label`) on a hosted field's input, as read by screen readers.
Call it after the fields are mounted (inside the `ready` callback) to align the input's
accessible name with your page copy or locale. HTML-like tags in `label` are stripped
(matching the legacy iFrame `setLabel`) and empty values are ignored. After the instance is
destroyed this method is a no-op (it logs a warning and returns without messaging the iframe).

##### Parameters

###### elementType

`HostedFieldElementType`

Which hosted field to update: the card number field or the CVV field. Required.

###### label

`string`

The accessible name to apply to that field's input. Required.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);
sdk.on('ready', () => {
  sdk.setLabel('number', 'Card number');
  sdk.setLabel('cvv', 'Security code');
});
```

***

#### setNumberFormat()

> **setNumberFormat**(`format`): `void`

Sets how the card number is displayed inside its hosted iframe: spaced brand-aware
groups, plain unformatted digits, or masked asterisks. Call it after the fields are
mounted (inside `on('ready', ...)`) to switch formatting on the fly. This only changes
the visible presentation — the underlying card digits kept in the iframe are unchanged
and never leave it. Note that selecting `maskedFormat` also masks the CVV display, and
any invalid value is ignored. This method is a no-op once the instance has been
destroyed.

##### Parameters

###### format

[`NumberDisplayFormat`](#numberdisplayformat)

Display format for the card number field: `prettyFormat` shows brand-aware digit groups (the default), `plainFormat` shows unformatted digits, and `maskedFormat` shows asterisks (and also masks the CVV). Required.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

sdk.on('ready', () => {
  // Hide the entered card number behind asterisks
  sdk.setNumberFormat('maskedFormat');
});
```

***

#### setPlaceholder()

> **setPlaceholder**(`elementType`, `placeholder`): `void`

Sets the placeholder text shown inside the card number or CVV hosted field iframe.
Call this after the fields are mounted (inside `ready`) to give shoppers input guidance,
and re-call it whenever you need to update the text (for example on a locale change).
The update is sent only to the targeted iframe; it does nothing if the instance has
already been destroyed.

##### Parameters

###### elementType

`HostedFieldElementType`

Which hosted field to update: the card number field (`'number'`) or the CVV field (`'cvv'`). Required.

###### placeholder

`string`

The placeholder text to display in that field. Required.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);
sdk.on('ready', () => {
  sdk.setPlaceholder('number', 'Card number');
  sdk.setPlaceholder('cvv', 'CVV');
});
```

***

#### setPlaceholderStyles()

> **setPlaceholderStyles**(`styles`): `void`

Applies CSS to the `::placeholder` pseudo-element of both hosted inputs (card number and CVV) at once.
Use it to style the placeholder text you set with `setPlaceholder()` — for example its color,
opacity, or font weight — so it matches your form's design. Call it after the fields are mounted
(inside `on('ready', ...)`); the same styles are sent to the number and CVV iframes as well as any
mounted catalogue (form) field iframes. After the instance is destroyed this method is a no-op and
logs a warning.

##### Parameters

###### styles

`Partial`\<`CSSStyleDeclaration`\>

Camel-cased CSS properties to apply to the placeholder text (e.g. `color`, `opacity`, `fontWeight`, `fontStyle`). Required.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

sdk.on('ready', () => {
  sdk.setPlaceholder('number', 'Card number');
  sdk.setPlaceholder('cvv', 'CVC');
  sdk.setPlaceholderStyles({
    color: '#9aa0a6',
    opacity: '1',
    fontWeight: '400',
  });
});
```

***

#### setRequiredAttribute()

> **setRequiredAttribute**(`elementType`, `required?`): `void`

Toggles the native HTML `required` attribute on a hosted-field input (card number, CVV, or a
mounted catalogue field) and keeps `aria-required` in sync. This is the merchant API for the
HTML5 attribute (legacy `Spreedly.setRequiredAttribute` parity). It is distinct from:
- `inAppElements()` `isRequired: true` on a catalogue field, which gates submit-time validation
  and also applies HTML `required` + `aria-required` at mount
- name (`first_name` / `last_name`) and date (`expiry` / `month` / `year`) being
  required by default at tokenize time (and `aria-required="true"` at render) unless
  `allow_blank_name` / `allow_blank_date` is passed

`'submit'` is a no-op (the hosted submit control is a button, not a required input). Call after
the fields are mounted (inside `ready`); it is a no-op that logs a warning if the instance has
already been destroyed.

##### Parameters

###### elementType

`HostedFieldElementType`

Which hosted field to update: `'number'`, `'cvv'`,
  or a mounted catalogue type (e.g. `'email'`, `'first_name'`). `'submit'` is accepted but
  ignored. Required.

###### required?

`boolean` = `true`

Whether the field should carry the `required` attribute.
  Optional; defaults to `true` (pass `false` to remove it).

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

sdk.on('ready', () => {
  sdk.setRequiredAttribute('number');       // add required to the card number field
  sdk.setRequiredAttribute('cvv', true);    // add required to the CVV field
  sdk.setRequiredAttribute('email', true);  // add required to a mounted catalogue field
  sdk.setRequiredAttribute('cvv', false);   // remove required from the CVV field
});
```

***

#### setShowCardTypeIcon()

> **setShowCardTypeIcon**(`visible`): `void`

Shows or hides the built-in card-type badge (e.g. `VISA`, `MASTER`) that is rendered
inside the card number field. The badge is shown by default, so you only need to call this
to hide it — typically when you render your own brand icon outside the iframe using the
`cardType` reported by `fieldStateChange`. This only affects the number field; it does
nothing after the instance has been destroyed (the call is ignored and a warning is logged).

##### Parameters

###### visible

`boolean`

`true` to show the card-type badge, `false` to hide it. Required.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);
sdk.on('ready', () => {
  // Hide the built-in badge to render your own brand icon instead
  sdk.setShowCardTypeIcon(false);
});
```

***

#### setStyles()

> **setStyles**(`elementType`, `styles`): `void`

Applies inline CSS styles to the `<input>` inside a single hosted field iframe (card number or CVV).
Use it to restyle one field at a time, for example on focus/blur or validation-state changes; unlike
`setPlaceholderStyles`, it targets only the field named by `elementType` rather than both. The iframe
merges the styles onto the input's inline `style`, silently dropping any unrecognized CSS properties or
invalid values. Call it after the SDK's `ready` event so the target iframe is mounted; it is a no-op if
the field name is unknown or after the SDK has been destroyed.

##### Parameters

###### elementType

`HostedFieldElementType`

Which hosted field to style: `'number'` for the card-number field or `'cvv'` for the CVV field. Required.

###### styles

`Partial`\<`CSSStyleDeclaration`\>

A partial `CSSStyleDeclaration` of camelCased CSS properties to apply to the field's input (e.g. `color`, `fontSize`, `backgroundColor`). Invalid properties/values are filtered out. Required.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

sdk.on('ready', () => {
  sdk.setStyles('number', {
    color: '#1a1a1a',
    fontSize: '16px',
    fontFamily: 'Helvetica, Arial, sans-serif',
  });
  sdk.setStyles('cvv', { color: '#1a1a1a', textAlign: 'center' });
});

// Mount the field iframes; the `ready` callback fires once they load.
sdk.inAppElements({
  number: { containerId: 'card-number-field' },
  cvv: { containerId: 'cvv-field' },
});
```

***

#### setText()

> **setText**(`elementType`, `text`): `void`

Sets the visible label (and matching `aria-label`) on the hosted submit button.
Same sanitization as [setLabel](#setlabel): HTML-like tags are stripped and empty values
are ignored. No-op with a warning if the instance has been destroyed.

##### Parameters

###### elementType

`"submit"`

Must be `'submit'`.

###### text

`string`

Visible button text. Required.

##### Returns

`void`

##### Example

```javascript
sdk.on('submitClick', () => {
  sdk.setText('submit', 'Please wait...');
  sdk.setDisable('submit', true);
  // Mounted hosted fields are read straight from their iframes at tokenization,
  // so pass only the fields you did not mount (none here) plus any submitParams.
  sdk.submit({}, {});
});
sdk.on('tokenGenerated', () => {
  sdk.setText('submit', 'Pay now');
  sdk.setDisable('submit', false);
});
```

***

#### setTitle()

> **setTitle**(`elementType`, `title`): `void`

Sets the native HTML `title` attribute on a hosted-field input, which the browser surfaces as a hover tooltip and as supplementary accessibility text. Call it after the fields are mounted (inside the `ready` callback) to give shoppers extra guidance on the card number or CVV field. The title text is sanitized inside the iframe before being applied: HTML tags are stripped, the value is trimmed, and it is truncated to 256 characters — if nothing meaningful remains, the update is ignored and a warning is logged. This is a no-op if the SDK instance has already been destroyed.

##### Parameters

###### elementType

`HostedFieldElementType`

Which hosted field to update: `'number'` for the card number field or `'cvv'` for the CVV field. Required.

###### title

`string`

The tooltip / title text to apply. HTML tags are stripped and the result is trimmed and capped at 256 characters; an empty or tags-only value is ignored. Required.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

sdk.on('ready', () => {
  sdk.setTitle('number', 'Enter the 16-digit number on the front of your card');
  sdk.setTitle('cvv', 'The 3 or 4 digit security code on your card');
});
```

***

#### toggleAutoComplete()

> **toggleAutoComplete**(): `void`

Toggles the browser `autocomplete` behavior on the card number (`cc-number`) and CVV
(`cc-csc`) hosted fields together. Each call flips the current state, so calling it once
turns autocomplete off (or on) and calling it again reverts it. Call this after the fields
are mounted (inside your `ready` handler); if the SDK instance has already been destroyed
the call is ignored and a warning is logged.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

sdk.on('ready', () => {
  // Disable autocomplete on both the card number and CVV fields
  sdk.toggleAutoComplete();
});
```

***

#### toggleMask()

> **toggleMask**(): `void`

Toggles the card number and CVV between masked (asterisks) and visible (plain digits) display.
Each call flips the current state: if the number is currently masked it becomes visible, otherwise
it becomes masked, and both the number and CVV fields re-render together. Useful for a "show/hide
card details" control on your checkout form. Only the display representation changes — the underlying
PAN and CVV never leave the hosted-field iframes. Requires the fields to be mounted; call it after the
`ready` event. No-op if the instance has already been destroyed.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

sdk.on('ready', () => {
  // Wire a "show/hide" button to reveal or re-mask the entered card details
  document.getElementById('toggle-visibility').addEventListener('click', () => {
    sdk.toggleMask();
  });
});
```

***

#### transferFocus()

> **transferFocus**(`elementType`): `void`

Programmatically moves focus into one of the mounted hosted-field iframes. Call it to steer
the cursor into the card number or CVV input from your own UI logic (for example, focusing the
number field once the form is ready), matching legacy `Spreedly.transferFocus`. Passing
`'iframe'` routes through the number frame and parks focus on that iframe's document body
(equivalent to the legacy `'iframe'` target) rather than a specific input. Because browsers
generally only honor focus changes triggered by a user gesture, calls made purely from timers
or async callbacks may be silently ignored. After the instance is destroyed this method is a
no-op (it logs a warning and returns without sending anything to the iframes).

##### Parameters

###### elementType

`"iframe"` \| `HostedFieldElementType`

Where to send focus: `'number'` for the
  card number input, `'cvv'` for the CVV input, any mounted catalogue (form) field type (e.g.
  `'email'`, `'address1'`) for that field's input, or `'iframe'` to focus the number iframe
  itself. Required.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

// Mount the hosted fields first — `ready` only fires once the iframes have loaded.
sdk.inAppElements({
  number: { containerId: 'card-number-container' },
  cvv: { containerId: 'cvv-container' },
});

sdk.on('ready', () => {
  // Focus the card number field as soon as the fields are mounted.
  sdk.transferFocus('number');
});
```

### Validation

#### addValidation()

> **addValidation**(`fieldName`, `validator`): `void`

Registers a custom validator for one non-sensitive form field, layered on top of the SDK's
own validation rather than replacing it. The SDK's built-in checks always run first — the
API-safety floor (UTF-16 encodability, character limits, name charset) and then the
`isRequired` gate — and your validator only runs for values that already passed both. It
cannot relax a built-in rule, but it can reject a value the SDK would have accepted.

Your validator runs on your own page, never inside a payment iframe, so PAN, CVV, month,
year, and expiry are never passed to it. The iframe re-filters the validator field list
before posting values to the parent, so those keys cannot be requested either. It runs on
`submit()` and `validate()` (not on every keystroke), and it also runs on empty values when
the field is not required — that is how you express a conditional requirement. When it
reports a failure, `submit()` is blocked before any network call and the message surfaces on
the `validation` event as `payload.formFields[fieldName].error`; Hosted Fields iframes stamp
`aria-invalid` but never render error text, so displaying it stays yours.

Calling this twice for the same field replaces the previous validator. If `fieldName` is not
a validatable field or `validator` is not a function, the call is ignored with a logged
warning — it never throws. If your validator throws or returns something unusable, the SDK
fails open (that field passes the custom rule) and emits `error` plus `consoleError`, so a
bug in your code cannot silently block every checkout.

##### Parameters

###### fieldName

`string`

The field to validate. Required. One of the additional fields
  (`'full_name'`, `'email'`, `'company'`, `'address1'`, `'address2'`, `'city'`, `'state'`,
  `'zip'`, `'country'`, `'phone_number'`, `'house_number_or_name'`, `'street'`,
  `'street_line2'`, `'phone_number_country_code'`, `'phone_number_area_code'`, and their
  `shipping_*` twins) or a cardholder name field (`'first_name'`, `'last_name'`). The PCI
  fields (`'number'`, `'verification_value'`) and date fields (`'month'`, `'year'`,
  `'expiry'`) are not accepted.

###### validator

`CustomFieldValidator`

Called with the field's current value exactly as typed (not trimmed) and the form's other
  non-sensitive values keyed by Spreedly param name (`number`, `verification_value`, `month`,
  `year`, and `expiry` are always absent). Return `{ isValid: false, errorMessage }`
  to fail with a message, `{ isValid: true }` to pass, or `{ isValid: false }` to fail with
  a generic message. Must be synchronous — returning a Promise is treated as a bug and fails
  open.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

sdk.inAppElements({
  number: { containerId: 'card-number' },
  cvv: { containerId: 'cvv' },
  zip: { containerId: 'zip' },
  country: { containerId: 'country' },
});

// Simple format rule
sdk.addValidation('zip', value => {
  const ok = /^\d{5}(-\d{4})?$/.test(value);
  return { isValid: ok, errorMessage: ok ? void : 'Enter a valid US ZIP code' };
});

// Cross-field rule — the second argument holds the other field values
sdk.addValidation('state', (value, fields) => {
  if (fields.country !== 'US') return { isValid: true };
  const ok = US_STATES.includes(value);
  return { isValid: ok, errorMessage: ok ? void : 'Select a valid US state' };
});

// Conditional requirement — zip is not mounted with isRequired, but is
// mandatory for US shoppers. Validators run on empty values too.
sdk.addValidation('zip', (value, fields) => {
  if (fields.country !== 'US') return { isValid: true };
  const ok = Boolean(value.trim());
  return { isValid: ok, errorMessage: ok ? void : 'ZIP is required for US addresses' };
});

sdk.on('validation', result => {
  console.log(result.formFields.zip?.error);
});
```

***

#### removeValidation()

> **removeValidation**(`fieldName`): `void`

Removes the custom validator previously registered for a field with `addValidation()`,
restoring built-in-only validation for it. Every other field is unaffected, and the SDK's
own rules for this field (character limits, UTF-16, charset, `isRequired`) keep working
exactly as before — those were never replaced. Removing the last registered validator also
removes the parent round-trip entirely, so validation returns to being fully synchronous.

If `fieldName` is not a validatable field the call is ignored with a logged warning; if it
is valid but has no validator registered, the call is a silent no-op. It never throws.

##### Parameters

###### fieldName

`string`

The field whose validator should be removed. Required. Same set
  of names accepted by `addValidation()`.

##### Returns

`void`

##### Example

```javascript
sdk.addValidation('zip', value => {
  const ok = /^\d{5}$/.test(value);
  return { isValid: ok, errorMessage: ok ? void : 'Enter a 5-digit ZIP' };
});

// Later — e.g. the shopper switched to a country where the rule no longer applies
sdk.removeValidation('zip');
```

***

#### setFieldStateReporting()

> **setFieldStateReporting**(`options`): `void`

Configures which optional, sensitive fields are included on the continuous
`fieldStateChange` snapshots. Call this to opt in to receiving the card's `iin` (the
leading PAN digits / issuer identification number) from the number iframe, and/or the
current catalogue-field `value` from name / address / expiry iframes. By default both
are omitted, so you must opt in explicitly. Any script on the checkout page can read
opted-in values from `message` events without registering an SDK handler — treat
`includeValue` with the same care as `includeIin`. Sends a message to the number iframe
and every mounted catalogue iframe, so call it once the fields are mounted (inside
`on('ready', ...)`); it is a no-op after the instance is destroyed.

##### Parameters

###### options

`SpreedlySetFieldStateReporting`

Reporting options
  object. Required.
  - `includeIin` {boolean} - When `true`, the `iin` (PAN prefix) is added to
    `fieldStateChange` payloads whenever it is available. Optional; defaults to `false`.
  - `includeValue` {boolean} - When `true`, catalogue `fieldStateChange` payloads include
    the sub-input's current `value` (scrubbed of PAN-shaped data). Number, CVV, and
    submit-button snapshots never carry `value`. Optional; defaults to `false`.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

sdk.on('ready', () => {
  // Opt in to receiving the card IIN on live field-state snapshots
  sdk.setFieldStateReporting({ includeIin: true, includeValue: true });
});

sdk.on('fieldStateChange', (state) => {
  if (state.iin) {
    // e.g. run a BIN lookup with the PAN prefix
    console.log('IIN:', state.iin);
  }
  if (state.value) {
    console.log(state.field, state.value);
  }
});
```

***

#### validate()

> **validate**(`options?`): `void`

Requests a one-time, client-side validation snapshot of the card fields from the number iframe,
without calling the tokenization API. Call it (after the fields are mounted) when you want to check
field validity on demand — for example to enable a submit button or show inline errors. The result
is delivered asynchronously through the `validation` event, so listen with
`sdk.on('validation', (payload) => { ... })`; the same event also fires automatically when `submit()`
is blocked by client-side validation failures (emitted before the `error` event). For a continuous
stream of field metadata (typing, focus, keystrokes, hover) use `sdk.on('fieldStateChange', ...)`
instead. PAN and CVV never leave the iframe. Catalogue fields mounted via `inAppElements()` are
included under `payload.formFields`. This method is a no-op if the instance has been destroyed.

##### Parameters

###### options?

Optional flags merged into the validation request and forwarded to the number iframe. Optional; defaults to an empty object (all flags off).

###### allow_blank_date?

`boolean`

When `true`, an empty expiration date is not treated as a validation failure. Forwarded for parity with `submit()`.

###### allow_blank_name?

`boolean`

When `true`, an empty cardholder name is not treated as a validation failure. Forwarded for parity with the legacy `validation` behavior.

###### allow_expired_date?

`boolean`

When `true`, an expired expiration date is not treated as a validation failure. Forwarded for parity with the legacy `validation` behavior.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

sdk.on('validation', (result) => {
  console.log('card number valid?', result.validNumber);
  console.log('cvv valid?', result.validCvv);
  console.log('form fields', result.formFields);
});

sdk.on('ready', () => {
  // Ask the number iframe for a validation snapshot
  sdk.validate();

  // Or relax specific checks for parity with legacy behavior
  sdk.validate({ allow_blank_name: true, allow_expired_date: false, allow_blank_date: false });
});
```

### Tokenization

#### submit()

> **submit**(`formData`, `submitParams?`): `void`

Tokenizes the card. The card number and CVV are read from their PCI iframes, and every
catalogue field you mounted via `inAppElements()` is read from its own iframe — none of
those values pass through this call or through the merchant page.

`formData` therefore carries only the tokenization params you did **not** mount as hosted
fields (for example `full_name` or `address1` when you collect them in your own inputs).
Pass `{}` when the mounted fields cover everything. Two groups of keys are dropped with a
warning if they appear here:

- `number`, `cvv`, and `verification_value` — always iframe-owned, and never accepted from
  the parent page.
- Any param owned by a **mounted** catalogue field — the hosted value wins.

Because of that second rule, do **not** pass the `submitClick` payload back into this
method. That payload is a snapshot of the mounted hosted fields, so every key in it is
already iframe-owned; passing it back changes nothing about what gets tokenized and logs a
"values for hosted fields were ignored" warning on every transaction.

Tokenization runs inside the number iframe: it validates, collects the sibling iframe
values, and POSTs. Results arrive on the `tokenGenerated` / `error` callbacks. Submits are
throttled to one every 2 seconds, and the call is a no-op after `destroy()`.

##### Parameters

###### formData

[`HostedFieldsFormData`](#hostedfieldsformdata)

Tokenization params for the fields you did not mount as hosted fields. Required; pass `{}` if there are none.

###### submitParams?

[`SubmitParams`](#submitparams)

Optional extras: `metadata`, `mandate`, `allow_expired_date`, `allow_blank_name`, `allow_blank_date`, `eligible_for_card_updater`.

##### Returns

`void`

##### Examples

```javascript
// Your own Pay button; only number + cvv are hosted, so the rest ride on formData.
document.getElementById('pay').addEventListener('click', () => {
  sdk.submit(
    {
      full_name: document.getElementById('name').value,
      month: document.getElementById('month').value,
      year: document.getElementById('year').value,
    },
    { metadata: { order_id: 'ORDER-123' } }
  );
});
```

```javascript
// Hosted submit button with the full catalogue mounted — nothing is left for formData.
sdk.inAppElements({
  number: { containerId: 'number-container' },
  cvv: { containerId: 'cvv-container' },
  expiry: { containerId: 'expiry-container' },
  full_name: { containerId: 'name-container' },
  submit: { containerId: 'submit-container', text: 'Pay now' },
});

sdk.on('submitClick', (formFields) => {
  // `formFields` is informational — inspect it, but do not pass it back.
  console.log('hosted fields filled:', Object.keys(formFields));
  sdk.submit({}, { metadata: { order_id: 'ORDER-123' } });
});
```

### Recache

#### recache()

> **recache**(): `void`

Executes the CVV recache for the payment method previously configured with `setRecache()`.
Call this (typically from your own button handler) after the shopper re-enters the CVV in the
hosted CVV field; the SDK tells the CVV iframe to make the recache API call using the token and
card details from `setRecache()`. The CVV value never leaves the iframe and is never passed here.
On success the SDK emits `recacheSuccess`; on failure it emits `error`. If `setRecache()` was
never called (SDK not in recache mode) or the iframes are not mounted, this is a no-op that emits
an `error` event with an explanatory message instead of throwing. In Express Checkout this runs
automatically on submit and is not exposed, so `recache()` is a Hosted Fields-only manual step.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

// Enter recache mode for a saved, retained payment method.
// This clears the hosted CVV field so the shopper can re-enter it.
sdk.setRecache('56wyNnSmuA6CWYP7w0MiYCVIbW6', {
  card_type: 'visa',
  last_four_digits: '4242',
  storage_state: 'retained',
  month: '12',
  year: '2025',
});

sdk.on('recacheReady', () => {
  // Recache mode is ready and the CVV field is cleared for re-entry.
  // Trigger the recache from your own button, after the shopper re-enters the CVV.
  document.getElementById('recache-button').addEventListener('click', () => {
    sdk.recache();
  });
});

sdk.on('recacheSuccess', (response) => {
  console.log('CVV recached successfully:', response);
  // Proceed with purchase/authorize using the retained token
});

sdk.on('error', (err) => {
  console.error('Recache failed:', err);
});
```

***

#### setRecache()

> **setRecache**(`token`, `options`): `void`

Puts Hosted Fields into recache mode so a shopper can supply only a fresh CVV for an
already-retained (previously tokenized) card. Call this after the fields are mounted
(inside `sdk.on('ready', ...)`) with the stored payment method token and its card
metadata; the card-number field is prefilled with the masked/last-four value and
locked, and only the CVV field stays editable. On success the SDK fires the
`recacheReady` callback with `{ token, options }`, after which you call `recache()`
to submit the new CVV. This is a no-op that logs a telemetry failure and returns if
the number/CVV iframes are not present, and it aborts (surfacing an `error` event) if
`token` is empty or `options.storage_state` is not `'retained'`.

##### Parameters

###### token

`string`

The retained payment method token whose CVV is being recached. Required.

###### options

[`RecacheOptions`](#recacheoptions)

Metadata for the stored card used to configure recache mode. Required.
  card_type {string} - Card brand (e.g. 'visa', 'master'). Required.
  last_four_digits {string} - Last four digits of the stored card, used to prefill the locked number field. Required.
  first_six_digits {string} - First six digits (BIN) of the stored card. Optional.
  storage_state {string} - Storage state of the payment method; must be 'retained'. Required.
  month {string} - Two-digit expiration month. Required.
  year {string} - Four-digit expiration year. Required.
  full_name {string} - Cardholder full name. Optional.
  allow_blank_name {boolean} - Allow recaching without a cardholder name. Optional.
  allow_expired_date {boolean} - Allow recaching a card with an expired date. Optional.
  allow_blank_date {boolean} - Allow recaching without an expiration date. Optional.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

sdk.on('ready', () => {
  sdk.setRecache('56wyNnSmuA6CWYP7w0MiYCVIbW6', {
    card_type: 'visa',
    last_four_digits: '4242',
    first_six_digits: '411111',
    storage_state: 'retained',
    month: '12',
    year: '2026',
    full_name: 'John Doe',
  });
});

sdk.on('recacheReady', () => {
  // Number field is locked; once the shopper enters the CVV, trigger the recache
  sdk.recache();
});
```

### Offsite Payments

#### clearOffsitePayment()

> **clearOffsitePayment**(): `void`

Clear offsite payment configuration

Clears the stored offsite payment configuration.
Use this if you need to reset the offsite payment setup.

##### Returns

`void`

##### Example

```javascript
sdk.clearOffsitePayment();
```

***

#### setupOffsitePayment()

> **setupOffsitePayment**(`config`): `void`

Setup offsite payment configuration

Stores the offsite payment method configuration to be used when submitting.
Call this before calling submitOffsitePayment().

Two flows are supported based on whether redirectUrl is provided:
- With redirectUrl: Form-based flow that redirects to Spreedly, then back to your URL with token
- Without redirectUrl: API-based flow that emits 'offsiteTokenGenerated' event with the token

##### Parameters

###### config

[`OffsitePaymentConfig`](#offsitepaymentconfig)

Configuration for the offsite payment method

##### Returns

`void`

##### Example

```javascript
// Redirect flow (PayPal, etc.)
sdk.setupOffsitePayment({
  paymentMethodType: 'paypal',
  redirectUrl: 'https://yoursite.com/payment-callback'
});

// API flow (EBANX, NuPay, etc.) - no redirect needed
sdk.setupOffsitePayment({
  paymentMethodType: 'pix',
  email: 'customer@example.com',
  fullName: 'Ana Santos Araujo',
  documentId: '853.513.468-93',
  country: 'BR',
  phoneNumber: '8522847035'
});
```

***

#### submitOffsitePayment()

> **submitOffsitePayment**(): `void`

Submit offsite payment - creates payment method via form redirect or API

Two flows are supported based on the configuration:

**With redirectUrl (Form-based flow):**
Creates a hidden form and submits to Spreedly's transparent redirect endpoint.
The browser will redirect to Spreedly, then back to your redirectUrl with the token.

**Without redirectUrl (API-based flow):**
Makes a direct API call to create the payment method. On success, emits
'offsiteTokenGenerated' event with { token, paymentMethodType } and clears
the stored config. On error, emits 'offsitePaymentError' with a sanitized
[SanitizedPaymentError](#sanitizedpaymenterror) payload (`{ message, status?, errors? }`) —
the raw request (customer PII) is never included, so the payload is safe to
log.

Requires setupOffsitePayment() to be called first.

##### Returns

`void`

##### Throws

If setupOffsitePayment() was not called first

##### Example

```javascript
// Redirect flow
sdk.setupOffsitePayment({
  paymentMethodType: 'paypal',
  redirectUrl: 'https://yoursite.com/payment-callback'
});
sdk.submitOffsitePayment();
// Browser redirects to Spreedly → then to redirectUrl?token=XXXX

// API flow
sdk.on('offsiteTokenGenerated', (data) => {
  console.log('Token:', data.token);
});
sdk.on('offsitePaymentError', (error) => {
  console.error('Error:', error.message);
});
sdk.setupOffsitePayment({
  paymentMethodType: 'pix',
  email: 'customer@example.com',
  fullName: 'Ana Santos',
  documentId: '853.513.468-93',
  country: 'BR'
});
sdk.submitOffsitePayment();
// Token received via 'offsiteTokenGenerated' event
```

### ACH

#### clearACHPayment()

> **clearACHPayment**(): `void`

Clear ACH payment configuration

Clears the stored ACH payment configuration. Use this if you need to
reset the ACH payment setup (for example after a failed submission
before re-collecting account details).

##### Returns

`void`

***

#### setupACHPayment()

> **setupACHPayment**(`config`): `void`

Setup ACH (bank account) payment configuration

Stores the bank account details that will be tokenized when
`submitACHPayment()` is called. The merchant collects these values
in their own UI; this SDK does not render any input fields for ACH.

Required: `bankRoutingNumber`, `bankAccountNumber`, and either
`fullName` OR (`firstName` AND `lastName`).

Note: routing-number / account-number format validation is delegated
to Spreedly Core. Invalid values surface via the `achPaymentError`
event after `submitACHPayment()` is called.

##### Parameters

###### config

[`ACHPaymentConfig`](#achpaymentconfig)

ACH payment configuration

##### Returns

`void`

##### Throws

If required fields are missing

##### Example

```javascript
sdk.setupACHPayment({
  bankRoutingNumber: '021000021',
  bankAccountNumber: '9876543210',
  fullName: 'Bob Smith',
  bankAccountType: 'checking',
  bankAccountHolderType: 'personal',
});
```

***

#### submitACHPayment()

> **submitACHPayment**(): `void`

Submit ACH payment - creates a bank_account payment method via API

Makes a direct API call to Spreedly's payment_methods endpoint. On
success, emits the `achTokenGenerated` event with `{ token, last4 }` and
clears the stored config. On error, emits `achPaymentError` with a
sanitized [SanitizedPaymentError](#sanitizedpaymenterror) payload
(`{ message, status?, errors? }`) — the raw request (bank account/routing
numbers) is never included, so the payload is safe to log.

Requires `setupACHPayment()` to be called first.

##### Returns

`void`

##### Throws

If `setupACHPayment()` was not called first

##### Example

```javascript
sdk.on('achTokenGenerated', ({ token, last4 }) => {
  // Send token to your backend to run the gateway purchase
});
sdk.on('achPaymentError', (error) => {
  console.error('ACH error:', error.message);
});

sdk.setupACHPayment({ ... });
sdk.submitACHPayment();
```

### Stripe Radar

#### stripeRadar()

> **stripeRadar**(`publishableKey`, `options?`): `Promise`\<`string` \| `null`\>

Creates a Stripe Radar session and resolves with its session id.

Stripe Radar collects fraud signals from the browser. Pass the resulting
session id to your backend so it can be forwarded to Stripe when the
payment is processed. This is the modern parity for the legacy
`Spreedly.stripeRadar(publishableKey, callback, options)` API.

Stripe.js must already be loaded on the page
(`<script src="https://js.stripe.com/v3/"></script>`). The session id is
returned to you only — it is NOT attached to tokenization automatically.

##### Parameters

###### publishableKey

`string`

Your Stripe publishable key (starts with `pk_`)

###### options?

[`StripeRadarOptions`](#striperadaroptions)

Optional settings, e.g. `stripeAccount` for Stripe Connect

##### Returns

`Promise`\<`string` \| `null`\>

The radar session id, or `null` if creation failed

##### Example

```javascript
const radarSessionId = await sdk.stripeRadar('pk_test_...');
if (radarSessionId) {
  // send radarSessionId to your backend alongside the payment token
}
```

### Other

#### encryptCardForClickToPay()

> **encryptCardForClickToPay**(`cardholder`): `Promise`\<\{ `cardBrand`: `string`; `encryptedCard`: `string`; \}\>

##### Parameters

###### cardholder

###### available_card_brands?

`string`[]

###### first_name?

`string`

###### full_name?

`string`

###### last_name?

`string`

###### month?

`string`

###### sandbox?

`boolean`

###### year?

`string`

##### Returns

`Promise`\<\{ `cardBrand`: `string`; `encryptedCard`: `string`; \}\>

***

#### tokenizeClickToPay()

> **tokenizeClickToPay**(`body`, `options?`): `Promise`\<`unknown`\>

Tokenizes a completed Click to Pay checkout from inside the iframe.

Running the POST in the iframe keeps it on a `*.spreedly.com` origin (required by
the restricted tokenization endpoint) and — for the selected-card flow — lets the
iframe inject the CVV it holds, which must never reach the merchant page. Pass the
`click_to_pay` body built by `SpreedlyClickToPay`. Wire it as the `tokenize`
callback of `checkout()`:

- Selected card (returning user): `{ withCvv: true }` — the number iframe adds
  `verification_value` from the held CVV before POSTing.
- New card: omit `withCvv` — the card/CVV are inside Mastercard's encrypted blob;
  the body carries only the correlation id + cardholder name.

##### Parameters

###### body

`ClickToPayPaymentMethodBody`

###### options?

###### withCvv?

`boolean`

##### Returns

`Promise`\<`unknown`\>

##### Example

```javascript
// returning user
tokenize: (body) => hostedFields.tokenizeClickToPay(body, { withCvv: true })
// new card
tokenize: (body) => hostedFields.tokenizeClickToPay(body)
```

***

## Type Definitions

### ACHPaymentConfig

> **ACHPaymentConfig** = `object`

Configuration for tokenizing a US or Canadian bank account (ACH), passed to
`setupACHPayment(config)`. Provide the account holder's name either as `fullName`
OR as `firstName` + `lastName`. Routing- and account-number formats are validated
by Spreedly Core (not client-side); the SDK only checks that required fields are present.

## Properties

### address1?

> `optional` **address1?**: `string`

Billing address line 1. Optional (gateway-dependent).

***

### address2?

> `optional` **address2?**: `string`

Billing address line 2. Optional (gateway-dependent).

***

### bankAccountHolderType?

> `optional` **bankAccountHolderType?**: `"personal"` \| `"business"`

Account holder type. Optional; one of `'personal'` or `'business'`.

***

### bankAccountNumber

> **bankAccountNumber**: `string`

Bank account number. Required.

***

### bankAccountType?

> `optional` **bankAccountType?**: `"checking"` \| `"savings"`

Account type. Optional; one of `'checking'` or `'savings'`.

***

### bankName?

> `optional` **bankName?**: `string`

Bank name. Optional.

***

### bankRoutingNumber

> **bankRoutingNumber**: `string`

Bank routing number. Required, exactly 9 digits. For US accounts this must be a
valid ABA routing number (checksum-verified by the SDK); for Canadian accounts it
is the 9-digit electronic routing number beginning with `0`. `setupACHPayment`
throws `Routing number is invalid` for values that can be neither.

***

### city?

> `optional` **city?**: `string`

Billing city. Optional (gateway-dependent).

***

### country?

> `optional` **country?**: `string`

Two-letter country code. Optional; Spreedly supports `'US'` and `'CA'` for ACH.

***

### email?

> `optional` **email?**: `string`

Account holder email. Optional (gateway-dependent).

***

### firstName?

> `optional` **firstName?**: `string`

Account holder's first name. Use together with `lastName` when `fullName` is not provided.

***

### fullName?

> `optional` **fullName?**: `string`

Account holder's full name. Provide this **or** `firstName` + `lastName`.

***

### lastName?

> `optional` **lastName?**: `string`

Account holder's last name. Use together with `firstName` when `fullName` is not provided.

***

### mandate?

> `optional` **mandate?**: [`Mandate`](#mandate)

Opaque mandate data stored on the payment method; the shape is owned by Spreedly Core and forwarded verbatim. Optional.

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `string`\>

Arbitrary key/value metadata stored on the payment method. Optional.

***

### phoneNumber?

> `optional` **phoneNumber?**: `string`

Account holder phone number. Optional (gateway-dependent).

***

### retained?

> `optional` **retained?**: `boolean`

When `true`, request that Spreedly retain the payment method after creation. Optional.

***

### state?

> `optional` **state?**: `string`

Billing state/province. Optional (gateway-dependent).

***

### zip?

> `optional` **zip?**: `string`

Billing postal/ZIP code. Optional (gateway-dependent).

### AuthDetails

> **AuthDetails** = `object`

The signed authentication credentials passed to the SDK constructor
(`new SpreedlyHostedFields(authDetails)` / `new SpreedlyExpressCheckout(authDetails)`).

These identify your Spreedly environment and authorize each tokenization/recache
request. Every field is required: the constructor validates them via
`isValidAuthDetails`, and if any one is missing/empty it emits an
`AUTH_VALIDATION_FAILED` telemetry event and throws
`Invalid auth details. Ensure valid values for environment_key, certificate_token,
nonce, signature, and timestamp are provided.`. The `nonce`, `signature`, and
`timestamp` form a signed request that must be generated server-side (never in the
browser), so your certificate's private key is not exposed.

## Properties

### certificate\_token

> **certificate\_token**: `string`

The token of the Spreedly certificate whose private key signed this request. Required.

***

### environment\_key

> **environment\_key**: `string`

Your Spreedly environment key, identifying the environment that will hold the tokenized payment method. Required.

***

### nonce

> **nonce**: `string`

A unique, single-use value included in the server-side signature to prevent replay of the request. Required.

***

### signature

> **signature**: `string`

The signature produced server-side over the request (using the certificate's private key) that authorizes this tokenization. Required.

***

### timestamp

> **timestamp**: `string`

The UTC timestamp that was included when generating the signature, used to bound the request's validity window. Required.

### HostedFieldInput

> **HostedFieldInput** = `object`

Configuration for a single Spreedly hosted field (the card number field, the CVV field,
or any catalogue field mounted via [HostedFieldsConfig](#hostedfieldsconfig)).

Each hosted field is rendered as a secure Spreedly-hosted iframe injected into a DOM
element you provide. You supply one `HostedFieldInput` per field via
[HostedFieldsConfig](#hostedfieldsconfig) when calling `inAppElements()`. The referenced container
element must already exist in the DOM when `inAppElements()` runs; if the element with
the given `containerId` cannot be found, that field is skipped and a warning is logged.

## Properties

### containerId

> **containerId**: `string`

ID of the DOM element (looked up with `document.getElementById`) that the field's
secure iframe is appended into. Required; the element must exist in the DOM before
`inAppElements()` is called or the field is not mounted.

***

### isRequired?

> `optional` **isRequired?**: `boolean`

Optional. When `true`, the SDK blocks tokenization (emitting `validation` then `error`)
if this hosted field is left blank at `submit()` time. Same name and semantics as the
Express Checkout field config flag.

This flag applies to every catalogue field except the two default-required groups: the
**name** fields `first_name` / `last_name` and the **date** fields `expiry` / `month` /
`year` are **required by default** whenever mounted — regardless of this flag — and are
relaxed only by the `allow_blank_name` / `allow_blank_date` submit params respectively.
`full_name` is **not** default-required: like `email` / `company` / `phone_number` /
address fields, it is only gated when mounted with `isRequired: true` (Express Checkout
parity). When `true`, the hosted input also receives HTML `required` and
`aria-required="true"` at mount (same as `setRequiredAttribute`).
The card `number` and `cvv` fields are always validated. Defaults to `false`
(Spreedly Core still enforces its own server-side requirements).

***

### styles?

> `optional` **styles?**: `Partial`\<`CSSStyleDeclaration`\>

Optional CSS applied to the hosted `<input>` when the fields become ready.
Same allowlist and filtering as `setStyles(<type>, …)`.
Update later with `setStyles(<type>, …)`.

### HostedFieldsConfig

> **HostedFieldsConfig** = `object` & `Partial`\<`Record`\<[`HostedFormFieldType`](#hostedformfieldtype), [`HostedFieldInput`](#hostedfieldinput)\>\>

Configuration object passed to SpreedlyHostedFields.inAppElements \| \`inAppElements()\`.

Required PCI iframes (always mounted):
- `number` — MandatoryCardPaymentFormFields.CardNumber
- `cvv` — [HostedCvvField](#hostedcvvfield) (iframe key; the API param is
  MandatoryCardPaymentFormFields.Cvv / `verification_value`)

Optional catalogue fields share Express Checkout's field keys. Include a key to mount
that field into the given container — the same merchant-selects-fields model as Express
Checkout's `cardPaymentFormFields` / `addField`. See [HostedFormFieldType](#hostedformfieldtype).

Optional hosted submit button:
- `submit` — [HostedSubmitButtonInput](#hostedsubmitbuttoninput); omit to keep using your own Pay button

## Type Declaration

### cvv

> **cvv**: [`HostedFieldInput`](#hostedfieldinput)

CVV PCI iframe. Same key as [HostedCvvField](#hostedcvvfield) (`cvv`), not
MandatoryCardPaymentFormFields.Cvv (`verification_value`).

### number

> **number**: [`HostedFieldInput`](#hostedfieldinput)

Card number PCI iframe. Same key as MandatoryCardPaymentFormFields.CardNumber.

### submit?

> `optional` **submit?**: [`HostedSubmitButtonInput`](#hostedsubmitbuttoninput)

Optional hosted submit button iframe. When mounted, a click emits `submitClick`
with a read-only snapshot of the collected catalogue values. Register
`sdk.on('submitClick', …)` and call `submit()` from that callback, passing only the
fields you did **not** mount as hosted fields — mounted values are read from their
iframes. A missing listener emits `error`.

### HostedFieldsFormData

> **HostedFieldsFormData** = `Omit`\<`MandatoryCardFields`, `"number"` \| `"verification_value"`\> & `AdditionalCardFields` & `object`

Cardholder, billing, and shipping details passed to `SpreedlyHostedFields.submit()`
alongside the securely held card number and CVV. The PAN (`number`) and CVV
(`verification_value`) are deliberately omitted from this shape: those values live only
inside the hosted field iframes and are never accepted from, nor exposed to, merchant
code. If they are supplied at runtime they are stripped with a warning; the iframe always
tokenizes its in-memory card details. Every field mirrors a legacy `Spreedly.setParam(name,
value)` slot one-to-one; any key that is not recognized is dropped server-side during
tokenization and logged as a console warning so typos are easy to spot.

`month` and `year` are required. For the cardholder name, provide **either** `full_name`
**or** both `first_name` and `last_name` — the SDK forwards whatever you supply and
Spreedly Core enforces the requirement.

## Type Declaration

### eligible\_for\_card\_updater?

> `optional` **eligible\_for\_card\_updater?**: `boolean`

Whether this card should be enrolled in Spreedly's Account Updater (card updater)
service. Optional; no default. May also be supplied via
`SubmitParams.eligible_for_card_updater` on the second `submit()` argument.

### HostedFormFieldType

> **HostedFormFieldType** = *typeof* [`CombinedExpiryField`](#combinedexpiryfield) \| `Exclude`\<`TMandatoryCardPaymentFormFields`, *typeof* `MandatoryCardPaymentFormFields.CardNumber` \| *typeof* `MandatoryCardPaymentFormFields.Cvv`\> \| `TAdditionalCardPaymentFormFields`

The composable, opt-in catalogue fields that can be mounted as additional Spreedly-hosted
iframes alongside the mandatory `number` and `cvv` PCI fields. Keys are the same Spreedly
tokenization parameters used by Express Checkout ([MandatoryCardPaymentFormFields](#mandatorycardpaymentformfields)
minus PAN/CVV, plus [AdditionalCardPaymentFormFields](#additionalcardpaymentformfields)), so both products collect the
same payment-method fields. The one Hosted Fields-only extra is [CombinedExpiryField](#combinedexpiryfield),
which parses a single `MM/YY` input into `month` + `year`.

Expiry can be collected two ways (mutually exclusive):
- `expiry` — a single `MM/YY` input parsed into `month` + `year`, or
- `month` + `year` — two separate inputs.

If both the combined `expiry` and either separate field are configured, the separate
`month`/`year` are ignored (a warning is logged) and the combined `expiry` wins.

### HostedSubmitButtonInput

> **HostedSubmitButtonInput** = `object`

Configuration for the optional hosted submit button mounted via [HostedFieldsConfig.submit](#hostedfieldsconfig).
Unlike catalogue fields this is a `<button>`, not a tokenization parameter.

## Properties

### containerId

> **containerId**: `string`

ID of the DOM element (looked up with `document.getElementById`) that the button iframe
is appended into. Required; the element must exist in the DOM before `inAppElements()`
is called or the button is not mounted.

***

### styles?

> `optional` **styles?**: `Partial`\<`CSSStyleDeclaration`\>

Optional CSS applied to the hosted `<button>` when the fields become ready.
Same allowlist and filtering as `setStyles('submit', …)`.
Update later with `setStyles('submit', …)`.

***

### text?

> `optional` **text?**: `string`

Visible button label (and matching `aria-label`). Defaults to `'Submit'`.
Update later with `setText('submit', …)` or `setLabel('submit', …)`.

### Mandate

> **Mandate** = `Record`\<`string`, `unknown`\>

Opaque mandate data forwarded verbatim to Spreedly Core. Core owns the mandate
schema and performs all validation; the SDK does not interpret, shape, or
validate this object beyond checking that it is non-empty before forwarding it.

### NumberDisplayFormat

> **NumberDisplayFormat** = `"maskedFormat"` \| `"plainFormat"` \| `"prettyFormat"`

### OffsitePaymentConfig

> **OffsitePaymentConfig** = `object`

Configuration for creating an offsite / alternative payment method, passed to
`setupOffsitePayment(config)`. The required fields vary by `paymentMethodType`;
the address/contact fields below are used by the LATAM methods that need them.
Provide the customer's name either as `fullName` OR as `firstName` + `lastName`.

## Properties

### address1?

> `optional` **address1?**: `string`

Address line 1. Optional (method-dependent).

***

### address2?

> `optional` **address2?**: `string`

Address line 2. Optional (method-dependent).

***

### city?

> `optional` **city?**: `string`

City. Optional (method-dependent).

***

### country?

> `optional` **country?**: `string`

Two-letter country code (e.g. `'BR'`, `'MX'`, `'CL'`, `'AR'`). Optional (method-dependent).

***

### documentId?

> `optional` **documentId?**: `string`

National ID / taxpayer ID (e.g. CPF for Brazil). Optional (method-dependent).

***

### email?

> `optional` **email?**: `string`

Customer email. Optional (method-dependent).

***

### firstName?

> `optional` **firstName?**: `string`

Customer first name. Use together with `lastName` when `fullName` is not provided.

***

### fullName?

> `optional` **fullName?**: `string`

Customer full name. Provide this **or** `firstName` + `lastName`.

***

### lastName?

> `optional` **lastName?**: `string`

Customer last name. Use together with `firstName` when `fullName` is not provided.

***

### paymentMethodType

> **paymentMethodType**: `string`

The offsite payment method to create — e.g. `'paypal'`, `'pix'`,
`'boleto_bancario'`, `'oxxo'`, `'nupay'`, `'khipu'`, `'rapipago'`. Required.

***

### phoneNumber?

> `optional` **phoneNumber?**: `string`

Customer phone number. Optional (method-dependent).

***

### redirectUrl?

> `optional` **redirectUrl?**: `string`

URL to redirect to after the payment method is created. When provided, the SDK
uses the form-based redirect flow instead of the API flow. Optional.

***

### state?

> `optional` **state?**: `string`

State/province. Optional (method-dependent).

***

### zip?

> `optional` **zip?**: `string`

Postal/ZIP code. Optional (method-dependent).

### PPCPButtonColor

> **PPCPButtonColor** = `"gold"` \| `"blue"` \| `"white"` \| `"black"`

### PPCPButtonKind

> **PPCPButtonKind** = `"paypal"` \| `"venmo"` \| `"payLater"` \| `"payPalCredit"`

### PPCPButtonLabel

> **PPCPButtonLabel** = `"checkout"` \| `"pay"` \| `"buynow"` \| `"subscribe"` \| `"donate"`

### PPCPPaymentMethodType

> **PPCPPaymentMethodType** = `"paypal"` \| `"venmo"` \| `"paylater"` \| `"paypal_credit"`

### PPCPPresentationMode

> **PPCPPresentationMode** = `"auto"` \| `"popup"` \| `"redirect"` \| `"payment-handler"`

### RecacheOptions

> **RecacheOptions** = `object`

Describes the saved, retained payment method whose CVV you want to re-cache, passed
as the second argument to `setRecache(token, options)`. These fields identify the
existing card (they are metadata about an already-tokenized payment method — the PAN
and CVV are never included here) and, together with the token, put the SDK into
recache mode so the shopper only has to re-enter their CVV. `storage_state` must be
`'retained'` or `setRecache` rejects the call and fires an `error` event; the
`allow_*` flags relax validation on the subsequent `recache()` call.

## Properties

### allow\_blank\_date?

> `optional` **allow\_blank\_date?**: `boolean`

When `true`, allows the recache to proceed even if the expiration date is blank. Optional; treated as `false` when omitted.

***

### allow\_blank\_name?

> `optional` **allow\_blank\_name?**: `boolean`

When `true`, allows the recache to proceed even if the cardholder name is blank. Optional; treated as `false` when omitted.

***

### allow\_expired\_date?

> `optional` **allow\_expired\_date?**: `boolean`

When `true`, allows the recache to proceed even if the card's expiration date is in the past. Optional; treated as `false` when omitted.

***

### card\_type

> **card\_type**: `string`

Card brand of the saved payment method, e.g. `'visa'`, `'master'`, `'american_express'`. Required. Used to size CVV validation for the brand (e.g. 4 digits for American Express) during the recache flow; it is NOT sent in the recache API request body, which carries only the new CVV plus the `allow_*` flags.

***

### first\_six\_digits?

> `optional` **first\_six\_digits?**: `string`

First six digits (BIN) of the saved card. Optional.

***

### full\_name?

> `optional` **full\_name?**: `string`

Cardholder name on the saved payment method. Optional.

***

### last\_four\_digits

> **last\_four\_digits**: `string`

Last four digits of the saved card. Required. Used only to prefill the disabled number field as a masked value (`****1234`); not sent to the recache API.

***

### month

> **month**: `string`

Expiration month of the saved card (e.g. `'12'`). Required.

***

### storage\_state

> **storage\_state**: `string`

Storage state of the payment method. Required, and must be exactly `'retained'` — any other value causes `setRecache` to emit an `error` (attribute `storage_state`) and abort.

***

### year

> **year**: `string`

Expiration year of the saved card (e.g. `'2025'`). Required.

### SanitizedPaymentError

> **SanitizedPaymentError** = `object`

Sanitized payment error emitted to the merchant's `achPaymentError` /
`offsitePaymentError` callbacks.

This is a shaped, safe-to-log projection of the underlying HTTP error. It is
deliberately built only from the server response and NEVER includes the raw
request (`config`/`request`), so sensitive request-body values — bank
account/routing numbers (ACH) or customer PII (offsite) — cannot leak into
merchant logs or third-party log/monitoring processors.

## Properties

### errors?

> `optional` **errors?**: [`SpreedlyServiceError`](#spreedlyserviceerror)[]

Validation details from Spreedly Core's response `errors` array, when available.

***

### message

> **message**: `string`

Human-readable error message (server message when available, otherwise a generic fallback).

***

### status?

> `optional` **status?**: `number`

HTTP status code from the response, when available.

### SpreedlyInputMode

> **SpreedlyInputMode** = `"none"` \| `"text"` \| `"numeric"` \| `"decimal"` \| `"tel"` \| `"search"` \| `"email"` \| `"url"` \| `"tel-national"` \| `"tel-international"` \| `"tel-national-prefix-optional"` \| `"tel-international-prefix-optional"`

Allowed `inputmode` values for hosted field inputs (HTML spec subset).

### SpreedlyServiceError

> **SpreedlyServiceError** = `object`

A single error entry from Spreedly Core's response `errors` array.

These describe *why* the request failed (e.g. an invalid routing number) and
never echo back the submitted account/routing/PII values, so they are safe to
surface and log.

## Properties

### attribute?

> `optional` **attribute?**: `string`

The request field the error applies to, e.g. `'bank_routing_number'`. Absent for non-field (base) errors.

***

### key

> **key**: `string`

Machine-readable error key, e.g. `'errors.invalid'` or `'errors.blank'`.

***

### message

> **message**: `string`

Human-readable description of the failure, e.g. `'is invalid'`.

### SubmitParams

> **SubmitParams** = `object`

Optional tokenization flags and metadata passed as the second argument to
SpreedlyHostedFields.submit (`submit(formData, submitParams)`). Every field is
optional — omit the argument entirely to tokenize with default (strict) validation.
Sensitive card data (PAN/CVV) is NEVER included here; those values stay inside the
hosted-field iframes. Note that the hosted-fields `submit()` only forwards `metadata`,
`mandate`, the three `allow_*` flags, and `eligible_for_card_updater` — the `allow_*`
flags are sent only when truthy, and `eligible_for_card_updater` is sent whenever it
is defined (including `false`).

## Properties

### allow\_blank\_date?

> `optional` **allow\_blank\_date?**: `boolean`

Optional. When `true`, allows tokenization with a blank/missing expiration date. Forwarded only when truthy; otherwise month/year are required.

***

### allow\_blank\_name?

> `optional` **allow\_blank\_name?**: `boolean`

Optional. When `true`, allows tokenization with a blank/missing cardholder name. Forwarded only when truthy; otherwise a name is required.

***

### allow\_expired\_date?

> `optional` **allow\_expired\_date?**: `boolean`

Optional. When `true`, allows tokenization to succeed even if the card's expiration date is in the past. Forwarded only when truthy; otherwise Spreedly rejects expired dates.

***

### eligible\_for\_card\_updater?

> `optional` **eligible\_for\_card\_updater?**: `boolean`

Optional. Marks the payment method as eligible for Spreedly's Account Updater (card-updater) service. Forwarded whenever it is defined, including when set to `false`.

***

### mandate?

> `optional` **mandate?**: [`Mandate`](#mandate)

Optional. Opaque mandate data stored alongside the resulting payment method; the shape is owned by Spreedly Core and forwarded verbatim. Defaults to an empty object (`{}`) when omitted.

***

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `string`\>

Optional. Free-form key/value metadata stored alongside the resulting payment method. Defaults to an empty object (`{}`) when omitted.

***

### retained?

> `optional` **retained?**: `boolean`

Optional. Requests that Spreedly retain (permanently store) the payment method after tokenization rather than treating it as single-use. Note: not forwarded by the current hosted-fields `submit()` implementation.
