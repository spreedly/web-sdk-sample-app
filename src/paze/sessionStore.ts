import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// One record per Paze checkout, keyed by sessionId. The sample backend has no database, so the
// records live in memory, as the PayPal demo's do: a restart loses them. The Paze calls still work
// after a restart, because clientContext is derived from sessionId; only the duplicate-complete
// check and the stored payment method token are lost. Merchants keep this in their order store.

export type PazeSessionStatus =
  | 'CREATED'
  | 'REVIEWED'
  | 'COMPLETING'
  | 'COMPLETED'
  | 'FAILED';

export type PazeTransactionType = 'PURCHASE' | 'CARD_ON_FILE' | 'BOTH';

export interface TransactionValue {
  transactionCurrency: string;
  transactionAmount: string;
}

export interface CompleteResult {
  paymentMethodToken: string;
  paymentCardNetwork?: string;
  lastFour?: string;
  consumer?: { fullName?: string; emailAddress?: string };
  billingAddress?: Record<string, string>;
  merchantReference?: string;
}

// What a retried complete needs to finish the Spreedly step without calling Paze again.
// securedPayload is encrypted while it waits.
export interface PendingPaymentMethod {
  encryptedSecuredPayload: Buffer;
  payloadId?: string | undefined;
  display: Omit<CompleteResult, 'paymentMethodToken'>;
}

export interface PazeSessionRecord {
  sessionId: string;
  // SHA-256 of the caller's app session, so review and complete only work for the creator.
  callerKey: string;
  environment: string;
  transactionType: PazeTransactionType;
  transactionValue?: TransactionValue | undefined;
  billingPreference: string;
  status: PazeSessionStatus;
  pending?: PendingPaymentMethod | undefined;
  result?: CompleteResult;
  createdAt: number;
  updatedAt: number;
}

export interface SessionStoreOptions {
  ttlMs: number;
  maxSessions: number;
  now?: () => number;
}

export class SessionStoreFullError extends Error {
  constructor() {
    super('Too many open Paze sessions');
    this.name = 'SessionStoreFullError';
  }
}

export class PazeSessionStore {
  private readonly records = new Map<string, PazeSessionRecord>();
  private readonly locks = new Map<string, Promise<unknown>>();
  // Encrypts securedPayload while a session waits for a Spreedly retry. A process-local key is
  // enough: the records themselves don't outlive the process.
  private readonly payloadKey = randomBytes(32);
  private readonly now: () => number;

  constructor(private readonly options: SessionStoreOptions) {
    this.now = options.now || Date.now;
  }

  create(
    record: Omit<PazeSessionRecord, 'status' | 'createdAt' | 'updatedAt'>
  ): PazeSessionRecord {
    this.sweep();
    if (this.records.size >= this.options.maxSessions) {
      throw new SessionStoreFullError();
    }
    const at = this.now();
    const created: PazeSessionRecord = {
      ...record,
      status: 'CREATED',
      createdAt: at,
      updatedAt: at,
    };
    this.records.set(record.sessionId, created);
    return created;
  }

  // An unknown id, an expired record and another caller's record all look the same: undefined.
  get(sessionId: string, callerKey: string): PazeSessionRecord | undefined {
    const record = this.records.get(sessionId);
    if (!record) return undefined;
    if (this.isExpired(record)) {
      this.delete(sessionId);
      return undefined;
    }
    return record.callerKey === callerKey ? record : undefined;
  }

  update(record: PazeSessionRecord, changes: Partial<PazeSessionRecord>): void {
    Object.assign(record, changes, { updatedAt: this.now() });
  }

  // Runs `task` after any earlier task for the same session, so two completes never overlap.
  async withLock<T>(sessionId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(sessionId) || Promise.resolve();
    const run = previous.catch(() => undefined).then(task);
    this.locks.set(sessionId, run);
    try {
      return await run;
    } finally {
      if (this.locks.get(sessionId) === run) this.locks.delete(sessionId);
    }
  }

  encryptPayload(securedPayload: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.payloadKey, iv);
    const body = Buffer.concat([
      cipher.update(securedPayload, 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]);
  }

  decryptPayload(encrypted: Buffer): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.payloadKey,
      encrypted.subarray(0, 12)
    );
    decipher.setAuthTag(encrypted.subarray(12, 28));
    return Buffer.concat([
      decipher.update(encrypted.subarray(28)),
      decipher.final(),
    ]).toString('utf8');
  }

  // Expired records go when they're next touched and on every create.
  sweep(): number {
    let expired = 0;
    for (const [sessionId, record] of this.records) {
      if (this.isExpired(record)) {
        this.delete(sessionId);
        expired++;
      }
    }
    return expired;
  }

  get size(): number {
    return this.records.size;
  }

  private isExpired(record: PazeSessionRecord): boolean {
    return this.now() - record.createdAt > this.options.ttlMs;
  }

  private delete(sessionId: string): void {
    const record = this.records.get(sessionId);
    if (record?.status === 'COMPLETING') {
      console.warn(
        JSON.stringify({
          event: 'paze_session_expired_completing',
          sessionId,
        })
      );
    }
    this.records.delete(sessionId);
  }
}
