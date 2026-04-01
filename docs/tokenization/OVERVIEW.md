# Tokenization Overview

Spreedly offers two SDK options for securely collecting and tokenizing card data. Both reduce your PCI scope by ensuring sensitive card details (number and CVV) never touch your servers. This document helps you choose the right one.

## Quick Comparison

| Aspect | Hosted Fields | Express Checkout |
|--------|--------------|------------------|
| **Class** | `SpreedlyHostedFields` | `SpreedlyExpressCheckout` |
| **CDN Path** | `/checkout/sdk/{version}/index.js` | `/checkout/elements/{version}/express-checkout.js` |
| **Form UI** | You build your own | Pre-built React form |
| **Styling Control** | Full CSS control | API-based (button, textfield, typography, colors, per-field styles) |
| **Custom Fields** | You control the form | Dynamic add/remove via API |
| **PCI Scope Reduction** | Yes | Yes |
| **3DS Support** | Yes | Yes |
| **Recache Support** | Yes | Yes |
| **Offsite Payments Support** | Yes | Yes |

## Decision Tree

```
Need to collect card details and tokenize?
│
├─ Want full control over form layout and styling?
│   └─ YES → Use Hosted Fields
│
├─ Want a quick drop-in form with minimal code?
│   └─ YES → Use Express Checkout
│
└─ Need a modal/dialog payment form?
    └─ YES → Use Express Checkout (dialog mode)
```

## 1. Hosted Fields

**Best for:** Merchants who need full control over the payment form design while keeping card data out of PCI scope.

**How it works:**
- You create your own HTML form for cardholder name, expiry, and any other fields
- The SDK injects secure iframes for the card number and CVV fields
- You call `submit()` with the non-sensitive form data; the SDK combines it with the iframe data and tokenizes

**Key methods:** `inAppElements()`, `setPlaceholder()`, `setStyles()`, `setFieldType()`, `submit()`

📖 See: [Hosted Fields Integration Guide](./hosted-fields/INTEGRATION_GUIDE.md)

---

## 2. Express Checkout

**Best for:** Merchants who want a complete payment form with minimal integration effort.

**How it works:**
- The SDK renders a complete payment form (card number, CVV, expiry, name) inside an iframe
- Can render embedded in a container or as a modal dialog
- You customize text, add/remove fields, and style via the SDK API
- The user fills in the form and submits; the SDK handles tokenization

**Key methods:** `expressCheckout()`, `addField()`, `removeField()`, `setFieldConfig()`, `updateTextElement()`

📖 See: [Express Checkout Integration Guide](./express-checkout/INTEGRATION_GUIDE.md)
