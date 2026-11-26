# Apple Pay — Integration Guide

> **Preview.** Apple Pay in Spreedly's checkout SDK is in final testing and not yet released, so no published SDK version includes it yet. Method names, options and behaviour may change before release. Payments have been tested end to end in desktop Chrome with an iPhone scanning Apple's code and in Safari on a Mac; testing in Safari on iPhone is in progress.

This guide shows how to add an Apple Pay button to your checkout with Spreedly's checkout SDK. The
SDK checks whether the shopper can pay with Apple Pay, draws Apple's own button, runs Apple's
payment sheet, and sends Apple's encrypted payment data to Spreedly. You get back a **Spreedly
payment method token**, which your server charges like any other Spreedly token.

Your page never sees card details. Apple encrypts the payment data so that only Spreedly can
decrypt it, and the SDK passes it to Spreedly without opening it.

Every method, option, event and error code is listed in the [API reference](./API_REFERENCE.md).

## What you'll need

- An **Apple Developer account**, with someone who has the Account Holder or Admin role. Only those
  roles can set up Apple Pay on the web.
- A **Spreedly environment** with an access secret, for the one-time certificate setup and for
  charging from your server.
- A **Spreedly signing certificate**, with its token and private key, so your server can sign auth
  details. If you already use the Hosted Fields card form with signed auth, you have one. If not,
  create one as described in Spreedly's
  [security guide](https://developer.spreedly.com/docs/using-certificates-iframe-security).
- **Secure tokenization turned on** for your Spreedly environment, in the Spreedly app: under
  **Security → Enhanced Security**, check **Enable secure tokenization**. Until you do, Spreedly
  doesn't check the signed auth details. See Spreedly's
  [Securing iFrame or Checkout SDK](https://developer.spreedly.com/docs/securing-iframe).
- A **Spreedly gateway** that supports Apple Pay.
- An **HTTPS website** on a domain you control. Apple only allows Apple Pay on pages served over
  HTTPS, and you have to prove to Apple that you control the domain.
- **Two server endpoints** on your side: one that asks Apple for a merchant session, and one that
  signs Spreedly auth details. Both are described in [step 2](#2-add-the-two-server-endpoints).

Apple Pay takes some setup with Apple: you register a Merchant ID and your domains, renew two
certificates every 25 months, and your server calls Apple each time a shopper opens the sheet.

## How the pieces fit

| Piece | What it does |
|---|---|
| Apple's `apple-pay-sdk.js` | Apple's script. You load it on your page. It provides the `<apple-pay-button>` element and, in browsers other than Safari, the QR code the shopper scans with an iPhone. |
| `SpreedlyApplePay` | The SDK class you use: `on()`, `mount()`, `setTotal()` and `destroy()`. |
| Your merchant validation endpoint | Asks Apple for a merchant session each time the sheet opens, using your Merchant Identity Certificate. |
| Your auth endpoint | Signs a fresh set of Spreedly auth details each time the shopper approves a payment. |
| Spreedly | Decrypts Apple's payment data with your Payment Processing Certificate's private key and creates the payment method. |
| Your server | Charges the payment method token through your gateway. |

A payment goes like this:

1. The shopper taps the button. The SDK opens Apple's sheet at once, before any of your code can
   run (see the note below).
2. Apple asks for a merchant session. The SDK calls your `onValidateMerchant`, which calls your
   merchant validation endpoint.
3. The shopper approves with Face ID, Touch ID or their iPhone.
4. The SDK calls your `getAuthDetails`, then sends Apple's encrypted payment data to Spreedly, which
   creates the payment method.
5. The SDK tells Apple the payment succeeded and gives you the token in `applePayTokenGenerated`.
   If you use `processPayment`, the SDK first waits for your charge and tells Apple its real result
   ([step 4](#4-optional-charge-while-the-sheet-is-open)).

> **Nothing can run between the tap and the sheet.** Apple only lets a page start a payment while
> the browser is still handling the tap, so the SDK builds the payment request from what it already
> has. Keep the amount current with `setTotal()` whenever the cart changes, before the tap.

---

## 1. Set up Apple Pay with Apple and Spreedly

You do this once per Merchant ID, then again whenever a certificate is due for renewal. Apple's
portal is at [developer.apple.com/account](https://developer.apple.com/account), under
**Certificates, Identifiers & Profiles**.

### 1.1 Create a Merchant ID

Go to **Identifiers**, click **+**, choose **Merchant IDs**, and register an identifier in
reverse-domain form, for example `merchant.com.example`. A Merchant ID never expires, and most
merchants use one for all environments, websites and apps. Your certificates only work with the
Merchant ID they were created for.

### 1.2 Create the Payment Processing Certificate through Spreedly

Apple encrypts every payment with this certificate's public key, and Spreedly decrypts it with the
private key. Spreedly creates the key pair and keeps the private key, so you only carry the
certificate signing request (CSR) to Apple and the signed certificate back.

1. Ask Spreedly for a CSR. Use your server-side credentials (environment key and access secret):

   ```bash
   curl https://core.spreedly.com/v1/certificates/generate.xml \
     -u "$SPREEDLY_ENVIRONMENT_KEY:$SPREEDLY_ACCESS_SECRET" \
     -H 'Content-Type: application/xml' \
     -d '<certificate>
           <algorithm>ec-prime256v1</algorithm>
           <cn>Example Shop Apple Pay</cn>
           <email_address>payments@example.com</email_address>
         </certificate>'
   ```

   Save two values from the response: `token`, which is your Spreedly certificate token, and `csr`,
   which is the CSR in PEM form. Copy the `csr` value, including the `BEGIN` and `END` lines, into
   a file such as `csr.pem`.

2. In Apple's portal, open your Merchant ID and, under **Apple Pay Payment Processing
   Certificate**, create a certificate. Apple may first ask you to accept an agreement. When the
   portal asks whether payments are processed exclusively in mainland China, answer No: Spreedly's
   CSR uses an ECC key, which Apple requires outside mainland China. Upload `csr.pem` and download
   the signed certificate.

3. Apple's download is usually in binary (DER) form, and Spreedly expects PEM text. A PEM file
   starts with `-----BEGIN CERTIFICATE-----` (check with `head -1 apple_pay.cer`). If it doesn't,
   convert it:

   ```bash
   openssl x509 -inform der -in apple_pay.cer -out apple_pay.pem
   ```

4. Upload the PEM to Spreedly, using the certificate token from step 1:

   ```bash
   curl https://core.spreedly.com/v1/certificates/CERTIFICATE_TOKEN.xml \
     -u "$SPREEDLY_ENVIRONMENT_KEY:$SPREEDLY_ACCESS_SECRET" \
     -X PUT \
     -H 'Content-Type: application/xml' \
     --data-binary @- <<EOF
   <certificate>
     <pem><![CDATA[$(cat apple_pay.pem)]]></pem>
   </certificate>
   EOF
   ```

   The response shows the certificate in `pem`, which was empty before.

5. Read the warning below, then go back to Apple's portal and **activate** the certificate.

> **Before you activate.** A Merchant ID has only one active Payment Processing Certificate, and
> activation can't be undone. If this Merchant ID already takes Apple Pay payments, for example in
> an iOS app or through another payment provider, activating Spreedly's certificate stops those
> payments from being decrypted. Use a separate Merchant ID for Spreedly, or move everything that
> uses the Merchant ID to this certificate first.

Apple doesn't switch every payment to the new key at once. For a while after activation, some
payments are still encrypted with the previous certificate's key. In Spreedly's own test, Apple took
about an hour and a half to switch over.

#### Using more than one Spreedly environment

Spreedly looks up the certificate in the environment that receives the payment, and a payment
encrypted for a certificate that environment doesn't hold fails with
`errors.apple_pay.certificate_not_found`. A certificate generated in one Spreedly environment is
held by that environment, and a Merchant ID has only one active certificate. So use a separate
Merchant ID for each Spreedly environment, for example one for testing and one for production.

### 1.3 Create the Merchant Identity Certificate

This certificate is yours, not Spreedly's. Your server presents it to Apple when it asks for a
merchant session. It's needed only for Apple Pay on the web, and Apple requires a 2048-bit RSA key.

1. Create a key and CSR on a machine you trust, and keep the key secret:

   ```bash
   openssl req -new -newkey rsa:2048 -nodes \
     -keyout merchant_identity.key -out merchant_identity.csr \
     -subj '/CN=merchant.com.example'
   ```

2. In Apple's portal, open your Merchant ID and, under **Apple Pay Merchant Identity Certificate**,
   create a certificate from `merchant_identity.csr`. Download it.

3. If the download is in binary (DER) form, convert it to PEM:

   ```bash
   openssl x509 -inform der -in merchant_id.cer -out merchant_identity.pem
   ```

4. Store `merchant_identity.pem` and `merchant_identity.key` with your other server secrets. Never
   put the key in your web page or your repository.

A Merchant ID can have up to three active Merchant Identity Certificates at once, so you can
create and test a new one before you revoke the old one. Revoking a certificate that is still in
use breaks Apple Pay at once.

### 1.4 Register and verify your domains

Apple only shows the sheet on domains registered to your Merchant ID. Register every domain and
subdomain that shows the button; Apple treats `www.example.com` and `example.com` as different
domains.

1. In Apple's portal, open your Merchant ID, go to **Merchant Domains**, click **Add Domain** and
   enter the domain without `https://`.
2. Download the verification file and serve it from that domain at the path the portal shows:
   `/.well-known/apple-developer-merchantid-domain-association`, with or without `.txt` at the end.
   Apple's own pages disagree on the extension, so use exactly what the portal shows. If you're not
   sure, serve the same file at both paths.
3. Click **Verify**.

The file has to come back as `200 OK` over HTTPS, unchanged, with no redirect, login or
TLS-terminating proxy in front of it. A downloaded file is valid for seven days, and downloading a
new one invalidates the old one.

The verification lasts until your domain's SSL certificate expires. Apple re-checks the domain 30,
15 and 7 days before that date, and the domain stays verified when the renewed SSL certificate is
in place, the verification file and the domain's root page both return `200 OK`, and the new
certificate has the same certificate chain as the old one. If you change certificate authority,
verify the domain again with a new file.

### 1.5 Check Apple's rules for your site

Before going live, read Apple's
[Acceptable Use Guidelines for Apple Pay on the Web](https://developer.apple.com/support/terms/apple-pay-acceptable-use-guidelines-for-websites/).
Among other things, Apple requires a privacy statement on your site, requires Apple Pay to be
offered with at least the same prominence as any other third-party payment method on the same page,
and doesn't allow Apple Pay for some kinds of goods.

---

## 2. Add the two server endpoints

### 2.1 Merchant validation

Each time the shopper opens the sheet, Apple needs a fresh merchant session from your server. The
SDK calls your `onValidateMerchant({ validationURL })`, where `validationURL` is the Apple URL from
Apple's `onvalidatemerchant` event. Your page sends it to your server, and your server:

1. checks that the URL is HTTPS and that its host is one of Apple's validation hosts, and rejects
   anything else;
2. sends a `POST` to that URL over mutual TLS, presenting your Merchant Identity Certificate and
   key;
3. returns Apple's JSON response to the page unchanged.

Apple lists its validation hosts on
[Setting Up Your Server](https://developer.apple.com/documentation/applepayontheweb/setting-up-your-server)
and asks you to allow only those. At the time of writing they are `apple-pay-gateway.apple.com` and
`cn-apple-pay-gateway.apple.com` for production, and `apple-pay-gateway-cert.apple.com` and
`cn-apple-pay-gateway-cert.apple.com` for sandbox testing only.

Using the host from `validationURL` matters for testing. Since 1 October 2026, a device signed in to
an Apple sandbox tester account must get its merchant session from Apple's sandbox, and a normal
device from production. `validationURL` already points to the right one.

The request body has four fields:

| Field | Value |
|---|---|
| `merchantIdentifier` | Your Merchant ID, for example `merchant.com.example`. It must be the Merchant ID your Merchant Identity Certificate belongs to. |
| `displayName` | Your store's name, 64 characters or fewer. Keep it the same every time: no order numbers, no translations. |
| `initiative` | `"web"` |
| `initiativeContext` | The domain in the shopper's address bar, exactly, with subdomain but without `https://` or a path, for example `shop.example.com`. It must be a domain you verified in step 1.4. |

An example in Node.js:

```js
import https from 'node:https';
import { readFileSync } from 'node:fs';

const APPLE_VALIDATION_HOSTS = new Set([
  'apple-pay-gateway.apple.com',
  'cn-apple-pay-gateway.apple.com',
  // Sandbox testing only. Remove these in production.
  'apple-pay-gateway-cert.apple.com',
  'cn-apple-pay-gateway-cert.apple.com',
]);

const identity = {
  cert: readFileSync(process.env.APPLE_PAY_IDENTITY_CERT_PATH), // merchant_identity.pem
  key: readFileSync(process.env.APPLE_PAY_IDENTITY_KEY_PATH), // merchant_identity.key
};

export function requestMerchantSession(validationURL) {
  const url = new URL(validationURL);
  if (url.protocol !== 'https:' || !APPLE_VALIDATION_HOSTS.has(url.hostname)) {
    return Promise.reject(new Error('Not an Apple Pay validation URL'));
  }

  const body = JSON.stringify({
    merchantIdentifier: 'merchant.com.example',
    displayName: 'Example Shop',
    initiative: 'web',
    initiativeContext: 'shop.example.com',
  });

  return new Promise((resolve, reject) => {
    const request = https.request(
      url,
      {
        method: 'POST',
        cert: identity.cert,
        key: identity.key,
        headers: { 'Content-Type': 'application/json' },
        timeout: 15000, // idle time on the socket, not a limit on the whole request
      },
      response => {
        let data = '';
        response.on('data', chunk => (data += chunk));
        response.on('end', () => {
          if (response.statusCode !== 200) {
            reject(new Error(`Apple returned ${response.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error('Apple returned a response that is not JSON'));
          }
        });
      }
    );
    request.on('timeout', () => request.destroy(new Error('Apple did not answer in time')));
    request.on('error', reject);
    request.end(body);
  });
}
```

Wire it to a route your page can call, for example `POST /api/apple-pay/validate` with
`{ validationURL }` in the body, and return the session object as JSON.

`initiativeContext` must match the page the shopper is on. If you show Apple Pay on more than one
domain, choose the value on your server from your list of verified domains, for example by
checking the request's `Host` header against that list. Don't pass through a domain the page sends
without checking it.

- A merchant session works once and expires five minutes after Apple creates it. Never cache or
  reuse one.
- Treat the session as opaque: return it unchanged, as an object, and don't log it.
- The SDK gives `onValidateMerchant` 20 seconds. If it hasn't resolved by then, the sheet closes
  and you get `MERCHANT_VALIDATION_TIMEOUT`, so keep your server's timeout below that.
- Apple's most common answers when something is wrong: `400` when the body is empty or misses a
  field, or `merchantIdentifier` doesn't match your certificate; `404` when the request didn't go to
  the exact `validationURL`; `417` when the Merchant ID isn't registered for Apple Pay or
  `initiativeContext` isn't a verified domain; and `500` when the body isn't valid JSON.

### 2.2 Auth details

Apple Pay uses Spreedly's signed auth details, the same ones Spreedly's card fields use: `environment_key`,
`certificate_token`, `nonce`, `timestamp` and `signature`. Your server signs `nonce + timestamp +
certificate_token` with the private key of your own Spreedly signing certificate, as described in
Spreedly's [security guide](https://developer.spreedly.com/docs/using-certificates-iframe-security).
That signing certificate is a different one from the Apple Pay Payment Processing Certificate in
step 1.2. In Node.js:

```js
import crypto from 'node:crypto';

// signingKey: your Spreedly signing certificate's private key (PEM), kept on the server.
export function createAuthDetails({ environmentKey, certificateToken, signingKey }) {
  const nonce = crypto.randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .sign('sha256', Buffer.from(nonce + timestamp + certificateToken), signingKey)
    .toString('base64');
  return {
    environment_key: environmentKey,
    certificate_token: certificateToken,
    nonce,
    timestamp,
    signature,
  };
}
```

Serve it at a route such as `GET /api/spreedly/auth-params`. The page's `getAuthDetails` must
resolve with these five fields.

The SDK calls your `getAuthDetails` each time the shopper approves a payment, including a second
approval in the same sheet after a failure. Return a new set every time. Spreedly accepts each
nonce once, and a nonce is used up even when the request fails, so a reused set fails with
`errors.replayed_tokenization_nonce`. A set is also only valid for 30 minutes after its
`timestamp`.

---

## 3. Add Apple Pay to your page

These steps use the Hosted Fields bundle. Express Checkout has the same class and also an
`applePay` option; see [Apple Pay in Express Checkout](#apple-pay-in-express-checkout).

### 3.1 Load the scripts

```html
<script crossorigin="anonymous"
  src="https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js"></script>

<script src="https://core.spreedly.com/checkout/sdk/{version}/index.js"></script>
<!-- or Express Checkout: https://core.spreedly.com/checkout/elements/{version}/express-checkout.js -->
```

Replace `{version}` with your SDK version.

The SDK doesn't load Apple's script for you. Apple
recommends the `1.latest` build, which Apple keeps up to date, and recommends loading it in
`<head>`. Apple also publishes fixed versions with integrity hashes; use the `integrity` attribute
only with a fixed version, never with `1.latest`.

Shoppers in browsers other than Safari pay by scanning a code with an iPhone, which needs Apple's
script version 1.2.0 or later and an iPhone or iPad on iOS 18 or iPadOS 18 or later.

### 3.2 Add a container for the button

```html
<div id="apple-pay-button"></div>
```

The SDK puts Apple's `<apple-pay-button>` element inside this container. The container can't be
inside a shadow root, because the SDK finds it with `document.getElementById`.

### 3.3 Create the instance and listen for events

```js
const applePay = new window.SpreedlyApplePay({
  environmentKey: 'YOUR_ENVIRONMENT_KEY',
  merchantIdentifier: 'merchant.com.example',
  countryCode: 'US',
  currencyCode: 'USD',
  total: { label: 'Example Shop', amount: '42.00' },
  supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
  onValidateMerchant: ({ validationURL }) =>
    fetch('/api/apple-pay/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ validationURL }),
    }).then(response => {
      if (!response.ok) throw new Error('Merchant validation failed');
      return response.json();
    }),
  getAuthDetails: () => fetch('/api/spreedly/auth-params').then(response => response.json()),
  button: { type: 'buy', style: 'black' },
});

applePay.on('applePayTokenGenerated', ({ token }) => {
  // Without processPayment: send the token to your server and charge it (step 3.6).
});
applePay.on('applePayUnavailable', ({ reason }) => {
  // Apple Pay can't be offered here. Leave the other payment methods in place.
});
applePay.on('applePayError', ({ code, message }) => {
  // See "Handling errors" below.
});
```

The constructor checks the whole configuration and throws an `Error` naming the first field that's
wrong, before it touches the page. `environmentKey` is the same key your auth details carry; it's
not a secret.

Register your handlers before you call `mount()`. Events go only to handlers that are registered
when the event fires, and `applePayReady` and `applePayUnavailable` fire during `mount()`.

Set `supportedNetworks` to the card networks your gateway accepts. If you leave it out, the SDK
offers twelve networks, and the shopper can approve a card from one your gateway then declines.

`countryCode` is, in Apple's words, the country of your principal place of business. Ask your
payment processor which code to use. Amounts are strings with no decimals or exactly two, such as
`'42'` or `'42.00'`; `'42.5'` is rejected.

### 3.4 Mount the button

```js
const { error } = await applePay.mount('apple-pay-button');
if (error) {
  // No button was drawn. Your other payment methods stay as they are.
}
```

`mount()` never throws. It waits up to 10 seconds for Apple's script, then checks that the page is
served over HTTPS, that the device and browser can make Apple Pay payments
(`ApplePaySession.canMakePayments()`), and that the browser supports an Apple Pay version this
configuration needs. If all of that passes, it draws the button and fires `applePayReady`. If not,
it fires `applePayUnavailable` with the reason and returns `{ error }`. If the checks pass but the
container isn't on the page, it fires `applePayError` with `MOUNT_FAILED` instead.

When your checkout view goes away, for example on a route change in a single-page app, call
`applePay.destroy()`, and create a new instance the next time.

Plain `http://localhost` doesn't work, even though browsers usually treat it as secure, because
Apple's script refuses any page that isn't HTTPS. Test on an HTTPS domain you've verified with
Apple.

### 3.5 Keep the total current

```js
applePay.setTotal({ total: { label: 'Example Shop', amount: '52.00' } });
```

Call `setTotal()` whenever the amount changes. It applies to the next tap. A sheet that's already
open keeps the amount it opened with.

### 3.6 Charge from your server

`applePayTokenGenerated` gives you a Spreedly payment method token. Your server charges it with
your environment key and access secret:

```
POST https://core.spreedly.com/v1/gateways/{gateway_token}/purchase.json
```

```json
{
  "transaction": {
    "payment_method_token": "PAYMENT_METHOD_TOKEN_FROM_SDK",
    "amount": 4200,
    "currency_code": "USD"
  }
}
```

`authorize.json` works the same way. `amount` is in the currency's smallest unit, as for cards
(`4200` for `'42.00'`). Send the same amount and currency the sheet showed. For how Spreedly
processes Apple Pay transactions, see Spreedly's
[Apple Pay guide](https://developer.spreedly.com/docs/apple-pay).

The SDK creates the payment method as cached, and Spreedly removes cached payment methods unless
you retain them. You only need to retain it to charge it again later, which normally means a
recurring payment with a merchant token (see [Recurring payments](#recurring-payments)). Retain it
from your server with `PUT /v1/payment_methods/{payment_method_token}/retain.json`, or pass
`retain_on_success: true` on the transaction.

---

## 4. Optional: charge while the sheet is open

Without `processPayment`, the SDK tells Apple the payment succeeded as soon as Spreedly returns a
token, so the sheet shows a tick before you have charged anything. If your charge then fails, the
shopper has already seen success.

With `processPayment`, the SDK waits for your charge before it tells Apple the result:

```js
const applePay = new window.SpreedlyApplePay({
  // ...the rest of your configuration
  processPayment: async ({ token }) => {
    const response = await fetch('/api/orders/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (response.ok) return { success: true };
    return { success: false, message: 'Your card was declined.' };
  },
});
```

- `{ success: true }`: the SDK tells Apple the payment succeeded and fires `applePayTokenGenerated`.
  You have already charged by then, so don't charge again in your `applePayTokenGenerated` handler;
  use it to show your confirmation.
- `{ success: false }`: the sheet stays open and you get `applePayError` with `PAYMENT_DECLINED`.
  The shopper can pick another card and approve again. Each new approval gets fresh auth details, a
  new payment method and a new `processPayment` call.
- A thrown error or a rejected promise: the SDK closes the sheet and fires `applePayError` with
  `PAYMENT_PROCESSING_FAILED`. Your charge may or may not have gone through, so check your order
  before you charge again.

You can also return `errors` to point the sheet at a field the shopper should fix, for example
`{ success: false, errors: [{ code: 'billingContactInvalid', contactField: 'postalAddress' }] }`.

In a device test (Chrome, iPhone scanning the code), a decline with `addressUnserviceable` on the
shipping `postalAddress` pointed the sheet at the address, and the shopper could edit it and pay,
even though the SDK doesn't listen for Apple's contact-change events.

In Chrome with an iPhone scanning the code, Apple's sheet shows only that the payment failed, not
your `message`. In Mac Safari, confirmed on an iPhone, it shows Apple's own "Try Again".
`applePayError` carries the message either way, so show it on your page.

### Apple's 30-second limit

Apple gives the page 30 seconds from the moment the shopper approves. That time covers
`getAuthDetails`, the call to Spreedly and `processPayment`. The SDK allows the first two up to 20
seconds together, so a charge that takes longer than about 10 seconds is at risk. If the total goes
over 30 seconds, Apple closes the sheet with an error. The SDK then fires `applePaySheetClosedEarly`, keeps
waiting for `processPayment` for up to 120 seconds, and reports the real result:
`applePayTokenGenerated` with `sheetClosedEarly: true`, or a final `applePayError`. Tell the shopper
their payment is still being confirmed when you see `applePaySheetClosedEarly`.

In device tests (Chrome with an iPhone scanning the code, and Mac Safari), a 40-second
`processPayment` made Apple close the sheet at 30 seconds; `applePaySheetClosedEarly` fired then,
and the result arrived later with `sheetClosedEarly: true`.

---

## Apple Pay in Express Checkout

With Express Checkout you can pass an `applePay` option and let the form put Apple's button on your
page, above the card fields. Steps 1 and 2 apply as written. From step 3 you still need 3.1 (load
Apple's script next to `express-checkout.js`), 3.6 (charge from your server) and, if you want it,
section 4 (`processPayment`, set inside the `applePay` option). The `applePay` option replaces steps
3.2 to 3.5.

```js
const authDetails = await fetch('/api/spreedly/auth-params').then(response => response.json());
const sdk = new window.SpreedlyExpressCheckout(authDetails);

sdk.on('applePayTokenGenerated', ({ token }) => {
  // Charge the token from your server.
});
sdk.on('tokenGenerated', ({ tokenResponse }) => {
  // Card payments still arrive here. The token is tokenResponse.payment_method.token.
});

sdk.expressCheckout({
  parentContainerId: 'payment-container',
  applePay: {
    merchantIdentifier: 'merchant.com.example',
    countryCode: 'US',
    currencyCode: 'USD',
    total: { label: 'Example Shop', amount: '42.00' },
    supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
    onValidateMerchant: ({ validationURL }) =>
      fetch('/api/apple-pay/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validationURL }),
      }).then(response => {
        if (!response.ok) throw new Error('Merchant validation failed');
        return response.json();
      }),
    getAuthDetails: () => fetch('/api/spreedly/auth-params').then(response => response.json()),
  },
});

// When the cart changes:
sdk.setApplePayTotal({ total: { label: 'Example Shop', amount: '52.00' } });
```

- `applePay` takes the same options as `SpreedlyApplePay`, except `environmentKey`, which Express
  Checkout fills in from its own auth details.
- `getAuthDetails` is still required. Express Checkout's card form uses its own auth details, and
  Spreedly accepts each nonce only once, so Apple Pay needs its own.
- The button goes in a row above the card form, on your page rather than inside the form's iframe,
  followed by an "or pay with card" divider. Apple's button stays hidden until Apple Pay is ready,
  and is removed if Apple Pay is unavailable; the row goes too when no wallet in it is available. It works with the form embedded in your page
  (`parentContainerId`) and in Express Checkout's own dialog.
- All the Apple Pay [events](./API_REFERENCE.md#events) reach handlers you register with
  `sdk.on()`. Register them before you call `expressCheckout()`.
- An invalid `applePay` option doesn't stop the card form. Express Checkout leaves Apple Pay out
  and fires `applePayError` with `DEVELOPER_ERROR`, then `applePayUnavailable`.
- In dialog mode, Express Checkout doesn't close its dialog after Apple Pay, whether the payment
  succeeds or the shopper cancels. Call `close()` once you're done, for example after
  `applePayTokenGenerated`. After `applePayCancelled`, leaving the dialog open lets the shopper pay
  by card.
- `applePay.metadata` is the only metadata on Apple Pay payment methods. `submitParams` applies to
  card payments only.

You can also use `window.SpreedlyApplePay` directly with the Express Checkout bundle, as in
[step 3](#3-add-apple-pay-to-your-page), if you'd rather place the button yourself.

---

## Handling errors

`applePayError` carries `{ code, message, details? }`. `details` never contains Apple's payment data
or the shopper's contact details.

| Code | What to do |
|---|---|
| `API_NOT_LOADED` | Check Apple's script tag and your Content Security Policy. |
| `MOUNT_FAILED` | Check the container id. |
| `SESSION_FAILED` | Check your configuration and `details`. |
| `MERCHANT_VALIDATION_FAILED` | Check your validation endpoint and its logs. The sheet has closed. |
| `MERCHANT_VALIDATION_TIMEOUT` | Make your validation endpoint answer within 20 seconds. The sheet has closed. |
| `AUTH_DETAILS_FAILED` | Check your auth endpoint. The shopper can approve again. |
| `TOKENIZATION_FAILED` | Read Spreedly's error in `details`. The shopper can approve again. |
| `TOKENIZATION_TIMEOUT` | A payment method may still have been created at Spreedly. The shopper can approve again. |
| `SHEET_CLOSED_BEFORE_CHARGE` | The sheet closed while the payment method was being created. Nothing was charged. The shopper can tap the button again. |
| `PAYMENT_DECLINED` | The shopper can pick another card and approve again. |
| `PAYMENT_PROCESSING_FAILED` | Your charge may have gone through. Check your order before charging again. |
| `PAYMENT_PROCESSING_TIMEOUT` | Your charge may have gone through. Check your order before charging again. |
| `DEVELOPER_ERROR` | Express Checkout only. Fix the `applePay` option; the message names the field. |

When each code fires, and what `details` holds, is in
[Error codes](./API_REFERENCE.md#error-codes).

Each tap ends with exactly one of `applePayTokenGenerated`, `applePayCancelled` or a final
`applePayError`, unless you call `destroy()` first, which ends it with no event. While the sheet is still open, every failed approval fires its own
`applePayError` (`AUTH_DETAILS_FAILED`, `TOKENIZATION_FAILED`, `TOKENIZATION_TIMEOUT` or
`PAYMENT_DECLINED`) and the shopper can try again, so don't treat those as the end of the payment.

In device tests (Chrome with an iPhone scanning the code, and Mac Safari), the sheet stayed open
after a failed `getAuthDetails` and the second approval succeeded.

If the shopper closes the sheet before approving, or after a failed approval, you get
`applePayCancelled`, and the shopper starts again by tapping the button. If the sheet closes while
the SDK is creating the payment method, you get `applePayError` with `SHEET_CLOSED_BEFORE_CHARGE`:
the shopper can't close it then, so Apple did. The SDK discards any token that arrives after that,
so there is nothing to charge, and the shopper starts again by tapping the button. If the sheet closes while `processPayment` is running, you get
`applePaySheetClosedEarly` instead, followed by the result of your charge (see
[Apple's 30-second limit](#apples-30-second-limit)).

The full list of events and payloads is in the [API reference](./API_REFERENCE.md).

---

## Showing the button

Apple's design rules for the button are in its
[Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/apple-pay).
The ones that matter most for checkout:

- Show the Apple Pay button wherever the device supports it, and don't hide it or make it look
  unavailable. The SDK draws it whenever `canMakePayments()` is true, even if the shopper has no
  card in Wallet yet.
- Make it at least as prominent as your other payment buttons.
- Use Apple's button, never your own drawing of it. The SDK always uses Apple's
  `<apple-pay-button>`.
- Pick the style for your background: `black` on white or light backgrounds, `white` on dark
  backgrounds, and `white-outline` on light backgrounds where `black` doesn't stand out enough.
- Write "Apple Pay" as two words, with capital A and P.

The button's `type` (for example `buy`, `check-out` or `plain`), `style`, `locale`, size and corner
radius are set through the `button` option; see the [API reference](./API_REFERENCE.md). Apple's
minimum height is 30 pixels, and its minimum width is 100 pixels for `plain` and 140 pixels for the
other types. If you set `width` or `height` in pixels below these, the SDK raises it to the
minimum.

### Checking for a card in Wallet

`checkPaymentCredentialStatus: true` makes the SDK ask Apple whether the shopper has a card in
Wallet that can pay you, and passes the answer as `paymentCredentialStatus` on `applePayReady`.
It's off by default because Apple restricts when a page may ask: "You can only call this method if
you want to default to Apple Pay during your checkout flow, or if you want to add an Apple Pay
button to your product detail page." When the answer is `paymentCredentialsAvailable`, Apple says
Apple Pay should be the primary payment option.

With it on, the SDK waits up to 3 seconds for Apple's answer and leaves `paymentCredentialStatus`
out if Apple takes longer. If Apple answers `applePayUnsupported`, the SDK draws no button and fires
`applePayUnavailable` with `APPLE_PAY_UNSUPPORTED`. In browsers other than Safari, that also happens
when Apple doesn't have your Merchant ID or domain registered.

With the option off, Apple's script in browsers other than Safari doesn't learn your Merchant ID
before the payment starts, and sends an empty Merchant ID when the payment begins. Before going
live, make one payment in desktop Chrome with the QR code and the option off.

---

## Recurring payments

Set `recurringPaymentRequest` for a subscription or other repeat charges. The sheet then shows the
billing terms, and Apple may issue a **merchant token** instead of a device token. Apple issues a
merchant token only when the card's network supports one.

```js
recurringPaymentRequest: {
  paymentDescription: 'Example Shop monthly plan',
  regularBilling: {
    label: 'Monthly plan',
    amount: '9.99',
    paymentTiming: 'recurring',
    recurringPaymentIntervalUnit: 'month',
  },
  managementURL: 'https://shop.example.com/account/subscription',
},
```

Apple asks for `paymentTiming: 'recurring'` on `regularBilling`. All the fields are in
[Recurring payments](./API_REFERENCE.md#recurring-payments).

- `applePayTokenGenerated` tells you which you got: `isMerchantToken` is `true` for a merchant
  token, with `merchantTokenIdentifier` set.
- Retain the payment method so you can charge it later: pass `retain_on_success: true` on the
  first charge, or call `PUT /v1/payment_methods/{payment_method_token}/retain.json`.
- Charge the first payment with the shopper present, using Spreedly's stored-credential fields
  `stored_credential_initiator: "cardholder"` and `stored_credential_reason_type: "recurring"`. Later
  charges without the shopper use `stored_credential_initiator: "merchant"` with
  `stored_credential_reason_type: "recurring"`.
- Spreedly lists the gateways that support recurring Apple Pay in its
  [Apple Pay guide](https://developer.spreedly.com/docs/apple-pay). On other gateways Spreedly
  ignores the stored-credential fields, and later charges may be declined.

A recurring request needs Apple Pay version 14, so browsers that don't support it get
`applePayUnavailable` with `UNSUPPORTED_VERSION`.

---

## Testing

Apple Pay testing needs a real device. Apple's sandbox page lists iPhone, iPad and Apple Watch. On
a Mac, Safari needs Touch ID or a paired iPhone or Apple Watch to approve a payment, and in other
browsers the shopper scans the code with an iPhone.

Start with a real card against Spreedly's Test gateway. That path needs only the setup in steps 1
and 2.

**With a real card and Spreedly's Test gateway.** Against Spreedly's Test gateway, every Apple Pay
payment is approved, whatever the card. This needs a Spreedly environment activated for real
transactions: until yours is, Spreedly rejects the payment method with `errors.account_inactive`, so
set `testCardNumber` to a Spreedly [test card](https://developer.spreedly.com/docs/test-data) in the
meantime. To test against your real gateway's sandbox, set
`testCardNumber` to one of that sandbox's test card numbers: Spreedly uses it in place of the card
number in Apple's payment data, because each gateway sandbox only accepts its own test cards. You
can also set it to a Spreedly [test card](https://developer.spreedly.com/docs/test-data) to force an outcome such as a decline on the Test gateway.
A payment method created this way is marked as a test one and can't be used on a production
gateway. Spreedly still decrypts Apple's payment data, so your Payment Processing Certificate has to
be in place. Remove `testCardNumber` before going live.

**With Apple's sandbox.** Create a sandbox tester in App Store Connect (**Users and Access** →
**Sandbox** → **Testers**), sign the test device out of its Apple Account and in with the tester,
and add Apple's [test cards](https://developer.apple.com/apple-pay/sandbox-testing/) to Wallet by
hand. Apple says a sandbox payment "will decline pre-fulfillment as the test key will not match
your production key". Spreedly still decrypts these payments and creates the payment method.

Before going live, Apple asks merchants to test end to end with real cards in production, to test
their error handling, and to test in browsers other than Safari.

---

## Content Security Policy (CSP)

Apple Pay runs on your page, so your page's CSP has to allow Apple's script and the SDK's call to
Spreedly. Add these to the directives you already have:

| Directive | Add | Why |
|---|---|---|
| `script-src` | `https://applepay.cdn-apple.com` | Apple's script (Apple's recommendation) |
| `frame-src` | `https://applepay.cdn-apple.com` | Apple's recommendation |
| `img-src` | `https://applepay.cdn-apple.com` | Apple's recommendation |
| `connect-src` | `https://core.spreedly.com` | The SDK creates the payment method from your page |
| `connect-src` | `https://smp-paymentservices.apple.com` | Only with `checkPaymentCredentialStatus: true`: in browsers other than Safari, Apple's script asks this host whether your Merchant ID is registered for the domain |

The merchant session request goes from your server to Apple, so it needs nothing in your page's
CSP.

---

## Apple Pay inside an iframe

The SDK runs Apple Pay on the page that loads it. If that page is inside an iframe:

- the iframe needs `allow="payment"`, which Safari 17 and later supports for cross-origin iframes;
- the domain you register with Apple and send as `initiativeContext` is the top-level page's
  domain, not the iframe's.

On iOS 16 and earlier, Apple Pay calls had to come from the top-level page, so shoppers on those
versions can't pay from inside an iframe.

---

## Keeping it working

| What | Expires | What to do |
|---|---|---|
| Merchant ID | Never | Nothing. |
| Payment Processing Certificate | 25 months | Repeat step 1.2 at least 30 days before expiry. Activate the new certificate only once it's uploaded to Spreedly, and keep the old one at Spreedly: Apple may use the old key for a while after activation. |
| Merchant Identity Certificate | 25 months | Repeat step 1.3, deploy the new certificate and key, then revoke the old certificate. |
| Domain verification | When the domain's SSL certificate expires | Renew the SSL certificate in time, with the same certificate chain, and keep the verification file in place; Apple then re-checks the domain on its own. Otherwise verify again with a new file. |

Apple emails the Account Holder and Admins 30, 15 and 7 days before a certificate expires, and
recommends renewing at least 30 days ahead.

---

## Limitations

- The SDK always creates the payment method in Spreedly, with Spreedly decrypting the payment data.
  Decrypting Apple Pay yourself isn't supported by this class.
- One `SpreedlyApplePay` runs one payment at a time. A tap while a payment is in progress is
  ignored.
- The button container can't be inside a shadow root.
- The SDK doesn't support line items, shipping methods, coupon codes, automatic reload or deferred
  payments in this release.
