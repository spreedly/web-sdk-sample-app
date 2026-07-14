# Spreedly Error Keys Reference

When a tokenization or payment-method request fails validation, Spreedly Core
returns an `errors` array in the response body. The SDK surfaces this array
verbatim on its error payloads:

- Card tokenization (Hosted Fields / Express Checkout): the `error` event, as
  `{ message, errors }`.
- ACH: the `achPaymentError` event, inside the sanitized
  `{ message, status?, errors? }` payload.
- Offsite (API flow): the `offsitePaymentError` event, inside the sanitized
  `{ message, status?, errors? }` payload.

Each entry has the shape:

```ts
{
  key: string;        // stable machine-readable identifier, e.g. 'errors.invalid'
  message: string;    // human-readable description, e.g. 'is invalid'
  attribute?: string; // the field the error is about, e.g. 'bank_routing_number'
}
```

Use `key` (not `message`) for programmatic branching — `message` is
human-facing copy and may change; `key` is stable. Use `attribute` to map the
error back to the specific field the customer needs to correct.

> **`key` is intentionally typed as `string`.** This list is maintained by
> Spreedly Core and is **not exhaustive** — new keys can be added server-side at
> any time without an SDK release. Always handle an unknown `key` gracefully
> (fall back to `message`) rather than assuming the set below is complete.

---

## Key reference

### Payment-method validation

These are the keys you'll most commonly handle. They apply to card, ACH, and
offsite payment-method creation, and each carries an `attribute` pointing at the
offending field.

| Key                    | Meaning                                                                                                                                               |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `errors.blank`         | The field named by `attribute` was submitted empty but is required. Prompt the customer to fill it in.                                                |
| `errors.invalid`       | The field named by `attribute` has an invalid value (e.g. a month of `13`, a malformed routing number). Prompt the customer to correct it.            |
| `errors.expired`       | The card's month/year indicates it is expired. Prompt the customer for a non-expired payment method.                                                  |
| `errors.blank_card_type` | The card number was invalid — the card type could not be determined.                                                                                |
| `errors.account_inactive` | A live (non-test) card number was submitted against a test/unpaid account. Can also surface when testing with an invalid number, since Spreedly treats unknown numbers as real. |

### Environment / configuration

| Key                                     | Meaning                                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `errors.environment_key_parameter_required` | No environment key was supplied when initializing the SDK. Pass a valid `environment_key`.               |
| `errors.invalid_environment_key_parameter`  | The supplied environment key is not valid. Verify the value and re-submit.                                |
| `errors.configuration`                  | The requested operation conflicts with how the instance is configured (e.g. calling recache on a tokenize-only setup, or vice versa). |

### Request integrity / security

These are protections applied by Spreedly against tampered or forged
submissions. They usually indicate an integration problem rather than
customer-correctable input.

| Key                                       | Meaning                                                                                                       |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `errors.unknown_referrer`                 | Spreedly could not determine the referring URL of the submission (required to detect MITM attacks).           |
| `errors.invalid_referrer`                 | The submission did not originate from a Spreedly payment frame and was rejected (MITM protection).            |
| `errors.invalid_enhanced_authentication_params` | Required parameters for enhanced authentication are missing or invalid.                                 |

---

## Handling example

```javascript
sdk.on('error', (error) => {
  // Client-side validation errors arrive as plain strings
  if (typeof error === 'string') {
    showBanner(error);
    return;
  }

  error.errors?.forEach((e) => {
    switch (e.key) {
      case 'errors.blank':
        markFieldRequired(e.attribute);
        break;
      case 'errors.invalid':
        markFieldInvalid(e.attribute, e.message);
        break;
      case 'errors.expired':
        markFieldInvalid(e.attribute, 'This card is expired.');
        break;
      default:
        // Unknown/unlisted key — fall back to the server message
        showBanner(e.message);
    }
  });
});
```

The same `errors` array (and the same handling) applies to `achPaymentError`
and `offsitePaymentError`, where it lives under `error.errors`.
