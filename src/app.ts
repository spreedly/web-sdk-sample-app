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
import { httpsMiddleware } from './middlewares/httpsMiddleware';
import { createEdgeGuard } from './middlewares/edgeGuardMiddleware';
import { createBasicAuth } from './middlewares/basicAuthMiddleware';

// utils.js ships with the production SDK origin. This rewrites that one line from
// SDK_BASE_URL so each Heroku app can serve a different host without a code change.
const SDK_SCRIPT_ORIGIN_LINE =
  "const SDK_SCRIPT_ORIGIN = 'https://core.spreedly.com';";

// Files served by the routes below are read once at startup, so a request never touches the disk.
// A missing file is served as a 404, as before.
const readOnce = (filePath: string): Buffer | null => {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
};

const buildSharedUtils = (): string | null => {
  const source = readOnce(
    path.join(__dirname, 'static', 'shared', 'utils.js')
  )?.toString('utf8');
  if (source === undefined) return null;
  if (!source.includes(SDK_SCRIPT_ORIGIN_LINE)) {
    console.warn(
      'shared/utils.js is missing the SDK_SCRIPT_ORIGIN line; SDK_BASE_URL will not apply'
    );
  }
  return source.replace(
    SDK_SCRIPT_ORIGIN_LINE,
    `const SDK_SCRIPT_ORIGIN = ${JSON.stringify(config.sdkBaseUrl)};`
  );
};
const SHARED_UTILS_BODY = buildSharedUtils();

const serveSharedUtils = (_req: Request, res: Response) => {
  if (SHARED_UTILS_BODY === null) {
    res.status(404).end();
    return;
  }
  res.set('Cache-Control', 'no-store');
  res.type('application/javascript').send(SHARED_UTILS_BODY);
};

const app = express();

app.use(morgan('combined'));

app.get('/healthz', (_req, res) => {
  res.set('Cache-Control', 'no-store').type('text/plain').send('ok');
});
if (config.edgeGuard) {
  app.use(createEdgeGuard(config.edgeGuard, config.publicAppOrigin));
}
app.use(httpsMiddleware);
// The staging app's login. Off unless BASIC_AUTH_USER and BASIC_AUTH_PASSWORD are set. After the
// https redirect, so the browser never sends the password over plain http.
if (config.basicAuth) {
  app.use(createBasicAuth(config.basicAuth));
}
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

// The pages load axios from the app, not a CDN, so the version is the one in package-lock.json.
// __dirname is dist/ or src/, both one level below node_modules.
const AXIOS_DIST = path.join(__dirname, '..', 'node_modules', 'axios', 'dist');
const AXIOS_FILES = new Map(
  ['axios.min.js', 'axios.min.js.map'].map(name => [
    `/vendor/${name}`,
    { type: path.extname(name), body: readOnce(path.join(AXIOS_DIST, name)) },
  ])
);
app.get([...AXIOS_FILES.keys()], (req, res) => {
  const file = AXIOS_FILES.get(req.path);
  if (!file?.body) {
    res.status(404).end();
    return;
  }
  res.type(file.type).send(file.body);
});
app.use('/', express.static(path.join(__dirname, 'static')));

// Every JSON body this app accepts is small. The largest is a Paze securedPayload.
app.use(express.json({ limit: '32kb' }));
app.use('/api/v1', routes);

app.use(errorHandler);

export default app;
