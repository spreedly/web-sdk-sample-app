# SDK Versioning & Release Channels

Choose how you receive Spreedly Web SDK updates.

---

## Table of Contents

1. [Overview](#overview)
2. [Release Channels](#release-channels)
3. [Which Channel Should I Use?](#which-channel-should-i-use)
4. [Versioning](#versioning)
5. [Deprecation & Support](#deprecation--support)
6. [Migrating from iframe](#migrating-from-iframe)

---

## Overview

The Spreedly Web SDK is available through three release channels. Each channel offers a different balance of stability and recency. You choose a channel by changing the script URL in your page — no code changes are needed.

The SDK consists of two packages that are versioned independently:

- **Hosted Fields** — for collecting card data via secure iframes
- **Express Checkout** — for a pre-built checkout UI

---

## Release Channels

### Stable (recommended)

```html
<!-- Hosted Fields -->
<script src="https://core.spreedly.com/checkout/sdk/stable/hosted-fields.js"></script>

<!-- Express Checkout -->
<script src="https://core.spreedly.com/checkout/sdk/stable/express-checkout.js"></script>
```

A vetted production version that has been validated over time. A new SDK version is first released to the RC channel, where it runs in production across merchants. Only after it has been confirmed stable — with no regressions or merchant-reported issues — is it promoted to the Stable channel. This means the version you receive has already been battle-tested before reaching you.

**Best for:** Most production environments. Gives you confidence that the SDK has been validated in real-world usage before it reaches your checkout page.

### RC (Release Candidate)

```html
<!-- Hosted Fields -->
<script src="https://core.spreedly.com/checkout/sdk/rc/hosted-fields.js"></script>

<!-- Express Checkout -->
<script src="https://core.spreedly.com/checkout/sdk/rc/express-checkout.js"></script>
```

Always points to the latest production release. Updated automatically with each new version we deploy.

**Best for:** Test environments, or merchants who want the latest features immediately.

### Versioned (pinned)

```html
<!-- Hosted Fields -->
<script src="https://core.spreedly.com/checkout/sdk/1.2.3/hosted-fields.js"></script>

<!-- Express Checkout -->
<script src="https://core.spreedly.com/checkout/sdk/1.2.3/express-checkout.js"></script>
```

An immutable release. The files at a versioned URL never change. You control exactly when to upgrade by changing the version number in your script tag.

**Best for:** Merchants who need strict change control or compliance requirements that mandate pinned dependencies.

---

## Versioning

The SDK follows [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`):

| Version change | Meaning |
|---|---|---|
| **Patch** (`1.2.3` → `1.2.4`) | Bug fixes |
| **Minor** (`1.2.4` → `1.3.0`) | New features |
| **Major** (`1.3.0` → `2.0.0`) | Breaking changes |

---

## Deprecation & Support

**Stable and RC** always serve a supported version — no action needed on your part.

**Versioned releases** remain available on the CDN but may be deprecated over time. The version continues to function normally — it is not broken or disabled. We strongly recommend upgrading to stay current with security patches and bug fixes.

---

## Migrating from iframe

If you're transitioning from the legacy Spreedly iframe to the Web SDK, here's how the release channels map:

| Old iframe channel | New SDK equivalent |
|---|---|
| `iframe-v1.min.js` (continuously updated) | **RC** |
| `iframe-stable.min.js` | **Stable** |
| N/A | **Versioned** (new — pin to a specific version) |

### Key differences

- **Pinned versions are now available.** You can lock to an exact version for full change control.
- **Hosted Fields and Express Checkout are versioned independently.** Each has its own version number and release timeline.
- **Semantic versioning.** Clear rules about what constitutes a breaking change so you know when your integration might need updates.
