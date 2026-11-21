import { Request } from 'express';

// Requests behind Fastly that arrive without Fastly-Client-IP share this one rate-limit bucket.
export const MISSING_FASTLY_CLIENT_IP = 'missing-fastly-client-ip';

// The caller's IP, for rate limits. Behind Fastly (edge guard on), the last X-Forwarded-For entry is
// Fastly's own IP, so this reads Fastly-Client-IP, which Fastly sets from the real client IP. Only
// requests that passed the edge guard reach the rate-limited routes, so the header came from Fastly.
// Without the guard (local runs), it falls back to the last X-Forwarded-For entry or the socket.
export const clientIp = (req: Request, behindFastly: boolean): string => {
  if (behindFastly) {
    return req.get('fastly-client-ip')?.trim() || MISSING_FASTLY_CLIENT_IP;
  }
  const forwarded = req.get('x-forwarded-for');
  return (
    forwarded?.split(',').pop()?.trim() || req.socket.remoteAddress || 'unknown'
  );
};
