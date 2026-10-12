# ACH Payments Overview

ACH lets customers pay directly from a US or Canadian checking or savings account. Spreedly
offers two SDK options for collecting the bank account. In both, the customer types the
routing and account numbers into Spreedly-hosted iframes, and the SDK tokenizes them there, so
the numbers never reach your page or your servers. Your page receives a Spreedly payment method
token, and your backend runs the purchase against an ACH-capable gateway. This document helps
you choose between them.

## Quick Comparison

| Aspect | ACH Hosted Fields | ACH Form |
|--------|-------------------|----------|
| **Class** | `SpreedlyACHFields` | `SpreedlyACHForm` |
| **Bundle** | Hosted Fields (`/checkout/sdk/{version}/index.js`) | Express Checkout (`/checkout/elements/{version}/express-checkout.js`) |
| **Form UI** | You build your own; the SDK adds secure routing and account number fields | Prebuilt form with every bank account field |
| **Name, account type, bank name** | Your own inputs, passed to `submit()` | Part of the form |
| **Styling** | Per-field CSS via `setStyles()` / `setPlaceholderStyles()` | Theme and per-field styles via `uiConfig` |
| **Embedded / dialog** | Embedded in your form | Embedded, or as a dialog |
| **"Save this account" checkbox** | You build it | Built in (`showSaveAccountCheckbox`) |
| **Needs a card SDK instance** | No — standalone | No — standalone |

## Decision Tree

```
Need to collect a bank account and tokenize?
│
├─ Want full control over form layout and styling?
│   └─ YES → Use ACH Hosted Fields
│
├─ Want a ready-made form with minimal code?
│   └─ YES → Use the ACH Form
│
└─ Need a modal/dialog bank account form?
    └─ YES → Use the ACH Form (dialog mode)
```

## 1. ACH Hosted Fields

**Best for:** Merchants who want the bank account fields inside their own form design.

**How it works:**
- You build your own form for the account holder name, account type and bank name
- The SDK injects two secure iframes: routing number and account number
- You call `submit()` with the non-sensitive fields; the SDK tokenizes inside the account iframe

**Key methods:** `inAppElements()`, `setPlaceholder()`, `setStyles()`, `submit()`, `reload()`

📖 See: [ACH Hosted Fields Integration Guide](./ach-hosted-fields/INTEGRATION_GUIDE.md) · [API Reference](./ach-hosted-fields/API_REFERENCE.md)

---

## 2. ACH Form

**Best for:** Merchants who want a complete bank account form with minimal integration effort.

**How it works:**
- The SDK renders the whole form (name, bank name, routing and account numbers, account
  type, holder type) inside one iframe
- Can render embedded in a container or as a modal dialog
- You customize labels, text, fields and theme through `uiConfig`
- The customer fills in the form and submits; the form tokenizes inside its iframe

**Key methods:** `mount()`, `close()`, `destroy()`

📖 See: [ACH Form Integration Guide](./ach-form/INTEGRATION_GUIDE.md) · [API Reference](./ach-form/API_REFERENCE.md)

---

## Both options

- **Token:** `tokenGenerated` sends `{ message, tokenResponse }` — the whole Spreedly
  transaction, with the bank numbers masked. The token is `tokenResponse.payment_method.token`.
  The ACH Form also sends `shouldRetain`: whether the customer ticked "Save this account".
- **Purchase:** run it from your backend, never the browser, so your access secret stays
  private.
- **Customer authorization:** before you debit a bank account, you must get the customer's
  authorization. The SDK doesn't collect it.
- **Security:** bank account data is not cardholder data, so it isn't PCI-scoped. Keeping the
  numbers out of your page reduces your Nacha data-security exposure.

---

## Deprecated: merchant-collected API

`setupACHPayment` / `submitACHPayment` / `clearACHPayment` on `SpreedlyHostedFields` and
`SpreedlyExpressCheckout` are **deprecated**. They have your page collect the routing and
account numbers in its own inputs, so the numbers pass through your application state. Use ACH
Hosted Fields or the ACH Form instead. The methods still work for the time being but will be
removed in a subsequent release. The earlier releases will still continue to have those methods.

📖 See: [Deprecated merchant-collected API](./DEPRECATED_API.md)
