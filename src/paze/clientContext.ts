import { createHmac, randomInt } from 'crypto';

// A Paze checkout's sessionId: 24 letters and digits from a secure random source.
const SESSION_ID_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const SESSION_ID_LENGTH = 24;
export const SESSION_ID_PATTERN = /^[A-Za-z0-9]{24}$/;

export const generateSessionId = (): string => {
  let id = '';
  for (let i = 0; i < SESSION_ID_LENGTH; i++) {
    id += SESSION_ID_ALPHABET[randomInt(SESSION_ID_ALPHABET.length)];
  }
  return id;
};

// clientContext is derived from sessionId, never stored: a UUID (version 8, RFC 9562 variant)
// from the first 16 bytes of HMAC-SHA256(clientContextKey, sessionId). Create, review and complete
// compute the same value, so it survives restarts and works across instances.
export const deriveClientContext = (key: Buffer, sessionId: string): string => {
  const bytes = createHmac('sha256', key).update(sessionId, 'utf8').digest();
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x80, 6); // version 8
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8); // variant 10
  const hex = bytes.subarray(0, 16).toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
};

// PAZE_CLIENT_CONTEXT_KEY: 32 random bytes, as 64 hex characters or base64. Anything else is
// treated as unset, so the session routes answer not_configured instead of using a weak key.
export const parseClientContextKey = (raw: string): Buffer | null => {
  const value = raw.trim();
  if (!value) return null;
  if (/^[0-9a-fA-F]{64}$/.test(value)) return Buffer.from(value, 'hex');
  if (/^[A-Za-z0-9+/_-]+={0,2}$/.test(value)) {
    const decoded = Buffer.from(value, 'base64');
    if (decoded.length === 32) return decoded;
  }
  return null;
};
