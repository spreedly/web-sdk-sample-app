# Troubleshooting — Spreedly Web SDK

---

## Table of Contents

1. [SDK Loading](#sdk-loading)
2. [Authentication](#authentication)
3. [Content Security Policy (CSP)](#content-security-policy-csp)
4. [Initialization](#initialization)
5. [Tokenization](#tokenization)
6. [Recaching](#recaching)
7. [3D Secure](#3d-secure)
8. [Network Errors](#network-errors)
9. [Browser DevTools Tips](#browser-devtools-tips)

---

## SDK Loading

### Script fails to load (net::ERR_BLOCKED_BY_CLIENT)

**Cause:** Ad blockers or browser extensions blocking requests to `core.spreedly.com`.

**Fix:** Disable ad blockers on your checkout page, or instruct users to allowlist the domain. This is also a common issue during development.

### `SpreedlyHostedFields` or `SpreedlyExpressCheckout` is undefined

**Cause:** The SDK script hasn't finished loading before your code runs.

**Fix:** Either place your initialization code after the `<script>` tag, or wait for the script's `onload` event:

```javascript
const script = document.createElement('script');
script.src = 'https://core.spreedly.com/checkout/sdk/{version}/index.js';
script.onload = () => {
  // SDK is now available
};
document.head.appendChild(script);
```

### Wrong SDK version or 404

**Cause:** The version in the URL doesn't exist on the CDN.

**Fix:** Verify the version exists by opening the URL directly in a browser:
```
https://core.spreedly.com/checkout/sdk/{version}/index.js
```

---

## Authentication

### `onError` fires immediately after `initialize()`

**Cause:** Invalid or expired auth details. The `authDetails` object requires all five fields: `environment_key`, `certificate_token`, `nonce`, `timestamp`, and `signature`.

**Fix:**
- Verify all five fields are present and non-empty.
- Check that the `timestamp` is recent (auth details are short-lived).
- Regenerate auth details from your server before each initialization.
- Confirm your `environment_key` and `certificate_token` are correct in your Spreedly dashboard.

### Auth details work once but fail on page reload

**Cause:** The `nonce` is single-use. Reusing the same auth details on a second initialization will fail.

**Fix:** Always fetch fresh auth details from your server for each SDK initialization. Do not cache or reuse them client-side.

---

## Content Security Policy (CSP)

### `Refused to frame` or `Refused to load the script` errors in console

**Cause:** Your page's CSP is blocking Spreedly's domains.

**Fix:** Add the following directives:

```http
Content-Security-Policy:
  script-src 'self' https://core.spreedly.com https://pci.browser-intake-datadoghq.com;
  frame-src https://core.spreedly.com;
  child-src https://core.spreedly.com;
  connect-src 'self' https://core.spreedly.com https://pci.browser-intake-datadoghq.com;
```

### CSP blocks telemetry but SDK still works

The `pci.browser-intake-datadoghq.com` domain is for operational telemetry only. Blocking it won't break SDK functionality, but Spreedly won't be able to monitor service health for your integration. Add it to `connect-src` if possible.

### Additional CSP for 3DS or offsite payments

If you're using 3D Secure (Global/Forter), you also need to allow the Forter domain:
```http
script-src https://plugins.spreedly.com;
```

For Braintree or Stripe APM, see their respective integration guides for required domains.

---

## Initialization

### `ready` event never fires (Hosted Fields)

| Check | Detail |
|-------|--------|
| Container elements exist | The `<div>` elements for number and CVV must be in the DOM **before** calling `inAppElements()` |
| Container IDs match | The IDs passed to `inAppElements()` must exactly match the element IDs in your HTML |
| Auth details are valid | An auth error silently prevents iframe creation — check `onError` callback |
| Console errors | Open DevTools → Console for any errors during initialization |

### Form doesn't appear (Express Checkout)

| Check | Detail |
|-------|--------|
| `parentContainerId` exists | The container element must be in the DOM before calling `expressCheckout()` |
| Dialog mode CSS conflicts | In dialog mode, check for `z-index` conflicts hiding the modal overlay |
| Console errors | Look for errors in DevTools → Console |

---

## Tokenization

### Common validation errors from `onTokenGenerated`

| Error message | Cause | Fix |
|--------------|-------|-----|
| `number: is invalid` | Fails Luhn check | Use a valid test card (e.g., `4111111111111111`) |
| `month: is expired` | Expiry date is in the past | Use a future date, or pass `allow_expired_date: true` in submit params |
| `first_name: can't be blank` | Name fields empty | Provide cardholder name, or pass `allow_blank_name: true` |
| `year: is invalid` | Wrong year format | Use 4-digit year (e.g., `2028`) |

### `submit()` does nothing

**Cause:** `submit()` was called before the `ready` event fired or before auth completed.

**Fix:** Only call `submit()` after the `onReady` callback has been invoked. Disable your submit button until then.

### Token response has unexpected structure

The token is at `response.tokenResponse.payment_method.token` (not `response.transaction.payment_method.token`). See the integration guides for the full response shape.

---

## Recaching

### "Payment method must be retained"

**Cause:** The payment method's `storage_state` is not `retained`.

**Fix:** When originally tokenizing the card, set `retained: true` to persist the payment method. Alternatively, retain the payment method via the Spreedly API before attempting recache.

### Recache mode — card number field is disabled but empty

**Cause:** The `token` or `card_type` in `RecacheOptions` doesn't match an existing payment method.

**Fix:** Verify the `token` is a valid, retained payment method token and that `card_type` matches the original card brand.

---

## 3D Secure

### Challenge iframe is blank or invisible

**Cause:** The challenge container element has zero dimensions or is hidden by CSS.

**Fix:** Ensure the element referenced by `challengeIframeLocation` is visible and has explicit width/height before the challenge fires. If using a modal, show the modal *before* starting the 3DS lifecycle.

### `messages.failed_sca_authentication`

**Cause:** The cardholder failed the challenge (wrong OTP, cancelled, timed out).

**Fix:** This is expected behavior. Display a user-friendly error and allow the cardholder to retry.

### Getting `managed_order_token` unexpectedly

**Cause:** You're passing `sca_provider_key` in your backend purchase request, which triggers the Global/Forter 3DS flow.

**Fix:** If you want gateway-specific 3DS, remove `sca_provider_key` from the request.

---

## Network Errors

### CORS errors in console

**Cause:** Your page is not served over HTTPS, or CSP is blocking `connect-src` to `core.spreedly.com`.

**Fix:**
- Serve your checkout page over HTTPS (required in production).
- Add `https://core.spreedly.com` to your `connect-src` CSP directive.

---

### Verifying SRI

If you're using Subresource Integrity and the SDK fails to load:
1. Open DevTools → Console — look for "Failed to find a valid digest in the 'integrity' attribute."
2. This means the hash doesn't match the file. Re-download the SRI manifest for your version and update the `integrity` attribute.

### Verifying CSP

1. Open DevTools → Console — CSP violations appear as errors with `[Report Only]` or `Refused to...` messages.
2. Each error tells you exactly which directive is blocking what resource.
