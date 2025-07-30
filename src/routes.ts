import { Router } from 'express';
import { getAuthParams } from './controllers/authController';

const router = Router();

router.get('/get-auth-params', getAuthParams);

export default router;
