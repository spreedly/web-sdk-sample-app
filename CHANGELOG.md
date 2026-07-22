# Changelog

All notable changes to the Spreedly Web SDK will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-07-10

### Added
- **ACH payments**: `setupACHPayment(config)`, `submitACHPayment()`, and `clearACHPayment()` methods (available from both Hosted Fields and Express Checkout), plus `achTokenGenerated` and `achPaymentError` events, for tokenizing US and Canadian bank accounts. See `docs/ach-payments/INTEGRATION_GUIDE.md`
- **Stripe Radar**: `stripeRadar(publishableKey, options?)` method (available from both Hosted Fields and Express Checkout) that wraps `Stripe.createRadarSession()` and resolves with the Radar session id (or `null` on failure) to forward with a Stripe Payment Intents charge. Legacy parity for `Spreedly.stripeRadar(...)` (callback → Promise). See `docs/stripe-radar/INTEGRATION_GUIDE.md`.

### Changed
- **Breaking (offsite): `offsitePaymentError` payload shape changed**. The payload was `{ message, error }` in 1.2.0 and is now `{ message, status, errors }`. Refer to `docs/offsite-payments/general/INTEGRATION_GUIDE.md` for complete details.

### Fixed
- **Hosted Fields cardholder name typing/docs**: `HostedFieldsFormData.first_name` and `last_name` are now correctly typed as optional. Provide **either** `full_name` **or** both `first_name` + `last_name` — the SDK forwards whatever is supplied and Spreedly Core enforces the requirement. API reference, migration guide, and the Hosted Fields integration guide updated accordingly. (Express Checkout's prebuilt form is unchanged — it still renders `first_name`/`last_name` by default.)
- **Hosted Fields integration guide** now documents `sdk.validate()` and the `validation` event (structured field-level validation), which previously only appeared in the migration guide.

## [1.2.0] - 2026-06-05

### Added
- Remaining hosted-fields parity methods (HC-1450 follow-up): `setInputMode`,
  `setRequiredAttribute`, `resetFields`, `isLoaded`, and `reload`.
- New hosted-fields callback event: `consoleError` (uncaught error inside a
  hosted iframe) (HC-1450).
- `email` as an optional Express Checkout form field.
- `eligible_for_card_updater` flag accepted in hosted-fields form data.
- Legacy-iframe migration guide (`docs/migration-guide/MIGRATION_GUIDE.md`).
- Option to hide the built-in card-type badge (e.g. `VISA`): `sdk.setShowCardTypeIcon(false)`
  on Hosted Fields and `uiConfig.showCardTypeIcon: false` on Express Checkout. Shown by
  default. Useful when rendering your own brand icon from the `cardType` field.

### Fixed
- CVV frame tab event not firing (HC-1450).

### Changed
- Tightened the CI bundle-size budget for the CVV iframe bundle (max 140 KB).

## [1.1.0] - 2026-05-26

### Added
- Hosted-fields parity methods to close gaps with the legacy iframe:
  `setLabel`, `setTitle`, `setNumberFormat`, `setPlaceholderStyles`,
  `toggleMask`, `toggleAutoComplete`, `transferFocus`, `validate`,
  `setFieldStateReporting`, `destroy`, and `setStyles` (renamed from
  `setStyle`); plus `removeHandlers` on the shared base class (HC-1450).
- New hosted-fields callback events: `fieldStateChange` (live field metadata)
  and `validation` (client-side validation snapshot, emitted by `validate()`
  and when `submit()` is blocked client-side) (HC-1450).
- **Gateway-specific 3D Secure** flow support, alongside the existing
  SCA-provider flow (HC-1073).
- New Recache config options: `allow_blank_name`, `allow_expired_date`,
  `allow_blank_date` (HC-1139).

### Fixed
- `maskedFormat` input defect on the card-number field (HC-1450).

## [1.0.1] - 2026-01-12

### Added
- `allow_blank_date` configuration option to the SDK.

### Fixed
- `allow_blank_name` configuration option.
- `allow_expired_date` configuration option.

### Removed
- Incorrect integration comments from the 3DS code.

## [1.0.0] - 2026-01-02

### Added

**Monorepo Architecture**
- Migrated to monorepo structure with npm workspaces and Turborepo
- New package: `@spreedly/core` - Shared utilities, types, logging, and API
- New package: `@spreedly/hosted-fields` - Secure iframe card inputs
- New package: `@spreedly/express-checkout` - Pre-built React payment form
- Shared card-type detection and validation logic in core

**3D Secure (3DS) Support**
- `SpreedlyThreeDSLifecycle` class for managing 3DS authentication flows
- `serializeBrowserInfo()` utility for collecting browser data
- `detectBrowserInfo()` utility for 3DS device fingerprinting
- Challenge iframe management with configurable containers
- Status polling and finalization support

**Security Enhancements**
- Console logs removed in production builds (Terser/esbuild)
- Debugger statements removed in production builds
- Source maps generated but hidden (not referenced in bundles)
- Release manifest generation (SHA-256 checksums)
- SRI (Subresource Integrity) hash generation (SHA-384/SHA-512)
- SBOM (Software Bill of Materials) generation (CycloneDX format)
- Automated dependency vulnerability scanning via `dependency-review.yml`
- CVV TTL (3-minute automatic clearing)
- Iframe `postMessage` origin validation on hosted-fields and express-checkout; express-checkout ignores subsequent init config once auth details are set (HC-1273)
- Express-checkout iframe CSP + `sandbox` parity with hosted-fields; hosted-fields CSP cleanup (HC-1340)

**Offsite payments** 
- (HC-1076): `setupOffsitePayment(config)`, `submitOffsitePayment()`, and `clearOffsitePayment()`   
  methods plus `offsiteTokenGenerated` and `offsitePaymentError` events for offsite gateways
  (PayPal, PIX, Boleto, OXXO, NuPay, etc.).

**Stripe APM** (`SpreedlyStripeAPM`) and **Braintree APM**
- (`SpreedlyBraintree`) integrations for Alternative Payment Methods and
  PayPal/Venmo buttons (HC-1227).

**Usage and performance telemetry** 
- (HC-1077): a core telemetry service tracking events and 
  metrics across SDK flows, with an events reference doc.

**CI/CD Improvements**
- Separate deployment workflows per package
- Path-filtered deployments (only changed packages deploy)
- Staging branch support with staging CDN (`core-test.spreedly.com`)
- Production deployment on push to main
- Manual stable promotion via tags (`stable-hf`, `stable-ec`)
- Automated GitHub Release creation with security artifacts

### Changed

- **Breaking:** Class names updated:
  - `SpreedlyWebSDK` renamed to `SpreedlyExpressCheckout` (Express Checkout)
  - New `SpreedlyHostedFields` class for Hosted Fields integration
- **Breaking:** CDN paths updated:
  - Hosted Fields: `/checkout/sdk/{version}/index.js`
  - Express Checkout: `/checkout/elements/{version}/express-checkout.js`
- Express Checkout now built with Vite (previously Webpack)
- Hosted Fields continue to use Webpack
- Improved cross-frame message validation with origin checks
- Enhanced logging with Datadog integration

### Documentation

- Updated `API_REFERENCE.md` - Complete API for both SDKs
- Updated `INTEGRATION_GUIDE.md` - Step-by-step integration with 3DS and recache
- Updated `SECURITY.md` - SRI, CSP, and security best practices
- Updated `BUILD_VERIFICATION.md` - Monorepo artifact inspection
- Updated `deploymentGuidelines.md` - Monorepo deployment procedures
- Updated `README.md` - Monorepo overview and quick start

---

## [0.0.5] - 2025-12-03

### Added

**CVV Recache Support**
- `setRecache(token, options)` method for enabling recache mode
- `recache()` method for triggering CVV update (Hosted Fields only)
- `recacheReady` event when SDK is ready for CVV recache
- `recacheSuccess` event on successful CVV update
- Card number field auto-populated and disabled in recache mode
- Support for retained payment method CVV updates

### Changed

- Enhanced form state management for recache mode
- Improved validation for retained payment method tokens

---

## [0.0.1] - 2025-0X-XX

### Added

- Initial release
- Hosted Fields implementation with secure iframes
- Express Checkout SDK with pre-built payment form
- Card tokenization via Spreedly API
- iframe-based secure input fields for card number and CVV
- Cross-frame messaging with origin validation
- Event-driven callback system (`ready`, `tokenGenerated`, `error`, `close`)
- Dynamic field configuration (labels, placeholders, styles)
- Dialog and embedded mode support for Express Checkout
- Real-time card type detection (Visa, Mastercard, Amex, etc.)
- Luhn validation for card numbers
- Datadog logging integration

---

## Versioning Strategy

We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (X.0.0): Breaking changes (architecture, API changes)
- **MINOR** (0.X.0): New features, backwards-compatible
- **PATCH** (0.0.X): Bug fixes, backwards-compatible

## Release Process

1. Bump the version in all four `package.json` files (root + three packages) in
   lockstep and run `npm i` to sync the lockfile. Versions are never reused.
2. Update `CHANGELOG.md` with the changes
3. Open a PR targeting `main`; merging deploys the changed package(s) to
   staging (`core-test.spreedly.com`, versioned + `rc` channels)
4. Verify on staging
5. For production, push a `hosted-fields-vX.Y.Z` and/or `express-checkout-vX.Y.Z`
   tag — the tag version must exactly match `package.json`

## CDN URLs

### Production
- Hosted Fields: `https://core.spreedly.com/checkout/sdk/{version}/index.js`
- Express Checkout: `https://core.spreedly.com/checkout/elements/{version}/express-checkout.js`

### Staging
- Hosted Fields: `https://core-test.spreedly.com/checkout/sdk/{version}/index.js`
- Express Checkout: `https://core-test.spreedly.com/checkout/elements/{version}/express-checkout.js`

## Change Categories

Changes are grouped as follows:
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements or fixes
