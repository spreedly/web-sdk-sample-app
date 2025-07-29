import { Router } from 'express';
import { getAPIKey, getAuthParams } from './controllers/authController';

const router = Router();

router.get('/get-auth-params', getAuthParams);
router.get('/get-api-key', getAPIKey);

export default router;
