# web-sdk-sample-app

Sample e-commerce app demoing every flow of Spreedly's checkout-web-sdk — **and,
critically, production-load-bearing infrastructure**: its Heroku deployment
(`checkout-web-sample-app-049a3c617015.herokuapp.com`) is the tokenization **proxy**
the SDK's core package uses for ALL local and staging development (Spreedly's
`restricted.json` endpoint rejects non-`*.spreedly.com` origins). Breaking the proxy
contract here breaks SDK development everywhere. Node 22.x, Express 5 + TypeScript
backend, plain browser JS frontend (no bundler).

## The proxy contract — never break these

- `POST /api/v1/payment_methods` (`src/controllers/payments.ts`) → forwards the body
  verbatim to `{SPREEDLY_URL}/v1/payment_methods/restricted.json` with ONLY the
  `spreedly-environment-key` header (no Basic auth). The SDK POSTs here directly.
- `POST /api/v1/payment_methods/:token/recache` — same forwarding pattern.
- `GET /api/v1/auth/params` (`src/controllers/auth.ts`) → `{nonce (UUID), timestamp
  (unix s), signature, certificateToken, environmentKey}`. Signature = RSA-SHA256,
  base64, over the concatenation `nonce + timestamp + certificateToken` — the order
  and algorithm are fixed by what Spreedly verifies; don't touch.
- The unrestricted `app.use(cors())` in `src/app.ts` is load-bearing — the SDK calls
  cross-origin from core-test/localhost. No origin allowlist may be added casually.
- Changing the route paths, injecting Basic auth into the proxy routes, or removing
  CORS breaks every SDK developer's local/staging tokenization.

## Architecture

- **Server**: `src/server.ts` → `src/app.ts` (morgan → cors → useragent → Swagger UI
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

- **SDK bundles come from the CDN rc channel on core-test**:
  `https://core-test.spreedly.com/checkout/sdk/rc/index.js` (hosted-fields) and
  `.../checkout/elements/rc/express-checkout.js` — i.e. whatever last merged to the
  SDK's `main`. A commented-out block in `src/static/shared/utils.js` switches to
  localhost:5000/:5173 for a locally-running SDK build.
- **Backend upstream defaults to PRODUCTION** (`SPREEDLY_URL` →
  `https://core.spreedly.com`) while the SDK loads from core-test. Keep both sides on
  the same Spreedly environment when changing either.
- **The frontend calls Heroku even when running locally**: `API_BASE_URL` in
  `shared/utils.js:1` is the hardcoded Heroku URL. `LOCAL_API_URL` exists but is used
  ONLY by the ACH helper — so ACH is the one flow that's local-only (broken on
  Heroku) while everything else silently hits Heroku from a local page. More
  hardcoded Heroku URLs in `offsite-payments/{braintree,stripe-apm}/`, `ebanx.js`,
  and `transparent_redirect_complete.html`.
- **Env vars: config reads ONLY the `_NEW`-suffixed names** (`PRIVATE_KEY_NEW`,
  `CERTIFICATE_TOKEN_NEW`, `SPREEDLY_ENVIRONMENT_KEY_NEW`, `SPREEDLY_ACCESS_SECRET_NEW`,
  `SPREEDLY_GATEWAY_TOKEN_NEW`, `SPREEDLY_SCA_PROVIDER_KEY_NEW`,
  `{STRIPE,PAYPAL,EBANX,BRAINTREE}_GATEWAY_TOKEN_NEW`, plus `PORT`/`SPREEDLY_URL`).
  Unsuffixed legacy vars in `.env` are dead. README's setup section doesn't mention
  `.env` at all — the server won't work without it.

## Flows (landing page `src/static/index.html`; `?sdk=hosted-fields|express-checkout` threads through URLs)

| Flow dir | Demos | SDK surface | Backend routes used |
|---|---|---|---|
| `tokenize/` | Tokenization + full SDK config panel (the API showcase: setLabel/setTitle/formats/mask/validate/reload/destroy/…) | HF + EC | `auth/params`, `retain` |
| `purchase/` | 3-step storefront, saved cards + new card, no 3DS | HF + EC (dialog) | `auth/params`, `payment_methods`, `simple-purchase` |
| `recache/` | CVV recache on a retained card (`setRecache` → `recache()`) — done client-side via SDK; the server recache route goes unused | HF + EC | `auth/params`, `payment_methods` |
| `purchase-with-3ds/` | 3DS **Global** (`sca_provider_key` server-side), `SpreedlyThreeDSLifecycle` + `serializeBrowserInfo` | HF + EC | `create-purchase-with-3ds` |
| `purchase-with-3ds-gateway-specific/` | 3DS **gateway-specific** with full callback set incl. `onTriggerCompletion` → `transactions/:t/complete` → `event.finalize()` | HF + EC | `create-purchase-with-3ds-gateway-specific`, `complete` |
| `ach-payments/` | ACH bank-account tokenize + $10 purchase (no iframes; base-class API) | `setupACHPayment`/`submitACHPayment` | `ach-purchase` (localhost-only!) |
| `offsite-payments/` | Hub: paypal/sprel via `setupOffsitePayment`; subpages `braintree/` (`SpreedlyBraintree`), `stripe-apm/` (`SpreedlyStripeAPM`), `ebanx/` (LATAM methods) | offsite APIs | `offsite-purchase`, `braintree-purchase`, `stripe-apm-purchase`, `create-purchase`, `transactions/:t`, `confirm` |

Backend routes with no frontend caller: `POST /purchase` (the only one exercising the
`sca_provider_key` vs `attempt_3dsecure` toggle), `POST /payment_methods` and
`/recache` proxies (called by the SDK itself, not by pages), `offsite-callback` (stub).

## Testing (this repo IS the SDK's e2e coverage — the SDK repo has none)

- Playwright, specs in `test/ui/testCases/` (8 files: token-generation, 3ds-flow,
  3ds-gateway-specific, offsite-payments, validations, allow-blank-date/-name/-expired).
  Page objects in `test/ui/pages/`, selectors/test data in `test/ui/util/test-constants.ts`.
- **`npm run test:e2e` targets the HEROKU deployment** (hardcoded baseURL in
  `playwright.config.js`) — it does NOT test local changes. Local: start the server,
  then `npm run test:e2e:local` (localhost:3000). No Playwright `webServer` config.
- **CI runs e2e only on a nightly cron (06:00 UTC)** against Heroku; the PR/push
  triggers in `.github/workflows/test_e2e.yml` are commented out. junit results go to
  Datadog, non-blocking. `dependency-review.yml` still gates PRs.
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
- README: no `.env` section, flow table omits ACH, and its testing-guide link 404s —
  the real folder is `docs/ testing and troubleshooting/` (leading space in the name).
- 3DS pages depend on the SDK-provided `serializeBrowserInfo` global; `browserSize`
  `'04'` and the accept header are hardcoded in each flow's CONFIG.
- `docs/` mirrors the SDK repo's docs structure (tokenization/three-ds/offsite/
  recaching/ach/migration-guide) — treat the SDK repo's `docs/` as canonical.
