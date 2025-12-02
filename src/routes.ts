import { Router } from 'express';
import { getAuthParams } from './controllers/auth';
import { createPaymentMethod, getPaymentMethods, retainPaymentMethod, recachePaymentMethod } from './controllers/payments';

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
router.put('/payment_methods/:paymentMethodToken/recache', recachePaymentMethod);

export default router;
