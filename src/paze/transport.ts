import https from 'https';

// One HTTPS POST to Paze. Built on node:https, not axios, because the retry rules need to know
// whether the connection was ever established, and axios's timeout can't tell a connect timeout
// from a read timeout.

export const MAX_RESPONSE_BYTES = 256 * 1024;

export interface TransportRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export interface TransportResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

// `connected` is false only when the failure happened before the TLS handshake finished, so
// Paze can't have received the request. A retry is safe only then.
export class TransportError extends Error {
  constructor(
    message: string,
    readonly connected: boolean
  ) {
    super(message);
    this.name = 'TransportError';
  }
}

export type Transport = (
  request: TransportRequest
) => Promise<TransportResponse>;

export interface HttpsTransportOptions {
  connectTimeoutMs: number;
  totalTimeoutMs: number;
}

// A fresh connection for every call: no keep-alive, so 'secureConnect' always fires and the
// connected flag is accurate. TLS verification uses the platform trust store and is never off.
const agent = new https.Agent({ keepAlive: false });

export const createHttpsTransport =
  (options: HttpsTransportOptions): Transport =>
  request =>
    new Promise<TransportResponse>((resolve, reject) => {
      const url = new URL(request.url);
      if (url.protocol !== 'https:') {
        reject(new TransportError('Paze URLs must be https', false));
        return;
      }
      let connected = false;
      let settled = false;
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(connectTimer);
        clearTimeout(totalTimer);
        req.destroy();
        reject(new TransportError(message, connected));
      };

      const req = https.request(
        {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || 443,
          path: `${url.pathname}${url.search}`,
          method: 'POST',
          agent,
          headers: {
            ...request.headers,
            'Content-Length': Buffer.byteLength(request.body).toString(),
          },
        },
        res => {
          // node:https never follows redirects; a 3xx is returned as an error status below.
          const chunks: Buffer[] = [];
          let size = 0;
          res.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > MAX_RESPONSE_BYTES) {
              fail('Paze response is too large');
              return;
            }
            chunks.push(chunk);
          });
          res.on('end', () => {
            if (settled) return;
            settled = true;
            clearTimeout(connectTimer);
            clearTimeout(totalTimer);
            resolve({
              status: res.statusCode || 0,
              headers: res.headers,
              body: Buffer.concat(chunks),
            });
          });
          res.on('error', () => fail('Paze response failed'));
        }
      );

      const connectTimer = setTimeout(
        () => fail('Paze connect timeout'),
        options.connectTimeoutMs
      );
      const totalTimer = setTimeout(
        () => fail('Paze request timeout'),
        options.totalTimeoutMs
      );

      req.on('socket', socket => {
        socket.once('secureConnect', () => {
          connected = true;
          clearTimeout(connectTimer);
        });
      });
      req.on('error', error => fail(error.message));
      req.end(request.body);
    });
