import express from 'express';
import authRoutes from './routes';
import { errorHandler } from './middlewares/errorHandler';
import path from 'path';
import morgan from 'morgan';
import cors from 'cors';
import paymentMethodsRoutes from './paymentMethodsRoutes';

const app = express();

app.use(morgan('combined'));
app.use(cors());

app.use('/', express.static(path.join(__dirname, 'static')));

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/v1/payment_methods', paymentMethodsRoutes);

app.use(errorHandler);

export default app;