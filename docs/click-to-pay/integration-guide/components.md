# Components & Presentation

Click to Pay uses Mastercard's **SRC UI-kit web components** (loaded from the `src-ui-kit` script +
CSS on your page). Some the **SDK drives for you**; others **you place and read**. This doc covers
each, plus how the checkout window is presented (popup vs drawer) and consent.

## Loading the kit

```html
<script type="module"
  src="https://sandbox.src.mastercard.com/srci/integration/components/src-ui-kit/src-ui-kit.esm.js"></script>
<link rel="stylesheet"
  href="https://sandbox.src.mastercard.com/srci/integration/components/src-ui-kit/src-ui-kit.css" />
```

The components render their own UI inside Shadow DOM (Mastercard's markup/styles); you only place the
elements and point config at their IDs.

| Component | Who drives it | Purpose |
|-----------|---------------|---------|
| `<src-card-list>` | **SDK** (`cardsEl`) | Saved-card list |
| `<src-otp-input>` | **SDK** (`otpEl`) — or you | OTP entry |
| `<src-consent>` | **You** (read its events) | Consumer consent |
| `<src-loader>` | **You** (show/hide) | Loading spinner |
| `<src-button>` | **You** (optional) | Branded Click to Pay button |

---

## `<src-card-list>` — saved cards (SDK-driven)

Required. Place the element and point `cardsEl` at it:

```html
<src-card-list id="c2p-card-list"></src-card-list>
```
```js
new SpreedlyClickToPay(authDetails, { cardsEl: 'c2p-card-list', /* … */ });
```

The SDK populates it when the saved-card list is ready, wires its selection / "add card" / sign-out
events (calling `setSelectedCard` for you), and pre-selects the first card. Customize it via
[`displayCards`](./configuration.md#5-displaycards--saved-card-list-options) (sign-out link,
preferred-card highlight, add-card link, `radioButton` vs `gridView`).

## `<src-otp-input>` — OTP entry (SDK-driven or your own)

Optional. Two ways to handle the OTP step:

**A — let the SDK drive it (recommended):** place the element and set `otpEl`. On `otp-initiated`
the SDK renders and drives it (channels, resend, continue):
```html
<src-otp-input id="c2p-otp-input"></src-otp-input>
```
```js
new SpreedlyClickToPay(authDetails, { otpEl: 'c2p-otp-input', /* … */ });
```

**B — drive it yourself:** omit `otpEl`, listen for `otp-initiated`, render your own input, and call:
```js
c2p.submitOtp(code);       // submit the entered code
c2p.resendOtp(channelId);  // resend (channelId optional)
```
Either way, watch `otp-response` / `otp-resend` / `otp-not-you` (see [flows.md](./flows.md)).

## `<src-consent>` — consumer consent (you read it)

Renders Mastercard's official "Save my information" + Terms/Privacy copy and marks. **You place it and
read its event**, then forward the consent records to `checkout()`:

```html
<src-consent id="c2p-consent-el" locale="en_US"></src-consent>
```
```js
let complianceResources = [];
document.getElementById('c2p-consent-el')
  .addEventListener('checkoutAsGuest', (e) => {
    complianceResources = e.detail?.complianceResources || [];
  });

// then, at checkout:
await c2p.checkout({
  /* … */
  ...(complianceResources.length ? { complianceSettings: { complianceResources } } : {}),
});
```

`e.detail.complianceResources` is Mastercard's documented consent payload (Terms / Privacy /
Remember-me records). Pass it through as `complianceSettings` — the SDK forwards it verbatim to
Mastercard. Using `<src-consent>` means you don't maintain your own consent copy or links.

## `<src-loader>` — loading spinner (you show/hide)

Optional, cosmetic. Place it (e.g. in a modal overlay) and toggle it during async calls (lookup,
OTP → cards) to mirror Mastercard's "finding your cards":
```html
<src-loader id="c2p-loader" locale="en_US"></src-loader>
```
The SDK doesn't drive it — show it when you start `lookup()` / OTP and hide it on
`display-cards-ready` / `otp-initiated` / `error`.

## `<src-button>` — branded Click to Pay button (optional)

Mastercard's branded button. It renders the Click to Pay + card-brand marks — there's **no text
label**. Useful as your "pay" / "continue" CTA for a more on-brand look.

```html
<src-button id="c2p-pay" card-brands="mastercard,visa,amex,discover" locale="en_US"></src-button>
```

Notable properties: `card-brands` (comma-separated marks to show), `locale`, `dark`, `theme`,
`width`, `height`. Things to know:

- **No `disabled` or loading prop.** Gate it yourself — e.g. a class that sets
  `pointer-events: none; opacity: .5`.
- **No custom click event** — a native `click` listener on the element works (the shadow click
  bubbles to the host):
  ```js
  document.getElementById('c2p-pay').addEventListener('click', pay);
  ```
- **Width is a CSS custom property, not the element box.** The rendered pill is sized by
  `--src-button-width` (the component writes a default inline). To make it full-width:
  ```css
  #c2p-pay { --src-button-width: 100% !important; }
  ```
  (`!important` is needed to beat the component's inline default.)

---

## Checkout presentation: popup vs drawer

Mastercard's **checkout window (DCF)** — where the shopper confirms/enrolls — is **Mastercard-hosted**
(you add nothing to its DOM). You choose how it appears via `checkoutPresentation`:

### Popup (default)
```js
new SpreedlyClickToPay(authDetails, { checkoutPresentation: 'popup', /* … */ });
```
Opens a `window.open` popup (size via `c2pFrameStyle`). Nothing else to build. Subject to popup
blockers.

### Drawer (embedded, no popup)
```js
new SpreedlyClickToPay(authDetails, {
  checkoutPresentation: 'drawer',
  checkoutContainerEl: 'c2p-checkout-host', // the SDK fills this with the checkout iframe
});
```
```html
<!-- your drawer chrome; the SDK only mounts the iframe into #c2p-checkout-host -->
<div id="c2p-checkout-drawer" class="drawer">
  <div class="drawer-panel"><div id="c2p-checkout-host"></div></div>
</div>
```

The SDK mounts the checkout iframe into `checkoutContainerEl` and makes it fill the container. **The
drawer chrome is yours** — panel, backdrop, animation, and opening/closing it:
```js
c2p.on('checkout-window-open', () => document.getElementById('c2p-checkout-drawer').classList.add('open'));
c2p.on('checkout-window-close', () => document.getElementById('c2p-checkout-drawer').classList.remove('open'));
```
If `checkoutContainerEl` can't be resolved, the SDK falls back to a popup.

---

## A note on rendering

`<src-card-list>` and `<src-otp-input>` occasionally render **blank** — a known Mastercard kit
issue tied to lazy-loading / browser WebGL-context exhaustion (many tabs / heavy GPU use). It's
environmental, not your integration; it renders correctly in a clean browser state. If you see an
empty card list or OTP box, check the console for a `src-*` load / WebGL error.
