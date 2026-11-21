import crypto from 'crypto';
import { RequestHandler } from 'express';
import type { BasicAuthConfig } from '../config';

// Callers that can't log in: Spreedly's offsite callbacks and Apple's domain verification fetch.
// GET /healthz is mounted before this middleware.
const OPEN_PATHS = new Set([
  '/api/v1/offsite-callback',
  '/.well-known/apple-developer-merchantid-domain-association',
  '/.well-known/apple-developer-merchantid-domain-association.txt',
]);

const CHALLENGE =
  'Basic realm="Spreedly sample app (staging)", charset="UTF-8"';

const digest = (value: string): Buffer =>
  crypto.createHash('sha256').update(value).digest();

const readCredentials = (
  header: string | undefined
): { user: string; password: string } | null => {
  const encoded = /^Basic ([A-Za-z0-9+/=]+)$/i.exec(header?.trim() || '')?.[1];
  if (!encoded) return null;
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const colon = decoded.indexOf(':');
  if (colon === -1) return null;
  return { user: decoded.slice(0, colon), password: decoded.slice(colon + 1) };
};

export const createBasicAuth = (auth: BasicAuthConfig): RequestHandler => {
  const expectedUser = digest(auth.user);
  const expectedPassword = digest(auth.password);
  return (req, res, next) => {
    if (OPEN_PATHS.has(req.path)) {
      next();
      return;
    }
    const sent = readCredentials(req.header('authorization'));
    // Both are compared every time, so a wrong user takes as long as a wrong password.
    const userMatches = crypto.timingSafeEqual(
      digest(sent?.user ?? ''),
      expectedUser
    );
    const passwordMatches = crypto.timingSafeEqual(
      digest(sent?.password ?? ''),
      expectedPassword
    );
    if (sent && userMatches && passwordMatches) {
      next();
      return;
    }
    res
      .set('WWW-Authenticate', CHALLENGE)
      .set('Cache-Control', 'no-store')
      .status(401)
      .end();
  };
};
