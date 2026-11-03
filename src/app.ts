import express from 'express';
import { errorHandler } from './middlewares/errorHandler';
// import { cspMiddleware } from './middlewares/cspMiddleware';
import path from 'path';
import morgan from 'morgan';
import cors from 'cors';
import { express as useragent } from 'express-useragent';
import routes from './routes';
import { swaggerSpec, swaggerUiExpress } from './swagger';
import { getAppleAppSiteAssociation, getAssetLinks } from './controllers/well-known';

const app = express();

app.use(morgan('combined'));
app.use(cors());
// TODO: Uncomment this when we have a valid CSP policy
// app.use(cspMiddleware);
app.use(useragent());
app.use('/api/v1/docs', swaggerUiExpress.serve, swaggerUiExpress.setup(swaggerSpec));

// Mobile app-link verification files. Routed explicitly: express.static skips dotfile dirs,
// and the AASA file has no extension, so static would not send application/json.
app.get('/.well-known/apple-app-site-association', getAppleAppSiteAssociation);
app.get('/.well-known/assetlinks.json', getAssetLinks);

app.use('/', express.static(path.join(__dirname, 'static')));

app.use(express.json());
app.use('/api/v1', routes);

app.use(errorHandler);

export default app;
