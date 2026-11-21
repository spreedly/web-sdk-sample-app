import config from './config';

const MAX_URL_LENGTH = 2048;

// Where Spreedly posts transaction updates. Always this app's own route, never a caller's URL.
export const serverCallbackUrl = (): string =>
  `${config.publicAppOrigin}/api/v1/offsite-callback`;

// A default landing page on this app's public origin.
export const defaultRedirectUrl = (path: string): string => `${config.publicAppOrigin}${path}`;

type RedirectCheck = { ok: true; url: string } | { ok: false };

// A caller's redirect_url must land on one of this app's own origins.
// Absent: the given default. Present but anywhere else: refused.
export const checkRedirectUrl = (value: unknown, fallbackPath: string): RedirectCheck => {
  if (value === undefined || value === null || value === '') {
    return { ok: true, url: defaultRedirectUrl(fallbackPath) };
  }
  if (typeof value !== 'string' || value.length > MAX_URL_LENGTH) return { ok: false };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false };
  if (url.username || url.password) return { ok: false };
  if (!config.appOrigins.has(url.origin)) return { ok: false };
  return { ok: true, url: url.href };
};

export const INVALID_REDIRECT_URL = {
  error: 'redirect_url must be a page on this app',
};
