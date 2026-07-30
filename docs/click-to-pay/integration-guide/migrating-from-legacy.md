# Migrating Click to Pay from the legacy iFrame

A field-by-field guide for merchants moving a working legacy `Spreedly.c2pInit(...)` integration to
the checkout SDK's `SpreedlyClickToPay`. The event names were deliberately preserved, so much of
your code ports directly — but **several contracts changed in ways that fail silently if ported
verbatim**. Everything that changed is listed here; anything not listed behaves as it did in legacy.

## Before / after at a glance

```js
// LEGACY
Spreedly.c2pInit(environmentKey, {
  numberEl: 'spreedly-number',
  cvvEl: 'spreedly-cvv',
  emailEl: 'email', phoneEl: 'phone', countryCodeEl: 'country-code',
  cardsEl: 'cards', otpEl: 'otp', cvvContainerEl: 'cvv-container',
  spreedlyPaymentFormEl: 'spreedly-payment-form',
  spreedlyPaymentFormC2PSubmitEl: 'c2p-checkout-submit',
  c2pFrameEl: 'mastercard-ui', c2pFrameStyle: 'width=600,height=720',
  otp: { rememberMe: true },
  c2pConfig: { dpaData: {…}, dpaTransactionOptions: {…}, cardBrands: [...] },
});
```

```js
// NEW
const c2p = new SpreedlyClickToPay(authDetails, {   // signed auth, not just an env key — see §1
  fields: {                                          // replaces numberEl / cvvEl
    number: { containerId: 'card-number-field' },    // may live in a hidden container
    cvv:    { containerId: 'cvv-field' },
  },
  cardsEl: 'cards',
  otpEl: 'otp',
  c2pFrameEl: 'mastercard-ui', c2pFrameStyle: 'width=600,height=720',
  rememberMe: true,                                  // was otp.rememberMe
  c2pConfig: { dpaData: {…}, dpaTransactionOptions: {…}, cardBrands: [...] },
});
await c2p.init();
```

---

## 1. Authentication: environment key → signed auth (server change)

Legacy C2P needed only the environment key. The new SDK requires the full **signed auth details**
on every instance — `{ environment_key, certificate_token, nonce, signature, timestamp }` —
produced by **your server** with your Spreedly certificate. If you don't already sign requests for
another SDK feature, this is the one genuinely new backend requirement. See the
[quick start, step 2](./README.md).

## 2. Entry point & methods

| Legacy | New | Notes |
|---|---|---|
| `Spreedly.c2pInit(envKey, options)` | `new SpreedlyClickToPay(authDetails, config)` + `await c2p.init()` | Construction **throws** on missing `cardsEl`, empty `cardBrands`, or missing `dpaData.dpaPresentationName`/`dpaName` — configs that soft-failed on legacy fail loudly now |
| `Spreedly.c2pLookup(lookupInfo)` | `c2p.lookup(info?)` | Same merge-over-config semantics |
| `Spreedly.c2pCheckout(options)` (selected card, `isCheckoutWithCard: true`) | `c2p.checkout({ withSelectedCard: true, cardholder })` | Card selection is tracked automatically from the card list (or via `setSelectedCard(id)`) |
| `Spreedly.c2pCheckout(options)` (new card — auto-encrypted) | `const { encryptedCard, cardBrand } = await c2p.hostedFields.encryptCardForClickToPay({...})` then `c2p.checkout({ encryptedCard, cardBrand, cardholder })` | Two explicit calls instead of one — encryption is no longer implicit |
| `Spreedly.c2pSignOut()` | `c2p.signOut()` | Returns `boolean` (legacy returned Mastercard's raw value) |
| — | `c2p.submitOtp(code)`, `c2p.resendOtp(channelId?)`, `c2p.isReady()`, `c2p.destroy()` | New capabilities |

> **`onsubmit` trap:** legacy `c2pCheckout()` returned `false` for the
> `onsubmit="return Spreedly.c2pCheckout(...)"` idiom. `checkout()` returns a **Promise** (truthy)
> — call `event.preventDefault()` yourself.

## 3. Configuration mapping

| Legacy option | New equivalent |
|---|---|
| `numberEl` / `cvvEl` | `fields: { number: { containerId }, cvv: { containerId } }` — the SDK creates + mounts its own secure fields during `init()` and exposes them as `c2p.hostedFields`. **The number field is always required** (it is the tokenization engine and CVV holder); hide its container with CSS for saved-card-only UIs |
| `cardsEl`, `otpEl` | Same names, same components |
| `c2pFrameEl`, `c2pFrameStyle` | Same names. **Behavior change:** the SDK no longer shows/hides a merchant element named by `c2pFrameEl` — for an embedded checkout use `checkoutPresentation: 'drawer'` + `checkoutContainerEl` (you own the drawer chrome; open/close on the `checkout-window-open`/`-close` events) |
| `otp.rememberMe` | Top-level `rememberMe`. The nested legacy key is **silently ignored** — move it. Scope also broadened: it is sent on every checkout, not only after an OTP |
| `otp.type: 'overlay' \| 'none'` | Removed — the OTP component always renders as an overlay. For inline OTP, omit `otpEl` and drive it yourself via `otp-initiated` + `submitOtp()` |
| `emailEl` / `phoneEl` / `countryCodeEl` | Removed — the SDK never reads your DOM inputs. Read them yourself and pass values: `c2p.lookup({ email })` / `{ phone: { number, countryCode } }` (or `config.customer`). **Ported verbatim, a legacy config silently sends no identity** — shoppers who should get the OTP flow fall through to new-user |
| `cvvContainerEl` | Removed — the SDK no longer relocates the CVV field next to the card list. Re-parent the CVV container yourself when switching sections (`host.appendChild(document.getElementById('cvv-field'))`; the field survives the move) |
| `spreedlyPaymentFormEl` / `...C2PSubmitEl` / `...SubmitEl` / `isGuest` | Removed — the SDK does no form show/hide, no submit-button swapping, no injected "Go back" link. Own your section switching, keyed off the events (§5). Consent/guest choice now comes from Mastercard's `<src-consent>` component → `checkout({ complianceSettings })` |
| `data-*` attributes on `#spreedly-iframe` | Removed — all configuration is the config object |
| `customer` (+ `mainLookupMethod`) | Same shape. **Behavior fix:** `mainLookupMethod: 'phoneNumber'` was a silent no-op in legacy (always email-first); it now genuinely works — if you set it years ago, phone-first lookups start actually happening |
| `isTest` | Removed (internal test hook). Sandbox-ness is auto-detected from the Mastercard `lib.js` script tag; `isSandbox` exists as an override — **prefer not setting it** so detection can't disagree with reality |

## 4. Events: names kept, several contracts changed

All 16 kebab-case C2P event names are unchanged (`c2p-initialized`, `c2p-verified-user`,
`c2p-existing-user`, `c2p-new-user`, `display-cards-ready`, `add-new-card`, `otp-initiated`,
`otp-response`, `otp-resend`, `otp-not-you`, `checkout-window-open`/`-close`,
`checkout-cancelled`, `checkout-different-pm`, `checkout-error`, `c2p-session-deleted`). The deltas:

| What changed | Legacy | New | Action |
|---|---|---|---|
| **Success event** | `paymentMethod` with positional `(token, paymentMethod)` | `tokenGenerated` with `{ tokenResponse }` | Rename + read `payload.tokenResponse.token` |
| **Error event** | `errors` with a **bare array** | `error` with `{ errors: [...] }` | Rename + unwrap; see §6 |
| `add-new-card` payload | positional brands array (or nothing from ADD_CARD) | always `{ availableCardBrands }` object | `(brands) => …` handlers break — read `payload.availableCardBrands` |
| `add-new-card` on the new-user branch | fired (with `c2p-new-user`) | **not fired** — `c2p-new-user` alone signals "show the card form" | If your form-reveal listened only to `add-new-card`, also listen to `c2p-new-user` |
| `display-cards-ready` payload | none | `{ cards }` (masked card data) | Additive — handlers keep working |
| `otp-initiated` payload | positional `(initValidation, options)` | `{ validation }` object | Adjust if you read the validation data |
| Wrong-OTP errors | `errors` fired per failed attempt | only `otp-response { success: false, errorReason }` | Move wrong-code handling/monitoring onto `otp-response` |
| Checkout failure sequence | popup left open; only `errors` | window always closed + `checkout-window-close` → `checkout-error` → `error` | Cleaner — but expect close events on failures where legacy fired none |
| Unknown event names | silently accepted | `on()` validates against an allowlist and warns | Stale `errors`/`paymentMethod` subscriptions become visible console warnings |

## 5. The SDK no longer touches your DOM

Legacy managed merchant UI; the new SDK is **event-driven only** — it drives Mastercard's
`<src-card-list>`/`<src-otp-input>` and nothing else. You now own:

- Showing/hiding your payment form and sections (`c2p-new-user`, `add-new-card`, `display-cards-ready`).
- **Hiding the card list** after "add a card" and after sign-out (`add-new-card`,
  `c2p-session-deleted`) — legacy hid it for you; leaving it visible after sign-out shows the
  previous shopper's masked cards.
- Back-navigation (legacy's injected "Go back" link is gone).
- CVV field placement next to the card list (see `cvvContainerEl` in §3).

## 6. Error handling (the biggest rewrite)

Three changes stack: the event is `error` (not `errors`), the payload is `{ errors: [...] }` (not a
bare array), and **most legacy per-failure keys are gone**. Legacy let you branch on
`errors.c2p_lookup`, `errors.otp_code`, `errors.c2p_checkout_with_card`, etc. In the new SDK,
lifecycle failures (init, lookup, OTP initiation, checkout, sign-out) all carry the single key
**`errors.click_to_pay`** with a descriptive message. Preserved/structured cases:

- `errors.acct_inaccessible` — the locked-account OTP case keeps its dedicated key and message.
- **Tokenization API failures** relay Spreedly Core's real errors array — `{ key, attribute?,
  message, status }` per entry, exactly like legacy (e.g. `errors.blank` on `first_name`, declines).

Additionally, every entry with the `errors.click_to_pay` key carries a stable **`code`** field
naming the failed stage — route on it instead of parsing messages:

| Legacy key | New `code` |
|---|---|
| `errors.c2p_invalid_initialization_options` | `init` |
| `errors.c2p_card_retrieval`, `errors.c2p_lookup` | `lookup` |
| `errors.otp_code` (OTP initiation) | `otp_initiation` |
| `errors.c2p_otp_handle_validation`, `errors.acct_inaccessible` | `otp_validation` (wrong-code attempts themselves live on `otp-response`) |
| `errors.c2p_checkout_with_card`, `errors.c2p_checkout_with_new_card`, `errors.checkout_code` | `checkout` |
| Core tokenization failures | entries keep Core's own keys + `status`, plus `code: 'tokenization'` |
| `errors.c2p_sign_out` | `sign_out` |
| — (integration mistakes, e.g. calling before `init()`) | `config` |

## 7. CVV & tokenization behavior deltas

- **Where tokenization runs is unchanged** (inside the Spreedly iframe — you just no longer wire
  anything to make that true), and the selected-card CVV is injected there as `verification_value`,
  exactly like legacy.
- **New-card tokens no longer carry a redundant `verification_value`** — the CVV rides inside
  Mastercard's encrypted card and the enrollment provisions a network token. Expect
  `verification_value: ""` on new-card C2P payment methods; nothing to fix downstream.
- **CVV TTL (new):** the held CVV auto-clears after 3 idle minutes (PCI) — the shopper re-enters
  it. The timer **pauses while Mastercard's checkout window is open**, so long DCF sessions are
  safe; when it clears, a `cvvExpired`-reason `error` event fires **and a fresh `fieldStateChange`
  (`validCvv: false`) is emitted** so pay-button gating stays truthful. A **failed** tokenization
  does *not* clear the CVV — transient failures retry without re-entry (legacy parity).
- Invalid PANs are refused **before** encryption with an attributed error (legacy parity), and
  brands not enabled by Mastercard's init are refused **before** the checkout window opens.

## 8. New capabilities you couldn't have on legacy (all opt-in)

`checkoutPresentation: 'drawer'` (embedded DCF, no popup blockers) · per-checkout
`dpaTransactionOptions` (show the real cart amount at checkout time) · `complianceSettings`
(consent records from `<src-consent>`) · programmatic OTP (`submitOtp`/`resendOtp`) ·
`paymentMethodOptions` incl. `metadata` on C2P tokens · `recognitionToken` replay hook ·
`destroy()` teardown · telemetry.

## Migration checklist

1. ☐ Server endpoint returning **signed auth** (§1); pass `authDetails` instead of the env key.
2. ☐ Replace `c2pInit` with `new SpreedlyClickToPay` + `await c2p.init()`; move `numberEl`/`cvvEl`
   to `fields` (number container may be hidden — it must exist).
3. ☐ Move `otp.rememberMe` → `rememberMe`; delete removed options (§3) and replace their behavior
   (identity via `lookup(...)`, CVV re-parenting, section switching, card-list hiding).
4. ☐ Rename `paymentMethod` → `tokenGenerated` and `errors` → `error`; unwrap the new payloads (§4, §6).
5. ☐ Re-key error routing off `errors.click_to_pay` + flow events; keep `errors.acct_inaccessible`
   and Core tokenization keys (§6).
6. ☐ New-card flow: add the explicit `c2p.hostedFields.encryptCardForClickToPay(...)` call (§2);
   note `verification_value: ""` on new-card tokens (§7).
7. ☐ If you set `mainLookupMethod: 'phoneNumber'`: confirm you *want* phone-first lookups — they
   now actually happen (§3).
8. ☐ `onsubmit` handlers: `preventDefault()` instead of relying on a `false` return (§2).
9. ☐ Test both flows in sandbox **without** setting `isSandbox` (auto-detected), verify
   `click_to_pay.test` flips to `false` against production `lib.js`.
