# SpreedlyExpressCheckout

SpreedlyExpressCheckout — the SDK for Spreedly's prebuilt drop-in payment form.

This class provides a comprehensive interface for merchants to integrate
secure payment forms using Spreedly's hosted iframe solution. It supports
both dialog and embedded modes, dynamic UI configuration, and event-driven
callbacks for seamless integration.

## Contents

Methods are grouped into the sections below; type definitions follow.

| Section | What it covers |
| --- | --- |
| [Lifecycle](#lifecycle) | Create, mount, reload, and tear down the SDK instance, and subscribe to events. |
| [Form Configuration](#form-configuration) | Configure the prebuilt form — which fields to render, their labels/placeholders, the display text, and submit parameters. |
| [Recache](#recache) | Update the CVV on an already-retained (previously tokenized) payment method. |
| [Offsite Payments](#offsite-payments) | Redirect-style / alternative payment methods, inherited from the shared SDK — see the dedicated Offsite Payments reference. |
| [ACH](#ach) | Bank-account (ACH) tokenization, inherited from the shared SDK — see the dedicated ACH reference. |
| [Type Definitions](#type-definitions) | The parameter and return types used throughout the API. |

## Example

```javascript
const sdk = new SpreedlyExpressCheckout({
  environment_key: 'your_env_key',
  certificate_token: 'your_cert_token',
  nonce: 'your_nonce',
  signature: 'your_signature',
  timestamp: 'your_timestamp'
});

sdk.on('ready', () => console.log('SDK is ready'));
sdk.on('tokenGenerated', (token) => console.log('Token:', token));

sdk.expressCheckout({
  parentContainerId: 'payment-form-container'
});
```

## Properties

### AdditionalCardFormFields

> `static` **AdditionalCardFormFields**: `Readonly`\<\{ `Address1`: `"address1"`; `Address2`: `"address2"`; `City`: `"city"`; `Company`: `"company"`; `Country`: `"country"`; `Email`: `"email"`; `FullName`: `"full_name"`; `PhoneNumber`: `"phone_number"`; `ShippingAddress1`: `"shipping_address1"`; `ShippingAddress2`: `"shipping_address2"`; `ShippingCity`: `"shipping_city"`; `ShippingCountry`: `"shipping_country"`; `ShippingPhoneNumber`: `"shipping_phone_number"`; `ShippingState`: `"shipping_state"`; `ShippingZip`: `"shipping_zip"`; `State`: `"state"`; `Zip`: `"zip"`; \}\>

Additional card form fields that can be added dynamically

***

### MandatoryCardFormFields

> `static` **MandatoryCardFormFields**: `Readonly`\<\{ `CardNumber`: `"number"`; `Cvv`: `"verification_value"`; `ExpiryMonth`: `"month"`; `ExpiryYear`: `"year"`; `FirstName`: `"first_name"`; `LastName`: `"last_name"`; \}\>

Mandatory card form fields required for payment processing

***

### SpreedlySDKCallbacks

> `static` **SpreedlySDKCallbacks**: `Readonly`\<\{ `ACHPaymentError`: `"achPaymentError"`; `ACHTokenGenerated`: `"achTokenGenerated"`; `Close`: `"close"`; `ConsoleError`: `"consoleError"`; `Error`: `"error"`; `FieldStateChange`: `"fieldStateChange"`; `OffsitePaymentError`: `"offsitePaymentError"`; `OffsiteTokenGenerated`: `"offsiteTokenGenerated"`; `Ready`: `"ready"`; `RecacheReady`: `"recacheReady"`; `RecacheSuccess`: `"recacheSuccess"`; `TokenGenerated`: `"tokenGenerated"`; `Validation`: `"validation"`; \}\>

Available SDK callback events that merchants can listen to

***

### TextElement

> `static` **TextElement**: `Readonly`\<\{ `FooterText`: `"footerText"`; `ProcessingText`: `"processingText"`; `SubmitBtnText`: `"submitBtnText"`; `Title`: `"title"`; \}\>

Text elements that can be customized in the UI

***

### VERSION

> `static` **VERSION**: `string`

Current SDK version

## Methods

### Lifecycle

#### close()

> **close**(`hardDestroy?`): `void`

Closes and tears down the Express Checkout payment form, removing it from the DOM and cleaning up internal state. In dialog mode this removes the modal overlay; in embedded mode it removes the iframe from its parent container. This is the same function returned as `destroy()` from `expressCheckout()`, and the SDK also calls it internally when the hosted form asks to close (e.g. after the shopper dismisses the dialog).

By default (`hardDestroy = false`) it performs a soft close: the form is removed but the global postMessage listener and your registered `on()` callbacks are preserved, so you can reopen the form by calling `expressCheckout()` again on the same instance. Pass `true` to fully destroy the instance — this additionally removes the window message listener and resets all callback queues, after which the instance should no longer be reused. If no form is currently open this is effectively a no-op (it logs a warning and returns without error).

##### Parameters

###### hardDestroy?

`boolean` = `false`

Whether to completely destroy the SDK instance. When `false`, only the form is closed and the instance can be reopened. When `true`, the message listener and all `on()` callback queues are also removed for a full teardown. Optional; defaults to `false`.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyExpressCheckout(authDetails);

// Open the form, keeping a handle to close it later
const checkout = sdk.expressCheckout({ parentContainerId: 'payment-container' });

// Soft close - form is removed but the instance can be reopened
checkout.destroy();
// equivalent to:
sdk.close();

// Hard destroy - also removes listeners and callback queues (do not reuse after this)
sdk.close(true);
```

***

#### expressCheckout()

> **expressCheckout**(`checkoutPluginOpts?`): \{ `destroy`: (`hardDestroy?`) => `void`; \} \| `void`

Builds the Spreedly hosted checkout iframe and mounts it, rendering the prebuilt
credit-card form. Call this once your page is ready and you want to show the form:
pass `parentContainerId` to embed it inside that element, or omit it to open the form
as a full-screen modal dialog. Any `uiConfig` and `submitParams` you pass are merged
over the SDK defaults and forwarded to the iframe once it signals `ready`; card data
(PAN/CVV) is entered and tokenized entirely inside the iframe and never passed here.
This is a no-op that returns `void` if `environment_key` is missing, or if
`parentContainerId` is given but no such element exists in the DOM.

##### Parameters

###### checkoutPluginOpts?

`Pick`\<[`SpreedlyCheckoutPluginOptions`](#spreedlycheckoutpluginoptions), `"className"` \| `"id"` \| `"submitParams"` \| `"parentContainerId"`\> & `object`

Configuration for the checkout form. Optional; if omitted the previously configured/default options are used and the form renders as a dialog.
  - `id` {string} - ID attribute applied to the generated iframe element. Optional.
  - `className` {string} - CSS class added to the generated iframe element. Optional.
  - `parentContainerId` {string} - ID of an existing DOM element to embed the form into. Optional; when omitted the form opens as a modal dialog instead.
  - `submitParams` {SubmitParams} - Tokenization options sent with the payment; supported sub-fields: `metadata` (Record<string, string>, defaults to `{}`), `allow_expired_date`, `allow_blank_name`, `allow_blank_date`, and `retained` (all optional booleans, only forwarded when truthy). Optional.
  - `uiConfig` {Partial<UIConfig>} - Overrides for the form UI (e.g. `styles`, `textConfig`, `cardPaymentFormFields`, `twoDigitExpiry`, `showSaveCardCheckbox`). Optional; merged over `DEFAULT_UI_CONFIG`.

##### Returns

An object whose `destroy` method (an alias for `close`) tears the form down and removes it from the DOM, or `void` if the form could not be mounted.

###### Type Literal

\{ `destroy`: (`hardDestroy?`) => `void`; \}

###### destroy

> **destroy**: (`hardDestroy?`) => `void`

Closes and tears down the Express Checkout payment form, removing it from the DOM and cleaning up internal state. In dialog mode this removes the modal overlay; in embedded mode it removes the iframe from its parent container. This is the same function returned as `destroy()` from `expressCheckout()`, and the SDK also calls it internally when the hosted form asks to close (e.g. after the shopper dismisses the dialog).

By default (`hardDestroy = false`) it performs a soft close: the form is removed but the global postMessage listener and your registered `on()` callbacks are preserved, so you can reopen the form by calling `expressCheckout()` again on the same instance. Pass `true` to fully destroy the instance — this additionally removes the window message listener and resets all callback queues, after which the instance should no longer be reused. If no form is currently open this is effectively a no-op (it logs a warning and returns without error).

###### Parameters

###### hardDestroy?

`boolean` = `false`

Whether to completely destroy the SDK instance. When `false`, only the form is closed and the instance can be reopened. When `true`, the message listener and all `on()` callback queues are also removed for a full teardown. Optional; defaults to `false`.

###### Returns

`void`

###### Example

```javascript
const sdk = new SpreedlyExpressCheckout(authDetails);

// Open the form, keeping a handle to close it later
const checkout = sdk.expressCheckout({ parentContainerId: 'payment-container' });

// Soft close - form is removed but the instance can be reopened
checkout.destroy();
// equivalent to:
sdk.close();

// Hard destroy - also removes listeners and callback queues (do not reuse after this)
sdk.close(true);
```

***

`void`

##### Example

```javascript
const sdk = new SpreedlyExpressCheckout({
  environment_key: 'your_env_key',
  certificate_token: 'your_cert_token',
  nonce: 'your_nonce',
  signature: 'your_signature'
});

sdk.on('ready', () => console.log('Checkout form ready'));
sdk.on('tokenGenerated', (token) => console.log('Token:', token));

// Embedded mode
const checkout = sdk.expressCheckout({
  parentContainerId: 'payment-container',
  uiConfig: { textConfig: { title: 'Complete Payment' } },
  submitParams: { metadata: { orderId: '12345' } }
});

// Dialog mode (omit parentContainerId)
// const checkout = sdk.expressCheckout({ uiConfig: { textConfig: { submitBtnText: 'Pay Now' } } });

// Tear the form down when done
checkout?.destroy();
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

sdk.on('close', () => {
  console.log('Payment form was closed');
});
```

***

#### removeHandlers()

> **removeHandlers**(): `void`

Removes all registered event listeners (legacy `Spreedly.removeHandlers()` parity).

Does not remove the window `message` listener — use `destroy()` on hosted fields or
`close(true)` on express checkout for full teardown.

##### Returns

`void`

### Form Configuration

#### addField()

> **addField**(`fieldName`, `config`): `void`

Adds one of the optional (non-mandatory) fields to the Express Checkout payment form.
Use this to collect extra details such as full name, email, company, billing address,
phone number, or shipping address alongside the card fields. Call it before
`expressCheckout()` to have the field present when the form first renders, or after the
form is open to add it live. If the form iframe is already mounted the change is pushed
to it immediately; otherwise the field is stored and applied when the form loads. Passing
an unrecognized field name is a no-op (a warning is logged and nothing changes), and after
the form is closed the field is retained in config but no live update is sent.

##### Parameters

###### fieldName

[`TCardAdditionalFormFields`](#tcardadditionalformfields)

The optional field to add. Required. One of:
  `'full_name'`, `'email'`, `'company'`, `'address1'`, `'address2'`, `'city'`, `'state'`,
  `'zip'`, `'country'`, `'phone_number'`, `'shipping_address1'`, `'shipping_address2'`,
  `'shipping_city'`, `'shipping_state'`, `'shipping_zip'`, `'shipping_country'`,
  `'shipping_phone_number'`.

###### config

`Partial`\<[`FormField`](#formfield)\>

Display configuration for the new field. Required (pass
  `{}` to accept all defaults). Any `fieldName` inside this object is ignored; the first
  argument determines the field.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyExpressCheckout({
  environment_key: 'your_env_key',
  certificate_token: 'your_cert_token',
  nonce: 'your_nonce',
  signature: 'your_signature',
  timestamp: 'your_timestamp'
});

// Add optional fields before opening the form
sdk.addField('company', {
  label: 'Company Name',
  placeholder: 'Enter company name',
  isRequired: false
});

sdk.addField('phone_number', {
  label: 'Phone Number',
  placeholder: 'your_phone_number',
  isRequired: true,
  styles: { borderColor: '#28a745' }
});

sdk.expressCheckout({ parentContainerId: 'payment-container' });
```

***

#### removeField()

> **removeField**(`fieldName`): `void`

Removes a previously added optional field from the Express Checkout card form. Use this to
dynamically take back out any additional field you added with `addField` (for example
dropping a `company` or `shipping_*` field when it is no longer needed). Only the optional
additional fields can be removed — the mandatory fields (first name, last name, card number,
CVV, expiry month/year) are always present and cannot be removed. If `fieldName` is not a
recognized additional field, the call is ignored (a warning is logged and nothing changes).
The field is deleted from the in-memory UI config and the updated config is pushed to the
mounted iframe form; if the form has not been mounted yet, the change is kept in memory and
takes effect once the form renders.

##### Parameters

###### fieldName

[`TCardAdditionalFormFields`](#tcardadditionalformfields)

The additional field to remove. Required. One of
  the optional field identifiers: `'full_name'`, `'email'`, `'company'`, `'address1'`,
  `'address2'`, `'city'`, `'state'`, `'zip'`, `'country'`, `'phone_number'`,
  `'shipping_address1'`, `'shipping_address2'`, `'shipping_city'`, `'shipping_state'`,
  `'shipping_zip'`, `'shipping_country'`, or `'shipping_phone_number'`.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyExpressCheckout(authDetails);

sdk.on('ready', () => {
  // Remove optional fields that are no longer required
  sdk.removeField('company');
  sdk.removeField('phone_number');
});
```

***

#### setFieldConfig()

> **setFieldConfig**(`fieldName`, `config`): `void`

Updates the configuration of a single field in the Express Checkout card form. Call it to
dynamically change a field's label, placeholder, required state, size, masking, or styles after
the form is created. Only the properties you supply are changed; every other property of that
field keeps its current value. The named field must already exist in the form's current
configuration — if the field name is unknown or is not part of the active form, the call is a
no-op (a warning is logged and nothing changes). Once the form iframe is mounted, the change is
pushed live to the rendered form; if called before the form has mounted it updates the in-memory
config only.

##### Parameters

###### fieldName

[`TCardPaymentFormFields`](#tcardpaymentformfields)

Which field to reconfigure. One of the card-form field
  keys: `'first_name'`, `'last_name'`, `'number'`, `'verification_value'`, `'month'`, `'year'`,
  or an additional field such as `'full_name'`, `'email'`, `'company'`, `'address1'`, `'address2'`,
  `'city'`, `'state'`, `'zip'`, `'country'`, `'phone_number'`, or their `'shipping_*'` counterparts.
  Required.

###### config

`Partial`\<[`FormField`](#formfield)\>

The properties to change. Only the following keys are applied;
  any omitted key is left unchanged.
  - `label` {string} - New label text shown above the field. Optional.
  - `placeholder` {string} - New placeholder text shown inside the empty field. Optional.
  - `isRequired` {boolean} - Whether the field must be filled in before submission. Optional.
  - `size` {number} - The field's grid column width (out of a 12-column row). Optional.
  - `isMasked` {boolean} - Whether the field's input is visually masked. Optional.
  - `styles` {TextfieldStyles} - Per-field style overrides (`backgroundColor`, `color`,
    `borderColor`, `fontSize`, `fontWeight`, and nested `placeholder`, `active`, `hover` colors).
    Optional.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyExpressCheckout(authDetails);

sdk.on('ready', () => {
  // Relabel a field and make it required
  sdk.setFieldConfig('first_name', {
    label: 'Given Name',
    placeholder: 'Enter your first name',
    isRequired: true,
  });

  // Restyle the card number field
  sdk.setFieldConfig('number', {
    styles: {
      borderColor: '#007bff',
      fontSize: '16px',
    },
  });
});
```

***

#### updateSubmitParams()

> **updateSubmitParams**(`submitParams`): `void`

Updates the tokenization options sent with the express-checkout form's submission. Call this after
initialization to change how the card is tokenized — for example to attach custom metadata or to
relax validation such as allowing an expired or blank expiration date. The values you pass are
shallow-merged into any previously set submit params (new keys override existing ones), so you can
update individual options without re-specifying the rest. The merged params are stored immediately and
relayed to the checkout iframe; if the form has not been opened/mounted yet the relay is a no-op, but
the stored params still apply once the form initializes.

##### Parameters

###### submitParams

[`SubmitParams`](#submitparams)

The tokenization options to apply. All fields are optional:
  - `metadata` ({ [key: string]: string }): custom key/value pairs stored on the payment method.
  - `allow_expired_date` (boolean): tokenize even when the card's expiration date is in the past.
  - `allow_blank_name` (boolean): tokenize even when the cardholder name is empty.
  - `allow_blank_date` (boolean): tokenize even when the expiration date is empty.
  - `retained` (boolean): retain (store) the payment method rather than treating it as single-use.
  - `eligible_for_card_updater` (boolean): mark the payment method as eligible for automatic card updates.
  Required.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyExpressCheckout(authDetails);
sdk.on('ready', () => {
  sdk.updateSubmitParams({
    retained: true,
    metadata: { order_id: '12345' },
  });
});
```

***

#### updateTextElement()

> **updateTextElement**(`textKey`, `textString`): `void`

Overrides one of the customizable text strings in the Express Checkout form (its title, submit-button
label, footer, or processing message). Call it to tailor the copy shown to your shoppers; the new value
is stored in the form's UI config and immediately pushed to the rendered iframe, so it can be used both
before initializing the form and live after it has mounted. If `textKey` is not one of the four supported
keys the call is a no-op (a warning is logged and nothing changes). If the checkout iframe isn't mounted
yet, the value is saved but only becomes visible once the form renders.

##### Parameters

###### textKey

[`TTextElement`](#ttextelement)

Which text element to
  override. Required. `'title'` (default `'Spreedly Checkout'`), `'submitBtnText'` (default `'Submit'`),
  `'footerText'` (default `'Powered by Spreedly'`), or `'processingText'` (default `'Processing...'`).

###### textString

`string`

The replacement text to display for that element. Required.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyExpressCheckout(authDetails);

sdk.on('ready', () => {
  sdk.updateTextElement('title', 'Complete Your Purchase');
  sdk.updateTextElement('submitBtnText', 'Pay Now');
  sdk.updateTextElement('footerText', 'Secure payment powered by Spreedly');
  sdk.updateTextElement('processingText', 'Please wait...');
});
```

### Recache

#### setRecache()

> **setRecache**(`token`, `options`): `void`

Puts the Express Checkout form into recache mode so it collects only a new CVV for an
existing, already-tokenized payment method instead of a full card entry. Call it after the
form is mounted (inside the `ready` handler); it pre-fills the iframe with the saved card's
display details (brand, last four, expiration) and switches it to CVV-only update. The
payment method must be `retained` — if `token` is missing or `storage_state` is not
`'retained'`, an `error` event is emitted (`{ message, attribute }`) and the call is aborted.
No-op if the checkout iframe has not been created yet (logs a warning and records a failed
telemetry event).

##### Parameters

###### token

`string`

The Spreedly payment method token of the saved card to recache. Required.

###### options

[`RecacheOptions`](#recacheoptions)

Display and validation details for the retained card. Required.
  - `card_type` {string} - Card brand, e.g. `'visa'`, `'master'`. Required.
  - `last_four_digits` {string} - Last four digits of the saved card. Required.
  - `first_six_digits` {string} - First six digits (BIN). Optional.
  - `storage_state` {string} - Storage state of the payment method; must be `'retained'`. Required.
  - `month` {string} - Expiration month. Required.
  - `year` {string} - Expiration year. Required.
  - `full_name` {string} - Cardholder name. Optional.
  - `allow_blank_name` {boolean} - Allow an empty cardholder name. Optional.
  - `allow_expired_date` {boolean} - Allow an expired expiration date. Optional.
  - `allow_blank_date` {boolean} - Allow a blank expiration date. Optional.

##### Returns

`void`

##### Example

```javascript
const sdk = new SpreedlyExpressCheckout(authDetails);
sdk.on('ready', () => {
  sdk.setRecache('56wyNnSmuA6CWYP7w0MiYCVIbW6', {
    card_type: 'visa',
    last_four_digits: '4242',
    first_six_digits: '411111',
    storage_state: 'retained',
    month: '12',
    year: '2027',
    full_name: 'John Doe',
  });
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
'offsiteTokenGenerated' event with { token, paymentMethodType }. On error,
emits 'offsitePaymentError' event.

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
success, emits the `achTokenGenerated` event with
`{ token, last4 }`. On error, emits `achPaymentError`.

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

Bank routing number (9-digit ABA / transit number). Required.

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

### FormField

> **FormField** = `object`

## Properties

### fieldName

> **fieldName**: `TCardMandatoryFormFields` \| [`TCardAdditionalFormFields`](#tcardadditionalformfields)

***

### isMasked

> **isMasked**: `boolean`

***

### isRequired

> **isRequired**: `boolean`

***

### label

> **label**: `string`

***

### placeholder

> **placeholder**: `string`

***

### size

> **size**: `number`

***

### styles

> **styles**: `TextfieldStyles`

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

### SpreedlyCheckoutPluginOptions

> **SpreedlyCheckoutPluginOptions** = `object`

## Properties

### className?

> `optional` **className?**: `string`

***

### id?

> `optional` **id?**: `string`

***

### parentContainerId?

> `optional` **parentContainerId?**: `string`

***

### submitParams?

> `optional` **submitParams?**: [`SubmitParams`](#submitparams)

***

### uiConfig

> **uiConfig**: [`UIConfig`](#uiconfig)

### SubmitParams

> **SubmitParams** = `object`

Optional tokenization flags and metadata passed as the second argument to
SpreedlyHostedFields.submit (`submit(formData, submitParams)`). Every field is
optional — omit the argument entirely to tokenize with default (strict) validation.
Sensitive card data (PAN/CVV) is NEVER included here; those values stay inside the
hosted-field iframes. Note that the hosted-fields `submit()` only forwards `metadata`,
the three `allow_*` flags, and `eligible_for_card_updater` — the `allow_*` flags are
sent only when truthy, and `eligible_for_card_updater` is sent whenever it is defined
(including `false`).

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

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `string`\>

Optional. Free-form key/value metadata stored alongside the resulting payment method. Defaults to an empty object (`{}`) when omitted.

***

### retained?

> `optional` **retained?**: `boolean`

Optional. Requests that Spreedly retain (permanently store) the payment method after tokenization rather than treating it as single-use. Note: not forwarded by the current hosted-fields `submit()` implementation.

### TCardAdditionalFormFields

> **TCardAdditionalFormFields** = *typeof* `AdditionalCardPaymentFormFields`\[keyof *typeof* `AdditionalCardPaymentFormFields`\]

### TCardPaymentFormFields

> **TCardPaymentFormFields** = *typeof* `AllCardPaymentFormFields`\[keyof *typeof* `AllCardPaymentFormFields`\]

### TTextElement

> **TTextElement** = *typeof* `TextElement`\[keyof *typeof* `TextElement`\]

### UIConfig

> **UIConfig** = `object`

Configuration for the prebuilt Express Checkout credit-card form: its visual styling,
user-facing text, which card/billing/shipping fields to render (and how), and a few
behavioral toggles. Pass this as `uiConfig` when initializing the SDK (e.g. via
`SpreedlyInitConfig`/`SpreedlyCheckoutPluginOptions`). Any omitted or partial values
fall back to the SDK's `DEFAULT_UI_CONFIG` (title "Spreedly Checkout", submit "Submit",
footer "Powered by Spreedly", processing "Processing...", the six mandatory card fields,
`twoDigitExpiry: false`, `showCardTypeIcon: true`).

## Properties

### cardPaymentFormFields

> **cardPaymentFormFields**: `Partial`\<`Record`\<[`TCardPaymentFormFields`](#tcardpaymentformfields), [`FormField`](#formfield)\>\>

The card, billing, and shipping fields to render, keyed by field name
(`TCardPaymentFormFields` — mandatory: `'first_name'`, `'last_name'`, `'number'`,
`'verification_value'`, `'month'`, `'year'`; plus additional/shipping fields such as
`'email'`, `'address1'`, `'country'`, `'shipping_zip'`, etc.). Each entry is a
[FormField](#formfield) describing that input's label, placeholder, requiredness, grid size,
masking, and per-field styles. `Partial`, so only the included fields are shown;
required key (defaults to the six mandatory card fields).

***

### saveCardCheckboxLabel?

> `optional` **saveCardCheckboxLabel?**: `string`

Label text for the "save this card" checkbox (used when `showSaveCardCheckbox` is `true`).
Optional; no default.

***

### showCardTypeIcon?

> `optional` **showCardTypeIcon?**: `boolean`

When `true`, show the detected card-brand icon inside the card-number field.
Optional; defaults to `true`.

***

### showSaveCardCheckbox?

> `optional` **showSaveCardCheckbox?**: `boolean`

When `true`, render a "save this card" checkbox in the form. Optional; when omitted the
checkbox is not shown.

***

### styles

> **styles**: `UIStyleConfig`

Theme/style overrides for the hosted form (button, text fields, typography, checkbox,
loader, paper background, and responsive root font sizes). All sub-fields are optional;
pass `{}` to accept the default theme. Required key (defaults to `{}`).

***

### textConfig

> **textConfig**: `Record`\<[`TTextElement`](#ttextelement), `string`\>

User-facing copy keyed by text element: `'title'`, `'submitBtnText'`, `'footerText'`,
and `'processingText'`. Required key; every key must be present (defaults:
"Spreedly Checkout", "Submit", "Powered by Spreedly", "Processing...").

***

### twoDigitExpiry?

> `optional` **twoDigitExpiry?**: `boolean`

When `true`, collect the expiry year as two digits (YY) instead of four (YYYY).
Optional; defaults to `false`.
