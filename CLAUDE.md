# web-sdk-sample-app

Sample e-commerce app demoing every flow of Spreedly's checkout-web-sdk.
Node 22.x, Express 5 + TypeScript backend, plain browser JS frontend (no bundler).

Card data does not pass through this app. The SDK posts it to Spreedly Core.
Do not reintroduce `POST /api/v1/payment_methods` as a forwarder to
`restricted.json`.

## Backend contract

- There is no recache route. The SDK recaches directly against Core.
- **Every Core call goes through `src/coreClient.ts`.** It sends only the method + path
  combinations in `CORE_ROUTES`, only to configured gateways, never follows redirects, and
  refuses any token that isn't 1–64 letters and digits. A new Core call needs a new
  `CORE_ROUTES` entry. Routes that take a token in the URL check it with `isSpreedlyToken`
  and answer 400 before calling Core.
- **Return URLs** (`src/returnUrls.ts`): `callback_url` is always set by the server
  (`PUBLIC_APP_ORIGIN` + `/api/v1/offsite-callback`). A caller's `redirect_url` must be on one
  of the app's origins (`PUBLIC_APP_ORIGIN`, `FRONTEND_ORIGINS`, `CORS_ALLOWED_ORIGINS`), or the route
  answers 400. Purchase bodies are built from named fields; never forward `req.body`.
- **Saved cards live in the visitor's browser**, not on the server. `retainPaymentMethod` in
  `shared/utils.js` retains through the server, then stores the card's display fields in
  `localStorage`; `fetchPaymentMethods` reads them back. There is no `GET /payment_methods`
  route: a server list would show every visitor's cards to everyone.
- **Retain checks ownership (HC-1940).** Each tab keeps a random secret in `sessionStorage`
  (`shared/utils.js`). Every tokenization that may be retained sends
  `...SpreedlyUtils.ownerMetadata()` (`sample_app_owner` = SHA-256 of the secret, hex) in its
  metadata, and `retainPaymentMethod` sends the secret as `owner_secret`. The route reads the
  payment method from Core and answers 403 unless the hash matches. A new flow that retains must
  add the metadata, or its retains fail.
- JSON and form bodies are capped at 32 KB.
- Never log an error object or a request body: body-parser errors carry the raw body, axios
  errors carry the Authorization header.
- `GET /api/v1/auth/params` (`src/controllers/auth.ts`) → `{nonce (UUID), timestamp
  (unix s), signature, certificateToken, environmentKey}`. Signature = RSA-SHA256,
  base64, over the concatenation `nonce + timestamp + certificateToken` — the order
  and algorithm are fixed by what Spreedly verifies; don't touch.
- CORS is an allowlist (`src/middlewares/corsMiddleware.ts`).
- **axios is served by the app** at `/vendor/axios.min.js` (`src/app.ts`, from
  `node_modules/axios/dist`), so pages run the version in `package-lock.json`. New pages use
  `<script src="/vendor/axios.min.js"></script>`; never load axios from a CDN.

## Architecture

- **Server**: `src/server.ts` → `src/app.ts` (morgan → `GET /healthz` → edge guard → https redirect + HSTS → cors → useragent → Swagger UI
  at `/api/v1/docs` → static → json → `/api/v1` router → errorHandler). Port from
  `PORT` (default 3000). `src/config.ts` reads env; `src/routes.ts` +
  `src/controllers/{auth,payments}.ts` hold all routes.
- **Build**: `npm run build` = `scripts/build.sh` (tsc → `dist/`, then copies
  `src/static/` → `dist/static/` wholesale). `npm start` = `node dist/server.js`.
  `npm run dev` = nodemon + ts-node.
- **Heroku deploy is implicit**: no Procfile/app.json/CI deploy — the Node buildpack
  auto-runs `build` and starts with `npm start`. Secrets live as Heroku config vars.
- **Frontend**: static pages under `src/static/<flow>/`, served at `/`. Each page
  dynamically loads the SDK via `shared/utils.js#getSDKScriptUrl()`.

## Environments — the traps

- **SDK bundles come from the production CDN rc channel**:
  `https://core.spreedly.com/checkout/sdk/rc/index.js` (hosted-fields) and
  `.../checkout/elements/rc/express-checkout.js`. ACH pages use the same production
  URLs when the page is not on localhost. A commented-out block in
  `src/static/shared/utils.js` switches to localhost:5000/:5173 for a locally-running
  SDK build.
- **Backend upstream defaults to PRODUCTION** (`SPREEDLY_URL` →
  `https://core.spreedly.com`), matching the production SDK bundle.
- **No hardcoded app URL (HC-2088).** `PUBLIC_APP_ORIGIN` (required, https) is the app's public
  origin; config throws at startup without it. Pages call `${window.location.origin}/api/v1`, or
  `localhost:3000` from a localhost page, and build return URLs with `getRedirectOrigin()` in
  `shared/utils.js`. `FRONTEND_ORIGINS` defaults to `PUBLIC_APP_ORIGIN`.
- **Edge guard (HC-2089)** (`src/middlewares/edgeGuardMiddleware.ts`): the app sits behind Fastly,
  which adds a shared secret header to every request. With the secret, a request goes through;
  without it, the herokuapp host is redirected (301/308) to `PUBLIC_APP_ORIGIN` and any other host
  gets an empty 403. `GET /healthz` is mounted before the guard. Fails closed: config throws
  unless `FASTLY_SHARED_SECRET`, `FASTLY_SECRET_HEADER` and `HEROKU_APP_HOST` are all set. Off
  Heroku, `EDGE_GUARD_DISABLED=true` turns the guard off for local runs; on Heroku (`DYNO` is set)
  it can't be turned off. The secret must be 32+ chars, and `PUBLIC_APP_ORIGIN` must not be the herokuapp host (config throws otherwise).
  Never log the header, and never put the secret in Playwright's `extraHTTPHeaders`: the browser
  would send it to the SDK and third-party hosts.
- **Staging login (HC-2083)** (`src/middlewares/basicAuthMiddleware.ts`): on when `BASIC_AUTH_USER` and
  `BASIC_AUTH_PASSWORD` are set (password 16+ chars). On Heroku, config throws if `SPREEDLY_URL` or
  `SDK_BASE_URL` is core-test and the login vars are missing. Never set them on the public app.
- **Env vars: config reads ONLY the `_NEW`-suffixed names** (`PRIVATE_KEY_NEW`,
  `CERTIFICATE_TOKEN_NEW`, `SPREEDLY_ENVIRONMENT_KEY_NEW`, `SPREEDLY_ACCESS_SECRET_NEW`,
  `SPREEDLY_GATEWAY_TOKEN_NEW`, `SPREEDLY_SCA_PROVIDER_KEY_NEW`,
  `{STRIPE,PAYPAL,EBANX,BRAINTREE}_GATEWAY_TOKEN_NEW`, plus `PORT`/`SPREEDLY_URL`).
  Unsuffixed legacy vars in `.env` are dead. README's setup section doesn't mention
  `.env` at all — the server won't work without it.
- **Exception: the Paze vars are unsuffixed.** Web checkout: `PAZE_CERTIFICATE_TOKEN`,
  `PAZE_CLIENT_ID` (the web client id), `PAZE_CLIENT_NAME`, `PAZE_PROFILE_ID`. Mobile token
  endpoint (`POST /api/v1/paze/oauth/token`, CAT): `PAZE_MOBILE_LOGIN_ID` (the mobile login id,
  not the web client id), `PAZE_SIGNING_KID`, `PAZE_SIGNING_PRIVATE_KEY` (PKCS#8 PEM, line
  breaks may be `\n`), `PAZE_DEMO_API_KEY` (callers send it as `X-Demo-Api-Key`), optional
  `PAZE_TOKEN_URL`. Without them that endpoint answers `503 not_configured`; nothing else breaks.
- **The Apple Pay vars are unsuffixed too.** Required: `APPLE_PAY_MERCHANT_IDENTITY_CERT` /
  `_KEY` (PEM, line breaks may be `\n`) and `APPLE_PAY_DOMAIN_ASSOCIATION` (Apple's verification
  file, served at `/.well-known/apple-developer-merchantid-domain-association`). Without them
  `POST /api/v1/apple-pay/validate` answers `503 not_configured` and the file route 404s.
  Optional overrides in `src/config.ts`: `APPLE_PAY_MERCHANT_ID`,
  `APPLE_PAY_DISPLAY_NAME`, `APPLE_PAY_DOMAIN` (sent as `initiativeContext`, must be registered with
  Apple; defaults to the `PUBLIC_APP_ORIGIN` hostname), `APPLE_PAY_ENVIRONMENT` (default `sandbox`; set `production` for Apple's production
  validation host). The test
  pages: `apple-pay-test/` (plain Apple Pay JS, no SDK; not on the landing page) and, behind the
  landing page's Apple Pay card (`apple-pay/`, a product page), `apple-pay-local-sdk/`. It loads
  the SDK from the CDN rc channel via `getSDKScriptUrl()`. `?sdk-source=local` loads it from the
  SDK dev servers on localhost:5000/:5173 of the computer showing it instead (Chrome only); a page
  opened on localhost always does.

## Flows (landing page `src/static/index.html`; `?sdk=hosted-fields|express-checkout` threads through URLs)

| Flow dir | Demos | SDK surface | Backend routes used |
|---|---|---|---|
| `tokenize/` | Tokenization with a **merchant-hosted form** (name/expiry/address on the page; only number + CVV are iframes) + SDK config panel | HF + EC | `auth/params`, `retain` |
| `tokenize-catalogue/` | Tokenization with **SDK-hosted catalogue fields** (`inAppElements`) + custom validators (`addValidation`) | HF + EC | `auth/params`, `retain` |
| `purchase/` | 3-step storefront, saved cards + new card, no 3DS | HF + EC (dialog) | `auth/params`, `simple-purchase` |
| `recache/` | CVV recache on a retained card (`setRecache` → `recache()`) — done client-side via SDK | HF + EC | `auth/params` |
| `purchase-with-3ds/` | 3DS **Global** (`sca_provider_key` server-side), `SpreedlyThreeDSLifecycle` + `serializeBrowserInfo` | HF + EC | `create-purchase-with-3ds` |
| `purchase-with-3ds-gateway-specific/` | 3DS **gateway-specific** with full callback set incl. `onTriggerCompletion` → `transactions/:t/complete` → `event.finalize()` | HF + EC | `create-purchase-with-3ds-gateway-specific`, `complete` |
| `ach-payments/` | ACH bank-account tokenize + $10 purchase. HF: two secure fields + merchant name/type inputs (`ach-payments.js`); EC: the prebuilt form in one iframe (`ach-form.js`) | HF `SpreedlyACHFields`; EC `SpreedlyACHForm` | `ach-purchase` |
| `apple-pay/` → `apple-pay-local-sdk/`; `apple-pay-test/` | Apple Pay on the web. The landing card opens `apple-pay/`, a product page; Proceed opens `apple-pay-local-sdk/` with `?amount=` (the cart total), where the SDK draws Apple's button and runs the sheet (`SpreedlyApplePay` / `expressCheckout({ applePay })`). The page loads the SDK from the CDN rc channel, or with `?sdk-source=local` (a link on the page) from the SDK dev servers on localhost:5000/:5173 of the computer showing it (Chrome only). `?debug=1` shows failure switches. With `?sdk=express-checkout` the form opens embedded or in Express Checkout's pop-up (dialog mode); the page closes the pop-up after Apple Pay. `apple-pay-test/` is plain Apple Pay JS for setup checks, not linked | HF + EC / none | `apple-pay/validate`, `apple-pay/config`, `auth/params`, `simple-purchase` |
| `offsite-payments/` | Hub: paypal/sprel via `setupOffsitePayment`; subpages `braintree/` (`SpreedlyBraintree`), `stripe-apm/` (`SpreedlyStripeAPM`), `ebanx/` (LATAM methods) | offsite APIs | `offsite-purchase`, `braintree-purchase`, `stripe-apm-purchase`, `create-purchase`, `transactions/:t`, `confirm` |
| `google-pay/` | `SpreedlyGooglePay`: page loads `pay.js`, SDK draws Google's button + tokenizes in-sheet (merchant-page `payment_methods.json`); needs a local SDK build until the global reaches the rc CDN. With `?sdk=express-checkout`, the Placement radio defaults to EC's `googlePay` option (`?placement=standalone` opts out): wallet row above the EC iframe, embedded in the page or in the page's own dialog (never EC's dialog mode), card tokens via `tokenGenerated`. Purchase branches on `googlePayType`: `TOKENIZED_CARD` → no 3DS; otherwise 3DS Global (default) or gateway 3DS + `SpreedlyThreeDSLifecycle` | HF + EC | `auth/params`, `simple-purchase`, `create-purchase-with-3ds-gateway-specific`, `transactions/:t/complete`, `create-purchase-with-3ds` |

Backend routes with no frontend caller: `POST /purchase` (the only one exercising the
`sca_provider_key` vs `attempt_3dsecure` toggle), `offsite-callback` (stub, but the server
sends it to Spreedly as every offsite `callback_url`).

## Testing (this repo IS the SDK's e2e coverage — the SDK repo has none)

- Playwright, specs in `test/ui/testCases/` (8 files: token-generation, 3ds-flow,
  3ds-gateway-specific, offsite-payments, validations, allow-blank-date/-name/-expired).
  Page objects in `test/ui/pages/`, selectors/test data in `test/ui/util/test-constants.ts`.
- **`npm run test:e2e` targets the deployment at `PUBLIC_APP_ORIGIN`** (baseURL in
  `playwright.config.js`, read from `.env`) — it does NOT test local changes.
  `test/api/edge-guard.spec.ts` starts its own app on a random port and needs no server. Local: start the server,
  then `npm run test:e2e:local` (localhost:3000). No Playwright `webServer` config.
- **CI e2e (`.github/workflows/test_e2e.yml`)**: against staging (`https://checkout.spreedly-demo.dev`,
  with the `E2E_BASIC_AUTH_USER`/`_PASSWORD` secrets) after each successful Heroku deploy of
  `checkout-web-app-staging` (a merge to `staging`); against production (no login) after each
  successful deploy of `checkout-web-sample-app` (a merge to `main`) and on the nightly cron
  (06:00 UTC); both at the deployed commit; manually via workflow_dispatch (`target`). The
  workflow sets `PUBLIC_APP_ORIGIN`. No PR trigger. junit results go to Datadog (tagged
  `target:`), non-blocking. `dependency-review.yml` still gates PRs.
  `browserstack.yml` is dead config (no SDK dep, nothing invokes it).
- SDK iframes reached via `frameLocator`: EC `iframe[title='Spreedly Secure Payment
  Form']`; HF `iframe[src*="numberField.html"]` / `[src*="cvvField.html"]`; 3DS
  challenge `iframe.challenge-iframe`.
- Test data quick reference: Visa `4111111111111111` / CVV `123`; 3DS global —
  challenge `5111220000000009` (PIN `1234` ok / `4567` fail), frictionless ok
  `5222220000000005`, frictionless fail `5248481111200179`; 3DS gateway-specific —
  card `4556761029983886`, magic amounts (cents) `3001` frictionless / `3003`
  fingerprint→auth / `3004` fingerprint→challenge / `3005` challenge / `3103`/`3104`
  failures; ACH routing `021000021`.
- Known flakiness: fixed `waitForTimeout`s in offsite/3DS page objects, live
  third-party sandboxes (PayPal/Stripe/EBANX), and the PayPal spec's real assertions
  are commented out (it only checks the login field renders).

## Known traps & stale bits

- **`dist/` is stale and contains two orphaned demos that no longer exist in `src/`:
  `dist/static/click-to-pay/` (demos a `SpreedlyClickToPay` global against a
  locally-run SDK) and `dist/static/stripe-radar/`.** A fresh build deletes them
  (build.sh does `rm -rf dist/static`). If C2P work needs a demo page, resurrect from
  `dist/`, don't assume it exists in `src/`.
- `.env` in the working tree holds live-looking secrets incl. a plaintext RSA private
  key — gitignored, never commit or copy it anywhere.
- CSP middleware exists but is commented out in `app.ts`; as written it omits
  `js.stripe.com`/`js.braintreegateway.com`, so enabling it unmodified would break the
  stripe-apm and braintree pages.
- `tokenize.js` ships debug instrumentation (monkeypatched `window.addEventListener`
  capturing SDK message listeners into `window.__capturedMessageListeners`).
- Hardcoded Stripe test publishable key in `stripe-apm.js`; fake Venmo nonce fallback
  in `braintree.js`.
- README: no `.env` section.
- 3DS pages depend on the SDK-provided `serializeBrowserInfo` global; `browserSize`
  `'04'` and the accept header are hardcoded in each flow's CONFIG.
- `docs/` mirrors the SDK repo's docs structure (tokenization/three-ds/offsite/
  recaching/ach/migration-guide) — treat the SDK repo's `docs/` as canonical.
