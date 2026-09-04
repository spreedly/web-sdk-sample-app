# PPCP — Integration Guide

> **Audience:** merchant developers adding PayPal Complete Payments to a checkout page with the
> Spreedly Checkout Web SDK.
> For the exhaustive field-by-field contract, see [`API_REFERENCE.md`](./API_REFERENCE.md).

## Contents

- [Contents](#contents)
- [What this is](#what-this-is)
- [Before you start](#before-you-start)
- [Getting started](#getting-started)
  - [Step 1 — Load the two scripts](#step-1--load-the-two-scripts)
  - [Step 2 — Add a container for the button](#step-2--add-a-container-for-the-button)
  - [Step 3 — Create the instance and mount](#step-3--create-the-instance-and-mount)
  - [What those two callbacks do](#what-those-two-callbacks-do)
  - [Step 4 — Create the order on your backend](#step-4--create-the-order-on-your-backend)
  - [Step 5 — Capture when the buyer returns](#step-5--capture-when-the-buyer-returns)
- [One-time payments](#one-time-payments)
  - [What happens, in order](#what-happens-in-order)
  - [`createOrder` receives the button that was clicked](#createorder-receives-the-button-that-was-clicked)
  - [Do not block inside `createOrder`](#do-not-block-inside-createorder)
  - [Reading the mount result](#reading-the-mount-result)
  - [A bad config throws](#a-bad-config-throws)
  - [When the buyer returns](#when-the-buyer-returns)
  - [Handling approval, cancellation and failure](#handling-approval-cancellation-and-failure)
  - [How the buyer sees PayPal](#how-the-buyer-sees-paypal)
- [Saving a wallet](#saving-a-wallet)
  - [Saving without a payment](#saving-without-a-payment)
  - [Saving while paying](#saving-while-paying)
  - [Charging a saved wallet](#charging-a-saved-wallet)
- [Buttons](#buttons)
  - [Which buttons a buyer sees](#which-buttons-a-buyer-sees)
  - [Appearance](#appearance)
- [Pay Later messaging](#pay-later-messaging)
  - [Adding the message](#adding-the-message)
  - [Options](#options)
  - [Knowing whether it rendered](#knowing-whether-it-rendered)
  - [Thing that catch you out](#thing-that-catch-you-out)
- [Cleaning up and re-mounting](#cleaning-up-and-re-mounting)

---

## What this is

`SpreedlyPPCP` puts PayPal's branded buttons on your checkout page. The buyer approves inside
PayPal's own UI. The money moves through Spreedly's `paypal_commerce_platform` gateway.

**What the SDK does.** It asks PayPal which buttons this buyer is eligible for, renders those
buttons, and drives the approval session when one is clicked. It can also render PayPal's Pay Later
promotional message.

**What the SDK does not do.** It never creates an order, never captures money, and never holds your
Spreedly credentials. Your backend does all of that by calling Spreedly Core's gateway APIs.

**The buttons.** Four kinds exist: `paypal`, `payLater`, `payPalCredit` and `venmo`. Which ones a
given buyer sees is PayPal's decision, not yours — see [Button eligibility](#which-buttons-a-buyer-sees).

**The class.** `SpreedlyPPCP` is standalone. It does not extend the tokenization SDK, and you do not
need a hosted-fields or express-checkout instance to use it. Both bundles define it as
`window.SpreedlyPPCP`.

**The public API is small:**

```ts
new SpreedlyPPCP(config)          // validates synchronously, throws on a bad config
await instance.mount()            // renders the buttons; resolves, never rejects
instance.isMounted()              // boolean
instance.destroy()                // removes everything it added
```

Everything else is configuration and callbacks.

---

## Before you start
You would need: 

**A PayPal client id.** A static, public, browser-safe value. Put it in your page.

**A Spreedly `paypal_commerce_platform` gateway.** Your backend calls it by token.

**Spreedly API credentials on your backend.** Every call is Basic auth:

```
Authorization: Basic base64(<environment_key>:<access_secret>)
Content-Type: application/json
```

**A public `https` return page.** Spreedly validates the `redirect_url` you give it and rejects
anything that is not a public `https` URL — `http://localhost` don't work.


**Two scripts on the checkout page.** PayPal's v6 core script first, then a Spreedly bundle. Load
one PayPal script — the production URL in production, the sandbox URL in sandbox:

```html
<!-- PayPal Web SDK v6 core -->
<script src="https://www.paypal.com/web-sdk/v6/core"></script>
<!-- in sandbox -->
<script src="https://www.sandbox.paypal.com/web-sdk/v6/core"></script>

```


```html
<!-- Hosted Fields bundle -->
<script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>
<!-- OR -->
<!-- Express Checkout bundle -->
<script src="https://core.spreedly.com/checkout/elements/{version}/express-checkout.js"></script>
```

Replace `{version}` with your pinned SDK version. Staging is `core-test.spreedly.com` with the same
paths.

**One thing to get right: amounts have two representations.**

For ex: An amount of $229.98 is represented differently in the SDK and the Spreedly Backend APIs.
| Where | Shape | Example |
|---|---|---|
| `SpreedlyPPCP` config and PayPal | decimal string | `'229.98'` |
| Spreedly Core transactions | integer minor units | `22998` |

---


---

## Getting started

A basic setup that takes a PayPal payment end to end. PayPal button only. Five steps.

### Step 1 — Load the two scripts

PayPal's v6 core script, then a Spreedly bundle. Both must be on the page before you mount.

```html
<script src="https://www.paypal.com/web-sdk/v6/core"></script>
<script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>
```

Details, including the sandbox URLs, are in [Before you start](#before-you-start).

### Step 2 — Add a container for the button

```html
<div id="paypal-button"></div>
```

The SDK renders into elements you provide.

### Step 3 — Create the instance and mount

```js
const ppcp = new SpreedlyPPCP({
  clientId: 'YOUR_PAYPAL_CLIENT_ID',
  environmentKey: 'YOUR_SPREEDLY_ENVIRONMENT_KEY',
  currencyCode: 'USD',
  amount: '229.98',
  countryCode: 'US',

  paymentElements: { paypal: 'paypal-button' },

   // Redirect is used here. See "How the buyer sees PayPal" for the alternatives.
  presentationMode: 'redirect',

  createOrder: async () => {
    const response = await fetch('/api/ppcp/orders', { method: 'POST' });
    const data = await response.json();
    return { orderId: data.id };
  },

  onPaymentResult: result => {
    if (result.state === 'Cancelled') showCancelled(result.orderId);
    if (result.state === 'Failed') showFailed(result.message, result.code);
  },
});

const result = await ppcp.mount();
if (result.error) {
  console.error(result.error);
  hidePayPalSection();
} else {
  console.log(result.rendered); // { paypal: true }
}
```

### What those two callbacks do

**`createOrder`** is how the SDK gets an order to send the buyer to.

It runs when the buyer clicks a button. It must resolve
to `{ orderId }`, where `orderId` is a PayPal order id your backend obtained from Spreedly. **`createOrder`** also receives a `context` argument naming
which button was clicked.

Keep it to a single request. The SDK hands your promise to PayPal **unresolved**, so PayPal's window
opens while your backend is still working. Details in [Keep `createOrder` fast](#do-not-block-inside-createorder).

If it rejects, or throws, `onPaymentResult` fires with `state: 'Failed'` and PayPal's approval never starts.

**`onPaymentResult`** is the single callback for how the payment ended. It is required, and it
replaces the four separate handlers PayPal's SDK has.

It fires with one of three states:

| `state` | Means | Also carries |
|---|---|---|
| `'Successful'` | The buyer approved | `orderId`, and `payerId` when PayPal supplies one |
| `'Cancelled'` | The buyer backed out at PayPal | `orderId` — the order exists, so you can void it |
| `'Failed'` | Something went wrong | `message`, and `code` when PayPal supplies one |

Approval is **not** payment. Your backend still has to capture. Where you do that depends on
`presentationMode`.

This example uses `'redirect'`, which navigates the buyer away from your page. Your page is gone by
the time they approve, so `onPaymentResult` only ever sees `'Cancelled'` and `'Failed'` here —
success is handled on the return page instead, covered in
[The buyer's return](#when-the-buyer-returns). The other modes keep the buyer on your page and give you
`'Successful'` too; see [How the buyer sees PayPal](#how-the-buyer-sees-paypal).

### Step 4 — Create the order on your backend

Two calls to Spreedly, in order.

```js
const SPREEDLY = 'https://core.spreedly.com';
const headers = {
  Authorization: 'Basic ' + Buffer
    .from(`${ENVIRONMENT_KEY}:${ACCESS_SECRET}`).toString('base64'),
  'Content-Type': 'application/json',
};

app.post('/api/ppcp/orders', async (req, res) => {
  const amount = '229.98';
  const currency_code = 'USD';

  // 1. Create the payment method.
  const pm = await axios.post(
    `${SPREEDLY}/v1/payment_methods.json`,
    { payment_method: { payment_method_type: 'paypal' } },
    { headers }
  );
  const paymentMethodToken =
    pm.data?.transaction?.payment_method?.token || pm.data?.payment_method?.token;

  // 2. Create the order on the gateway.
  const txn = await axios.post(
    `${SPREEDLY}/v1/gateways/${GATEWAY_TOKEN}/authorize.json`,
    {
      transaction: {
        payment_method_token: paymentMethodToken,
        amount: Math.round(Number(amount) * 100), // 22998
        currency_code,
        redirect_url: 'https://your-site.example/ppcp/return/',
        retain_on_success: true,
      },
    },
    { headers }
  );

  const transaction = txn.data?.transaction;

  // setup_verification is the PayPal order id. transaction.token is Spreedly's.
  // Store the pair against your own order record — The Capture api mentioned later uses the Spreedly token.
  await saveOrder({
    paypalOrderId: transaction.setup_verification,
    spreedlyTransactionToken: transaction.token,
  });

  res.json({ id: transaction.setup_verification });
});
```

Two fields in that response matter:

- **`setup_verification` is the PayPal order id.** It is what `createOrder` must resolve to.
- **`transaction.token` is Spreedly's own id.** The Capture API addresses this one, not the PayPal order id.
  Store the pair against your order record.

And one you send:

- **`redirect_url` is where Spreedly lands the buyer** after it finalizes. It must be public and
  `https`.

### Step 5 — Capture when the buyer returns

```js
app.post('/api/ppcp/capture/:transactionToken', async (req, res) => {
  const token = req.params.transactionToken;

  const current = await axios.get(
    `${SPREEDLY}/v1/transactions/${token}.json`,
    { headers }
  );
  const authorization = current.data?.transaction;

  if (!authorization?.succeeded) {
    return res.status(409).json({ error: 'Not approved yet', state: authorization?.state });
  }

  const { data } = await axios.post(
    `${SPREEDLY}/v1/transactions/${authorization.token}/capture.json`,
    { transaction: {} },
    { headers }
  );
  const capture = data?.transaction;

  res.json({
    succeeded: capture?.succeeded,
    amount: capture?.amount,               // minor units
    currency_code: capture?.currency_code,
    paypalOrderId: authorization.setup_verification,
    paypalCaptureId: capture?.gateway_transaction_id,
  });
});
```

That is the whole loop. The rest of this guide adds buttons, saving, and the details.

**If you create the order with `purchase.json` instead of `authorize.json`, skip Step 5.**
`authorize.json` holds the funds and needs this capture. `purchase.json` takes the money when
Spreedly finalizes — one leg, nothing left to capture, and calling capture on it fails.

---

## One-time payments

### What happens, in order

```
1. mount()          SDK asks PayPal which buttons are eligible, renders them
2. buyer clicks     SDK calls your createOrder(context), hands the pending promise to PayPal
3. your backend     creates the Spreedly transaction, returns the PayPal order id
4. PayPal           full-page navigation to PayPal; buyer approves
5. Spreedly         finalizes the transaction on its own return leg
6. your return page ?transaction_token=… → your backend captures
```

Step 3 runs *while* PayPal's UI is opening. See [Keep `createOrder` fast](#do-not-block-inside-createorder).

### `createOrder` receives the button that was clicked

```js
createOrder: async context => {
  // context = { payment_method: { payment_method_type: 'paypal' | 'venmo'
  //                                                 | 'paylater' | 'paypal_credit' } }
  const response = await fetch('/api/ppcp/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payment_method_type: walletFor(context),    // 'paypal' | 'venmo'
      transaction_type: 'authorize',              // or 'purchase'
    }),
  });
  const data = await response.json();
  return { orderId: data.id };
}

// Pay Later and PayPal Credit are funding sources on a PayPal account, so they
// transact as paypal. Venmo is the only separate wallet type.
function walletFor(context) {
  return context?.payment_method?.payment_method_type === 'venmo' ? 'venmo' : 'paypal';
}
```
The context parameter is optional. A zero-argument createOrder is valid, and that is enough when every button you offer maps to the same wallet — PayPal, Pay Later and PayPal Credit all transact as paypal. You need it once Venmo is on the page. Venmo is a separate wallet type, so your backend has to create a venmo payment method rather than a paypal one, and the context is the only thing that tells you which button the buyer pressed.

`createOrder` must resolve to exactly `{ orderId: string }`. If it rejects or throws,
`onPaymentResult` fires with `state: 'Failed'`.

### Do not block inside `createOrder`

`createOrder` runs synchronously up to its first `await`, and the SDK opens PayPal's window
immediately after it returns. Anything blocking before that — a `confirm()` dialog, a blocking loop —
delays that call, and the browser can withdraw the click's permission to open a window. The buyer
clicks and nothing happens.

Put confirmations and consent before the buyer clicks the button, not inside the callback. Awaiting a
network request is fine; the window is already open by then.

Same for `createVaultSetupToken`.

---

### Reading the mount result

```js
const result = await ppcp.mount();
```

`mount()` **resolves, never rejects.** A `try/catch` around it catches nothing.

On success you get one boolean per button you asked for, keyed by the same names you used in
`paymentElements`:

```js
{ rendered: { paypal: true, payLater: true, payPalCredit: false } }
```

On failure you get `error` and no `rendered`:

```js
{ error: 'PayPal (PPCP) buttons are already mounted' }
```

The error strings:

| Error | Cause |
|---|---|
| `PayPal (PPCP) buttons are already mounted` | `mount()` called while the instance is already mounted |
| `The PayPal Web SDK v6 (window.paypal.createInstance) is not present on the page. Load https://www.paypal.com/web-sdk/v6/core (sandbox: https://www.sandbox.paypal.com/web-sdk/v6/core) before mounting.` | PayPal's script has not loaded, or something else owns `window.paypal` |
| Whatever PayPal threw | `createInstance` or the eligibility check failed |
| `Failed to mount PayPal (PPCP) buttons` | A non-`Error` was thrown somewhere in the above |

`rendered[kind] === false` is not an error. It means the buyer is ineligible for that funding source,
the container element was not in the DOM, or setting that button up threw. One button failing never
stops the others.

### A bad config throws

The constructor validates synchronously and completely, so a bad config fails on every page load and
surfaces in development. Wrap it so a bad deploy degrades instead of breaking the page:

```js
let ppcp;
try {
  ppcp = new SpreedlyPPCP(config);
} catch (err) {
  showCheckoutUnavailable();
}
```

Every message is listed in the [API reference](./API_REFERENCE.md#constructor-errors).

---

### When the buyer returns

**In `redirect` mode the page navigates away, so `onPaymentResult` never fires on success.** The
outcome arrives on your return page instead. Build your success/failure handling there.

Spreedly finalizes the transaction on its own return leg, then lands the buyer on the `redirect_url` you supplied, with one query parameter appended:

```
https://your-site.example/ppcp/return/?transaction_token=01M0842ZX1SNEKJZ64Q0DP1QXA
```

**That token is the only handle the return page gets.** The PayPal order id is not on the URL. If you need it, look it up from the order record you stored when you created the transaction.

#### The return page code

```js
async function handleReturn() {
  const params = new URLSearchParams(window.location.search);
  const transactionToken = params.get('transaction_token');
  if (!transactionToken) return showNothingToDo();

  // Drop the token from the address bar so a refresh cannot attempt a second capture.
  window.history.replaceState({}, '', window.location.pathname);

  const info = await fetch(`/api/ppcp/transactions/${transactionToken}`).then(r => r.json());

  if (info.transaction_type === 'OffsiteVerification') {
    // The buyer saved a wallet, nothing to capture. See "Saving a wallet without paying".
    const saved = await fetch('/api/ppcp/vault/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionToken }),
    }).then(r => r.json());
    return showWalletSaved(saved.reference);
  }

  const response = await fetch(`/api/ppcp/capture/${transactionToken}`, { method: 'POST' });
  const capture = await response.json();

  if (!response.ok || !capture.succeeded) {
    return showCaptureFailed(capture.error, capture.state);
  }

  // Spreedly amounts are integer minor units.
  showPaid((capture.amount / 100).toFixed(2), capture.currency_code);
}
```

The lookup endpoint is a plain read of the Spreedly transaction:

```js
app.get('/api/ppcp/transactions/:token', async (req, res) => {
  const { data } = await axios.get(
    `${SPREEDLY}/v1/transactions/${req.params.token}.json`,
    { headers }
  );
  const t = data?.transaction;
  res.json({
    token: t?.token,
    transaction_type: t?.transaction_type,   // OffsiteAuthorization | OffsitePurchase | OffsiteVerification
    state: t?.state,
    succeeded: t?.succeeded,
    message: t?.message,
  });
});
```

#### The ids in the capture response

| What | Where it comes from |
|---|---|
| PayPal order id | `authorization.setup_verification` |
| PayPal authorization id | `authorization.gateway_transaction_id` |
| PayPal capture id | `capture.gateway_transaction_id` |
| Payer | `authorization.gateway_specific_response_fields.paypal_commerce_platform.payer` |
| Amount and currency | `capture.amount` (minor units), `capture.currency_code` |


- **Check `transaction_type` before capturing.** Capturing an `OffsitePurchase` is not needed — it is already paid.
---

### Handling approval, cancellation and failure

`onPaymentResult` is the single terminal callback. Three PayPal handlers funnel into it:

| PayPal handler | Becomes |
|---|---|
| `onApprove` | `onPaymentResult({ state: 'Successful', … })` |
| `onCancel` | `onPaymentResult({ state: 'Cancelled', … })` |
| `onError` | `onPaymentResult({ state: 'Failed', … })` |

Two more paths also arrive as `Failed`: anything thrown synchronously in the click handler — your
`createOrder` throwing rather than rejecting, for example — and a rejection from the approval session itself.


```js
onPaymentResult: result => {
  // result.payment_method.payment_method_type is always present:
  // 'paypal' | 'venmo' | 'paylater' | 'paypal_credit'

  switch (result.state) {
    case 'Successful':
      // In redirect mode this does not fire — the page has navigated away.
      // checkout flow → result.orderId, plus result.payerId when PayPal supplies it
      // vault flow    → result.vaultSetupToken
      break;

    case 'Cancelled':
      // result.orderId when PayPal supplied one. No message, no code.
      break;

    case 'Failed':
      // result.message is always a string.
      // result.code is PayPal's stable ERR_* code, when there is one.
      break;
  }
}
```
---

### How the buyer sees PayPal

`presentationMode` decides where PayPal's approval UI opens.

| Value | Behaviour |
|---|---|
| `'auto'` *(default)* | PayPal chooses. |
| `'popup'` | A separate window. |
| `'redirect'` | The whole page navigates to PayPal. |
| `'payment-handler'` | The browser's Payment Handler API. |

`'modal'` is not supported. Passing it throws from the constructor.

All four work for taking a payment. What changes is where your code picks the payment back up.

#### `'redirect'`

The buyer leaves your page and comes back through the return leg, which finalizes the transaction on
the way. Two consequences to design around:

- **`onPaymentResult` never fires on success.** Your page is gone by then. Success is handled on your
  return page — see [The buyer's return](#when-the-buyer-returns).
- **Your page state does not survive.** Persist anything you need — cart contents, order id — before
  the buyer clicks.

#### `'auto'`, `'popup'` and `'payment-handler'`

The approval finishes in the browser and `onPaymentResult` fires on your page with the order id. The
transaction is still pending at this point: it is finalized by the return leg.


```js
onPaymentResult: async (result) => {
  if (result.state !== 'Successful') return;

  const { transaction } = await fetch(`/api/orders/${result.orderId}`).then(r => r.json());

  // Navigate, do not fetch — the browser has to follow the 302 chain the same way a redirect
  // approval would. Nothing after this line runs.
  window.location.assign(
    `https://core.spreedly.com/transaction/${transaction.token}/redirect` +
      `?token=${result.orderId}`
  );
}
```

That lands the buyer on your `redirect_url` with `?transaction_token=`, exactly as a redirect
approval would, and your return page captures from there.

#### Saving a wallet is redirect-only

`flow: 'vault'` requires `'redirect'`. The approval session carries its own return URL, so PayPal
finishes the save by navigating rather than handing a result back to the opener. In a popup the
wallet still vaults — inside the popup — but `onPaymentResult` never fires and your page shows the
buyer nothing.

#### Taking the redirect yourself
By default the SDK sends the buyer to PayPal for you. Add onRedirect and it gives you the URL instead, and you decide when to go.

You'd want this if you need to save something before the buyer leaves, or if a native app has to open the URL rather than the browser

```js
onRedirect: url => {
  sessionStorage.setItem('cart', JSON.stringify(cart));
  window.location.assign(url);
}
```

Adding the callback is what switches the SDK's automatic navigation off. There is no separate setting, so you cannot turn the navigation off and then forget to handle it

Two things to know:
 1. The SDK checks the URL first. It must be https on a paypal.com or venmo.com host. If it isn't, the SDK logs an error and does not call your handler. Nothing else happens — onPaymentResult does not fire, and the buyer is left waiting. So don't put anything the buyer needs behind this callback

2. If your handler throws, the SDK logs it and carries on. Again nothing else happens, and onPaymentResult does not fire.

If you store the URL and navigate to it later check it again at that point. The SDK checks it once, when it hands it to you

---

## Saving a wallet

Three different flows: 

### Saving without a payment

For "add a PayPal to my account". No money moves.

You'll use the `flow: 'vault'` config to initialize the SDK in vault mode. If you're using both one time payments and vaulting, This would be a second, separate `SpreedlyPPCP` instance with `flow: 'vault'`. Do not try to make one instance do both.

#### Set up the save button

 ```html
  <div id="save-paypal-button"></div>
  ```

```js
const vault = new SpreedlyPPCP({
  clientId: 'YOUR_PAYPAL_CLIENT_ID',
  environmentKey: 'YOUR_SPREEDLY_ENVIRONMENT_KEY',
  currencyCode: 'USD',
  countryCode: 'US',
  flow: 'vault',

  paymentElements: { paypal: 'save-paypal-button' },

  // Must be 'redirect' in this flow. See "How the buyer sees PayPal".
  presentationMode: 'redirect',

  createVaultSetupToken: async () => {
    const res = await fetch('/api/ppcp/vault/setup', { method: 'POST' }).then(r => r.json());
    if (!res.approval_session_id) {
      throw new Error('Spreedly did not return an approval session.');
    }
    return { setupToken: res.approval_session_id };
  },

  onPaymentResult: result => {
    // Cancelled and Failed only. Success lands on the return page.
    if (result.state === 'Cancelled') showSaveCancelled();
    if (result.state === 'Failed') showSaveFailed(result.message);
  },
});

await vault.mount();   // rendered === { paypal: true }
```

`flow: 'vault'` changes these things:

- The constructor requires `createVaultSetupToken` and ignores `createOrder` (if provided).
- Only the `paypal` button is mounted. `venmo`, `payLater` and `payPalCredit` entries in
  `paymentElements` are dropped silently — they do not appear in `rendered` at all, not even as
  `false`.
- Eligibility is asked with a save intent instead of an amount. `amount` is never sent.
- Pay Later messaging is suppressed. There is no purchase to promote financing against.
- Your `{ setupToken }` is handed to PayPal as `{ vaultSetupToken }`. The SDK does the rename.

#### Start the approval session

```js
app.post('/api/ppcp/vault/setup', async (req, res) => {
  // retained: true, so the payment method survives the verification.
  const pm = await axios.post(
    `${SPREEDLY}/v1/payment_methods.json`,
    { payment_method: { payment_method_type: 'paypal', retained: true } },
    { headers }
  );
  const paymentMethodToken =
    pm.data?.transaction?.payment_method?.token || pm.data?.payment_method?.token;

  const verify = await axios.post(
    `${SPREEDLY}/v1/gateways/${GATEWAY_TOKEN}/verify.json`,
    {
      transaction: {
        payment_method_token: paymentMethodToken,
        redirect_url: 'https://your-site.example/ppcp/return/',
        retain_on_success: true,
        gateway_specific_fields: {
          paypal_commerce_platform: {
            application_context: {
              brand_name: 'Your Store',
              shipping_preference: 'NO_SHIPPING',
              user_action: 'CONTINUE',
            },
          },
        },
      },
    },
    { headers }
  );

  const transaction = verify.data?.transaction;
  const checkoutUrl = transaction?.checkout_url || transaction?.response?.checkout_url;

  if (!checkoutUrl) {
    return res.status(502).json({ error: 'Spreedly did not return a checkout_url' });
  }

  // The approval session id is a query parameter on the checkout URL.
  const approvalSessionId = new URL(checkoutUrl).searchParams.get('approval_session_id');
  if (!approvalSessionId) {
    return res.status(502).json({ error: 'No approval_session_id on the checkout URL' });
  }

  await saveVaultAttempt({ transactionToken: transaction.token, paymentMethodToken });

  res.json({
    approval_session_id: approvalSessionId,
    transaction_token: transaction.token,      // transaction_type: OffsiteVerification
  });
});
```

`application_context` shapes PayPal's approval page. `brand_name` is the store name the buyer sees
there. `shipping_preference: 'NO_SHIPPING'` stops PayPal asking for a shipping address — nothing is
being shipped. `user_action: 'CONTINUE'` sets the wording on PayPal's final button; this is a save,
not a payment. None of it is what makes the save work.

`approval_session_id` is what `createVaultSetupToken` returns as `setupToken`. Handing it to PayPal's
save session is what gives the buyer a real PayPal button rather than a bare link. Fail loudly if it
is missing — an empty `setupToken` produces an opaque PayPal error at click time.

**`retain_on_success: true` is what keeps the wallet usable.** Without it the payment method ends up
in `storage_state: 'used'` and cannot be charged again. `retained: true` on the payment method sets
it retained from creation, before any transaction runs; send both and the wallet is retained either
way.

#### Record the saved wallet

The return page sees `transaction_type === 'OffsiteVerification'` and posts the token here. Spreedly
has already finalized the verification by then, so this only reads the result back.

```js
app.post('/api/ppcp/vault/complete', async (req, res) => {
  const { transactionToken } = req.body;

  const after = await axios.get(
    `${SPREEDLY}/v1/transactions/${transactionToken}.json`,
    { headers }
  );
  const transaction = after.data?.transaction;
  if (!transaction?.succeeded || !transaction.payment_method?.token) {
    return res.status(502).json({ error: 'Verification did not succeed', state: transaction?.state });
  }

  // Re-read the payment method. The payment_method inside a transaction response is a
  // snapshot from when the transaction was created — before approval — so its reference
  // is still null there.
  const pm = await axios.get(
    `${SPREEDLY}/v1/payment_methods/${transaction.payment_method.token}.json`,
    { headers }
  );
  const paymentMethod = pm.data?.payment_method;

  // A wallet counts as vaulted only once it has a vault# reference.
  if (!paymentMethod?.reference?.startsWith('vault#')) {
    return res.status(502).json({ error: 'Succeeded but no vault reference' });
  }

  await saveWalletForCustomer({
    paymentMethodToken: paymentMethod.token,     // this is what you charge later
    reference: paymentMethod.reference,          // display and reconciliation only
    storageState: paymentMethod.storage_state,
  });

  res.json({ status: 'SUCCESS', reference: paymentMethod.reference });
});
```

**Store `payment_method.token`.** That is the handle you charge. The `vault#…` reference is a display
value.

#### Venmo

Venmo takes payments like any other button. It is a distinct wallet: your backend creates the
transaction with `payment_method_type: 'venmo'`, and `createOrder` tells you which button was
pressed so you can send the right one.

Venmo cannot be saved **without** a payment. `flow: 'vault'` renders the PayPal button only, and a
`venmo` entry in `paymentElements` is dropped. To save a Venmo, save it while paying.

Venmo is US-only and needs `venmoSandbox: true` while you are testing.

---

### Saving while paying

One offsite flow that pays and saves. It is [Taking a payment](#one-time-payments) with two additions,
and **both must be present.**

**Browser** — add `savePayment: true`:

```js
const ppcp = new SpreedlyPPCP({
  clientId: 'YOUR_PAYPAL_CLIENT_ID',
  currencyCode: 'USD',
  amount: '229.98',
  paymentElements: { paypal: 'paypal-button' },
  presentationMode: 'redirect',
  savePayment: true,          // tells PayPal this purchase also saves, so the buyer is asked
  createOrder,
  onPaymentResult,
});
```

**Backend** — add the vault block to the same `authorize.json` / `purchase.json` transaction:

```js
{
  transaction: {
    payment_method_token: paymentMethodToken,
    amount: 22998,
    currency_code: 'USD',
    redirect_url: 'https://your-site.example/ppcp/return/',
    retain_on_success: true,
    gateway_specific_fields: {
      paypal_commerce_platform: {
        vault: { store_in_vault: 'ON_SUCCESS', usage_type: 'MERCHANT' },
      },
    },
  },
}
```

`ON_SUCCESS` means the wallet is vaulted only if the payment goes through. `usage_type: 'MERCHANT'`
is what makes a later merchant-initiated charge permitted — that decision is made here, not at charge
time.

Everything else is identical: same `createOrder`, same return page, same capture.

#### Things to get right

- **The two settings must agree.** `savePayment: true` alone gets the buyer's consent at PayPal but
  vaults nothing. The `gateway_specific_fields.vault` block alone vaults without asking the buyer.
  Send both or neither.
- **`savePayment` is fixed at mount time.** It is read into the payment-session options when the
  buttons are created. Flipping a "save my PayPal" checkbox after mounting has no effect. To honour a
  change, `destroy()` the instance, then construct and `mount()` a new one.
- **Confirm what was actually vaulted.** `ON_SUCCESS` saves nothing if the payment fails, and PayPal
  can decline the save on its own. After the capture, re-read the payment method by token and check
  for a `vault#…` reference — exactly as in the vault-without-payment flow. Report that, not what the
  checkbox asked for.

---

### Charging a saved wallet

Backend only. No browser, no PayPal button, no SDK, no redirect, no return page. One call, and the
result is final and synchronous.

```js
app.post('/api/ppcp/charge', async (req, res) => {
  const { paymentMethodToken, amount, currency_code, buyerPresent } = req.body;

  const { data } = await axios.post(
    `${SPREEDLY}/v1/gateways/${GATEWAY_TOKEN}/purchase.json`,
    {
      transaction: {
        payment_method_token: paymentMethodToken,
        amount: Math.round(Number(amount) * 100),
        currency_code,
        stored_credential_initiator: buyerPresent ? 'cardholder' : 'merchant',
        stored_credential_reason_type: buyerPresent ? 'unscheduled' : 'recurring',
      },
    },
    { headers }
  );

  const transaction = data?.transaction;
  res.json({
    succeeded: !!transaction?.succeeded,
    state: transaction?.state,
    message: transaction?.message,
    gatewayTransactionId: transaction?.gateway_transaction_id,
  });
});
```

The two cases differ only in that pair of fields:

| Case | `stored_credential_initiator` | `stored_credential_reason_type` |
|---|---|---|
| **Buyer present** — return buyer, one click at checkout | `cardholder` | `unscheduled` |
| **Buyer absent** — recurring, merchant-initiated | `merchant` | `recurring` |

#### Things to get right

- **Charge with the Spreedly `payment_method_token`, not the `vault#…` reference.** Spreedly resolves
  the PayPal vault id itself.
- **`purchase.json`, not `authorize.json`.** There is no second leg. The money moves on this call.
- **No `redirect_url`.** This is not an offsite transaction. Sending one does not make it one.
- **Minor units again.** `'10.00'` → `1000`.
- **A merchant-initiated charge depends on `usage_type: 'MERCHANT'`** having been set when the wallet
  was vaulted. If it was not, this call is where you find out.

---

## Buttons

### Which buttons a buyer sees

You ask for buttons in `paymentElements`. PayPal decides which of them a given buyer actually sees.
`mount()` reports the outcome in `rendered`.

```js
paymentElements: {
  paypal:       'paypal-button',
  venmo:        'venmo-button',
  payLater:     'paylater-button',
  payPalCredit: 'paypalcredit-button',
}
```

```js
{ rendered: { paypal: true, venmo: true, payLater: true, payPalCredit: false } }
```

Only the kinds you asked for appear as keys. Ask for `paypal` and `payLater` and you get those two,
not all four. In `flow: 'vault'` you only ever get `paypal`, whatever you configured.

#### Why a button may not render

1. PayPal reported that funding source isn't available. Eligibility depends on your PayPal account's configuration, the buyer's country, the currency, the amount etc. A button that never renders for anyone can mean your account isn't enabled for it.
2. The container element id does not exist in the DOM.
3. Setting that button up threw, logged as `Failed to set up <kind> button`.

All three are logged. Check your element ids first — a typo looks exactly like ineligibility.

**Pay Later needs `amount`.** Its eligibility is amount-banded. With no `amount`, PayPal cannot
evaluate the thresholds and filters it out. It fails silently: no error, no warning, `rendered.payLater`
is just `false`.

**Pay Later and PayPal Credit are mutually exclusive.** PayPal returns one or the other, never both,
and Pay Later wins when both are requested. If you want PayPal Credit, leave `payLater` out of
`paymentElements` entirely.

**Pay Later renders for some carts and not others.** Expected. The thresholds are amount-based.

**`amount` never charges anything.** It goes to the eligibility check and to the Pay Later message.
The charged amount is the one in your Spreedly transaction. If the two disagree, the buyer is charged
the Spreedly figure while eligibility was decided on the other — keep them in step.

**Eligibility is scoped to what you ask for.** The SDK requests exactly the buttons in
`paymentElements`.

#### Re-checking eligibility when the cart changes

`amount` is read at mount time. To have eligibility re-evaluated for a new total:

```js
ppcp.destroy();
ppcp = new SpreedlyPPCP({ ...config, amount: newTotal });
await ppcp.mount();
```

`mount()` refuses to run while an instance is already mounted. The new instance is what carries the
new `amount` — it is set in the constructor and cannot be changed after. `destroy()` on the old
instance removes its buttons and detaches PayPal's learn-more handler.

---

### Appearance

```js
buttonStyle: {
  label: 'checkout',           // 'checkout' | 'pay' | 'buynow' | 'subscribe' | 'donate'
  color: 'blue',               // 'gold' | 'blue' | 'white' | 'black'
  paypalBorderRadius: '4px',   // any CSS length
  venmoBorderRadius: '9999px',
}
```

**`label` applies to the PayPal and Venmo buttons only.** Pay Later and PayPal Credit take a product
code and country code from PayPal's eligibility response instead, and have no label control. The
Venmo button gets `'pay'` when you leave `label` unset; the PayPal button gets no label attribute at
all.

**`color` becomes a CSS class on the button element,** prefixed by button family: `paypal-<color>`
for PayPal, Pay Later and PayPal Credit, `venmo-<color>` for Venmo. PayPal's component styles itself
from that class.

**The two radius properties are separate** because PayPal's PayPal-family and Venmo buttons read two
different CSS custom properties — `--paypal-button-border-radius` and `--venmo-button-border-radius`.
The SDK sets both on every button it renders; each component reads only the one that matches it. Set
either, both, or neither.

The buttons are PayPal's own web components. Beyond these four options, style the container element
around them.

---

## Pay Later messaging

The "as low as $28/mo" placement. It advertises financing **before** the buyer reaches a button, so
it belongs next to a price on a product or cart page — not down beside the buttons.

It is not a button. No session, no click handler, no eligibility check. PayPal alone decides whether
to show a message and what it says. An empty placement is a normal outcome.

### Adding the message

```html
<div class="price">$229.98</div>
<div id="paylater-message"></div>
```

```js
const ppcp = new SpreedlyPPCP({
  clientId: 'YOUR_PAYPAL_CLIENT_ID',
  currencyCode: 'USD',
  amount: '229.98',
  countryCode: 'US',

  paymentElements: { paypal: 'paypal-button', payLater: 'paylater-button' },

  payLaterMessaging: {
    elementId: 'paylater-message',
    logoType: 'WORDMARK',
    textColor: 'BLACK',
    fontSize: '14px',
    textAlign: 'center',
    onContentReady: content => {
      // PayPal has returned content. This is when something is actually on the page.
    },
  },

  presentationMode: 'redirect',
  createOrder,
  onPaymentResult,
});

const result = await ppcp.mount();
result.messagingRendered;   // reported separately from result.rendered
```

`mount()` renders the buttons and the message together. There is no separate call.

### Options

| Option | Type | Notes |
|---|---|---|
| `elementId` | `string` | **Required.** The element to render into. |
| `amount` | `string` | The figure the offer is calculated from. Defaults to `PPCPConfig.amount`. |
| `logoType` | `string` | Passed straight to PayPal. |
| `logoPosition` | `string` | Passed straight to PayPal. |
| `textColor` | `string` | Passed straight to PayPal. |
| `messageLength` | `string` | Passed straight to PayPal. |
| `alternativePrefix` | `string` | Passed straight to PayPal. |
| `offerTypes` | `string[] \| string` | Restrict which offers may be promoted. An array is joined with commas. |
| `presentationMode` | `string` | How the "learn more" terms open. Passed straight to PayPal. |
| `fontSize` | `string` | Any CSS length. Sets `--paypal-message-font-size`. |
| `textAlign` | `string` | Any CSS value. Sets `--paypal-message-text-align`. |
| `onReady` | `() => void` | Fires together with `onContentReady`. |
| `onContentReady` | `(content) => void` | PayPal returned content. |

The seven pass-through options are not validated or narrowed by the SDK. Six are typed `string`;
`offerTypes` is `string[] | string`. PayPal owns those values, validates them, and can add more.
Falsy values are skipped. An unrecognised value is PayPal's problem to report, not an SDK error.

`presentationMode` here is not the presentationMode for Paypal checkout. This one controls how the financing
terms open; that one controls the payment approval UI. Different surfaces, similar words.

**Set `presentationMode` if you want the learn-more link to work.** The SDK attaches PayPal's default
learn-more listener only when this option is set. Leave it unset and no listener is attached.

### Knowing whether it rendered

`result.messagingRendered` only tells you the element was **appended**. It does not mean PayPal
returned anything to show.

`onContentReady` is the real signal. `onReady` fires at the same moment, not earlier — PayPal invokes
one callback, so the SDK fires both from there.

`messagingRendered: false` means the SDK could not append the element. Three things cause it: the
`elementId` is not on the page, `createPayPalMessages` is missing from the PayPal SDK instance, or
setup threw. All three are logged. None of them stops checkout, and the buttons still render. It is
never `false` because PayPal returned nothing — in that case it stays `true`.

### Thing that catch you out

**It is ignored in `flow: 'vault'`.** There is no purchase to promote financing against, so
`messagingRendered` is absent from the mount result entirely.

---

## Cleaning up and re-mounting

```js
ppcp.destroy();
```

`destroy()` removes every element the SDK appended — the buttons and the Pay Later message — detaches
PayPal's learn-more listener, and resets the instance. It is safe to call when nothing is mounted.
After it, `mount()` can run again.

**You must call it before re-mounting.** PayPal registers its learn-more click handler on `window`,
not on the message element, so removing the element does not remove the handler. Mount twice without
`destroy()` in between and both handlers stay bound — one click then opens two learn-more windows.

The sequence is always:

```js
ppcp.destroy();
await ppcp.mount();
```

`isMounted()` tells you where you are: `false` before the first successful `mount()`, and after
`destroy()`.
