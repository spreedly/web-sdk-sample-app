import express, { Request, Response } from 'express';
import { errorHandler } from './middlewares/errorHandler';
// import { cspMiddleware } from './middlewares/cspMiddleware';
import fs from 'fs';
import path from 'path';
import morgan from 'morgan';
import { express as useragent } from 'express-useragent';
import config from './config';
import routes from './routes';
import { swaggerSpec, swaggerUiExpress } from './swagger';
import { serveApplePayDomainAssociation } from './controllers/apple-pay';
import { corsMiddleware } from './middlewares/corsMiddleware';

// utils.js ships with the production SDK origin. This rewrites that one line from
// SDK_BASE_URL so each Heroku app can serve a different host without a code change.
const SDK_SCRIPT_ORIGIN_LINE =
  "const SDK_SCRIPT_ORIGIN = 'https://core.spreedly.com';";

const serveSharedUtils = (_req: Request, res: Response) => {
  const filePath = path.join(__dirname, 'static', 'shared', 'utils.js');
  fs.readFile(filePath, 'utf8', (err, source) => {
    if (err || source === undefined) {
      res.status(404).end();
      return;
    }
    if (!source.includes(SDK_SCRIPT_ORIGIN_LINE)) {
      console.warn(
        'shared/utils.js is missing the SDK_SCRIPT_ORIGIN line; SDK_BASE_URL will not apply'
      );
    }
    const body = source.replace(
      SDK_SCRIPT_ORIGIN_LINE,
      `const SDK_SCRIPT_ORIGIN = ${JSON.stringify(config.sdkBaseUrl)};`
    );
    res.set('Cache-Control', 'no-store');
    res.type('application/javascript').send(body);
  });
};

const app = express();

app.use(morgan('combined'));
app.use(corsMiddleware);
// TODO: Uncomment this when we have a valid CSP policy
// app.use(cspMiddleware);
app.use(useragent());
app.use('/api/v1/docs', swaggerUiExpress.serve, swaggerUiExpress.setup(swaggerSpec));

// Apple Pay domain verification. A route, so dotfiles stay off for the static mount below.
// Apple's portal fetches the .txt path; older Apple docs use the path without it.
app.get(
  [
    '/.well-known/apple-developer-merchantid-domain-association',
    '/.well-known/apple-developer-merchantid-domain-association.txt',
  ],
  serveApplePayDomainAssociation
);

app.get('/shared/utils.js', serveSharedUtils);
app.use('/', express.static(path.join(__dirname, 'static')));

// Every JSON body this app accepts is small. The largest is a Paze securedPayload.
app.use(express.json({ limit: '32kb' }));
app.use('/api/v1', routes);

app.use(errorHandler);

export default app;
