# 3D Secure Overview

Spreedly supports multiple 3DS authentication approaches. This document helps you choose the right one.

## Quick Comparison

| Aspect | 3DS2 Global (Forter) | 3DS2 Gateway Specific |
|--------|---------------------|----------------------|
| **Provider** | Forter (Spreedly partner) | Payment gateway |
| **Portability** | ✅ Works across gateways | ❌ Gateway-specific |
| **User Experience** | Iframe | Iframe (or redirect for fallback) |
| **Trigger** | `sca_provider_key` in request | `three_ds_version: "2"` |
| **Identifier** | `managed_order_token` in response | `required_action` field |

## Decision Tree

```
Creating a purchase transaction?
│
├─ Want portable 3DS across multiple gateways?
│   └─ YES → Use 3DS2 Global (Forter)
│
└─ Gateway handles its own 3DS?
    └─ YES → Use 3DS2 Gateway Specific
```

## 1. 3DS2 Global (Forter-Managed)

**Best for:** Merchants using multiple gateways who want consistent 3DS handling.

**How it works:**
- Spreedly routes authentication through Forter
- Single integration works across all gateways
- Forter SDK handles device fingerprinting and challenges

**Purchase request requires:**
```json
{
  "sca_provider_key": "your_sca_key",
  "browser_info": "base64_encoded_info"
}
```

**Response indicator:**
```json
{
  "transaction": {
    "state": "pending",
    "managed_order_token": "eyJ..."
  }
}
```

📖 See: [3DS2 Global Integration Guide](./global/INTEGRATION_GUIDE.md)

---

## 2. 3DS2 Gateway Specific

**Best for:** Merchants using a single gateway that handles its own 3DS.

**How it works:**
- Gateway performs 3DS authentication directly
- SDK handles device fingerprint iframes, challenge forms
- Merchant calls `/complete` endpoint when triggered

**Purchase request requires:**
```json
{
  "three_ds_version": "2",
  "attempt_3dsecure": true,
  "browser_info": "base64_encoded_info"
}
```

**Response indicators:**
```json
{
  "transaction": {
    "state": "pending",
    "required_action": "device_fingerprint" | "challenge",
    "device_fingerprint_form_embed_url": "...",
    "challenge_url": "..."
  }
}
```

📖 See: [3DS2 Gateway Specific Integration Guide](./gateway-specific/INTEGRATION_GUIDE.md)

---

## SDK Detection Logic

The SDK automatically routes to the correct flow:

```typescript
// In SpreedlyThreeDSLifecycle
if (status.managed_order_token) {
  // → 3DS2 Global (Forter)
} else if (status.required_action === 'device_fingerprint' || status.required_action === 'challenge') {
  // → 3DS2 Gateway Specific
} else if (status.required_action === 'redirect' || status.required_action === 'fallback') {
  // → Redirect/Fallback flow
} 
```

---

## Callbacks by Flow

| Callback | 3DS2 Global | 3DS2 Gateway Specific |
|----------|-------------|----------------------|
| `onSuccess` | ✅ | ✅ |
| `onError` | ✅ | ✅ |
| `onChallenge` | ✅ | ✅ |
| `onDeviceFingerprint` | ❌ | ✅ |
| `onTriggerCompletion` | ❌ | ✅ |
| `onFinalizationTimeout` | ❌ | ✅ |

