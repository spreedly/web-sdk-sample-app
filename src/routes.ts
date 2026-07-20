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
  createPPCPOrder,
  capturePPCPOrder,
} from './controllers/ppcp';

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

export default router;
