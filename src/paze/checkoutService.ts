import { generateSessionId } from './clientContext';
import { PazeClient, PazeInvalidResponseError } from './pazeClient';
import {
  CompleteResult,
  PazeSessionRecord,
  PazeSessionStore,
  PazeTransactionType,
  TransactionValue,
} from './sessionStore';

// The backend-mediated Paze checkout: create, review and complete, then the Spreedly payment
// method from securedPayload. Everything here is independent of Express and of config, so the
// tests drive it with a fake transport and a fake Spreedly.

// A failure that isn't Paze's: bad input, an unknown session, a Spreedly error. `message` goes
// to the app, so it never carries tokens, the code, securedPayload or shopper contact details.
export class BackendError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'BackendError';
  }
}

// Spreedly answered the payment method create with an HTTP error. Its status and body go back
// to the app unchanged, as the other routes do with sendCoreError.
export class SpreedlyApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown
  ) {
    super(spreedlyErrorMessage(status, body));
    this.name = 'SpreedlyApiError';
  }
}

const spreedlyErrorMessage = (status: number, body: unknown): string => {
  const errors =
    isObject(body) && Array.isArray(body.errors) ? body.errors : [];
  const messages = errors
    .map(error => (isObject(error) ? error.message : undefined))
    .filter(
      (message): message is string =>
        typeof message === 'string' && message.length > 0
    );
  if (messages.length > 0) return messages.join('; ');
  const transaction = isObject(body) ? body.transaction : undefined;
  if (
    isObject(transaction) &&
    typeof transaction.message === 'string' &&
    transaction.message
  ) {
    return transaction.message;
  }
  return `Spreedly returned HTTP ${status}`;
};

export interface PazeMerchantClient {
  id: string;
  name: string;
  profileId: string;
}

export interface SpreedlyPaymentMethod {
  token: string;
  lastFour?: string;
}

// Creates the payment method from the third_party_network_token body. Throws on failure.
export type CreateSpreedlyPaymentMethod = (
  thirdPartyNetworkToken: Record<string, unknown>
) => Promise<SpreedlyPaymentMethod>;

export interface CheckoutServiceDeps {
  paze: PazeClient;
  store: PazeSessionStore;
  createPaymentMethod: CreateSpreedlyPaymentMethod;
  client: PazeMerchantClient;
  certificateToken: string;
  // The sample has no order store, so the order is what create was given, within these limits.
  maxTransactionAmount: number;
  currencies: ReadonlySet<string>;
}

export interface CreateSessionResult {
  sessionId: string;
  checkoutUrl: string;
}

const INTENTS = new Set(['REVIEW_AND_PAY', 'EXPRESS_CHECKOUT', 'ADD_CARD']);
const TRANSACTION_TYPES = new Set<PazeTransactionType>([
  'PURCHASE',
  'CARD_ON_FILE',
  'BOTH',
]);
const PREFERENCE_PATTERN = /^[A-Z_]{1,32}$/;
const AMOUNT_PATTERN = /^(0|[1-9]\d{0,8})\.\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@]{1,189}$/;
const PHONE_PATTERN = /^\+?[0-9]{6,15}$/;
// The checkout code is opaque. Bounded and printable, nothing more is assumed. The wallet's
// code is a compact JWS that runs past 2 KB; 16 KB keeps the body under express.json's 32kb.
const CODE_PATTERN = /^[\x21-\x7e]{1,16384}$/;
const MCC_PATTERN = /^\d{4}$/;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionalString = (
  value: unknown,
  field: string,
  pattern: RegExp
): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new BackendError(400, `${field} is invalid`);
  }
  return value;
};

const readTransactionType = (value: unknown): PazeTransactionType => {
  if (value === undefined || value === null) return 'PURCHASE';
  if (
    typeof value !== 'string' ||
    !TRANSACTION_TYPES.has(value as PazeTransactionType)
  ) {
    throw new BackendError(400, 'transactionType is invalid');
  }
  return value as PazeTransactionType;
};

const readCode = (body: unknown): string => {
  const code = isObject(body) ? body.code : undefined;
  if (typeof code !== 'string' || !CODE_PATTERN.test(code)) {
    throw new BackendError(400, 'code is required');
  }
  return code;
};

const sameValue = (a?: TransactionValue, b?: TransactionValue): boolean =>
  a?.transactionCurrency === b?.transactionCurrency &&
  a?.transactionAmount === b?.transactionAmount;

const stringField = (value: unknown, max = 128): string | undefined =>
  typeof value === 'string' && value.length > 0 && value.length <= max
    ? value
    : undefined;

const ADDRESS_FIELDS = [
  'line1',
  'line2',
  'line3',
  'city',
  'state',
  'zip',
  'countryCode',
] as const;

// The display-safe part of a sessions/complete response. Never the network token, its expiry,
// the PAR, dynamicData or the ECI.
export const displayFields = (
  data: Record<string, unknown>
): Omit<CompleteResult, 'paymentMethodToken'> => {
  const maskedCard = isObject(data.maskedCard) ? data.maskedCard : {};
  const consumerRaw = isObject(data.consumer) ? data.consumer : {};
  const lastFour = stringField(
    maskedCard.panLastFour ?? maskedCard.lastFour ?? maskedCard.last4,
    4
  );
  const network = stringField(
    maskedCard.paymentCardNetwork ?? data.paymentCardNetwork,
    32
  );
  const joinedName = [consumerRaw.firstName, consumerRaw.lastName]
    .filter(part => typeof part === 'string' && part)
    .join(' ');
  const fullName = stringField(consumerRaw.fullName) ?? stringField(joinedName);
  const emailAddress = stringField(consumerRaw.emailAddress, 254);

  const billingRaw = isObject(maskedCard.billingAddress)
    ? maskedCard.billingAddress
    : isObject(data.billingAddress)
      ? data.billingAddress
      : undefined;
  let billingAddress: Record<string, string> | undefined;
  if (billingRaw) {
    billingAddress = {};
    for (const field of ADDRESS_FIELDS) {
      const value = stringField(billingRaw[field]);
      if (value) billingAddress[field] = value;
    }
    if (Object.keys(billingAddress).length === 0) billingAddress = undefined;
  }

  return {
    ...(network && { paymentCardNetwork: network }),
    ...(lastFour && /^\d{4}$/.test(lastFour) && { lastFour }),
    ...((fullName || emailAddress) && {
      consumer: {
        ...(fullName && { fullName }),
        ...(emailAddress && { emailAddress }),
      },
    }),
    ...(billingAddress && { billingAddress }),
  };
};

export class PazeCheckoutService {
  constructor(private readonly deps: CheckoutServiceDeps) {}

  private readTransactionValue(value: unknown): TransactionValue {
    if (!isObject(value)) {
      throw new BackendError(400, 'transactionValue is required');
    }
    const currency = value.transactionCurrency;
    const amount = value.transactionAmount;
    if (typeof currency !== 'string' || !this.deps.currencies.has(currency)) {
      throw new BackendError(400, 'transactionCurrency is not supported');
    }
    if (
      typeof amount !== 'string' ||
      !AMOUNT_PATTERN.test(amount) ||
      Number(amount) <= 0 ||
      Number(amount) > this.deps.maxTransactionAmount
    ) {
      throw new BackendError(400, 'transactionAmount is invalid');
    }
    return { transactionCurrency: currency, transactionAmount: amount };
  }

  async createSession(
    body: unknown,
    callerKey: string
  ): Promise<CreateSessionResult> {
    if (!isObject(body))
      throw new BackendError(400, 'body must be a JSON object');

    // Sent to Paze as the app gave it; Paze rejects one it doesn't accept.
    const callbackURLScheme = body.callbackURLScheme;
    const intent = body.intent;
    if (typeof intent !== 'string' || !INTENTS.has(intent)) {
      throw new BackendError(400, 'intent is invalid');
    }
    const transactionType = readTransactionType(body.transactionType);
    // CARD_ON_FILE moves no money, so it has no amount. The others take theirs from the order.
    const transactionValue =
      transactionType === 'CARD_ON_FILE'
        ? undefined
        : this.readTransactionValue(body.transactionValue);
    const emailAddress = optionalString(
      body.emailAddress,
      'emailAddress',
      EMAIL_PATTERN
    );
    const phoneNumber = optionalString(
      body.phoneNumber,
      'phoneNumber',
      PHONE_PATTERN
    );
    if (!emailAddress && !phoneNumber) {
      throw new BackendError(400, 'emailAddress or phoneNumber is required');
    }
    const shippingPreference =
      optionalString(
        body.shippingPreference,
        'shippingPreference',
        PREFERENCE_PATTERN
      ) ?? 'ALL';
    const billingPreference =
      optionalString(
        body.billingPreference,
        'billingPreference',
        PREFERENCE_PATTERN
      ) ?? 'ALL';

    const sessionId = generateSessionId();
    const data: Record<string, unknown> = {
      client: {
        id: this.deps.client.id,
        name: this.deps.client.name,
        profileId: this.deps.client.profileId,
      },
      sessionId,
      ...(emailAddress && { emailAddress }),
      ...(phoneNumber && { phoneNumber }),
      callbackURLScheme,
      intent,
      transactionType,
      shippingPreference,
      billingPreference,
      ...(transactionValue && { transactionValue }),
    };

    // Recorded first, so the store's size limit applies before Paze is called.
    this.deps.store.create({
      sessionId,
      callerKey,
      environment: this.deps.paze.environment,
      transactionType,
      transactionValue,
      billingPreference,
    });
    let checkoutUrl: string;
    try {
      const { body: response } = await this.deps.paze.callSession(
        'create',
        sessionId,
        data
      );
      checkoutUrl = this.readCheckoutUrl(response);
    } catch (error) {
      const record = this.deps.store.get(sessionId, callerKey);
      if (record) this.deps.store.update(record, { status: 'FAILED' });
      throw error;
    }
    return { sessionId, checkoutUrl };
  }

  // Only https on the environment's checkout host is handed to the app.
  private readCheckoutUrl(response: Record<string, unknown>): string {
    const data = isObject(response.data) ? response.data : response;
    const raw = data.pazeCheckoutUrl ?? data.checkoutUrl;
    if (typeof raw !== 'string') {
      throw new PazeInvalidResponseError('create', 'no checkout URL');
    }
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new PazeInvalidResponseError('create', 'checkout URL is not a URL');
    }
    if (
      url.protocol !== 'https:' ||
      url.hostname !== this.deps.paze.hosts.checkoutHost ||
      url.username ||
      url.password ||
      (url.port && url.port !== '443')
    ) {
      throw new PazeInvalidResponseError('create', 'checkout URL host');
    }
    return url.toString();
  }

  private findSession(sessionId: string, callerKey: string): PazeSessionRecord {
    const record = this.deps.store.get(sessionId, callerKey);
    if (!record) throw new BackendError(404, 'session not found');
    return record;
  }

  async reviewSession(
    sessionId: string,
    body: unknown,
    callerKey: string
  ): Promise<{ pazeResponse: Record<string, unknown> }> {
    const record = this.findSession(sessionId, callerKey);
    const code = readCode(body);
    if (record.status !== 'CREATED' && record.status !== 'REVIEWED') {
      throw new BackendError(409, 'session can no longer be reviewed');
    }
    const { body: response } = await this.deps.paze.callSession(
      'review',
      sessionId,
      { sessionId, code }
    );
    this.deps.store.update(record, { status: 'REVIEWED' });
    return { pazeResponse: response };
  }

  async completeSession(
    sessionId: string,
    body: unknown,
    callerKey: string
  ): Promise<CompleteResult> {
    // Checked before taking the lock, so an unknown id never queues behind a real session.
    this.findSession(sessionId, callerKey);
    return this.deps.store.withLock(sessionId, async () => {
      const record = this.findSession(sessionId, callerKey);
      if (record.status === 'COMPLETED' && record.result) return record.result;
      if (record.status === 'COMPLETING' && record.pending) {
        return this.finishPaymentMethod(record);
      }
      if (record.status !== 'CREATED' && record.status !== 'REVIEWED') {
        throw new BackendError(409, 'session can no longer be completed');
      }
      const data = this.completeData(record, body);

      this.deps.store.update(record, { status: 'COMPLETING' });
      let response: Record<string, unknown>;
      try {
        ({ body: response } = await this.deps.paze.callSession(
          'complete',
          sessionId,
          data
        ));
      } catch (error) {
        // The code may be spent, so this session is done. The app starts a new checkout.
        this.deps.store.update(record, { status: 'FAILED' });
        throw error;
      }

      const responseData = isObject(response.data) ? response.data : response;
      const securedPayload =
        responseData.securedPayload ?? responseData.securePayload;
      if (typeof securedPayload !== 'string' || !securedPayload) {
        this.deps.store.update(record, { status: 'FAILED' });
        throw new PazeInvalidResponseError('complete', 'no securedPayload');
      }
      const payloadId = stringField(responseData.payloadId, 256);
      this.deps.store.update(record, {
        pending: {
          encryptedSecuredPayload:
            this.deps.store.encryptPayload(securedPayload),
          payloadId,
          display: displayFields(responseData),
        },
      });
      return this.finishPaymentMethod(record);
    });
  }

  // The sessions/complete data object. The order decides the amount: the app's values are
  // checked against it, never used in its place.
  private completeData(
    record: PazeSessionRecord,
    body: unknown
  ): Record<string, unknown> {
    const code = readCode(body);
    const input = body as Record<string, unknown>;
    const transactionType =
      input.transactionType === undefined || input.transactionType === null
        ? record.transactionType
        : readTransactionType(input.transactionType);
    if (transactionType !== record.transactionType) {
      throw new BackendError(400, 'transactionType does not match the order');
    }
    if (
      record.transactionType !== 'CARD_ON_FILE' &&
      input.transactionValue !== undefined &&
      input.transactionValue !== null &&
      !sameValue(
        this.readTransactionValue(input.transactionValue),
        record.transactionValue
      )
    ) {
      throw new BackendError(400, 'transactionValue does not match the order');
    }
    const billingPreference =
      optionalString(
        input.billingPreference,
        'billingPreference',
        PREFERENCE_PATTERN
      ) ?? record.billingPreference;
    const merchantCategoryCode = optionalString(
      input.merchantCategoryCode,
      'merchantCategoryCode',
      MCC_PATTERN
    );

    return {
      transactionType: record.transactionType,
      sessionId: record.sessionId,
      code,
      transactionOptions: {
        payloadTypeIndicator: 'PAYMENT',
        billingPreference,
        ...(merchantCategoryCode && { merchantCategoryCode }),
      },
      ...(record.transactionType !== 'CARD_ON_FILE' && {
        transactionValue: record.transactionValue,
      }),
    };
  }

  // Creates the Spreedly payment method once. On failure the session stays at COMPLETING with
  // the encrypted payload, so a retried complete finishes here without calling Paze again.
  private async finishPaymentMethod(
    record: PazeSessionRecord
  ): Promise<CompleteResult> {
    const pending = record.pending;
    if (!pending)
      throw new BackendError(409, 'session can no longer be completed');

    let paymentMethod: SpreedlyPaymentMethod;
    try {
      paymentMethod = await this.deps.createPaymentMethod({
        certificate_token: this.deps.certificateToken,
        secured_payload: this.deps.store.decryptPayload(
          pending.encryptedSecuredPayload
        ),
        session_id: record.sessionId,
        ...(pending.payloadId && { payload_id: pending.payloadId }),
        source: 'paze',
      });
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: 'paze_spreedly_payment_method_failed',
          sessionId: record.sessionId,
          ...(error instanceof SpreedlyApiError && {
            status: error.status,
            reason: error.message,
          }),
        })
      );
      if (error instanceof SpreedlyApiError) throw error;
      throw new BackendError(
        502,
        'payment method creation failed; retry complete'
      );
    }

    const result: CompleteResult = {
      paymentMethodToken: paymentMethod.token,
      ...pending.display,
    };
    if (!result.lastFour && paymentMethod.lastFour) {
      result.lastFour = paymentMethod.lastFour;
    }
    // securedPayload is dropped once the payment method exists.
    this.deps.store.update(record, {
      status: 'COMPLETED',
      result,
      pending: undefined,
    });
    return result;
  }
}
