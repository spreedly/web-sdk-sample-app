# ACH — Deprecated merchant-collected API

`setupACHPayment` / `submitACHPayment` / `clearACHPayment` on `SpreedlyHostedFields` and
`SpreedlyExpressCheckout` are **deprecated**. They have your page collect the routing and
account numbers in its own inputs and hand them to the SDK, so the numbers pass through your
application state.

**Use [`SpreedlyACHFields`](./ach-hosted-fields/INTEGRATION_GUIDE.md) (Hosted Fields) or
[`SpreedlyACHForm`](./ach-form/INTEGRATION_GUIDE.md) (Express Checkout) instead.** The
deprecated methods still work, but a future release will remove them. Older versions keep
them. This page documents them for existing integrations.

## Example

```javascript
const sdk = new SpreedlyHostedFields(authDetails);

sdk.on('achTokenGenerated', ({ token, last4 }) => { /* … */ });
sdk.on('achPaymentError', (error) => console.error(error.message));

sdk.setupACHPayment({
  bankRoutingNumber: '021000021',
  bankAccountNumber: '9876543210',
  fullName: 'Bob Smith',
  bankAccountType: 'checking',
  bankAccountHolderType: 'personal',
});
sdk.submitACHPayment();
```

## Events

`achTokenGenerated` sends `{ token, last4 }`. The `achPaymentError` payload is a sanitized
`{ message, status?, errors? }` object built only from the server response — it never carries the request body, so account /
routing numbers cannot leak into logs. Each entry in `errors` is
`{ key, message, attribute? }`; see the
**[Error Keys Reference](../errors/ERROR_KEYS_REFERENCE.md)**.

## `ACHPaymentConfig`

The full config for `setupACHPayment`:

| Field                    | Type                       | Required | Notes                                                 |
| ------------------------ | -------------------------- | -------- | ----------------------------------------------------- |
| `bankRoutingNumber`      | `string`                   | yes      | A valid US routing number, or a Canadian one (9 digits starting with `0`) |
| `bankAccountNumber`      | `string`                   | yes      | Bank account number                                   |
| `fullName`               | `string`                   | †        | Either `fullName` OR (`firstName` AND `lastName`)     |
| `firstName` / `lastName` | `string`                   | †        | See above                                             |
| `bankName`               | `string`                   | no       | Display name of the bank                              |
| `bankAccountType`        | `'checking' \| 'savings'`  | no       |                                                       |
| `bankAccountHolderType`  | `'personal' \| 'business'` | no       |                                                       |
| `email` / `phoneNumber`  | `string`                   | no       |                                                       |
| `address1` … `country`   | `string`                   | no       | Optional billing address; some gateways require it    |
| `metadata`               | `Record<string, string>`   | no       | Sent to the Spreedly API                              |
| `mandate`                | `object`                   | no       | Sent to the Spreedly API                              |
| `retained`               | `boolean`                  | no       | Sent to the Spreedly API. To retain the payment method, call the Spreedly retain API from your backend (`PUT /v1/payment_methods/{token}/retain.json`) |

> Spreedly supports US (`US`) and Canadian (`CA`) bank accounts only.
