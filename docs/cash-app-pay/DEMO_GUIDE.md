# Cash App Pay — Demo Guide

The demo at `/cash-app-pay/index.html` runs `SpreedlyCashAppPay` against Block's sandbox Pay Kit.

> **Mock:** Spreedly Core's Cash App API isn't available yet. The payment method token
> (`mock_…`) comes from the SDK's mock exchange, and **Complete purchase** calls the sample app's
> mock route, which returns a synthetic transaction. Nothing is charged and Spreedly is never
> called for either step.

## What the page does

1. Loads `https://sandbox.kit.cash.app/v1/pay.js`, then the selected SDK bundle.
2. Fetches the Client ID and Merchant ID from `GET /api/v1/cash-app-pay/config`, and fresh auth
   params from `GET /api/v1/auth/params`.
3. Creates `SpreedlyCashAppPay` with `redirectURL` set to this page, registers the event handlers,
   then calls `setup()` and `beginCheckout({ amount })`.
4. On `cashAppTokenGenerated`, shows the cashtag and token and enables **Complete purchase
   (mock)**, which posts `{ payment_method_token, amount, currency_code }` to
   `POST /api/v1/cash-app-pay-purchase`.

Controls:

- **Order total**: calls `beginCheckout()` again, which updates the request until the shopper
  interacts.
- **Button options**: rebuild the instance.
- **New checkout**: rebuilds the instance with fresh auth params.

Every SDK event is written to the event log.

## Running it locally

1. Set `CASH_APP_CLIENT_ID_NEW` (sandbox, `CAS-CI_…`) and `CASH_APP_MERCHANT_ID_NEW` in `.env`.
   Without them the config route answers `503 not_configured` and the page says so.
2. Until an SDK release includes `SpreedlyCashAppPay`, run the SDK locally (`npm run dev` in
   `checkout-web-sdk`) and enable the local-SDK block in `src/static/shared/utils.js`. Don't
   commit that change.
3. `API_BASE_URL` in `shared/utils.js` points at Heroku. To use your local server's routes,
   point it at `http://localhost:3000/api/v1` temporarily. Don't commit that either.
4. `npm run dev`, open `http://localhost:3000/cash-app-pay/index.html?sdk=hosted-fields` (or
   `?sdk=express-checkout`).

## Testing

- **Automated:** `test/ui/testCases/cash-app-pay.spec.ts` replaces Pay Kit with a stub
  (`installCashAppStub` in `test/ui/pages/cashAppPayPage.ts`) and mocks both Cash App routes. It
  checks the customer request (amount in cents, `scopeId`, `redirectURL`), approval → mock token →
  mock purchase, decline, dismiss, failure, amount update and `UPDATE_REJECTED`. It skips itself
  if the loaded SDK build has no `SpreedlyCashAppPay`. Run it locally with
  `npm run test:e2e:local -- cash-app-pay`.
- **Manual (sandbox):**
  - Desktop: click the button, scan the QR code with a sandbox Cash App account, and check
    approve, decline and dismiss.
  - Mobile: open the page over https (Heroku or a tunnel, because Pay Kit needs a secure
    `redirectURL`), approve in Cash App, and confirm the token appears on return without clicking
    anything.
  - Check the network panel for Cash App hosts beyond `sandbox.kit.cash.app` and add them to the
    CSP docs.
