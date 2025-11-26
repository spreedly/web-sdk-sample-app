import express from 'express';
import { errorHandler } from './middlewares/errorHandler';
import { cspMiddleware } from './middlewares/cspMiddleware';
import path from 'path';
import morgan from 'morgan';
import cors from 'cors';
import routes from './routes';
import { swaggerSpec, swaggerUiExpress } from './swagger';

const app = express();

app.use(morgan('combined'));
app.use(cors());
// app.use(cspMiddleware);

app.use('/api/v1/docs', swaggerUiExpress.serve, swaggerUiExpress.setup(swaggerSpec));

app.use('/', express.static(path.join(__dirname, 'static')));

app.use(express.json());
app.use('/api/v1', routes);

app.use(errorHandler);

export default app;
