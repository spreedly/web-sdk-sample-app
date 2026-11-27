# Mobile WebViews — Integration Guide

This guide covers running a web checkout built on the Spreedly checkout SDK (Hosted Fields or
Express Checkout) inside a native app's WebView: iOS `WKWebView`, Android `WebView`, or a hybrid
shell such as Capacitor, Cordova or React Native WebView. It also lists what the native app has to
do for Google Pay and 3D Secure to work there.

## Support position

- **The SDK is not tested or certified inside WebViews.** It does not add WebView-specific code.
  Anything that works does so because the WebView supports it by default.
- **For native and wrapper apps, use the native Spreedly SDKs** (iOS, Android, React Native). Use a
  WebView only when you share one web checkout between your site and your app, and test it end to
  end on each platform and OS version you support.

## Who this guide is for

Merchants and integrators whose checkout page is loaded in a WebView inside their own mobile app.
It assumes the page already works in a mobile browser.

---

## Card form (Hosted Fields and Express Checkout)

The SDK needs only what a WebView already provides: JavaScript, cross-origin iframes and
`postMessage` between your page and the Spreedly iframes. With JavaScript enabled, the card form
and tokenization should work the same way they do in a mobile browser.

What the app must allow:

- **JavaScript.** Android: `webView.settings.javaScriptEnabled = true`. It is on by default in
  `WKWebView`.
- **Navigation inside iframes.** Don't cancel, or open externally, navigations for sub-frames in
  `shouldOverrideUrlLoading` (Android) or `decidePolicyFor navigationAction` (iOS). Only intercept
  navigations of the main frame.
- **Your Content Security Policy.** The same CSP rules as in a browser apply. See the CSP section of
  the guide for the feature you use.

---

## Google Pay

Google Pay works in a WebView from SDK **1.11.0**, but only after the native app turns it on.
`SpreedlyGooglePay` itself needs no change: it calls Google's `isReadyToPay()` and draws the
button only when the shopper can pay.

### Android `WebView`

Follow Google's [Using Android WebView](https://developers.google.com/pay/api/android/guides/recipes/using-android-webview)
guide. In short:

1. Depend on `androidx.webkit:webkit` **1.14.0** or later.
2. Turn on the Payment Request API for the WebView, after checking it is supported:

   ```kotlin
   if (WebViewFeature.isFeatureSupported(WebViewFeature.PAYMENT_REQUEST)) {
       WebSettingsCompat.setPaymentRequestEnabled(webView.settings, true)
   }
   ```

3. Declare the payment intents in `AndroidManifest.xml` so the app can see Google Pay:

   ```xml
   <queries>
       <intent>
           <action android:name="org.chromium.intent.action.PAY" />
       </intent>
       <intent>
           <action android:name="org.chromium.intent.action.IS_READY_TO_PAY" />
       </intent>
       <intent>
           <action android:name="org.chromium.intent.action.UPDATE_PAYMENT_DETAILS" />
       </intent>
   </queries>
   ```

4. Have Google approve the app for Google Pay in a WebView, as Google's guide describes, before
   going live.

### iOS `WKWebView`

Follow Google's [Using iOS WKWebView](https://developers.google.com/pay/api/web/guides/recipes/using-ios-wkwebview)
guide. In short:

1. Add `GOOGLE_PAY_SUPPORTED` to the WebView's user agent (for example through
   `applicationNameForUserAgent` or `customUserAgent`).
2. Handle the popup window Google opens for the payment sheet: implement `WKUIDelegate`
   `webView(_:createWebViewWith:for:windowFeatures:)` to show it, and close it in
   `webViewDidClose(_:)`.

### If the app doesn't do this

Google Pay is not available: no button is drawn, `googlePayUnavailable` fires with
`NOT_READY_TO_PAY`, and the card form keeps working. Treat this as the normal fallback (see
[Google Pay Integration Guide](../google-pay/INTEGRATION_GUIDE.md)).

---

## 3D Secure (`SpreedlyThreeDSLifecycle`)

3DS2 should work in a WebView, but it is untested there. Device fingerprinting and the challenge run
in iframes on your page (`challengeIframeLocation`); the SDK opens no popups.

The one exception is **Braintree with `challengeIframeLocation: 'popup'`**, which lets Braintree
show the challenge in its own window. Don't use `'popup'` in a WebView; pass the id of a container
on your page instead.

What the app must allow:

- **Third-party cookies.** Issuer ACS pages run in third-party iframes and may need cookies.
  - Android: `CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)`. It is off by
    default.
  - iOS: `WKWebView` blocks third-party cookies by default, and the app can't turn that off. Test
    challenges with the issuers and gateways you use.
- **Navigation inside sub-frames.** The ACS navigates inside the challenge iframe. Don't block it
  or hand it to an external browser.
- **Full-page navigation for 3DS1 fallback.** When a gateway falls back to 3DS1 and returns only a
  `checkout_url`, the SDK navigates the whole page there (`window.location.href`). Let the WebView
  follow it, and make sure the `redirect_url` on your transaction loads back inside the app, not
  in the system browser.

See [3DS Overview](../three-ds/OVERVIEW.md) for the two 3DS flows.

---

## PayPal (PPCP)

`presentationMode: 'modal'` is not supported (see
[PPCP API Reference](../ppcp/API_REFERENCE.md)). The popup-family modes open a new window, so the
app must handle window creation (`WKUIDelegate` on iOS; `setSupportMultipleWindows(true)` and
`WebChromeClient.onCreateWindow` on Android), or use `'redirect'`.

---

## Checklist

|               | Android `WebView`                                                                        | iOS `WKWebView`                                                                       |
| ------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Card form     | JavaScript on, sub-frame navigation allowed                                              | Sub-frame navigation allowed                                                          |
| Google Pay    | `webkit` 1.14.0+, `setPaymentRequestEnabled(true)`, `<queries>` intents, Google approval | `GOOGLE_PAY_SUPPORTED` in the user agent, `WKUIDelegate` popup handling               |
| 3DS2          | `setAcceptThirdPartyCookies(true)`, sub-frame navigation allowed, no Braintree `'popup'` | Sub-frame navigation allowed, no Braintree `'popup'`; third-party cookies are blocked |
| 3DS1 fallback | Allow full-page navigation, return URL opens in the app                                  | Allow full-page navigation, return URL opens in the app                               |

### Test end to end

On each platform and OS version you support, inside the real app:

- Tokenize a card with your form.
- Show and complete the Google Pay sheet, and check the fallback when Google Pay is unavailable.
- Run a frictionless and a challenge 3DS2 purchase with your gateway.
- If your gateway can fall back to 3DS1, check that the shopper returns to the app.

---

## Guide contents

- [Tokenization Overview](../tokenization/OVERVIEW.md) — Hosted Fields vs Express Checkout.
- [Google Pay Integration Guide](../google-pay/INTEGRATION_GUIDE.md)
- [3DS Overview](../three-ds/OVERVIEW.md)
