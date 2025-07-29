import express from 'express';
import authRoutes from './routes';
import { errorHandler } from './middlewares/errorHandler';
import path from 'path';
import morgan from 'morgan';

const app = express();

app.use(morgan('combined'));

app.use('/', express.static(path.join(__dirname, 'static')));

app.use(express.json());

app.use('/api/auth', authRoutes);

app.use(errorHandler);

export default app;
