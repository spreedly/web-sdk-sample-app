# API Reference

The `SpreedlyClickToPay` methods and events, plus the two `SpreedlyHostedFields` helpers used by
the Click to Pay flow. Config options are in [configuration.md](./configuration.md).

## `SpreedlyClickToPay`

```js
const c2p = new window.SpreedlyClickToPay(authDetails, config);
```

| Constructor param | Type | |
|-------------------|------|--|
| `authDetails` | `{ environment_key, certificate_token, nonce, signature, timestamp }` | Signed auth from your server. |
| `config` | `ClickToPayConfig` | See [configuration.md](./configuration.md). |

The constructor **throws synchronously** on: invalid/incomplete `authDetails`, missing `cardsEl`,
empty `c2pConfig.cardBrands`, missing `dpaData.dpaPresentationName`/`dpaName`, or passing both
`fields` and `hostedFields`. Construct inside a try/catch if config may be incomplete.

### Properties

#### `hostedFields: SpreedlyHostedFields | null`
The hosted-fields instance the SDK created from `config.fields` — the real instance with its full
public API (styling, `on('ready')`/`on('fieldStateChange')`, and the
[Click to Pay helpers](#spreedlyhostedfields-helpers-click-to-pay) below). Available from
construction (attach listeners before `init()` mounts the fields). `null` when `fields` wasn't used.

### Methods

#### `on(event, callback)` / `removeHandlers()`
Register an event handler / remove all handlers. Event names are validated against the list in
[Events](#events) — unknown names are dropped with a console warning.
```js
c2p.on('tokenGenerated', (payload) => { /* … */ });
```

#### `init(): Promise<void>`
Mounts the hosted card fields (when `config.fields` is set), initializes Mastercard SRC, and emits
`c2p-initialized` then `ready`. **Await it before any other call.** If `doLookup` isn't `false`, it
also runs `lookup()` automatically. It never rejects: failures surface as an `error` event plus
`c2p-initialized { success: false }`.

#### `lookup(info?): Promise<void>`
Identifies the shopper and branches the flow (see [flows.md](./flows.md)). Optionally pass identity
to merge into the configured `customer`:
```js
c2p.lookup({ email: 'shopper@example.com' });
c2p.lookup({ phone: { number: '5551234949', countryCode: '1' } });
```
`info` is a `ClickToPayCustomer`: `{ email?, phone?: { number, countryCode }, mainLookupMethod? }`.

#### `setSelectedCard(srcDigitalCardId): void`
Records the saved card the shopper selected. When you set `cardsEl`, the SDK calls this for you from
the card list's selection event; call it yourself only if you drive selection manually.

#### `checkout(options): Promise<void>`
Launches Mastercard's checkout window for the selected or new card, then tokenizes on completion.
Resolves the flow into a `tokenGenerated` (or other outcome) event — see
[checkout() options](#checkout-options) and [flows.md](./flows.md).

Fails fast with an `error` event **before the checkout window opens** when: `init()` hasn't run
(`code: 'config'`), no card is selected for `withSelectedCard` (`code: 'checkout'`), the card brand
isn't in Mastercard's enabled list (`code: 'checkout'`), or there is no tokenization route — no
`fields`/`hostedFields` and no `tokenize` callback (`code: 'checkout'`).

#### `submitOtp(value): Promise<void>` / `resendOtp(channelId?): Promise<void>`
Submit / resend the OTP code programmatically. Only needed if you drive OTP yourself instead of
letting the SDK drive `<src-otp-input>` (see [components.md](./components.md)).

#### `signOut(): Promise<boolean>`
Signs the shopper out of Click to Pay on this device, resets all per-shopper state (customer
identity, cardholder, selected card, remember-me, OTP channel) to the configured defaults, and
emits `c2p-session-deleted`. Resolves to whether the device is still recognized.

#### `isReady(): boolean`
`true` once `init()` has completed.

#### `destroy(): void`
**Terminal** teardown: closes any open checkout window, cancels in-flight flows (nothing tokenizes
or emits afterwards), removes the component listeners, clears all shopper state, and resets
handlers. Further calls on the instance are ignored with a console warning — create a new
`SpreedlyClickToPay` to start again.

---

## `checkout()` options

All optional, but you must provide **either** `withSelectedCard: true` (saved card) **or**
`encryptedCard` + `cardBrand` (new card).

| Option | Type | Description |
|--------|------|-------------|
| `withSelectedCard` | `boolean` | Check out with the card chosen via `setSelectedCard`. |
| `encryptedCard` | `string` | The encrypted card from `encryptCardForClickToPay` (new-card flow). |
| `cardBrand` | `string` | The brand from `encryptCardForClickToPay` (new-card flow). |
| `cardholder` | `{ firstName?, lastName?, fullName? }` | **camelCase.** Applied to the token; Spreedly requires a non-blank first + last name. |
| `creditCard` | `ClickToPayCreditCardFields` | **snake_case** extra fields forwarded onto the token (see below). |
| `paymentMethodOptions` | `{ allow_blank_name?, allow_expired_date?, metadata? }` | Payment-method-level options. |
| `complianceSettings` | `{ complianceResources: [...] }` | Consumer consent from `<src-consent>`; passed through (see [components.md](./components.md)). |
| `dpaTransactionOptions` | `Partial<C2PTransactionOptions>` | Per-checkout DPA options, e.g. the current `transactionAmount` (dollars) — merged over the init config. |
| `tokenize` | `(body) => Promise<unknown>` | **Advanced override.** With `config.fields`/`config.hostedFields` the SDK tokenizes inside the number iframe automatically (`withCvv` by flow); pass this only to run the POST yourself (takes precedence; see [tokenization.md](./tokenization.md)). |

**`creditCard` (whitelist, snake_case, all optional):** `first_name`, `last_name`, `full_name`,
`email`, `month`, `year`, `phone_number`, `company`, `eligible_for_card_updater`, `address1`,
`address2`, `city`, `state`, `zip`, `country`, `shipping_address1`, `shipping_address2`,
`shipping_city`, `shipping_state`, `shipping_zip`, `shipping_country`, `shipping_phone_number`.
Only present keys are sent. (The PAN and CVV are **never** accepted here.)

---

## Events

Register with `c2p.on(name, cb)`. Legacy kebab-case names are preserved.

### Lifecycle / lookup
| Event | Payload | Fires when |
|-------|---------|-----------|
| `ready` | — | `init()` finished. |
| `c2p-initialized` | `{ success, c2pInitialization?, availableCardBrands? }` | Mastercard SRC init result. |
| `c2p-verified-user` | — | Recognized device; saved cards will render. |
| `c2p-existing-user` | — | Known shopper, new device; OTP follows. |
| `c2p-new-user` | — | No profile; collect a new card. |
| `display-cards-ready` | `{ cards }` | Saved-card list rendered. |
| `otp-initiated` | `{ validation }` | OTP challenge sent. |
| `otp-response` | `{ success, errorReason? }` | OTP validated. |
| `otp-resend` | — | OTP resent. |
| `otp-not-you` | — | Shopper clicked "Not you?" → signs out. |

### Checkout
| Event | Payload | Fires when |
|-------|---------|-----------|
| `checkout-window-open` | — | Mastercard's checkout window opened. |
| `checkout-window-close` | — | …closed. |
| `tokenGenerated` | `{ tokenResponse }` | Checkout completed → Spreedly token created. Read the token from `tokenResponse` (e.g. `tokenResponse.payment_method?.token` / `tokenResponse.token`). |
| `checkout-cancelled` | — | Shopper cancelled. |
| `checkout-different-pm` | — | Shopper switched cards; re-show the list. |
| `add-new-card` | `{ availableCardBrands }` | Show your new-card form: fires from the card list's "add a card" link, the ADD_CARD checkout outcome, and an OTP success that returned zero saved cards. The SDK hides the card list first. |
| `checkout-error` | — | Unexpected checkout outcome. |
| `c2p-session-deleted` | — | Signed out / switched account. |
| `error` | `{ errors: [{ key, code?, message, … }] }` | Any error in the flow. Entries with key `errors.click_to_pay` carry a stable stage `code` (`config` / `init` / `lookup` / `otp_initiation` / `otp_validation` / `checkout` / `tokenization` / `sign_out`) for machine routing; tokenization failures relay Core's own keys + `status` with `code: 'tokenization'`. |

> The full per-scenario ordering of these events is in [flows.md](./flows.md).

---

## `SpreedlyHostedFields` helpers (Click to Pay)

These live on the `SpreedlyHostedFields` instance. With the recommended `config.fields`
integration, that instance is created by the SDK and exposed as **`c2p.hostedFields`** (same full
API); with a two-class integration it's the instance you created yourself.

#### `encryptCardForClickToPay(cardholder): Promise<{ encryptedCard, cardBrand }>`
Encrypts the new card **inside the number iframe** (the PAN never leaves it). Fields are
**snake_case**; all are optional except that a card number must be present in the hosted field:
```js
const { encryptedCard, cardBrand } = await c2p.hostedFields.encryptCardForClickToPay({
  first_name: 'Lee',
  last_name: 'Cardholder',
  full_name: 'Lee Cardholder',       // optional; used only when first/last are absent
  month: '12',                        // 'MM'
  year: '2029',                       // 'YYYY' (or 'YY')
  available_card_brands: ['mastercard', 'visa', 'amex', 'discover'],
});
```
Pass the returned `encryptedCard` + `cardBrand` to `checkout()`.

- `sandbox?: boolean` — **omit it**: it is auto-detected from the Mastercard `lib.js` script tag.
  Only set it to override the detection.
- `available_card_brands` — when supplied, encryption is refused for brands not in the list;
  when omitted, any detected brand is encrypted.
- **Rejects** on: an invalid card number, an unavailable brand, Mastercard SDK load/encryption
  failure, a 30-second timeout (number field not mounted/loaded), or `destroy()` while pending.

#### `tokenizeClickToPay(body, options?): Promise<unknown>`
Runs the tokenization POST **from inside the iframe**. You don't build `body` — pass it through from
`checkout()`'s `tokenize` callback:
```js
// returning / selected card — the iframe injects the held CVV as verification_value
tokenize: (body) => hostedFields.tokenizeClickToPay(body, { withCvv: true })

// new card — CVV is already inside Mastercard's encrypted blob
tokenize: (body) => hostedFields.tokenizeClickToPay(body)
```
`options.withCvv` (default `false`) controls whether the iframe adds `verification_value`.

**Rejects** with an `Error` whose `message` is the human-readable reason; for Spreedly API failures
the error also carries `.errors` — Core's structured array (`{ key, attribute?, message, status }`
per entry). Also rejects on a 30-second timeout (number field not mounted/loaded) or `destroy()`
while pending. See [tokenization.md](./tokenization.md).

---

## Exported TypeScript types

Importable from the package for typed integrations: `ClickToPayConfig`, `ClickToPayCustomer`,
`ClickToPayFieldsConfig`, `C2PHostedFieldsLike`, `C2PErrorCode`, `C2PConfig`, `C2PCard`,
`C2PCardBrand`, `C2PConsumer`, `C2PCheckoutResponse`, `C2PCheckoutActionCode`, `C2PValidationInit`,
`Click2PayInstance`.
