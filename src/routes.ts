import { Router, urlencoded } from 'express';
import { getAuthParams } from './controllers/auth';
import { 
  retainPaymentMethod, 
  createPurchaseTransaction, 
  createPurchaseWith3DS, 
  createPurchaseWith3DSGatewaySpecific, 
  createSimplePurchase,
  createStripeRadarPurchase,
  completeTransaction,
  createOffsitePurchase,
  getTransaction,
  handleOffsiteCallback,
  createStripeAPMPurchase,
  createPurchase,
  createBraintreePurchase,
  confirmTransaction,
  createAchPurchase,
  createPazePaymentMethod,
} from './controllers/payments';
import { getPazeAccessToken, pazeTokenRateLimit } from './controllers/paze-oauth';
import { getPazeWebConfig } from './controllers/paze-web-config';
import {
  completePazeSession,
  createPazeSession,
  pazeCreateSessionRateLimit,
  pazeSessionStepRateLimit,
  reviewPazeSession,
} from './controllers/paze-sessions';
import {
  applePayValidateRateLimit,
  getApplePayConfig,
  validateApplePayMerchant,
} from './controllers/apple-pay';
import {
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
  createSpreedlyPPCPVaultSetup,
  completeSpreedlyPPCPVaultSetup,
  getSpreedlyPPCPTransactionByToken,
  createSpreedlyPPCPOrder,
  captureSpreedlyPPCPOrder,
  captureSpreedlyPPCPByTransaction,
  getSpreedlyPPCPTransaction,
  listSpreedlyPPCPVaultTokens,
  deleteSpreedlyPPCPVaultToken,
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
 * /api/v1/payment_methods/{paymentMethodToken}/retain:
 *   put:
 *     description: Retain a payment method to prevent automatic deletion. Only the browser tab that created it can retain it.
 *     tags: [Payment Methods]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: paymentMethodToken
 *         description: The unique token identifying the payment method
 *         in: path
 *         required: true
 *         type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [owner_secret]
 *             properties:
 *               owner_secret:
 *                 type: string
 *                 description: The tab's secret. The payment method's sample_app_owner metadata must be its SHA-256 (hex).
 *     responses:
 *       200:
 *         description: Payment method retained successfully
 *       400:
 *         description: Invalid payment method token format
 *       403:
 *         description: Missing owner_secret, or the payment method was not created with it
 *       500:
 *         description: Error retaining payment method
 */
router.put('/payment_methods/:paymentMethodToken/retain', retainPaymentMethod);

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
 *             sca_provider_type:
 *               type: string
 *               enum: [forter, test]
 *               description: >
 *                 Which SCA provider to use for 3DS Global. Defaults to the Forter provider.
 *                 Set to "test" to use Spreedly's test SCA provider, which returns no
 *                 managed_order_token. Ignored when attempt_3dsecure is true.
 *             test_scenario:
 *               type: string
 *               enum: [authenticated, challenge, not_authenticated]
 *               description: >
 *                 Outcome to simulate. Only applies when sca_provider_type is "test".
 *     responses:
 *       200:
 *         description: Purchase transaction created successfully
 *       400:
 *         description: Invalid test_scenario value
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
 *             sca_provider_type:
 *               type: string
 *               enum: [forter, test]
 *               description: >
 *                 Which SCA provider to use. Defaults to the Forter provider. Set to "test"
 *                 to use Spreedly's test SCA provider, which returns no managed_order_token.
 *             test_scenario:
 *               type: string
 *               enum: [authenticated, challenge, not_authenticated]
 *               description: >
 *                 Outcome to simulate. Only applies when sca_provider_type is "test".
 *     responses:
 *       200:
 *         description: Purchase processed successfully
 *       400:
 *         description: Invalid test_scenario value
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
 * /api/v1/stripe-radar-purchase:
 *   post:
 *     description: Purchase through the Stripe Payment Intents gateway, forwarding a Stripe Radar session id via gateway_specific_fields.stripe_payment_intents.radar_session_id
 *     tags: [Transactions]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           properties:
 *             payment_method_token:
 *               type: string
 *             amount:
 *               type: number
 *               description: Amount in minor units (cents)
 *             currency_code:
 *               type: string
 *             radar_session_id:
 *               type: string
 *               description: Stripe Radar session id from sdk.stripeRadar()
 *     responses:
 *       200:
 *         description: Purchase processed (see radar_session_forwarded flag)
 *       500:
 *         description: Error processing purchase
 */
router.post('/stripe-radar-purchase', createStripeRadarPurchase);

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
 *             redirect:
 *               type: boolean
 *               description: True when the buyer will be navigated away, so PayPal needs somewhere to send them back to (default false)
 *             return_url:
 *               type: string
 *               description: Where PayPal sends the buyer after approval. Any absolute URL, including a mobile deep link such as myapp://paypalreturn. Supplying it also turns on the redirect behaviour. Defaults to this app's spike page.
 *             cancel_url:
 *               type: string
 *               description: Where PayPal sends the buyer if they back out. Falls back to return_url when only that is given, then to this app's spike page.
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
 *             redirect_url:
 *               type: string
 *               description: Where Spreedly sends the buyer after approval. Spreedly validates this itself and rejects anything that is not a public https URL, so a custom scheme comes back as errors.invalid_url. Defaults to this app's /ppcp/return/ page.
 *             callback_url:
 *               type: string
 *               description: Spreedly's offsite callback target. Defaults to this app's /api/v1/offsite-callback.
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
 * /api/v1/ppcp/spreedly/vault/setup:
 *   post:
 *     description: (PPCP via Spreedly) Start vaulting a PayPal wallet without a payment. Creates an unvaulted paypal payment method, runs gateway verify, and returns the PayPal approval URL to send the buyer to. There is no PayPal setup token in this flow — Spreedly mints the approval session itself. Venmo has no verify path — use vault-with-purchase.
 *     tags: [PPCP]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         description: Where Spreedly returns the buyer. Omit both on web.
 *         in: body
 *         required: false
 *         schema:
 *           type: object
 *           properties:
 *             redirect_url:
 *               type: string
 *               description: Spreedly validates this and rejects anything that is not a public https URL. Defaults to this app's /ppcp/return/ page.
 *             callback_url:
 *               type: string
 *               description: Defaults to this app's /api/v1/offsite-callback.
 *     responses:
 *       200:
 *         description: Pending OffsiteVerification with checkout_url and transaction_token
 *       500:
 *         description: Error starting the verification
 *       502:
 *         description: Spreedly did not return a payment method or checkout_url
 */
router.post('/ppcp/spreedly/vault/setup', createSpreedlyPPCPVaultSetup);

/**
 * @swagger
 * /api/v1/ppcp/spreedly/vault/complete:
 *   post:
 *     description: (PPCP via Spreedly) Record a verification the buyer already approved. Spreedly finalizes on its own redirect leg before landing the buyer on redirect_url, so this only reads the transaction back and files the vaulted payment method.
 *     tags: [PPCP]
 *     produces:
 *       - application/json
 *     parameters:
 *       - name: body
 *         in: body
 *         required: true
 *         schema:
 *           type: object
 *           required: [transactionToken]
 *           properties:
 *             transactionToken:
 *               type: string
 *               description: The Spreedly transaction token, from ?transaction_token on the return URL.
 *     responses:
 *       200:
 *         description: Vaulted; the payment method keeps type paypal and gains reference vault#<id>
 *       400:
 *         description: transactionToken missing
 *       502:
 *         description: Verification did not succeed
 */
router.post('/ppcp/spreedly/vault/complete', completeSpreedlyPPCPVaultSetup);

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
 * /api/v1/ppcp/spreedly/vault/tokens/{ref}:
 *   delete:
 *     description: (PPCP via Spreedly) Remove a saved method from the demo list. Does not redact the payment method in Spreedly or unvault it at PayPal.
 *     tags: [PPCP]
 *     parameters:
 *       - name: ref
 *         in: path
 *         required: true
 *         description: Opaque handle from GET /ppcp/spreedly/vault/tokens
 *     responses:
 *       200: { description: Removed from the list }
 *       404: { description: No saved payment method for that ref }
 */
router.delete('/ppcp/spreedly/vault/tokens/:ref', deleteSpreedlyPPCPVaultToken);

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
 * /api/v1/ppcp/spreedly/transactions/{transactionToken}:
 *   get:
 *     description: (PPCP via Spreedly) What kind of transaction a return URL is landing from. Spreedly puts only transaction_token on the URL, so a return page cannot otherwise tell an OffsitePurchase to capture from an OffsiteVerification to record.
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
 *         description: Transaction type, state and vault reference
 *       500:
 *         description: Error reading the transaction
 */
router.get('/ppcp/spreedly/transactions/:transactionToken', getSpreedlyPPCPTransactionByToken);


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
 *     parameters:
 *       - name: body
 *         description: Where PayPal returns the buyer after approving the save. Omit both on web.
 *         in: body
 *         required: false
 *         schema:
 *           type: object
 *           properties:
 *             return_url:
 *               type: string
 *               description: Any absolute URL, including a mobile deep link such as myapp://paypalreturn. Defaults to this app's /ppcp/ page, which strands a mobile buyer in a browser.
 *             cancel_url:
 *               type: string
 *               description: Falls back to return_url when only that is given, then to this app's /ppcp/ page.
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
 *             return_url:
 *               type: string
 *               description: Where PayPal sends the buyer after approval. Any absolute URL, including a mobile deep link such as myapp://paypalreturn. Defaults to this app's /ppcp/ page.
 *             cancel_url:
 *               type: string
 *               description: Falls back to return_url when only that is given, then to this app's /ppcp/ page.
 *             user_action:
 *               type: string
 *               enum: [PAY_NOW, CONTINUE]
 *               description: Wording on PayPal's final button — PAY_NOW renders "Pay", CONTINUE renders "Review Order". The Orders-API twin of the JS SDK's `commit`; send the two in agreement or PayPal is told both at once. Anything other than CONTINUE is treated as PAY_NOW, which is also what `commit` defaults to.
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

/**
 * @swagger
 * /api/v1/paze-payment-method:
 *   post:
 *     description: Create a Paze payment method from securedPayload via third_party_network_token
 *     tags: [Paze Payments]
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Paze payment method created successfully
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Error creating payment method
 */
router.post('/paze-payment-method', createPazePaymentMethod);

/**
 * @swagger
 * /api/v1/paze/oauth/token:
 *   post:
 *     description: Mint a single-use Paze access token for the Spreedly mobile SDK (Paze CAT), bound to the app's Paze session. Send session_id as JSON or form data. Every response has Cache-Control no-store.
 *     tags: [Paze Payments]
 *     produces:
 *       - application/json
 *     parameters:
 *       - in: header
 *         name: X-Demo-Api-Key
 *         required: true
 *         type: string
 *         description: Shared demo key (PAZE_DEMO_API_KEY)
 *       - in: formData
 *         name: session_id
 *         required: true
 *         type: string
 *         description: "The Paze checkout session id (letters, digits, . _ : -; up to 128 characters)"
 *     responses:
 *       200:
 *         description: Token minted
 *         schema:
 *           type: object
 *           properties:
 *             access_token:
 *               type: string
 *             token_type:
 *               type: string
 *             expires_in:
 *               type: string
 *       400:
 *         description: session_id missing or malformed ({"error":"invalid_session_id"})
 *       401:
 *         description: Missing or wrong X-Demo-Api-Key ({"error":"unauthorized"})
 *       429:
 *         description: More than 10 requests a minute from this caller, with or without a valid key ({"error":"rate_limited"}, with Retry-After)
 *       502:
 *         description: Paze rejected the request ({"error":"upstream_rejected"}) or returned no usable token ({"error":"upstream_invalid"})
 *       503:
 *         description: Paze timed out or failed ({"error":"upstream_unavailable"}), or the Paze settings are missing ({"error":"not_configured"})
 */
router.post(
  '/paze/oauth/token',
  pazeTokenRateLimit,
  urlencoded({ extended: false, limit: '32kb' }),
  getPazeAccessToken
);

/**
 * @swagger
 * components:
 *   parameters:
 *     PazeDemoApiKey:
 *       in: header
 *       name: X-Demo-Api-Key
 *       required: true
 *       schema:
 *         type: string
 *       description: Shared demo key (PAZE_DEMO_API_KEY)
 *     PazeShopperSession:
 *       in: header
 *       name: X-Shopper-Session
 *       required: true
 *       schema:
 *         type: string
 *         pattern: '^[A-Za-z0-9._:-]{16,128}$'
 *       description: Stands in for the shopper's authenticated app session. Review and complete only work with the value that created the session.
 *     PazeSessionId:
 *       in: path
 *       name: sessionId
 *       required: true
 *       schema:
 *         type: string
 *         pattern: '^[A-Za-z0-9]{24}$'
 *   schemas:
 *     PazeTransactionValue:
 *       type: object
 *       properties:
 *         transactionCurrency: { type: string, example: USD }
 *         transactionAmount: { type: string, example: '10.00' }
 *     PazeError:
 *       oneOf:
 *         - type: object
 *           description: Paze failed. Its status and body are passed through unchanged.
 *           properties:
 *             source: { type: string, enum: [paze] }
 *             pazeStatusCode: { type: integer }
 *             pazeError: { type: object }
 *         - type: object
 *           properties:
 *             source: { type: string, enum: [backend] }
 *             message: { type: string }
 */

/**
 * @swagger
 * /api/v1/paze/sessions:
 *   post:
 *     description: Starts a backend-mediated Paze checkout for the mobile SDK. The backend generates sessionId, derives clientContext, mints a Paze token and calls Paze sessions/create. Every response has Cache-Control no-store.
 *     tags: [Paze Payments]
 *     parameters:
 *       - $ref: '#/components/parameters/PazeDemoApiKey'
 *       - $ref: '#/components/parameters/PazeShopperSession'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [callbackURLScheme, intent]
 *             properties:
 *               callbackURLScheme: { type: string, example: com.example.merchant.paze, description: 'The app scheme the wallet redirects back to, sent to Paze as given' }
 *               intent: { type: string, enum: [REVIEW_AND_PAY, EXPRESS_CHECKOUT, ADD_CARD] }
 *               transactionType: { type: string, enum: [PURCHASE, CARD_ON_FILE, BOTH], default: PURCHASE }
 *               transactionValue: { $ref: '#/components/schemas/PazeTransactionValue' }
 *               emailAddress: { type: string, example: shopper@example.com }
 *               phoneNumber: { type: string, nullable: true }
 *               shippingPreference: { type: string, default: ALL }
 *               billingPreference: { type: string, default: ALL }
 *     responses:
 *       200:
 *         description: '{"sessionId": string, "checkoutUrl": string}'
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Wrong demo key or missing X-Shopper-Session
 *       429:
 *         description: More than 10 creates a minute for this shopper, or Paze's own 429
 *       502:
 *         description: Paze rejected the request or answered with something unusable
 *       503:
 *         description: Paze is unavailable, or the Paze session settings are missing (not_configured)
 */
router.post('/paze/sessions', pazeCreateSessionRateLimit, createPazeSession);

/**
 * @swagger
 * /api/v1/paze/sessions/{sessionId}/review:
 *   post:
 *     description: Calls Paze sessions/review with the code from the wallet redirect and returns Paze's body for the confirmation screen (REVIEW_AND_PAY only).
 *     tags: [Paze Payments]
 *     parameters:
 *       - $ref: '#/components/parameters/PazeDemoApiKey'
 *       - $ref: '#/components/parameters/PazeShopperSession'
 *       - $ref: '#/components/parameters/PazeSessionId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string }
 *     responses:
 *       200:
 *         description: '{"pazeResponse": {...Paze sessions/review body, unchanged...}}'
 *       404:
 *         description: Unknown session, or one another caller created
 *       409:
 *         description: The session is already completing, completed or failed
 */
router.post('/paze/sessions/:sessionId/review', pazeSessionStepRateLimit, reviewPazeSession);

/**
 * @swagger
 * /api/v1/paze/sessions/{sessionId}/complete:
 *   post:
 *     description: Calls Paze sessions/complete, creates the Spreedly payment method from securedPayload (third_party_network_token, source paze) and returns display-safe fields with the payment method token. securedPayload never leaves the backend. A repeated complete returns the stored result.
 *     tags: [Paze Payments]
 *     parameters:
 *       - $ref: '#/components/parameters/PazeDemoApiKey'
 *       - $ref: '#/components/parameters/PazeShopperSession'
 *       - $ref: '#/components/parameters/PazeSessionId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string }
 *               transactionType: { type: string, enum: [PURCHASE, CARD_ON_FILE, BOTH] }
 *               transactionValue: { $ref: '#/components/schemas/PazeTransactionValue' }
 *               billingPreference: { type: string }
 *               merchantCategoryCode: { type: string, nullable: true, pattern: '^[0-9]{4}$' }
 *     responses:
 *       200:
 *         description: '{"paymentMethodToken", "paymentCardNetwork", "lastFour", "consumer", "billingAddress"}'
 *       400:
 *         description: Invalid request, or transactionType/transactionValue differs from the order
 *       404:
 *         description: Unknown session, or one another caller created
 *       409:
 *         description: The session failed and can't be completed
 *       502:
 *         description: Paze failed, or the Spreedly payment method couldn't be created (retry complete; Paze isn't called again)
 */
router.post('/paze/sessions/:sessionId/complete', pazeSessionStepRateLimit, completePazeSession);

/**
 * @swagger
 * /api/v1/apple-pay/validate:
 *   post:
 *     description: Requests an Apple Pay merchant session from Apple over mutual TLS with the Merchant Identity Certificate. Always calls Apple's fixed host for APPLE_PAY_ENVIRONMENT; the browser's validationURL is never fetched.
 *     tags: [Apple Pay]
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: Apple's merchant session object, unchanged (single use, expires after 5 minutes)
 *       429:
 *         description: More than 10 requests a minute from this caller ({"error":"rate_limited"})
 *       502:
 *         description: Apple rejected the request ({"error":"upstream_rejected"})
 *       503:
 *         description: Apple timed out or failed ({"error":"upstream_unavailable"}), or the Apple Pay settings are missing ({"error":"not_configured"})
 */
router.post('/apple-pay/validate', applePayValidateRateLimit, validateApplePayMerchant);

/**
 * @swagger
 * /api/v1/apple-pay/config:
 *   get:
 *     description: Apple Pay settings the demo page needs. The merchant ID isn't secret.
 *     tags: [Apple Pay]
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: '{"merchantIdentifier": string | null, "configured": boolean}'
 */
router.get('/apple-pay/config', getApplePayConfig);

/**
 * @swagger
 * /api/v1/paze/web-config:
 *   get:
 *     description: Paze client settings and wallet host for the web demo page, from PAZE_ENVIRONMENT and PAZE_CLIENT_ID / PAZE_CLIENT_NAME / PAZE_PROFILE_ID. None of them are secret.
 *     tags: [Paze Payments]
 *     produces:
 *       - application/json
 *     responses:
 *       200:
 *         description: '{"environment": "cat" | "uat" | "production", "checkoutHost": string, "clientConfig": {"id": string, "name": string, "profileId": string}}'
 *       503:
 *         description: The Paze settings are missing ({"error":"not_configured"})
 */
router.get('/paze/web-config', getPazeWebConfig);

export default router;
