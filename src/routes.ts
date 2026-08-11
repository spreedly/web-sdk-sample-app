import { Router } from 'express';
import { getAuthParams } from './controllers/auth';
import { 
  createPaymentMethod, 
  getPaymentMethods, 
  retainPaymentMethod, 
  recachePaymentMethod, 
  createPurchaseTransaction, 
  createPurchaseWith3DS, 
  createPurchaseWith3DSGatewaySpecific, 
  createSimplePurchase, 
  completeTransaction,
  createOffsitePurchase,
  getTransaction,
  handleOffsiteCallback,
  createStripeAPMPurchase,
  createPurchase,
  createBraintreePurchase,
  confirmTransaction,
  createAchPurchase,
} from './controllers/payments';
import {
  getPPCPClientToken,
  getPPCPConfig,
  createPPCPOrder,
  capturePPCPOrder,
  createPPCPVaultSetupToken,
  createPPCPVaultPaymentToken,
  listPPCPVaultTokens,
  chargePPCPVaultToken,
  createPPCPVaultPurchaseOrder,
  capturePPCPVaultPurchaseOrder,
} from './controllers/ppcp';
import {
  createSpreedlyPPCPOrder,
  captureSpreedlyPPCPOrder,
  captureSpreedlyPPCPByTransaction,
  getSpreedlyPPCPTransaction,
  importSpreedlyPPCPVaultToken,
  listSpreedlyPPCPVaultTokens,
  chargeSpreedlyPPCPVaultToken,
} from './controllers/ppcp-spreedly';

const router = Router();

/**
 * @swagger
 * /api/v1/auth/params:
 *   get:
 *     description: Generate authentication parameters including nonce, timestamp, signature, and certificate token for Spreedly integration
 *     tags: [Authentication]
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Authentication parameters generated successfully
 *         schema:
 *           type: object
 *           properties:
 *             nonce:
 *               type: string
 *               description: Unique identifier (UUID)
 *             timestamp:
 *               type: number
 *               description: Unix timestamp in seconds
 *             signature:
 *               type: string
 *               description: Base64-encoded SHA256 signature
 *             certificateToken:
 *               type: string
 *               description: Certificate token for authentication
 *       500:
 *         description: Error generating authentication parameters
 */
router.get('/auth/params', getAuthParams);
/**
 * @swagger
 * /api/v1/payment_methods:
 *   post:
 *     description: Create a restricted payment method token using Spreedly
 *     tags: [Payment Methods]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: spreedly-environment-key
 *         description: Spreedly environment key for authentication
 *         in: header
 *         required: true
 *         type: string
 *       - name: body
 *         description: Payment method details including card information
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *     responses:
 *       200:
 *         description: Payment method created successfully
 *       500:
 *         description: Error creating payment method
 */
router.post('/payment_methods', createPaymentMethod);
/**
 * @swagger
 * /api/v1/payment_methods:
 *   get:
 *     description: Retrieve a list of retained payment methods in descending order (latest first) from Spreedly
 *     tags: [Payment Methods]
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: List of payment methods retrieved successfully
 *       500:
 *         description: Error retrieving payment methods
 */
router.get('/payment_methods', getPaymentMethods);
/**
 * @swagger
 * /api/v1/payment_methods/{paymentMethodToken}/retain:
 *   put:
 *     description: Retain a payment method to prevent automatic deletion
 *     tags: [Payment Methods]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: paymentMethodToken
 *         description: The unique token identifying the payment method
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Payment method retained successfully
 *       500:
 *         description: Error retaining payment method
 */
router.put('/payment_methods/:paymentMethodToken/retain', retainPaymentMethod);


/**
 * @swagger
 * /api/v1/payment_methods/{paymentMethodToken}/recache:
 *   post:
 *     description: Recache a payment method
 *     tags: [Payment Methods]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: paymentMethodToken
 *         description: The unique token identifying the payment method
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Payment method recached successfully
 *       500:
 *         description: Error recaching payment method
 */
router.post('/payment_methods/:paymentMethodToken/recache', recachePaymentMethod);
/**
 * @swagger
 * /api/v1/purchase:
 *   post:
 *     description: Create a purchase transaction using a payment method token with SCA authentication
 *     tags: [Transactions]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         description: Purchase transaction details
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           required:
 *             - amount
 *             - currency_code
 *             - payment_method_token
 *           properties:
 *             amount:
 *               type: number
 *               description: Transaction amount in dollars
 *             currency_code:
 *               type: string
 *               description: ISO 4217 currency code (e.g., USD, EUR)
 *             payment_method_token:
 *               type: string
 *               description: The token identifying the payment method to use
 *             attempt_3dsecure:
 *               type: boolean
 *               description: If true, uses gateway-specific 3DS instead of sca_provider_key
 *     responses:
 *       200:
 *         description: Purchase transaction created successfully
 *       500:
 *         description: Error creating purchase transaction
 */
router.post('/purchase', createPurchaseTransaction);


/**
 * @swagger
 * /api/v1/create-purchase-with-3ds:
 *   post:
 *     description: Create a purchase with 3DS (sca_provider_key is read from server config)
 *     tags: [Transactions]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         description: Purchase details
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             payment_method_token:
 *               type: string
 *             amount:
 *               type: number
 *             currency_code:
 *               type: string
 *             browser_info:
 *               type: string
 *     responses:
 *       200:
 *         description: Purchase processed successfully
 *       500:
 *         description: Error processing purchase
 */
router.post('/create-purchase-with-3ds', createPurchaseWith3DS);

/**
 * @swagger
 * /api/v1/create-purchase-with-3ds-gateway-specific:
 *   post:
 *     description: Create a purchase with Gateway Specific 3DS (uses three_ds_version=2 and attempt_3dsecure=true)
 *     tags: [Transactions]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         description: Purchase details
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             payment_method_token:
 *               type: string
 *             amount:
 *               type: number
 *             currency_code:
 *               type: string
 *             browser_info:
 *               type: string
 *             gateway:
 *               type: string
 *               description: Gateway to use (spreedly, paypal, ebanx, stripe, braintree). Defaults to spreedly.
 *     responses:
 *       200:
 *         description: Purchase processed successfully
 *       500:
 *         description: Error processing purchase
 */
router.post('/create-purchase-with-3ds-gateway-specific', createPurchaseWith3DSGatewaySpecific);

/**
 * @swagger
 * /api/v1/simple-purchase:
 *   post:
 *     description: Create a simple purchase transaction
 *     tags: [Transactions]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         description: Purchase details
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             payment_method_token:
 *               type: string
 *             amount:
 *               type: number
 *             currency_code:
 *               type: string
 *     responses:
 *       200:
 *         description: Purchase processed successfully
 *       500:
 *         description: Error processing purchase
 */
router.post('/simple-purchase', createSimplePurchase);

/**
 * @swagger
 * /api/v1/transactions/{transactionToken}/complete:
 *   post:
 *     description: Complete a 3DS transaction (Gateway Specific). Called after device fingerprint or challenge.
 *     tags: [Transactions]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: transactionToken
 *         description: The unique token identifying the transaction
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Transaction completed successfully
 *       400:
 *         description: Invalid transaction token format
 *       500:
 *         description: Error completing transaction
 */
router.post('/transactions/:transactionToken/complete', completeTransaction);

/**
 * @swagger
 * /api/v1/transactions/{transactionToken}:
 *   get:
 *     description: Get transaction details by token
 *     tags: [Transactions]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: transactionToken
 *         description: The unique token identifying the transaction
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Transaction details retrieved successfully
 *       400:
 *         description: Invalid transaction token format
 *       500:
 *         description: Error retrieving transaction
 */
router.get('/transactions/:transactionToken', getTransaction);

/**
 * @swagger
 * /api/v1/offsite-purchase:
 *   post:
 *     description: Create an offsite purchase that redirects customer to payment provider
 *     tags: [Offsite Payments]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         description: Purchase details
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           required:
 *             - payment_method_token
 *             - amount
 *             - redirect_url
 *             - callback_url
 *           properties:
 *             gateway:
 *               type: string
 *               description: Gateway to use (spreedly, paypal, ebanx, stripe, braintree). Defaults to spreedly.
 *             payment_method_token:
 *               type: string
 *               description: Token of the offsite payment method
 *             amount:
 *               type: number
 *               description: Transaction amount in cents
 *             currency_code:
 *               type: string
 *               description: ISO 4217 currency code (default USD)
 *             redirect_url:
 *               type: string
 *               description: URL to redirect customer after payment
 *             callback_url:
 *               type: string
 *               description: URL for Spreedly callbacks
 *     responses:
 *       200:
 *         description: Purchase initiated, includes checkout_url for redirect
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Error creating purchase
 */
router.post('/offsite-purchase', createOffsitePurchase);

/**
 * @swagger
 * /api/v1/offsite-callback:
 *   post:
 *     description: Webhook endpoint for receiving offsite payment callbacks from Spreedly
 *     tags: [Offsite Payments]
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Callback received and acknowledged
 */
router.post('/offsite-callback', handleOffsiteCallback);

/**
 * @swagger
 * /api/v1/stripe-apm-purchase:
 *   post:
 *     description: Create a pending Stripe APM purchase. Returns client_secret for Payment Element.
 *     tags: [Stripe APM]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         description: Purchase details
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             amount:
 *               type: number
 *               description: Transaction amount in cents (default 1000)
 *             currency_code:
 *               type: string
 *               description: ISO 4217 currency code (default EUR)
 *             apm_types:
 *               type: array
 *               items:
 *                 type: string
 *               description: Array of APM types to accept (e.g., ["ideal", "bancontact"])
 *             redirect_url:
 *               type: string
 *               description: URL to redirect customer after payment
 *             callback_url:
 *               type: string
 *               description: URL for Spreedly callbacks
 *     responses:
 *       200:
 *         description: Pending purchase created, includes client_secret for Payment Element
 *         schema:
 *           type: object
 *           properties:
 *             success:
 *               type: boolean
 *             transaction:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 state:
 *                   type: string
 *             client_secret:
 *               type: string
 *               description: Stripe client_secret for Payment Element
 *       500:
 *         description: Error creating pending purchase
 */
router.post('/stripe-apm-purchase', createStripeAPMPurchase);

/**
 * @swagger
 * /api/v1/create-purchase:
 *   post:
 *     description: Create a purchase transaction. Supports multiple gateways (spreedly, paypal, ebanx, stripe).
 *     tags: [Transactions]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         description: Purchase details following Spreedly's purchase API format
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             gateway:
 *               type: string
 *               description: Gateway to use (spreedly, paypal, ebanx, stripe)
 *             transaction:
 *               type: object
 *               properties:
 *                 payment_method_token:
 *                   type: string
 *                 amount:
 *                   type: number
 *                 currency_code:
 *                   type: string
 *                 redirect_url:
 *                   type: string
 *                 callback_url:
 *                   type: string
 *     responses:
 *       200:
 *         description: Purchase transaction created successfully
 *       500:
 *         description: Error creating purchase
 */
router.post('/create-purchase', createPurchase);

/**
 * @swagger
 * /api/v1/braintree-purchase:
 *   post:
 *     description: Create a pending Braintree PayPal/Venmo purchase. Returns client_token for frontend use. Note - payment_method_type is hardcoded to 'paypal' and paypal_flow_type is hardcoded to 'checkout'.
 *     tags: [Braintree]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         description: Purchase details
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             amount:
 *               type: number
 *               description: Transaction amount in cents (default 1000)
 *             currency_code:
 *               type: string
 *               description: ISO 4217 currency code (default USD)
 *             redirect_url:
 *               type: string
 *               description: URL to redirect customer after payment
 *             callback_url:
 *               type: string
 *               description: URL for Spreedly callbacks
 *     responses:
 *       200:
 *         description: Pending purchase created, includes client_token for Braintree SDK
 *         schema:
 *           type: object
 *           properties:
 *             success:
 *               type: boolean
 *             transaction:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 state:
 *                   type: string
 *                 client_token:
 *                   type: string
 *       500:
 *         description: Error creating pending purchase
 */
router.post('/braintree-purchase', createBraintreePurchase);

/**
 * @swagger
 * /api/v1/transactions/{transactionToken}/confirm:
 *   post:
 *     description: Confirm a Braintree/Stripe-apm transaction with the nonce from PayPal/Venmo
 *     tags: [Braintree, Stripe-apm]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: transactionToken
 *         description: The unique token identifying the transaction
 *         in: path
 *         required: true
 *         type: string
 *       - name: body
 *         description: Confirmation details
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           required:
 *             - nonce
 *             - payment_method_type
 *           properties:
 *             state:
 *               type: string
 *               description: State of the transaction (e.g., Successful, Cancelled, Failed)
 *             nonce:
 *               type: string
 *               description: Nonce received from Braintree PayPal/Venmo SDK
 *             payment_method_type:
 *               type: string
 *               description: Payment method type (e.g., paypal, venmo)
 *     responses:
 *       200:
 *         description: Transaction confirmed successfully
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Error confirming transaction
 */
router.post('/transactions/:transactionToken/confirm', confirmTransaction);

/**
 * @swagger
 * /api/v1/ach-purchase:
 *   post:
 *     description: Create a purchase transaction against an ACH (bank_account) payment method using the Spreedly Test gateway
 *     tags: [ACH Payments]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         description: Purchase details
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           required:
 *             - payment_method_token
 *             - amount
 *           properties:
 *             payment_method_token:
 *               type: string
 *               description: Token of the bank_account payment method
 *             amount:
 *               type: number
 *               description: Transaction amount in cents
 *             currency_code:
 *               type: string
 *               description: ISO 4217 currency code (default USD)
 *     responses:
 *       200:
 *         description: ACH purchase created successfully
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Error creating purchase
 */
router.post('/ach-purchase', createAchPurchase);

/**
 * @swagger
 * /api/v1/ppcp/client-token:
 *   get:
 *     description: (PPCP interim spike) Mint a browser-safe PayPal client token for the JS SDK v6 createInstance({ clientToken }). Talks to PayPal sandbox directly.
 *     tags: [PPCP]
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Client token minted
 *         schema:
 *           type: object
 *           properties:
 *             clientToken:
 *               type: string
 *       500:
 *         description: Error minting client token
 */
router.get('/ppcp/client-token', getPPCPClientToken);

/**
 * @swagger
 * /api/v1/ppcp/config:
 *   get:
 *     description: Public PayPal client ID for initialising the JS SDK v6 (createInstance({ clientId })). Static and browser-safe — a real merchant would inline it; this exists because the demo keeps it in .env.
 *     tags: [PPCP]
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: "{ clientId }"
 *       500:
 *         description: Client ID not configured
 */
router.get('/ppcp/config', getPPCPConfig);

/**
 * @swagger
 * /api/v1/ppcp/orders:
 *   post:
 *     description: (PPCP interim spike) Create a PayPal order via Orders V2 (sandbox, direct). Returns the PayPal order incl. id.
 *     tags: [PPCP]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         description: Order details
 *         in: body
 *         required: false
 *         schema:
 *           type: object
 *           properties:
 *             amount:
 *               type: string
 *               description: Decimal amount string, e.g. "10.00" (default "10.00")
 *             currency_code:
 *               type: string
 *               description: ISO 4217 currency code (default USD)
 *             intent:
 *               type: string
 *               description: CAPTURE or AUTHORIZE (default CAPTURE)
 *     responses:
 *       200:
 *         description: Order created
 *       500:
 *         description: Error creating order
 */
router.post('/ppcp/orders', createPPCPOrder);

/**
 * @swagger
 * /api/v1/ppcp/orders/{orderId}/capture:
 *   post:
 *     description: (PPCP interim spike) Capture an approved PayPal order via Orders V2 (sandbox, direct).
 *     tags: [PPCP]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: orderId
 *         description: PayPal order id
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Order captured
 *       400:
 *         description: Invalid order id
 *       500:
 *         description: Error capturing order
 */
router.post('/ppcp/orders/:orderId/capture', capturePPCPOrder);

/**
 * @swagger
 * /api/v1/ppcp/spreedly/orders:
 *   post:
 *     description: (PPCP via Spreedly) Create a PayPal order through Spreedly's paypal_commerce_platform gateway. Spreedly calls PayPal server-side; the response id is the PayPal order id for the SDK's createOrder().
 *     tags: [PPCP]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         description: Order details
 *         in: body
 *         required: false
 *         schema:
 *           type: object
 *           properties:
 *             amount:
 *               type: string
 *               description: Decimal amount string, e.g. "10.00" (default "10.00"); converted to minor units for Spreedly
 *             currency_code:
 *               type: string
 *               description: ISO 4217 currency code (default USD)
 *     responses:
 *       200:
 *         description: Order created (id = PayPal order id, status = Spreedly transaction state)
 *       500:
 *         description: Error creating order
 *       502:
 *         description: Spreedly did not return a PayPal order id
 */
router.post('/ppcp/spreedly/orders', createSpreedlyPPCPOrder);

/**
 * @swagger
 * /api/v1/ppcp/spreedly/orders/{orderId}/capture:
 *   post:
 *     description: (PPCP via Spreedly) Capture the authorization Spreedly created when the buyer approved. The Spreedly transaction token is resolved server-side from the PayPal order id.
 *     tags: [PPCP]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: orderId
 *         description: PayPal order id (as returned by POST /ppcp/spreedly/orders)
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Transaction captured
 *       400:
 *         description: Invalid order id
 *       404:
 *         description: No Spreedly transaction for that order id
 *       500:
 *         description: Error capturing transaction
 */
router.post('/ppcp/spreedly/orders/:orderId/capture', captureSpreedlyPPCPOrder);

/**
 * @swagger
 * /api/v1/ppcp/spreedly/orders/{orderId}:
 *   get:
 *     description: (PPCP via Spreedly) Inspect the underlying Spreedly transaction — state, payer details, PayPal order/authorization/capture ids.
 *     tags: [PPCP]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: orderId
 *         description: PayPal order id
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: The Spreedly transaction
 *       404:
 *         description: No Spreedly transaction for that order id
 */
router.get('/ppcp/spreedly/orders/:orderId', getSpreedlyPPCPTransaction);

/**
 * @swagger
 * /api/v1/ppcp/spreedly/vault/payment-token:
 *   post:
 *     description: (PPCP via Spreedly) Exchange an approved PayPal vault setup token for a permanent vault token, then import it into Spreedly as a third_party_token payment method. The save leg stays a direct PayPal call because vaulting a PayPal wallet needs browser approval, which Spreedly's store.json cannot drive.
 *     tags: [PPCP]
 *     parameters:
 *       - name: body
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             vaultSetupToken: { type: string }
 *     responses:
 *       200: { description: Imported into Spreedly }
 *       400: { description: vaultSetupToken missing }
 *       502: { description: Spreedly did not return a payment method token }
 */
router.post('/ppcp/spreedly/vault/payment-token', importSpreedlyPPCPVaultToken);

/**
 * @swagger
 * /api/v1/ppcp/spreedly/vault/tokens:
 *   get:
 *     description: (PPCP via Spreedly) Saved payment methods imported into Spreedly.
 *     tags: [PPCP]
 *     responses:
 *       200: { description: Saved methods }
 */
router.get('/ppcp/spreedly/vault/tokens', listSpreedlyPPCPVaultTokens);

/**
 * @swagger
 * /api/v1/ppcp/spreedly/vault/charge:
 *   post:
 *     description: (PPCP via Spreedly) Charge a saved method through Spreedly using flat stored-credential fields. initiator CUSTOMER = one-click (cardholder/unscheduled); MERCHANT = recurring MIT (merchant/recurring).
 *     tags: [PPCP]
 *     parameters:
 *       - name: body
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             ref: { type: integer }
 *             amount: { type: string }
 *             initiator: { type: string, description: CUSTOMER or MERCHANT }
 *     responses:
 *       200: { description: Charge attempted }
 *       404: { description: No saved payment method for that ref }
 */
router.post('/ppcp/spreedly/vault/charge', chargeSpreedlyPPCPVaultToken);


/**
 * @swagger
 * /api/v1/ppcp/spreedly/transactions/{transactionToken}/capture:
 *   post:
 *     description: (PPCP via Spreedly, redirect flow) Capture by SPREEDLY transaction token. presentationMode 'redirect' navigates the buyer away, so the landing page only has the ?transaction_token= Spreedly appends to the return URL — not the PayPal order id.
 *     tags: [PPCP]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: transactionToken
 *         description: Spreedly transaction token from the return URL's transaction_token param
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Captured
 *       400:
 *         description: Invalid transaction token
 *       409:
 *         description: Authorization is not in a succeeded state
 *       500:
 *         description: Error capturing transaction
 */
router.post(
  '/ppcp/spreedly/transactions/:transactionToken/capture',
  captureSpreedlyPPCPByTransaction
);

/**
 * @swagger
 * /api/v1/ppcp/vault/setup-token:
 *   post:
 *     description: (PPCP interim spike) Create a PayPal vault setup token (buyer approves via the JS SDK). Returns { setupToken }.
 *     tags: [PPCP]
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Setup token created
 *       500:
 *         description: Error creating setup token
 */
router.post('/ppcp/vault/setup-token', createPPCPVaultSetupToken);

/**
 * @swagger
 * /api/v1/ppcp/vault/payment-token:
 *   post:
 *     description: (PPCP interim spike) Exchange an approved setup token for a long-lived payment token; stored server-side.
 *     tags: [PPCP]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           required:
 *             - vaultSetupToken
 *           properties:
 *             vaultSetupToken:
 *               type: string
 *     responses:
 *       200:
 *         description: Payment token created and stored
 *       400:
 *         description: Missing vaultSetupToken
 *       500:
 *         description: Error creating payment token
 */
router.post('/ppcp/vault/payment-token', createPPCPVaultPaymentToken);

/**
 * @swagger
 * /api/v1/ppcp/vault/tokens:
 *   get:
 *     description: (PPCP interim spike) List saved payment methods (demo only; raw token ids stay server-side).
 *     tags: [PPCP]
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: List of saved payment methods
 */
router.get('/ppcp/vault/tokens', listPPCPVaultTokens);

/**
 * @swagger
 * /api/v1/ppcp/vault/charge:
 *   post:
 *     description: (PPCP interim spike) Charge a saved payment token as a merchant-initiated recurring payment (buyer not present).
 *     tags: [PPCP]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           required:
 *             - ref
 *           properties:
 *             ref:
 *               type: integer
 *               description: Opaque handle from GET /ppcp/vault/tokens
 *             amount:
 *               type: string
 *               description: Decimal amount string (default "10.00")
 *             currency_code:
 *               type: string
 *               description: ISO 4217 currency (default USD)
 *             initiator:
 *               type: string
 *               enum: [MERCHANT, CUSTOMER]
 *               description: MERCHANT (default) = recurring MIT, buyer not present (scenario 4); CUSTOMER = return buyer present, one-click (scenario 3)
 *     responses:
 *       200:
 *         description: Charge processed
 *       404:
 *         description: No saved token for that ref
 *       500:
 *         description: Error charging saved token
 */
router.post('/ppcp/vault/charge', chargePPCPVaultToken);

/**
 * @swagger
 * /api/v1/ppcp/vault/purchase-order:
 *   post:
 *     description: (PPCP interim spike) Scenario 2 — create a checkout order that also vaults the PayPal on a successful capture.
 *     tags: [PPCP]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         in: body
 *         schema:
 *           type: object
 *           properties:
 *             amount:
 *               type: string
 *               description: Decimal amount string (default "10.00")
 *             currency_code:
 *               type: string
 *               description: ISO 4217 currency (default USD)
 *     responses:
 *       200:
 *         description: Order created (approve via the JS SDK checkout session)
 *       500:
 *         description: Error creating order
 */
router.post('/ppcp/vault/purchase-order', createPPCPVaultPurchaseOrder);

/**
 * @swagger
 * /api/v1/ppcp/vault/purchase-order/{orderId}/capture:
 *   post:
 *     description: (PPCP interim spike) Scenario 2 — capture a vault-with-purchase order and store the vaulted PayPal token.
 *     tags: [PPCP]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: orderId
 *         description: PayPal order id
 *         in: path
 *         required: true
 *         type: string
 *     responses:
 *       200:
 *         description: Order captured; PayPal vaulted
 *       400:
 *         description: Invalid order id
 *       500:
 *         description: Error capturing order
 */
router.post('/ppcp/vault/purchase-order/:orderId/capture', capturePPCPVaultPurchaseOrder);

export default router;
