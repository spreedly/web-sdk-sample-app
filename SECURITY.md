# Security Integration Guide

This document outlines security best practices for integrating the Spreedly Web SDK to maintain PCI DSS compliance and protect against common web vulnerabilities.

---

## Table of Contents

1. [Security Features](#security-features)
2. [Secure Integration Checklist](#secure-integration-checklist)
   - [Load SDK with SRI](#1-load-sdk-with-subresource-integrity-sri)
   - [Configure CSP](#2-configure-content-security-policy-csp)
   - [Serve Over HTTPS](#3-serve-pages-over-https)
   - [Protect Against Clickjacking](#4-protect-against-clickjacking)
3. [Subresource Integrity (SRI)](#subresource-integrity-sri)
4. [Release Verification](#release-verification)
5. [Security Support](#security-support)

---

## Security Features

The Spreedly Web SDK includes built-in security controls:

- **Isolated iFrames** — Card data is captured inside Spreedly-hosted iframes and never touches your DOM or JavaScript context.
- **Automatic CVV TTL** — CVV values are automatically cleared from memory after 3 minutes or after tokenization, whichever comes first.
- **Input Validation** — Real-time Luhn checks, card type detection, and format validation run inside the iframe before any API call.
- **Tokenization Throttling** — Built-in rate limiting prevents rapid-fire tokenization attempts.
- **No Card Data Storage** — No card data is stored in memory, localStorage, cookies, or any persistent browser storage.
- **Origin Validation** — All cross-frame `postMessage` communication validates the sender's origin.
- **SRI Support** — Integrity hashes are published for every release, enabling browser-enforced file verification.
- **HTTPS Only** — The SDK enforces secure connections in production.

---

## Secure Integration Checklist

### 1. Load SDK with Subresource Integrity (SRI)

Always use the `integrity` attribute when loading the SDK to ensure the file hasn't been tampered with:

**Hosted Fields:**

```html
<script
  src="https://core.spreedly.com/checkout/sdk/{version}/index.js"
  integrity="sha384-{HASH_FROM_SRI_MANIFEST}"
  crossorigin="anonymous"
></script>
```

**Express Checkout:**

```html
<script
  src="https://core.spreedly.com/checkout/elements/{version}/express-checkout.js"
  integrity="sha384-{HASH_FROM_SRI_MANIFEST}"
  crossorigin="anonymous"
></script>
```

See [Subresource Integrity (SRI)](#subresource-integrity-sri) below for how to obtain the hashes.

### 2. Configure Content Security Policy (CSP)

Add the following directives to your page's CSP header or meta tag. The SDK loads iframes and scripts from `core.spreedly.com` and sends telemetry data to Datadog for monitoring.

```http
Content-Security-Policy:
  script-src 'self' https://core.spreedly.com;
  frame-src https://core.spreedly.com;
  child-src https://core.spreedly.com;
  connect-src 'self' https://core.spreedly.com https://pci.browser-intake-datadoghq.com;
```

**Meta tag alternative:**

```html
<meta http-equiv="Content-Security-Policy" content="
  script-src 'self' https://core.spreedly.com;
  frame-src https://core.spreedly.com;
  child-src https://core.spreedly.com;
  connect-src 'self' https://core.spreedly.com https://pci.browser-intake-datadoghq.com;
">
```

**Note on `connect-src`:** The `pci.browser-intake-datadoghq.com` domain is required because the SDK sends anonymized telemetry (load times, error rates) to Datadog for operational monitoring. No card data is included in telemetry.

**Additional CSP for offsite payments:** If you're using Braintree APM or Stripe APM, you'll also need to allow their respective domains. See the integration guides for [Braintree](./docs/offsite-payments/braintree/INTEGRATION_GUIDE.md) and [Stripe APM](./docs/offsite-payments/stripe-apm/INTEGRATION_GUIDE.md).

### 3. Serve Pages Over HTTPS

The SDK **requires HTTPS** in production. HTTP connections will fail.

```
https://yoursite.com/checkout    ← allowed
http://yoursite.com/checkout     ← blocked
```

### 4. Protect Against Clickjacking

Clickjacking attacks trick users into interacting with hidden elements by overlaying your payment page with a malicious frame. Protect your checkout pages with these measures:

#### Set X-Frame-Options Header

Prevent your payment pages from being embedded in third-party iframes:

```http
X-Frame-Options: DENY
```

Or, to allow only your own domain:

```http
X-Frame-Options: SAMEORIGIN
```

#### Use frame-ancestors CSP Directive

The modern replacement for X-Frame-Options (use both for broader browser support):

```http
Content-Security-Policy: frame-ancestors 'self';
```

Or to block all framing:

```http
Content-Security-Policy: frame-ancestors 'none';
```

#### JavaScript Frame-Busting (Defense in Depth)

Add this to your checkout page as an additional protection layer:

```javascript
if (window.self !== window.top) {
  window.top.location = window.self.location;
}
```

#### Summary

| Risk | Mitigation |
|------|------------|
| Payment page embedded by attacker | Use `X-Frame-Options: DENY` or `frame-ancestors 'none'` |
| UI redressing attacks | Ensure checkout forms are not visually overlayable |
| Transparent iframe overlay | Set proper `z-index` and use frame-busting scripts |
| Cross-origin frame communication | SDK validates all `postMessage` origins internally |

> **Note:** The Spreedly SDK's hosted iframes have their own CSP and origin validation. These recommendations apply to **your checkout page** that embeds the SDK.

---

## Subresource Integrity (SRI)

### What is SRI?

Subresource Integrity ensures that files loaded from CDNs haven't been tampered with. The browser computes a hash of the downloaded file and compares it to the expected hash in the `integrity` attribute. If they don't match, the browser refuses to execute the script.

### How to Use SRI

#### Step 1: Download SRI Manifest

Each release publishes an `sri-manifest.json` file on the CDN:

**Hosted Fields:**
```
https://core.spreedly.com/checkout/sdk/{version}/sri-manifest.json
```

**Express Checkout:**
```
https://core.spreedly.com/checkout/elements/{version}/sri-manifest.json
```

#### Step 2: Extract the Hash

The manifest contains hashes in both SHA-384 and SHA-512:

```json
{
  "version": "{version}",
  "generatedAt": "2026-01-15T10:30:00.000Z",
  "algorithm": "sha384 (recommended) and sha512 (alternative)",
  "assets": [
    {
      "file": "index.js",
      "url": "https://core.spreedly.com/checkout/sdk/{version}/index.js",
      "sri": {
        "sha384": "sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/...",
        "sha512": "sha512-..."
      }
    }
  ]
}
```

Use the `sha384` value — it provides optimal security with broad browser support.

#### Step 3: Add to Script Tag

```html
<script
  src="https://core.spreedly.com/checkout/sdk/{version}/index.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/..."
  crossorigin="anonymous"
></script>
```

#### Step 4: Verify in Browser

Open DevTools → Network → select the script → check:
- Status: 200
- No console errors about integrity mismatch

If the integrity check fails, the browser will block the script and log an error to the console.

---

## Release Verification

For additional assurance beyond SRI, each release includes artifacts for manual verification:

### Release Manifest

Every release publishes a `release-manifest.json` with SHA-256 checksums for all assets:

```
https://core.spreedly.com/checkout/sdk/{version}/release-manifest.json
https://core.spreedly.com/checkout/elements/{version}/release-manifest.json
```

```json
{
  "version": "{version}",
  "buildDate": "2026-01-15T10:30:00.000Z",
  "assets": [
    {
      "file": "index.js",
      "size": 88002,
      "sha256": "a1b2c3d4e5f6...",
      "url": "https://core.spreedly.com/checkout/sdk/{version}/index.js"
    }
  ],
  "checksumAlgorithm": "SHA-256"
}
```

### Verifying a Release

```bash
VERSION="{version}"

# Download the manifest and asset
curl -O "https://core.spreedly.com/checkout/sdk/${VERSION}/release-manifest.json"
curl -O "https://core.spreedly.com/checkout/sdk/${VERSION}/index.js"

# Compute SHA-256
CALCULATED=$(shasum -a 256 index.js | awk '{print $1}')
EXPECTED=$(jq -r '.assets[] | select(.file=="index.js") | .sha256' release-manifest.json)

if [ "$CALCULATED" = "$EXPECTED" ]; then
  echo "Verification passed"
else
  echo "Verification failed — do not use this file"
fi
```

### Software Bill of Materials (SBOM)

Each release includes `sbom.json` (CycloneDX format) listing all bundled dependencies:

```
https://core.spreedly.com/checkout/sdk/{version}/sbom.json
https://core.spreedly.com/checkout/elements/{version}/sbom.json
```

Use this for dependency auditing, vulnerability scanning, and license compliance.

---

## Security Support

If you have security concerns or need assistance:

- **Help Center:** [Submit a request](https://support.spreedly.com/hc/en-us/requests/new) to open a ticket with our Customer Support team.
- **Trust Center:** For security or compliance-related issues, email [security@spreedly.com](mailto:security@spreedly.com) or visit our [Security & Compliance page](https://www.spreedly.com/security-compliance).
