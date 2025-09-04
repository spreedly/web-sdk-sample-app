import axios from 'axios';
import { Router } from 'express';

const router = Router();

router.post('/restricted.json', async (req, res) => {
  try {
    const response = await axios.post(
      'https://core.spreedly.com/v1/payment_methods/restricted.json',
      req.body,
      {
        headers: {
          'spreedly-environment-key': req.headers['spreedly-environment-key'],
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
