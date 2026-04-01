# Offsite Payments Overview

Spreedly supports multiple offsite payment integrations. This document helps you choose the right one.

## Quick Comparison

| Aspect | General Offsite | Braintree APM | Stripe APM |
|--------|----------------|---------------|------------|
| **Payment Methods** | PayPal, PIX, Boleto, OXXO, NuPay, Khipu, Rapipago | PayPal, Venmo | iDEAL, Bancontact, SEPA, and others via Stripe |
| **SDK Class** | `SpreedlyHostedFields` or `SpreedlyExpressCheckout` | `SpreedlyBraintree` | `SpreedlyStripeAPM` |
| **Third-party SDK** | None | Braintree JS SDK required | Stripe.js required |
| **Flow** | Create Payment Method → Purchase → Redirect | Pending Purchase → Mount buttons → Confirm | Pending Purchase → Mount Payment Element → Confirm |

## 1. General Offsite Payments

**Best for:** Merchants using EBANX or other gateways that support region-specific payment methods.

**How it works:**
- Use the existing `SpreedlyHostedFields` or `SpreedlyExpressCheckout` SDK
- Call `setupOffsitePayment()` with payment method configuration
- Call `submitOffsitePayment()` to create the payment method
- Create a purchase on your backend and redirect the customer

**Supported payment methods:** PayPal, PIX, Boleto, NuPay, OXXO, Khipu, Rapipago, and more.

📖 See: [General Offsite Integration Guide](./general/INTEGRATION_GUIDE.md)

---

## 2. Braintree APM (PayPal & Venmo)

**Best for:** Merchants using Braintree as their gateway who want native PayPal and Venmo buttons.

**How it works:**
- Create a pending purchase via Spreedly to obtain a Braintree `client_token`
- Initialize `SpreedlyBraintree` with the transaction token
- Mount native PayPal and/or Venmo buttons
- Customer authorizes payment through the provider
- Confirm the transaction with Spreedly

**Requires:** Braintree JS SDK scripts loaded on the page.

📖 See: [Braintree APM Integration Guide](./braintree/INTEGRATION_GUIDE.md)

---

## 3. Stripe APM

**Best for:** Merchants using Stripe who want to offer European and global payment methods via the Stripe Payment Element.

**How it works:**
- Create a pending purchase via Spreedly to obtain a Stripe `client_secret`
- Initialize `SpreedlyStripeAPM` with the client secret
- Mount the Stripe Payment Element
- Customer completes payment through Stripe's UI
- Handle the redirect back to your site

**Requires:** Stripe.js loaded on the page.

📖 See: [Stripe APM Integration Guide](./stripe-apm/INTEGRATION_GUIDE.md)
