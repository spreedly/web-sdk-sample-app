# Hosted Fields — Tokenization Integration Guide

Use Spreedly Hosted Fields (`SpreedlyHostedFields`) to build a fully custom payment form while keeping sensitive card data out of your PCI scope. The SDK injects secure iframes for the card number and CVV fields; you own everything else — layout, styling, and form logic. A working example of catalogue fields, the optional hosted submit button, and `addValidation` is at `/tokenize-catalogue` in this sample app.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Integration Flow](#integration-flow)
4. [Optional hosted submit button](#optional-hosted-submit-button)
5. [Complete Usage Example](#complete-usage-example)
6. [Styling Hosted Fields](#styling-hosted-fields)
7. [Validation](#validation)

8. [Error Handling](#error-handling)
9. [Testing](#testing)
10. [API Reference](#api-reference)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- **HTTPS** — required for secure payment processing
- **Spreedly account** with API credentials
- **Server-generated auth details** — see [Authentication](#authentication) below

### Authentication

Both the constructor and every tokenization request require `AuthDetails`. Generate these server-side — never expose your secret key to the browser.

Follow [this guide](https://developer.spreedly.com/docs/using-certificates-iframe-security) to generate credentials.

| Property | Type | Description |
|----------|------|-------------|
| `environment_key` | `string` | Your Spreedly environment key |
| `certificate_token` | `string` | Certificate token for iframe security |
| `nonce` | `string` | One-time random string |
| `timestamp` | `string` | UTC timestamp |
| `signature` | `string` | SHA-256 digital signature of `nonce + timestamp + certificate_token`, signed with your certificate private key |

---

## Installation

Add the Hosted Fields script to your page:

```html
<!-- Production -->
<script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>

<!-- Staging (testing) -->
<script src="https://core-test.spreedly.com/checkout/sdk/{version}/index.js"></script>
```

| Channel | Description | Example |
|---------|-------------|---------|
| `{version}` | Specific version | `1.0.0` |
| `rc` | Release candidate | `rc` |
| `stable` | Stable release | `stable` |

> For SRI hashes and CSP configuration, see [SECURITY.md](../../../SECURITY.md).

---

## Integration Flow

### Step 1 — Initialize the SDK

```javascript
const sdk = new SpreedlyHostedFields({
  environment_key: 'your_env_key',
  certificate_token: 'your_cert_token',
  nonce: 'your_nonce',
  signature: 'your_signature',
  timestamp: 'your_timestamp'
});
```

### Step 2 — Register event handlers

```javascript
sdk.on('ready', () => {
  console.log('Hosted fields are ready');
  document.getElementById('submit-btn').disabled = false;
});

sdk.on('tokenGenerated', (response) => {
  const token = response.tokenResponse.payment_method.token;
  console.log('Payment method token:', token);
  // Send this token to your server to create a transaction
});

sdk.on('error', (error) => {
  console.error('Error:', error);
});
```

### Step 3 — Mount the secure fields

Provide two empty `<div>` containers in your HTML. The SDK will inject iframes into them.

```html
<div id="card-number-field"></div>
<div id="cvv-field"></div>
```

```javascript
sdk.inAppElements({
  number: {
    containerId: 'card-number-field',
    styles: { fontSize: '16px', color: '#333', fontFamily: 'Arial, sans-serif' },
  },
  cvv: { containerId: 'cvv-field' }
});
```

### Step 4 — Configure field appearance (optional)

Mount-time `styles` (above) are applied on `ready`. You can also set placeholders, input
type, and styles after `ready`:

```javascript
sdk.setPlaceholder('number', 'Card Number');
sdk.setPlaceholder('cvv', 'CVV');

sdk.setFieldType('number', 'tel'); // numeric keyboard on mobile

sdk.setStyles('cvv', {
  fontSize: '16px',
  color: '#333',
  fontFamily: 'Arial, sans-serif'
});
```

### Step 5 — Submit for tokenization

Collect the non-sensitive fields yourself and call `submit()`. To replace your own Pay
button with a Spreedly-hosted one, see [Optional hosted submit button](#optional-hosted-submit-button).

```javascript
document.getElementById('payment-form').addEventListener('submit', (e) => {
  e.preventDefault();

  sdk.submit({
    first_name: document.getElementById('first-name').value,
    last_name: document.getElementById('last-name').value,
    month: document.getElementById('expiry-month').value,
    year: document.getElementById('expiry-year').value
  }, {
    metadata: { order_id: 'ORDER-123' },
  });
});
```

> **Cardholder name:** provide **either** `full_name` **or** both `first_name` and
> `last_name` — whichever suits your form. `month` and `year` are always required. The
> SDK forwards whatever you supply; Spreedly Core enforces the name requirement, so a
> submission with only `full_name` (and no `first_name`/`last_name`) tokenizes fine:
>
> ```javascript
> sdk.submit({
>   full_name: document.getElementById('full-name').value,
>   month: document.getElementById('expiry-month').value,
>   year: document.getElementById('expiry-year').value
> });
> ```

### Step 6 — Handle the token

The `tokenGenerated` callback fires on success:

```javascript
sdk.on('tokenGenerated', (response) => {
  const pm = response.tokenResponse.payment_method;
  console.log('Token:', pm.token);
  console.log('Card type:', pm.card_type);
  console.log('Last four:', pm.last_four_digits);

  // Send pm.token to your backend to create a purchase/auth
});
```

---

## Composable hosted field catalogue (optional)

Beyond the mandatory `number` and `cvv` fields, you can opt any of the following
non-sensitive fields into their own Spreedly-hosted iframe so their values are collected
inside the secure frame instead of your page. Every field is **granular** — one input mapped
to a single Spreedly tokenization parameter — so you mount only what you need, each into its
own container. The config key matches the Spreedly parameter name exactly (the combined
`expiry` field is the one exception).

| Config key | Spreedly parameter(s) collected |
|---|---|
| `expiry` | a single `MM/YY` input, parsed into `month` + `year` |
| `month` | `month` (separate `MM` input) |
| `year` | `year` (separate `YYYY` input) |
| `first_name` | `first_name` |
| `last_name` | `last_name` |
| `full_name` | `full_name` |
| `email` | `email` |
| `company` | `company` |
| `phone_number` | `phone_number` |
| `address1` | `address1` |
| `address2` | `address2` |
| `city` | `city` |
| `state` | `state` |
| `zip` | `zip` |
| `country` | `country` |
| `house_number_or_name` | `house_number_or_name` |
| `street` | `street` |
| `street_line2` | `street_line2` |
| `phone_number_country_code` | `phone_number_country_code` |
| `phone_number_area_code` | `phone_number_area_code` |
| `shipping_address1` … `shipping_country` | the matching `shipping_*` parameter |
| `shipping_phone_number` | `shipping_phone_number` |
| `shipping_house_number_or_name` | `shipping_house_number_or_name` |
| `shipping_street` | `shipping_street` |
| `shipping_street_line2` | `shipping_street_line2` |
| `shipping_phone_number_country_code` | `shipping_phone_number_country_code` |
| `shipping_phone_number_area_code` | `shipping_phone_number_area_code` |

**Backend (Spreedly Core API):** After the request reaches Spreedly’s tokenization
API, the server applies composition: when `house_number_or_name` and/or `street` are
present, Core builds `address1` from them and **overrides** any separately supplied
`address1`. `street_line2` is the canonical equivalent of `address2` and overrides it
when provided. The same override rules apply to the `shipping_*` twins. That behavior
lives in Spreedly’s backend, not in this SDK’s `@spreedly/core` package.

### Expiry: combined or split

Collect the expiration date **either** as one combined `expiry` field (`MM/YY`, parsed into
`month` + `year`) **or** as two separate `month` and `year` fields — not both. If you
configure the combined `expiry` alongside `month`/`year`, the separate fields are ignored
(with a warning) and the combined field wins. Both modes get the same date validation as
`express-checkout` (valid month `1`–`12`, 4-digit year, not-expired unless
`allow_expired_date`).

The combined `expiry` field **auto-formats to `MM/YY` as the cardholder types** — the `/`
separator is inserted automatically after the two month digits (and a leading `2`–`9` is
padded to `0X/`), while backspacing still clears the separator cleanly.

Add a container `<div>` for each field you want, then include it in `inAppElements()`:

```html
<div id="card-number-field"></div>
<div id="cvv-field"></div>
<div id="expiry-field"></div>
<div id="name-field"></div>
<div id="address1-field"></div>
<div id="city-field"></div>
<div id="zip-field"></div>
```

```javascript
sdk.inAppElements({
  number: { containerId: 'card-number-field' },
  cvv: { containerId: 'cvv-field' },

  // Optional granular catalogue fields — include only the ones you want hosted.
  // first_name / last_name and the date fields are required by default; every other field
  // (including full_name) is optional unless `isRequired: true`.
  expiry: { containerId: 'expiry-field' }, // or: month + year
  full_name: { containerId: 'name-field', styles: { fontSize: '16px', color: '#333' } },
  address1: { containerId: 'address1-field', isRequired: true },
  city: { containerId: 'city-field' },
  zip: { containerId: 'zip-field' }
});
```

To collect expiry as separate inputs instead, swap `expiry` for `month` + `year`:

```javascript
sdk.inAppElements({
  number: { containerId: 'card-number-field' },
  cvv: { containerId: 'cvv-field' },
  month: { containerId: 'expiry-month-field' },
  year: { containerId: 'expiry-year-field' }
});
```

**Behavior**

- **Hosted value wins.** When a catalogue field is mounted, its value is read from the
  secure iframe at `submit()` time. Any value you pass to `submit()` for a parameter that
  field owns (e.g. `first_name` when the `first_name` field is mounted) is ignored and a
  warning is logged.
- **Name & date are required by default.** When a **name** field (`first_name` / `last_name`)
  or a **date** field (`expiry` / `month` / `year`) is mounted, it is required —
  leaving it blank blocks tokenization with a `validation` then `error` event. This is
  independent of the `isRequired` option below. To allow blanks, pass `allow_blank_name` (name)
  or `allow_blank_date` (date) to `submit()`; `allow_expired_date` similarly permits a past date.
- **`isRequired` (optional, default `false`).** Applies to every other field — `full_name`,
  email, company, phone and the address fields. When `true`, tokenization is blocked with a
  `validation` then `error` event if that field is left blank, and the hosted input also
  receives HTML `required` + `aria-required="true"` at mount. (Ignored for the
  `first_name` / `last_name` and date fields, which are always required by default as described
  above.) `full_name` is deliberately opt-in here, matching Express Checkout, where a mounted
  `full_name` is only required when configured with `isRequired: true`. `allow_blank_name` does
  not relax `full_name` in either product.
- **Styling & configuration.** Pass optional `styles` on each field in `inAppElements()` —
  they are applied to the hosted `<input>` on `ready` (same allowlist as `setStyles`).
  Field-configuration methods also accept the granular catalogue types, e.g.
  `sdk.setPlaceholder('expiry', 'MM/YY')` or `sdk.setStyles('full_name', { … })`.

```javascript
// With expiry + full_name + address fields mounted, submit() only needs whatever is left:
sdk.submit({
  metadata: { order_id: 'ORDER-123' }
});
```

---

## Optional hosted submit button

The hosted submit button is **opt-in**. Omit `submit` from `inAppElements()` to keep using
your own Pay button and call `sdk.submit(...)` as today.

When you do mount it, a click **does not tokenize**. You **must** register
`sdk.on('submitClick', …)` and call `submit()` from that callback. If the listener is missing,
the SDK logs an error and emits `error` with `{ message }` — no tokenization runs.

Mount it into an empty container the same way as a catalogue field. Size the container at least
44×44px so the control meets the touch-target guideline. The button starts **disabled** until
`ready`, then you own disable/text/styles.

```html
<div id="card-number-field"></div>
<div id="cvv-field"></div>
<div id="submit-button-field" style="height: 44px;"></div>
```

```javascript
sdk.inAppElements({
  number: { containerId: 'card-number-field' },
  cvv: { containerId: 'cvv-field' },
  expiry: { containerId: 'expiry-field' },
  submit: {
    containerId: 'submit-button-field',
    text: 'Pay now',
    styles: {
      backgroundColor: '#0a0a0a',
      color: '#fff',
      fontSize: '16px',
      borderRadius: '6px',
    },
  },
});
```

| Option | Default | Notes |
|---|---|---|
| `containerId` | — | Required. Empty `<div>` the iframe is injected into. |
| `text` | `'Submit'` | Visible label and matching `aria-label`. Update later with `setText('submit', …)` or `setLabel('submit', …)`. |
| `styles` | — | Optional CSS applied to the `<button>` on `ready`. Same allowlist as `setStyles('submit', …)`. |

### Click → `submitClick` → `submit()`

The `submitClick` callback receives Spreedly-param-keyed catalogue values collected from
mounted hosted form fields (`first_name`, `month`/`year`, `email`, …). **PAN and CVV are
never included.**

That payload is **informational** — use it to log, inspect, or run your own pre-submit
checks. **Do not pass it back into `submit()`.** Every mounted field's value is re-read
directly from its iframe at tokenization, so the hosted value always wins; passing the
snapshot back is redundant and logs a "values for hosted fields were ignored" warning on
every transaction.

`submit(formData)` is for the fields you did **not** mount as hosted fields (plus
`submitParams`). If you mounted the whole catalogue, pass `{}`. Validation, throttling,
and tokenization are unchanged.

```javascript
sdk.on('ready', () => {
  sdk.setText('submit', 'Pay now');
  sdk.setTitle('submit', 'Submit payment');
  sdk.setStyles('submit', {
    backgroundColor: '#0a0a0a',
    color: '#fff',
    fontSize: '16px',
    borderRadius: '6px',
  });
});

sdk.on('submitClick', (formFields) => {
  sdk.setDisable('submit', true);
  sdk.setText('submit', 'Please wait...');

  // `formFields` is a snapshot of the mounted hosted fields — inspect it if useful,
  // but do not pass it back: those values come from the iframes at tokenization.
  console.log('hosted fields filled:', Object.keys(formFields));

  sdk.submit(
    {
      // Only fields NOT mounted via inAppElements() belong here.
      email: document.getElementById('email').value,
    },
    {
      metadata: { order_id: 'ORDER-123' },
      allow_blank_name: false,
    }
  );
});

sdk.on('tokenGenerated', () => {
  sdk.setDisable('submit', false);
  sdk.setText('submit', 'Pay now');
});

sdk.on('error', () => {
  sdk.setDisable('submit', false);
  sdk.setText('submit', 'Pay now');
});
```

A missing `submitClick` listener produces:

```javascript
{
  message:
    "Hosted submit button was clicked but no submitClick listener is registered. " +
    "Call sdk.on('submitClick', ...) and invoke submit() from that callback."
}
```

### Customization and events

The SDK does **not** auto-disable the button or change its text during `submit()`. Use:

| Method | Notes |
|---|---|
| `setText('submit', text)` | Visible label and `aria-label`. `'submit'` only. |
| `setDisable('submit', disabled)` | Enable/disable. `'submit'` only. |
| `setStyles('submit', { … })` | Same CSS allowlist as other hosted fields, applied to the `<button>`. Also accepted at mount via `submit.styles`. |
| `setLabel('submit', text)` | Same sanitization as `setText` (HTML stripped; empty ignored). |
| `setTitle('submit', text)` | Native `title` tooltip. |
| `transferFocus('submit')` | Moves focus into the button iframe. |

`setPlaceholder` / `setFieldType` / `setInputMode` / `setRequiredAttribute` do not apply to
`'submit'` (warn + no-op).

Pointer, focus, and click interactions emit `fieldStateChange` with `field: 'submit'`
(`focus` / `blur` / `mouseover` / `mouseout` / `click` / `tab` / `shiftTab`). Enter in another
hosted field does not click this button (separate iframes); listen to `fieldStateChange`
`enter` if you want that.

---

## Complete Usage Example

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Hosted Fields Tokenization</title>
  <style>
    .form-group { margin-bottom: 15px; }
    .form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
    .hosted-field { height: 40px; border: 1px solid #ccc; border-radius: 4px; }
    input, select { height: 40px; width: 100%; padding: 0 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
    .form-row { display: flex; gap: 12px; }
    .form-row > .form-group { flex: 1; }
    button { padding: 12px 24px; background: #0a0a0a; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; width: 100%; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    #result { margin-top: 20px; padding: 16px; border-radius: 6px; display: none; }
    #result.success { background: #f0fdf4; border: 1px solid #bbf7d0; display: block; }
    #result.error { background: #fef2f2; border: 1px solid #fecaca; display: block; }
  </style>
</head>
<body>
  <h1>Pay with Card</h1>

  <form id="payment-form">
    <div class="form-row">
      <div class="form-group">
        <label for="first-name">First Name</label>
        <input type="text" id="first-name" placeholder="John" required>
      </div>
      <div class="form-group">
        <label for="last-name">Last Name</label>
        <input type="text" id="last-name" placeholder="Doe" required>
      </div>
    </div>

    <div class="form-group">
      <label>Card Number</label>
      <div id="card-number-field" class="hosted-field"></div>
    </div>

    <div class="form-group">
      <label>CVV</label>
      <div id="cvv-field" class="hosted-field" style="max-width: 120px;"></div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="expiry-month">Month</label>
        <input type="text" id="expiry-month" placeholder="MM" maxlength="2" inputmode="numeric" required>
      </div>
      <div class="form-group">
        <label for="expiry-year">Year</label>
        <input type="text" id="expiry-year" placeholder="YYYY" maxlength="4" inputmode="numeric" required>
      </div>
    </div>

    <button type="submit" id="submit-btn" disabled>Create Payment Method</button>
  </form>

  <div id="result"></div>

  <script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>
  <script>
    // 1. Initialize
    const sdk = new SpreedlyHostedFields({
      environment_key: 'your_env_key',
      certificate_token: 'your_cert_token',
      nonce: 'your_nonce',
      signature: 'your_signature',
      timestamp: 'your_timestamp'
    });

    // 2. Event handlers
    sdk.on('ready', () => {
      document.getElementById('submit-btn').disabled = false;
    });

    sdk.on('tokenGenerated', (response) => {
      const pm = response.tokenResponse.payment_method;
      const result = document.getElementById('result');
      result.className = 'success';
      result.innerHTML = `
        <strong>Payment method created!</strong><br>
        Token: ${pm.token}<br>
        Card: ${pm.card_type} ending in ${pm.last_four_digits}<br>
        Expires: ${pm.month}/${pm.year}
      `;
    });

    sdk.on('error', (error) => {
      const result = document.getElementById('result');
      result.className = 'error';
      if (typeof error === 'string') {
        // Client-side validation errors arrive as plain strings
        result.textContent = error;
      } else if (error.errors) {
        // API errors carry Spreedly's response body
        result.innerHTML = error.errors
          .map(e => `<strong>${e.attribute || e.key}:</strong> ${e.message}`)
          .join('<br>');
      } else {
        result.textContent = error.message || 'An error occurred';
      }
      document.getElementById('submit-btn').disabled = false;
    });

    // 3. Mount secure fields
    sdk.inAppElements({
      number: { containerId: 'card-number-field' },
      cvv: { containerId: 'cvv-field' }
    });

    // 4. Configure appearance
    sdk.setPlaceholder('number', 'Card Number');
    sdk.setPlaceholder('cvv', 'CVV');
    sdk.setFieldType('number', 'tel');

    sdk.setStyles('number', { fontSize: '16px', fontFamily: 'inherit', color: '#333' });
    sdk.setStyles('cvv', { fontSize: '16px', fontFamily: 'inherit', color: '#333' });

    // 5. Submit
    document.getElementById('payment-form').addEventListener('submit', (e) => {
      e.preventDefault();
      document.getElementById('submit-btn').disabled = true;

      sdk.submit({
        first_name: document.getElementById('first-name').value,
        last_name: document.getElementById('last-name').value,
        month: document.getElementById('expiry-month').value,
        year: document.getElementById('expiry-year').value
      }, {
        metadata: { source: 'hosted-fields-example' },
      });
    });
  </script>
</body>
</html>
```

---

## Styling Hosted Fields

Style **containers** with your own CSS. Style **iframe inputs and the optional submit
button** via `styles` on `inAppElements()` (applied on `ready`) or after `ready` with
`setStyles`, `setPlaceholder` / `setPlaceholderStyles`, `setLabel`, `setTitle`, and
(for submit) `setText` / `setDisable`.

```javascript
sdk.inAppElements({
  number: {
    containerId: 'card-number-field',
    styles: { fontSize: '16px', color: '#333', fontFamily: 'Arial, sans-serif', backgroundColor: '#fff' },
  },
  cvv: { containerId: 'cvv-field', styles: { fontSize: '16px', color: '#333' } },
  expiry: { containerId: 'expiry-field', styles: { fontSize: '16px', color: '#333' } },
});
```

```css
.hosted-field {
  height: 40px;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 0 4px;
}
```

For the full styling API — catalogue fields, placeholder allowlist, hosted submit button,
localization via labels/placeholders, and Express Checkout themes — see the dedicated
**[Styling Guide](../STYLING_GUIDE.md)**.

---

## Validation

The SDK validates the **card number and CVV** plus any **catalogue fields** you mounted
via `inAppElements()` (name, expiry, address, email, and so on) and reports their
state through the **`validation`** event. Number and CVV stay on the top-level
snapshot (`validNumber`, `validCvv`, …); catalogue results are nested under
`formFields`, keyed by field type. Raw catalogue values never leave the iframes on `validation`
or during tokenization, and they are omitted from `fieldStateChange` by default. Two exceptions
deliver catalogue values (never PAN/CVV) to the parent page: the optional hosted submit button's
`submitClick` event, and `fieldStateChange.value` after an explicit
`sdk.setFieldStateReporting({ includeValue: true })`. Opting in to `includeValue` streams
cardholder name, expiry, email, phone, and address on every interaction — any script on the
checkout page can read those `message` events without registering an SDK handler, so treat it
with the same care as `includeIin`.

You get this structured state two ways:

- **On demand** — call **`sdk.validate(options?)`** whenever you want to check the
  current field state (e.g. to enable/disable your submit button, or show inline
  hints). It resolves asynchronously: the result arrives via the `validation` event,
  not as a return value.
- **Automatically on a blocked submit** — when `submit()` is rejected client-side
  (invalid number/CVV or a failing catalogue field), the SDK emits the same
  `validation` event **and** an `error` event. Use `validation` to drive field-level
  UI and `error` for a human-readable message.

```javascript
// Receive the structured snapshot
sdk.on('validation', (payload) => {
  document.getElementById('submit-btn').disabled =
    !payload.validNumber || !payload.validCvv;

  if (payload.validNumber === false) {
    showFieldError('number', 'Enter a valid card number');
  }
  if (!payload.validCvv) {
    showFieldError('cvv', 'Enter a valid CVV');
  }

  const firstName = payload.formFields?.first_name;
  if (firstName && !firstName.valid) {
    showFieldError('first_name', firstName.error);
  }
});

// Ask the SDK to validate the current field state on demand
sdk.validate();

// Optional flags mirror the submit flags (name / expiry catalogue fields)
sdk.validate({
  allow_blank_name: true,
  allow_expired_date: false,
  allow_blank_date: false,
});
```

### `validation` payload

The snapshot always describes the two PCI fields (card number + CVV). When catalogue
fields are mounted, `formFields` reports each one:

| Field | Type | Description |
|---|---|---|
| `cardType` | `string` | Detected brand (e.g. `'visa'`, `'master'`). Empty string when no single brand matches the typed digits. |
| `validNumber` | `boolean` | Whether the card number is valid (length + Luhn for the detected brand). |
| `validCvv` | `boolean` | Whether the CVV is valid for the detected brand. |
| `numberLength` | `number` | Number of digits typed in the card-number field. |
| `cvvLength` | `number` | Number of digits typed in the CVV field. |
| `luhnValid` | `boolean` | Whether the card number passes the Luhn checksum. |
| `iin` | `string` \| `null` | Issuer identification number (BIN) prefix — 8 digits for Visa/Mastercard once ≥8 are typed, otherwise 6 (once ≥6), else `null`. |
| `maskedNumber` | `string` | Masked display value of the number field, when available. |
| `allow_blank_name` | `boolean` | Echoed back only when passed to `validate()` / `submit()`. |
| `allow_expired_date` | `boolean` | Echoed back only when passed to `validate()` / `submit()`. |
| `formFields` | `object` | Per-field snapshot for every mounted catalogue field. `{}` when none are mounted, or in recache mode. Each key is a field type (`first_name`, `city`, `expiry`, …) with `{ valid: boolean, empty: boolean, error: string }`. `first_name` / `last_name` are required unless `allow_blank_name`; every other field (including `full_name`) only when mounted with `isRequired: true`; date fields use the same month/year checks as `submit()`. Raw values are never included. |

> **In recache mode** only the CVV field is active, so the snapshot is the CVV
> subset: `cardType`, `cvvLength`, `validCvv`, `maskedNumber`, and `formFields: {}`.

For **continuous** live field state (on every keystroke, focus, blur, hover, and hosted
submit-button pointer/focus/click) rather than a point-in-time snapshot, subscribe to
`fieldStateChange`, which carries the same fields plus the active `field` and `action`. Catalogue
snapshots omit the raw `value` unless you call `sdk.setFieldStateReporting({ includeValue: true })`.
See the [API Reference](#api-reference).

### Custom field validators

`addValidation(fieldName, validator)` attaches your own rule to a non-sensitive field. It is
**layered on top of** the SDK's validation, not a replacement for it:

1. The SDK's API-safety checks run first — UTF-16 encodability, per-field character limits, and
   the name charset. These are not overridable.
2. Then the `isRequired` gate (and, for `first_name` / `last_name`, the `allow_blank_name` gate
   plus the combined 350-character cap).
3. Only if both passed does your validator run.

So a validator can reject a value the SDK would have accepted, but it can never make the SDK
accept one it rejected. Your function runs on your own page — it is never injected into a payment
iframe — and it is invoked on `submit()` and `validate()`, not on every keystroke.

```javascript
sdk.addValidation('zip', (value, fields) => {
  const ok = /^\d{5}(-\d{4})?$/.test(value);
  return { isValid: ok, errorMessage: ok ? undefined : 'Enter a valid US ZIP code' };
});

// The second argument carries the form's other non-sensitive values, so rules can be cross-field
sdk.addValidation('state', (value, fields) => {
  if (fields.country !== 'US') return { isValid: true };
  const ok = US_STATES.includes(value);
  return { isValid: ok, errorMessage: ok ? undefined : 'Select a valid US state' };
});

sdk.removeValidation('zip'); // back to built-in-only validation for that field
```

**Which fields accept a validator.** Every catalogue field except the date fields, plus the two
cardholder-name fields: `first_name`, `last_name`, `full_name`, `email`, `company`,
`phone_number`, the billing address keys (`address1`, `address2`, `city`, `state`, `zip`,
`country`, `house_number_or_name`, `street`, `street_line2`, `phone_number_country_code`,
`phone_number_area_code`) and their `shipping_*` twins. Not accepted: `number` and
`verification_value` (PCI — their values never leave the iframe), and `month` / `year` /
`expiry` (governed by the shared date validation). An unrecognized name logs a warning and is
ignored; nothing throws.

**Return values.** Return `{ isValid: boolean, errorMessage?: string }`:

| Return | Meaning |
|---|---|
| `{ isValid: true }` | Valid (`errorMessage` is ignored) |
| `{ isValid: false, errorMessage: 'msg' }` | Invalid, `msg` is reported |
| `{ isValid: false }` | Invalid, a generic `<Label> is invalid` message is reported |

Validators must be **synchronous**. Returning a Promise, a boolean, a string, `null`, or
`undefined` is treated as a bug (see below).

**Empty values still run.** A validator is invoked even when the field is blank, as long as the
field is not required. That is how you express a conditional requirement:

```javascript
sdk.addValidation('zip', (value, fields) => {
  if (fields.country !== 'US') return { isValid: true };
  const ok = Boolean(value.trim());
  return { isValid: ok, errorMessage: ok ? undefined : 'ZIP is required for US addresses' };
});
```

**Reporting.** A failure blocks `submit()` before any network call and appears on the
`validation` event as `payload.formFields[fieldName].error`, exactly like a built-in failure.
Hosted Fields iframes set `aria-invalid` but never render error text, so displaying the message
is yours to do — the same code that already renders `formFields[type].error` covers it.

**Fail-open.** If your validator throws, returns something the SDK cannot interpret, or returns a
Promise, that field **passes** the custom rule and the SDK emits `error` plus `consoleError`
describing the problem. A bug in merchant code must not be able to block every checkout with no
diagnosable cause; the value has already cleared the API-safety floor, and Spreedly Core still
validates server-side.

**Cost when unused.** With no validators registered there is no extra iframe round-trip and no
behavior change at all.

**PAN, CVV, and expiry are never passed.** The `fields` argument is the form's other
non-sensitive values keyed by Spreedly param name; `number`, `verification_value`, `month`,
`year`, and `expiry` are always absent.

---

## Error Handling

The `error` callback payload **varies by error source** — handle both strings and
objects. For **field-level** card/CVV validity, prefer the structured
[`validation` event](#validation) above; the `error` event carries a human-readable
`string` for the same client-side failures.

```javascript
sdk.on('error', (error) => {
  if (typeof error === 'string') {
    // Client-side validation and guard errors
    console.error(error);
  } else if (error.errors && Array.isArray(error.errors)) {
    // API errors: Spreedly's error response body is passed through
    error.errors.forEach(err => console.error(`${err.attribute}: ${err.message}`));
  } else {
    // Configuration errors (e.g. recache setup, missing submitClick listener)
    console.error(error.message);
  }
});
```

### Error payload shapes by source

| Error source | Payload |
|---|---|
| Client-side validation (invalid card number / CVV / expiry, invalid auth body) | `string` — e.g. `'Card number must be between 13 and 19 digits'`, `'Invalid CVV'` |
| Submit throttling / auth credential misuse | `string` — e.g. `'Please wait before submitting again'` |
| Tokenization or recache API failure | Spreedly's error response body — typically `{ errors: [{ attribute, key, message }] }` — or a `string` message for network-level failures |
| Recache configuration (`setRecache` with missing token / non-retained card) | `{ message, attribute }` |
| Recache mode guards (`recache()` before `setRecache()`, iframes not mounted) | `{ message }` |
| Hosted submit button clicked with no `submitClick` listener | `{ message }` — tokenization does not run |
| CVV TTL expiry (3-minute PCI limit) | `{ message, reason }` |

---

## Testing

### Test Card Numbers

| Card Type | Number | CVV | Expiry |
|-----------|--------|-----|--------|
| Visa | 4111111111111111 | 123 | Any future date |
| Mastercard | 5555555555554444 | 123 | Any future date |
| Amex | 378282246310005 | 1234 | Any future date |
| Discover | 6011111111111117 | 123 | Any future date |

### Staging Environment

Use `core-test.spreedly.com` for testing:

```html
<script src="https://core-test.spreedly.com/checkout/sdk/{version}/index.js"></script>
```

---

## API Reference

For the complete API reference — including the constructor, all methods and their
parameters, events, and payload/type definitions — see the dedicated
**[Hosted Fields API Reference](../../HOSTED_FIELDS_API_REFERENCE.md)**.

---

## Troubleshooting

### Hosted fields not appearing

- Ensure the container `<div>` elements exist in the DOM **before** calling `inAppElements()`.
- Wait for the `ready` event before enabling form interactions.

### CSP errors

Add Spreedly domains to your Content Security Policy:

```html
<meta http-equiv="Content-Security-Policy" content="
  frame-src https://core.spreedly.com https://core-test.spreedly.com;
  script-src https://core.spreedly.com https://core-test.spreedly.com;
  connect-src https://core.spreedly.com https://core-test.spreedly.com;
">
```

### Token not generating

1. Verify auth details are valid and not expired.
2. Ensure all required form fields are filled.
3. Check that the card data passes Luhn validation and is not expired.
4. Check the browser console for errors.

---

## See Also

- [Styling Guide](../STYLING_GUIDE.md) — Brand Hosted Fields and Express Checkout
- [Express Checkout Integration Guide](../express-checkout/INTEGRATION_GUIDE.md) — Pre-built form alternative
- Sample app `/tokenize-catalogue` — Live catalogue, hosted submit, and custom-validator demo
- [Recaching Integration Guide](../../recaching/INTEGRATION_GUIDE.md) — Update CVV for retained cards
- [3DS Overview](../../three-ds/OVERVIEW.md) — Add 3D Secure authentication
- [Security Guide](../../../SECURITY.md) — SRI, CSP, and security best practices
