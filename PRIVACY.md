# Privacy Policy — Spreedly Web SDK

---

## Overview

The Spreedly Web SDK is a client-side JavaScript library that securely collects payment card information for tokenization. This document describes how payment data is handled by the SDK.

**Key Privacy Principles:**
- **No Persistent Data Storage** — Card data is never stored persistently in the browser
- **Memory-Only Processing** — Card data exists only during the active tokenization lifecycle
- **Minimal Data Collection** — Only payment data required for tokenization is collected
- **Secure Transmission** — All data sent via TLS encryption
- **Cleanup After Use** — Card data is cleared from memory after tokenization or expiry
- **Operational Telemetry Only** — The SDK sends anonymized performance metrics to monitor service health; no card data or personally identifiable information is included (see [Telemetry](#telemetry))

---

## Table of Contents

1. [What Data We Process](#what-data-we-process)
2. [How We Process Data](#how-we-process-data)
3. [Data Storage](#data-storage)
4. [Data Transmission](#data-transmission)
5. [Telemetry](#telemetry)
6. [Data Security](#data-security)
7. [PCI DSS Compliance](#pci-dss-compliance)
8. [Data Retention](#data-retention)
9. [Third-Party Data Sharing](#third-party-data-sharing)
10. [International Data Transfers](#international-data-transfers)
11. [Children's Privacy](#childrens-privacy)
12. [Contact & Further Information](#contact--further-information)

---

## What Data We Process

### Payment Card Data

The SDK processes the following payment card information **in memory only**:

| Data Type | Purpose | Retention |
|-----------|---------|-----------|
| **Card Number** | Tokenization | Cleared after tokenization |
| **CVV/CVC** | Security verification | Cleared after tokenization or after 3 minutes, whichever comes first |
| **Expiry Date** (Month/Year) | Card validation | Sent to Spreedly, not retained by SDK |
| **Cardholder Name** (Optional) | Transaction identification | Sent to Spreedly, not retained by SDK |
| **Billing Address** (Optional) | Fraud prevention | Sent to Spreedly, not retained by SDK |

**Important:** The SDK does **not** store any of this data persistently. All payment card data is:
1. Processed in memory only
2. Transmitted securely to Spreedly for tokenization
3. Cleared from memory after processing (see [Memory Cleanup](#memory-cleanup))

**CVV Retention Window:** The CVV value is held in the iframe's memory from the moment the user enters it until tokenization completes or a 3-minute timeout expires — whichever comes first. After either event, the CVV is cleared. This timeout prevents stale CVV data from persisting if the user abandons the form.

### Technical Data

The SDK processes minimal technical data for authentication:
- **Environment Key** — Provided by the merchant to identify the Spreedly environment
- **Nonce** — One-time-use authentication token
- **Signature** — HMAC signature for request verification
- **Timestamp** — Request timestamp for replay attack prevention

None of this technical data is personally identifiable.

---

## How We Process Data

### Data Flow

```
1. User enters card data in SDK iframe fields (on your website)
   ↓
2. SDK validates data inside the iframe
   ↓
3. SDK sends data to Spreedly API via HTTPS/TLS
   ↓
4. Spreedly returns a payment method token
   ↓
5. SDK clears card data from memory
   ↓
6. Token returned to your application
```

---

## Data Storage

### What the SDK Stores: Nothing

The Spreedly Web SDK does **not** use any persistent browser storage:

| Storage Type | SDK Behavior |
|--------------|--------------|
| **Browser LocalStorage** | Not used |
| **Browser SessionStorage** | Not used |
| **Cookies** | Not set |
| **IndexedDB** | Not used |
| **Browser Cache** | Not cached (iframe isolation) |
| **Server-Side Storage** | No server-side component in the SDK |

By not storing any payment card data, the SDK supports PCI DSS Requirement 3.2:
> "Do not store sensitive authentication data after authorization (even if encrypted)."

---

## Data Transmission

### Secure Communication

All payment card data is transmitted securely:

| Security Measure | Implementation |
|------------------|----------------|
| **Protocol** | HTTPS/TLS 1.2+ only |
| **Encryption** | AES-256 (or stronger) in transit |
| **Certificate Validation** | Browser-enforced certificate checks |
| **Origin Validation** | Cross-origin message validation |
| **Request Signing** | HMAC-SHA256 signatures |

**Destination:** `https://core.spreedly.com` — Spreedly's PCI DSS Level 1 certified infrastructure.

**No card data goes elsewhere.** Card numbers and CVVs are sent exclusively to Spreedly's tokenization API. Telemetry data (see below) is sent separately and never contains card data.

### Cross-Origin Communication

The SDK uses secure iframe isolation:
- **Iframe Sandboxing** — Restrictive sandbox attributes limit what the iframe can do
- **Message Validation** — All cross-frame `postMessage` calls are validated
- **Origin Checking** — Messages from untrusted origins are rejected

---

## Telemetry

The SDK sends **anonymized operational telemetry** to Datadog for service health monitoring.

### What telemetry includes:
- SDK load times and initialization success/failure
- Error rates and error types (e.g., network failures, validation errors)
- Browser and environment metadata (browser name, OS — no fingerprinting)

### What telemetry does NOT include:
- Card numbers, CVVs, or any payment card data
- Personally identifiable information (names, emails, addresses, IP addresses)
- User behavior tracking, session recordings, or clickstreams
- Cookies or persistent identifiers

### Why:
Telemetry allows Spreedly to monitor SDK availability, detect outages, and identify integration issues proactively.

### CSP requirement:
To allow telemetry, your Content Security Policy must include:
```
connect-src https://pci.browser-intake-datadoghq.com;
```

See [SECURITY.md](./SECURITY.md) for full CSP configuration.

---

## Data Security

The SDK implements multiple layers of security:

### Client-Side Security
- **Iframe Isolation** — Card data is collected inside a Spreedly-hosted iframe, isolated from your page's JavaScript context
- **Input Validation** — Real-time Luhn checks, card type detection, and format validation run inside the iframe
- **Memory Cleanup** — Card data variables are cleared after tokenization

### Transmission Security
- **TLS Encryption** — All data transmitted via HTTPS
- **Certificate Validation** — Browser-enforced SSL/TLS checks
- **Request Signing** — HMAC signatures prevent tampering
- **Nonce-Based Auth** — One-time-use authentication tokens prevent replay attacks

### Code Security
- **SRI (Subresource Integrity)** — Integrity hashes published for every release to verify file authenticity
- **SBOM** — Software Bill of Materials for dependency auditing

For full security integration guidance, see [SECURITY.md](./SECURITY.md).

---

## PCI DSS Compliance

### How the SDK Helps

The Spreedly Web SDK helps merchants reduce their PCI DSS scope by:

1. **Never storing card data** 
2. **Using iframe isolation** 
3. **Transmitting via TLS** 
4. **Validating inputs** 
5. **Clearing memory after use**

### Your Responsibilities

As a merchant, you must:
- Serve the SDK over HTTPS
- Not log, intercept, or store card data from the SDK
- Follow Spreedly's integration guidelines
- Maintain your own PCI DSS compliance program
- Consult your Qualified Security Assessor (QSA) for your specific compliance requirements

---

## Data Retention

### SDK Retention: None

The SDK does **not** retain any data beyond the active processing lifecycle:

1. Card data exists in iframe memory only while the user is interacting with the form
2. CVV is cleared after tokenization or after 3 minutes (whichever comes first)
3. Card number is cleared after tokenization
4. No data is written to any persistent browser storage

### Spreedly Retention

For information about how Spreedly retains tokenized data, refer to [Spreedly's Privacy Policy](https://legal.spreedly.com/#privacy-policy).

---

## Third-Party Data Sharing

### Card Data

The SDK sends card data **only** to Spreedly (`core.spreedly.com`). Card numbers and CVVs are not shared with analytics providers, advertising networks, marketing services, data brokers, or any other external services.

### No Sale of Personal Information

Spreedly does not sell any personal information collected through the SDK. This applies under the CCPA and all other applicable US state consumer privacy laws.

### Telemetry Data

Anonymized operational metrics are sent to Datadog (`pci.browser-intake-datadoghq.com`) for service monitoring. This data contains no card information or personally identifiable information. See [Telemetry](#telemetry) for details.

### Offsite Payment Providers

If you integrate offsite payment methods (Braintree APM, Stripe APM), those flows involve their respective third-party SDKs, which have their own privacy policies:
- **Braintree/PayPal:** [PayPal Privacy Policy](https://www.paypal.com/webapps/mpp/ua/privacy-full)
- **Stripe:** [Stripe Privacy Policy](https://stripe.com/privacy)

---

## International Data Transfers

Payment card data is transmitted to Spreedly's infrastructure in the United States. Spreedly is certified under the **EU-US Data Privacy Framework**, the **UK Extension to the EU-US DPF**, and the **Swiss-US Data Privacy Framework**, providing legally recognized mechanisms for personal data transfers from the EEA, United Kingdom, and Switzerland to the United States.

For full details on Spreedly's data transfer mechanisms, Standard Contractual Clauses, and Data Processing Addendum, see:
- [Spreedly Privacy Policy](https://legal.spreedly.com/#privacy-policy)
- [Spreedly Data Processing Addendum](https://legal.spreedly.com/#data-processing-addendum)

**Your Responsibility:** Ensure appropriate legal mechanisms for international transfers are in place with Spreedly for your jurisdiction.

---

## Children's Privacy

The Spreedly Web SDK is not intended for use by children under the age of 18 (or the applicable age in your jurisdiction). Merchants must not knowingly collect payment information from children without proper parental consent.

---

## Contact & Further Information

For the full Spreedly corporate privacy policy, terms of service, and data processing addendum, visit: [legal.spreedly.com](https://legal.spreedly.com/)
