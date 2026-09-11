# Styling Guide — Hosted Fields & Express Checkout

This guide covers how to brand Spreedly’s tokenization UIs. Use it alongside the
[Hosted Fields](./hosted-fields/INTEGRATION_GUIDE.md) and
[Express Checkout](./express-checkout/INTEGRATION_GUIDE.md) integration guides and the
generated [Hosted Fields](../HOSTED_FIELDS_API_REFERENCE.md) /
[Express Checkout](../EXPRESS_CHECKOUT_API_REFERENCE.md) API references.

| Product | Styling model |
|---|---|
| **Hosted Fields** | You own layout and container CSS. Pass iframe `styles` on `inAppElements()`, or update later with `setStyles` / `setPlaceholderStyles`. |
| **Express Checkout** | Pre-built form. Pass theme overrides in `uiConfig.styles` / `textConfig`, or update fields later with `setFieldConfig` / `updateTextElement`. |

Sensitive card data (PAN / CVV) never leaves Spreedly-hosted iframes. Style APIs only
accept CSS that the iframe can apply safely — invalid properties and unsafe values are
dropped.

---

## Table of Contents

1. [Hosted Fields](#hosted-fields)
   - [Split responsibility: page vs iframe](#split-responsibility-page-vs-iframe)
   - [`setStyles`](#setstyles)
   - [Placeholders and placeholder styles](#placeholders-and-placeholder-styles)
   - [Labels, titles, and localization](#labels-titles-and-localization)
   - [Catalogue fields (name, expiry, address, …)](#catalogue-fields-name-expiry-address-)
   - [Hosted submit button](#hosted-submit-button)
   - [Other appearance helpers](#other-appearance-helpers)
   - [Complete Hosted Fields example](#complete-hosted-fields-example)
2. [Express Checkout](#express-checkout)
   - [`uiConfig.textConfig` and `uiConfig.styles`](#uiconfigtextconfig-and-uiconfigstyles)
   - [Per-field styles via `setFieldConfig`](#per-field-styles-via-setfieldconfig)
   - [Updating copy after launch](#updating-copy-after-launch)
3. [See Also](#see-also)

---

## Hosted Fields

### Split responsibility: page vs iframe

| Layer | What you style | How |
|---|---|---|
| **Merchant page** | Field containers, labels outside the iframe, spacing, borders around the iframe | Normal CSS / your design system on the `<div>` you pass as `containerId` |
| **Inside the iframe** | The secure `<input>` (or hosted `<button>`) | `setStyles`, `setPlaceholderStyles`, `setLabel`, `setTitle`, `setText`, … after `ready` |

Size and border the **container** yourself — the iframe fills it. A typical pattern:

```html
<label for="card-number-field">Card number</label>
<div id="card-number-field" class="hosted-field"></div>
```

```css
.hosted-field {
  height: 40px;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 0 4px;
  background: #fff;
}

.hosted-field:focus-within {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.2);
}
```

Pass initial iframe styles on `inAppElements()` (`number.styles`, `cvv.styles`, catalogue
`styles`, `submit.styles`). They are applied to the hosted `<input>` / `<button>` on `ready`,
with the same CSS allowlist as `setStyles`. Update later with `setStyles` after `ready`.

---

### `setStyles`

```javascript
sdk.setStyles(elementType, styles);
```

- **`elementType`** — `'number'`, `'cvv'`, `'submit'`, or any mounted catalogue type
  (`'expiry'`, `'first_name'`, `'address1'`, `'shipping_city'`, …).
- **`styles`** — partial camelCase `CSSStyleDeclaration` (e.g. `fontSize`, `backgroundColor`).
  Keys that are not real CSSOM properties on the target element, and non-string/number
  values, are filtered out inside the iframe.

```javascript
const fieldStyle = {
  fontSize: '16px',
  fontFamily: 'Helvetica, Arial, sans-serif',
  color: '#1a1a1a',
  backgroundColor: 'transparent',
};

sdk.inAppElements({
  number: { containerId: 'card-number-field', styles: fieldStyle },
  cvv: { containerId: 'cvv-field', styles: { ...fieldStyle, textAlign: 'center' } },
  expiry: { containerId: 'expiry-field', styles: fieldStyle },
  full_name: { containerId: 'name-field', styles: fieldStyle },
});

// Or update after `ready`:
sdk.on('ready', () => {
  sdk.setStyles('cvv', { ...fieldStyle, textAlign: 'center' });
});
```

---

### Placeholders and placeholder styles

```javascript
sdk.setPlaceholder('number', 'Card number');
sdk.setPlaceholder('cvv', 'CVV');
sdk.setPlaceholder('expiry', 'MM/YY');
sdk.setPlaceholder('full_name', 'Name on card');

// Applies to number, CVV, and every mounted catalogue field
sdk.setPlaceholderStyles({
  color: '#9aa0a6',
  fontSize: '16px',
  fontFamily: 'Helvetica, Arial, sans-serif',
  fontWeight: '400',
  opacity: '1',
});
```

`setPlaceholderStyles` only accepts this allowlist (legacy iframe parity):

| Property | Example |
|---|---|
| `color` | `'#9aa0a6'` |
| `fontFamily` | `'Helvetica, Arial, sans-serif'` |
| `fontSize` | `'16px'` |
| `fontStyle` | `'italic'` |
| `fontWeight` | `'400'` |
| `letterSpacing` | `'0.02em'` |
| `lineHeight` | `'1.5'` |
| `opacity` | `'1'` |
| `textAlign` | `'left'` |

Values containing CSS breakout constructs (`{}`, `url()`, `@`, comments, etc.) are rejected.

---

### Labels, titles, and localization

Hosted Fields does **not** ship locale packs. Point copy at your shopper’s language with
the same APIs you use for branding:

| Method | Effect |
|---|---|
| `setPlaceholder(type, text)` | Input placeholder (and a cue for empty fields) |
| `setLabel(type, text)` | Accessible name (`aria-label`) on the input or submit button |
| `setTitle(type, text)` | Native `title` tooltip / supplementary text |
| `setText('submit', text)` | Visible label on the hosted submit button (also updates `aria-label`) |

HTML-like tags in label/title/text are stripped; empty results are ignored; values are
capped at 256 characters.

```javascript
// Example: switch copy when your app locale changes
function applyLocale(copy) {
  sdk.setPlaceholder('number', copy.cardNumber);
  sdk.setLabel('number', copy.cardNumber);
  sdk.setPlaceholder('cvv', copy.cvv);
  sdk.setLabel('cvv', copy.cvv);
  sdk.setPlaceholder('expiry', copy.expiry);
  sdk.setLabel('expiry', copy.expiry);
  sdk.setText('submit', copy.pay);
}
```

---

### Catalogue fields (name, expiry, address, …)

Optional fields mounted via `inAppElements()` (`expiry`, `month`/`year`, `first_name`,
`last_name`, `full_name`, billing/shipping address keys, email, company, phone, …) use the
**same** styling methods as `number` / `cvv`:

```javascript
const fieldStyle = { fontSize: '16px', color: '#1a1a1a' };

sdk.inAppElements({
  number: { containerId: 'card-number-field' },
  cvv: { containerId: 'cvv-field' },
  expiry: { containerId: 'expiry-field', styles: fieldStyle },
  full_name: { containerId: 'name-field', styles: fieldStyle },
  address1: { containerId: 'address1-field', styles: fieldStyle },
  zip: { containerId: 'zip-field', styles: fieldStyle },
});

sdk.on('ready', () => {
  ['expiry', 'full_name', 'address1', 'zip'].forEach((type) => {
    sdk.setPlaceholder(type, /* … */);
    sdk.setLabel(type, /* … */);
  });
});
```

Style the outer containers independently so billing vs shipping sections can use different
page chrome while the iframe inputs stay consistent.

---

### Hosted submit button

When you mount `submit: { containerId, text?, styles? }` in `inAppElements()`:

| Method / config | Notes |
|---|---|
| `submit.styles` on `inAppElements()` | Applied to the `<button>` on `ready`. Same allowlist as `setStyles`. |
| `setStyles('submit', { … })` | Same filtering as inputs; applied to the `<button>`. Use after mount to update. |
| `setText('submit', text)` / `setLabel('submit', text)` | Visible label + `aria-label` |
| `setDisable('submit', boolean)` | Loading / locked state (SDK does **not** auto-disable during `submit()`) |

Size the container at least **44×44px** for a usable touch target. The button starts
**disabled** until `ready`. Mount `styles` on number, CVV, catalogue fields, and `submit`
are all applied on `ready`.

```javascript
sdk.inAppElements({
  number: { containerId: 'card-number-field' },
  cvv: { containerId: 'cvv-field' },
  submit: {
    containerId: 'submit-button-field',
    text: 'Pay now',
    styles: {
      backgroundColor: '#0a0a0a',
      color: '#ffffff',
      fontSize: '16px',
      fontWeight: '600',
      borderRadius: '8px',
      border: 'none',
      cursor: 'pointer',
    },
  },
});
```

You can still update styles after `ready`:

```javascript
sdk.on('ready', () => {
  sdk.setStyles('submit', {
    backgroundColor: '#0a0a0a',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '600',
    borderRadius: '8px',
    border: 'none',
    cursor: 'pointer',
  });
  sdk.setText('submit', 'Pay now');
});

sdk.on('submitClick', (formFields) => {
  sdk.setDisable('submit', true);
  sdk.setText('submit', 'Please wait…');
  sdk.submit(formFields, { metadata: { order_id: 'ORDER-123' } });
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

`setPlaceholder` / `setFieldType` / `setInputMode` / `setRequiredAttribute` do **not** apply
to `'submit'`.

---

### Other appearance helpers

| Method | Purpose |
|---|---|
| `setFieldType('number' \| 'cvv' \| catalogue, 'text' \| 'tel' \| 'number' \| 'password')` | Input type / mobile keyboard hint |
| `setInputMode(type, mode)` | `inputmode` hint |
| `setNumberFormat(format)` | Card-number display grouping |
| `toggleMask()` | Mask/unmask PAN display |
| `setShowCardTypeIcon(boolean)` | Built-in brand badge on the number field |
| `setPlaceholderStyles(styles)` | Shared `::placeholder` styles (see allowlist above) |
| `toggleAutoComplete()` | Toggle browser autocomplete on number/CVV |

Use `fieldStateChange` (and optional merchant CSS on containers) to reflect focus / validity
in your own chrome — for example toggle a `.is-invalid` class on the container when
`validation` reports a failure.

---

### Complete Hosted Fields example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

const ink = {
  fontSize: '16px',
  fontFamily: 'inherit',
  color: '#111827',
  backgroundColor: 'transparent',
};

sdk.on('ready', () => {
  sdk.setPlaceholderStyles({ color: '#9ca3af', fontSize: '16px' });
  sdk.setPlaceholder('number', 'Card number');
  sdk.setPlaceholder('cvv', 'CVV');
  sdk.setPlaceholder('expiry', 'MM/YY');
  sdk.setPlaceholder('full_name', 'Name on card');
  sdk.setPlaceholder('address1', 'Address');
  sdk.setPlaceholder('zip', 'ZIP');
});

sdk.inAppElements({
  number: { containerId: 'card-number-field', styles: ink },
  cvv: { containerId: 'cvv-field', styles: ink },
  expiry: { containerId: 'expiry-field', styles: ink },
  full_name: { containerId: 'name-field', styles: ink },
  address1: { containerId: 'address1-field', styles: ink },
  zip: { containerId: 'zip-field', styles: ink },
  submit: {
    containerId: 'submit-button-field',
    text: 'Pay securely',
    styles: {
      backgroundColor: '#111827',
      color: '#fff',
      fontSize: '16px',
      fontWeight: '600',
      border: 'none',
      borderRadius: '8px',
    },
  },
});
```

---

## Express Checkout

Express Checkout is a pre-built form. You do not style individual iframes the Hosted Fields
way — pass theme and copy through `expressCheckout({ uiConfig })`, then optionally tweak
fields at runtime.

### `uiConfig.textConfig` and `uiConfig.styles`

```javascript
const checkout = sdk.expressCheckout({
  parentContainerId: 'checkout-container',
  uiConfig: {
    textConfig: {
      title: 'Payment Details',
      submitBtnText: 'Pay Now',
      footerText: 'Secure payment powered by Spreedly',
      processingText: 'Processing…',
    },
    styles: {
      button: {
        backgroundColor: '#0a0a0a',
        borderRadius: '8px',
        hover: { backgroundColor: '#262626' },
      },
      // Additional theme keys (text fields, typography, colors, …) —
      // see the Express Checkout API Reference for the full shape.
    },
  },
});
```

### Per-field styles via `setFieldConfig`

```javascript
sdk.setFieldConfig('number', {
  styles: {
    borderColor: '#007bff',
    fontSize: '16px',
  },
});

sdk.setFieldConfig('first_name', {
  label: 'Given Name',
  placeholder: 'Enter your first name',
  isRequired: true,
});
```

### Updating copy after launch

```javascript
sdk.updateTextElement('title', 'Complete Your Purchase');
sdk.updateTextElement('submitBtnText', 'Pay $99.00');
sdk.updateTextElement('footerText', 'Secured by Spreedly');
sdk.updateTextElement('processingText', 'Processing payment…');
```

There is no Hosted Fields–style `submitClick` on Express Checkout — the submit control
lives inside the checkout iframe and triggers tokenization directly.

---

## See Also

- [Hosted Fields Integration Guide](./hosted-fields/INTEGRATION_GUIDE.md)
- [Express Checkout Integration Guide](./express-checkout/INTEGRATION_GUIDE.md)
- [Hosted Fields API Reference](../HOSTED_FIELDS_API_REFERENCE.md)
- [Express Checkout API Reference](../EXPRESS_CHECKOUT_API_REFERENCE.md)
- [Tokenization Overview](./OVERVIEW.md)
- [Migration Guide](../migration-guide/MIGRATION_GUIDE.md)
