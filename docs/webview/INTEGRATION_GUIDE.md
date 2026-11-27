# Mobile WebViews — Integration Guide

What to know before running a web checkout built on the Spreedly checkout SDK (Hosted Fields or
Express Checkout) inside a native app's WebView: iOS `WKWebView`, Android `WebView`, or a hybrid
shell such as Capacitor, Cordova or React Native WebView.

## Support position

- **The SDK is not tested or certified inside WebViews.** It does not add WebView-specific code.
  Anything that works does so because the WebView supports it by default.
- **For native and wrapper apps, use the native Spreedly SDKs** (iOS, Android, React Native). Use a
  WebView only when you share one web checkout between your site and your app, and test it end to
  end on each platform and OS version you support.

---

## Card form (Hosted Fields and Express Checkout)

The SDK needs only JavaScript, iframes and `postMessage`, so the card form should work as it does
in a mobile browser. Your app must keep JavaScript on and must not block navigation inside iframes.

---

## Google Pay

Supported from SDK **1.11.0**, but your native app has to turn Google Pay on in its WebView. Follow
Google's guide for your platform:
[Android WebView](https://developers.google.com/pay/api/android/guides/recipes/using-android-webview)
or [iOS WKWebView](https://developers.google.com/pay/api/web/guides/recipes/using-ios-wkwebview).

Until the app does, no button is drawn, `googlePayUnavailable` fires and the card form keeps
working (see [Google Pay Integration Guide](../google-pay/INTEGRATION_GUIDE.md)).

---

## 3D Secure (`SpreedlyThreeDSLifecycle`)

3DS2 should work but is untested in WebViews. It runs in iframes on your page with no popups. Your
app must:

- Accept third-party cookies (Android: `setAcceptThirdPartyCookies(true)`; iOS blocks them by
  default).
- Allow navigation inside the challenge iframe.
- Let a 3DS1 fallback redirect the whole WebView, and bring the `redirect_url` back into the app.

Don't use Braintree's `challengeIframeLocation: 'popup'` in a WebView. See
[3DS Overview](../three-ds/OVERVIEW.md).

---

## PayPal (PPCP)

`presentationMode: 'modal'` is not supported (see [PPCP API Reference](../ppcp/API_REFERENCE.md)).
Popup modes need your app to handle new windows; otherwise use `'redirect'`.
