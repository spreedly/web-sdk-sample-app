# Tokenization & Charging

When Mastercard's checkout completes, the SDK turns the result into a **Spreedly payment-method
token** and emits `tokenGenerated`. The SDK builds the token body for you — this doc explains where
the POST runs, how the CVV is handled, how to read the token, and how your server charges it.

## Where tokenization runs: inside the secure number iframe, always

With `config.fields` (the recommended integration), **there is nothing to wire**: the SDK routes
the tokenization POST into its own hosted number iframe automatically. It must run there because:
- **Origin:** the production tokenization endpoint only accepts requests from the Spreedly iframe's
  origin — your page's origin is rejected by the browser before the request is even sent.
- **PCI:** for a returning card, the CVV the shopper typed lives inside the iframe and is injected
  there, without ever touching your page.

There is **no merchant-page tokenization path** — a checkout with no route to the number iframe
fails fast with a clear error *before* Mastercard's window opens.

> **Saved-card-only pages:** the number field must still be mounted (it's the tokenization engine
> and the CVV holder). Keep its container visually hidden with CSS; only the CVV field needs to be
> visible next to the card list.

### Advanced: the `tokenize` callback override

If you manage your own `SpreedlyHostedFields` instance (two-class integration), either pass it once
as `config.hostedFields`, or wire the callback per checkout — it takes precedence over the
automatic routing, and you control `withCvv` yourself:

```js
// returning / selected card
tokenize: (body) => hostedFields.tokenizeClickToPay(body, { withCvv: true })

// new card
tokenize: (body) => hostedFields.tokenizeClickToPay(body)
```

## CVV handling

**The shopper always enters a CVV** (a required hosted field in both flows). What differs is *where
it goes on the token*:

| Flow | `withCvv` (decided by flow automatically) | Where the CVV lives |
|------|-------------------------------------------|---------------------|
| **New card** | `false` | Inside Mastercard's **encrypted card blob** (from `encryptCardForClickToPay`). The card is provisioned as a network token, so the Spreedly token needs **no** separate `verification_value`. |
| **Selected (returning) card** | `true` | There's no encrypted blob — so the number iframe injects the held CVV as **`verification_value`** on the token body before POSTing. |

So `verification_value` appears on the token **only for the selected-card flow**, and it's added
**inside the iframe** — never on your page. With `config.fields` the SDK sets `withCvv` per flow
for you; only a custom `tokenize` callback needs to pass it explicitly.

**Gating on CVV validity is your choice — the SDK never blocks on it.** The `validCvv` flag on
`fieldStateChange` is advisory. Gating your pay button on it is the recommended default, but flag-don't-block — warn the shopper and let them proceed — is equally valid. One rule is strongly recommended either way: for **saved-card** payments, don't proceed with
an **empty** CVV (`cvvLength === 0`) — the SDK only rejects that at tokenization, i.e. *after* the
shopper has completed Mastercard's checkout window.

## What ends up on the token

You don't build the body — the SDK assembles it from the Mastercard checkout result plus what you
passed to `checkout()`:

- **`click_to_pay` block** (SDK-supplied): the SRC `correlation_id`, your `dpa_id`, the `flow_id` /
  `merchant_transaction_id` from the checkout response, and a `test` flag in sandbox.
- **Cardholder name**: `first_name` / `last_name` / `full_name` from `checkout({ cardholder })`
  (Spreedly requires a non-blank first + last name).
- **Whitelisted fields** from `checkout({ creditCard })` — email, expiry, phone, billing + shipping
  address, etc. (the snake_case whitelist in [api-reference.md](./api-reference.md)).
- **Payment-method options** from `checkout({ paymentMethodOptions })` — `allow_blank_name`,
  `allow_expired_date`, `metadata`.
- **`verification_value`** — added by the iframe for the selected-card flow only (above).

The PAN is never in this body (it's inside Mastercard's encrypted card or already a saved SRC card).

## Getting the token

```js
c2p.on('tokenGenerated', (payload) => {
  const tx = payload.tokenResponse;               // the tokenization transaction
  const token = tx.payment_method?.token || tx.token;
  // → send `token` to your server
});
```

The resulting Spreedly payment method is a Click to Pay method you can charge, store, or use like any
other Spreedly token.

## Amount units — the one gotcha

Two different amount conventions are in play; keep them straight:

| Where | Unit | `$42.00` is… |
|-------|------|--------------|
| Mastercard's checkout window (`dpaTransactionOptions.transactionAmount`) | **major unit — dollars** | `42.0` |
| Spreedly transactions (the purchase below) | **minor unit — cents** | `4200` |

Sending cents to Mastercard (or dollars to the purchase) is the classic 100× bug. Pass the current
cart amount to Mastercard **in dollars** at checkout time:

```js
await c2p.checkout({
  /* … */
  dpaTransactionOptions: {
    transactionAmount: { transactionAmount: 42.0, transactionCurrencyCode: 'USD' },
  },
});
```

## Charging the token (your server)

The SDK stops at the token — it does **not** move money. Your backend runs the purchase against your
gateway, with the amount in **cents**:

```
POST https://core.spreedly.com/v1/gateways/{gateway_token}/purchase.json
{
  "transaction": {
    "payment_method_token": "<token>",
    "amount": 4200,
    "currency_code": "USD"
  }
}
```

Use your Spreedly API credentials server-side (never in the browser). See Spreedly's Transactions
API docs for auth, 3DS, and response handling.
