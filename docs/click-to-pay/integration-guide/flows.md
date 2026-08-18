# Flows

Click to Pay has one lifecycle with three shopper outcomes. This doc walks each one as a sequence of
**events you listen to** and **calls you make**. Event names in `code` are the exact strings passed
to `c2p.on(...)`.

## The lifecycle in one picture

```
init()  ──►  c2p-initialized ──► ready
   │
   └─ lookup()  decides the outcome:
        ├─ recognized device      → c2p-verified-user   → cards        → (A)
        ├─ known shopper, new device → c2p-existing-user → OTP → cards  → (B)
        └─ no profile / blank      → c2p-new-user        → new-card form→ (C)

  …then, for any card:  checkout()  →  Mastercard window  →  tokenGenerated  →  your server charges it
```

## What `lookup()` decides

`lookup()` runs two Mastercard checks, in order:

1. **Device recognition** — is this browser already recognized? If yes, saved cards come back
   immediately → **`c2p-verified-user`** (scenario A). No email or OTP needed.
2. **Identity lookup** — otherwise, if you supplied an email/mobile, Mastercard checks for a profile:
   - profile found → **`c2p-existing-user`** → an OTP challenge (scenario B).
   - no profile (or you passed no email/mobile) → **`c2p-new-user`** (scenario C).

You trigger lookup either automatically (`doLookup: true`) or yourself:

```js
c2p.lookup({ email: 'shopper@example.com' });      // email-first
c2p.lookup({ phone: { number: '5551234949', countryCode: '1' } }); // or phone
```

---

## Scenario A — Returning shopper, recognized device

The smoothest path: no email entry, no OTP.

```
lookup() ─► c2p-verified-user ─► display-cards-ready
         (you show the card list + a Pay button)
setSelectedCard(id)  ◄─ from the card list selection
checkout({ withSelectedCard: true, … })  ─► … ─► tokenGenerated
```

1. `c2p-verified-user` fires; the SDK populates your `<src-card-list>`.
2. `display-cards-ready` fires when the list is on screen.
3. The shopper picks a card (the SDK calls your `setSelectedCard` wiring), enters the CVC, and you
   call `checkout({ withSelectedCard: true, … })`.
4. → the shared **checkout → token** step below.

> Recognition is the *exception*, not the rule, on the web today — see [the recognition
> note](#a-note-on-recognition) at the end.

## Scenario B — Returning shopper, device not recognized (OTP)

```
lookup({ email }) ─► c2p-existing-user ─► otp-initiated
                  (you reveal your <src-otp-input>; the SDK drives it)
   shopper enters code ─► otp-response { success: true } ─► display-cards-ready
setSelectedCard(id) ─► checkout({ withSelectedCard: true, … }) ─► tokenGenerated
```

1. `c2p-existing-user` fires — Mastercard has a profile for this email/mobile.
2. `otp-initiated` fires — an OTP was sent. Reveal your `<src-otp-input>`; if you set `otpEl`, the
   SDK renders and drives it (the boxes, resend links, Continue).
3. The shopper enters the code. Related events:
   - `otp-response` — `{ success, errorReason? }` after validation.
   - `otp-resend` — the shopper asked for a new code (`resendOtp(channelId?)`).
   - `otp-not-you` — the shopper clicked "Not you?" → the SDK signs out → `c2p-session-deleted`.
4. On success, saved cards render → `display-cards-ready`, then the same select → checkout path as A.

> You can also drive OTP yourself without the component: listen for `otp-initiated`, render your own
> input, and call `submitOtp(value)` / `resendOtp()`. See [components.md](./components.md).

## Scenario C — New shopper (no profile)

```
lookup() ─► c2p-new-user
         (you show your new-card form: number + expiry + CVV + name)
encryptCardForClickToPay({ first_name, last_name, month, year, … }) ─► { encryptedCard, cardBrand }
checkout({ encryptedCard, cardBrand, … }) ─► … ─► tokenGenerated
```

1. `c2p-new-user` fires (no profile, or the shopper left email/mobile blank). Show your new-card
   form (the card-number + CVV hosted fields, plus expiry and name).
2. When the card is valid, encrypt it **inside the iframe**:
   ```js
   const { encryptedCard, cardBrand } = await c2p.hostedFields.encryptCardForClickToPay({
     first_name: firstName, last_name: lastName, month, year,
     available_card_brands: ['mastercard', 'visa', 'amex', 'discover'],
   });
   ```
3. Call `checkout({ encryptedCard, cardBrand, … })`.
4. → the shared **checkout → token** step. Mastercard's window collects the shopper's
   email/mobile/consent to enroll the card (that part is Mastercard's own UI).

---

## The shared step: checkout → Mastercard window → token

Both card types converge here. `checkout()` launches Mastercard's checkout window (the DCF — a
popup or an on-page drawer, per `checkoutPresentation`) and reports the outcome:

```
checkout(…) ─► checkout-window-open ─► [Mastercard DCF] ─► checkout-window-close
            └─► outcome (by Mastercard action code):
```

| Outcome | Event | What to do |
|---------|-------|------------|
| Completed | `tokenGenerated` | Send `tokenResponse.token` to your server to charge (below). |
| Shopper cancelled | `checkout-cancelled` | Return them to the card list / checkout. |
| Shopper switched card | `checkout-different-pm` | Re-show the card list. |
| Shopper chose "add card" | `add-new-card` | Show your new-card form. |
| Shopper switched account | `c2p-session-deleted` | Reset to lookup. |
| Unexpected | `checkout-error` | Surface an error. |

On completion the SDK builds the token body and tokenizes (CVV handled inside the iframe — see
[tokenization.md](./tokenization.md)), then emits:

```js
c2p.on('tokenGenerated', (payload) => {
  const token = payload.tokenResponse.token; // Spreedly payment-method token
  // → POST to your server; charge via your gateway
});
```

### Then: charge the token (your server)

The SDK's job ends at the token. Your backend runs the purchase:

```
POST https://core.spreedly.com/v1/gateways/{gateway_token}/purchase.json
{ "transaction": { "payment_method_token": "<token>", "amount": 4200, "currency_code": "USD" } }
```

(Amount in the **smallest currency unit** — cents. See the units note in
[tokenization.md](./tokenization.md).)

---

## A note on recognition

Scenario A (recognized device, no OTP) is the ideal returning experience, but on the web it often
**doesn't** happen even for an enrolled shopper, so **build for scenario B as the returning
default**:

- Same-browser recognition relies on a `src.mastercard.com` cookie that `getCards()` reads. Under
  modern **third-party-cookie blocking**, that read fails cross-site — so a returning shopper falls
  through to identity lookup + OTP (scenario B) instead of A.
- `rememberMe: true` requests recognition for next time, but is still subject to the same cookie
  policy and the shopper's consent.
- The robust cross-cookie-policy path is a **`recognitionToken`** replayed on `init()` — but that
  token is issued **server-side** (through Spreedly), not in the client checkout response, so it
  isn't wired end-to-end yet. See [configuration.md §7](./configuration.md#7-recognitiontoken).

Net: treat A as a bonus, B as the normal returning flow.
