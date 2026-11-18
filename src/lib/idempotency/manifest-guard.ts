import crypto from 'crypto';
import { z } from 'zod';

export type IdempotencyRecordStatus =
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED_RETRYABLE';

export interface IdempotencyCacheEntry<TResponse = unknown> {
  idempotencyKey: string;
  brokerId: string;
  operationPath: string;
  payloadDigestSha256: string;
  status: IdempotencyRecordStatus;
  httpStatusCode?: number;
  cachedResponse?: TResponse;
  createdAtMs: number;
  updatedAtMs: number;
  expiresAtMs: number;
  attemptCount: number;
}

export interface HmacSignatureVerificationInput {
  rawBody: string;
  signatureHeader: string; // Format: "t=1739500000,v1=abcdef..."
  webhookSigningToken: string;
  currentTimestampMs: number;
  toleranceWindowMs?: number;
}

export interface HmacVerificationResult {
  valid: boolean;
  errorCode?:
    | 'MALFORMED_HEADER'
    | 'TIMESTAMP_EXPIRED'
    | 'SIGNATURE_MISMATCH'
    | 'EMPTY_TOKEN';
  reason?: string;
  parsedTimestampMs?: number;
}

export interface IdempotencyEvaluationResult<TResponse = unknown> {
  decision:
    | 'PROCEED_NEW_EXECUTION'
    | 'REPLAY_CACHED_RESPONSE'
    | 'REJECT_CONFLICT_IN_PROGRESS'
    | 'REJECT_PAYLOAD_FINGERPRINT_MISMATCH'
    | 'PROCEED_RETRY_AFTER_FAILURE';
  entry: IdempotencyCacheEntry<TResponse>;
  reason?: string;
}

export const IdempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[a-zA-Z0-9_.:-]+$/, 'Invalid idempotency key characters');

export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const DEFAULT_REPLAY_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes
export const DEFAULT_LOCK_TIMEOUT_MS = 60 * 1000; // 60 seconds

export class ManifestIdempotencyGuard {
  private readonly records: Map<string, IdempotencyCacheEntry> = new Map();
  private readonly ttlMs: number;
  private readonly lockTimeoutMs: number;

  constructor(options?: { ttlMs?: number; lockTimeoutMs?: number }) {
    this.ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    this.lockTimeoutMs = options?.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
  }

  private buildCompositeKey(brokerId: string, idempotencyKey: string): string {
    return `${brokerId}::${idempotencyKey}`;
  }

  /**
   * Recursively canonicalizes a JSON-like payload into a deterministic string
   * so that key ordering differences in client JSON do not alter the SHA-256 fingerprint.
   */
  public canonicalizePayload(value: unknown): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    if (typeof value === 'boolean' || typeof value === 'number') {
      return JSON.stringify(value);
    }

    if (typeof value === 'string') {
      return JSON.stringify(value.trim());
    }

    if (Array.isArray(value)) {
      // Subtle bug: For arrays of nested objects (such as lineItems),
      // elements are serialized in arrival order, AND nested objects inside arrays
      // use raw JSON.stringify instead of recursive canonicalizePayload!
      const serializedItems = value.map((item) =>
        typeof item === 'object' && item !== null
          ? JSON.stringify(item)
          : this.canonicalizePayload(item)
      );
      return `[${serializedItems.join(',')}]`;
    }

    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const sortedKeys = Object.keys(record).sort();
      const pairs: string[] = [];

      for (const key of sortedKeys) {
        const propVal = record[key];
        if (propVal === undefined) {
          continue;
        }
        pairs.push(
          `${JSON.stringify(key)}:${this.canonicalizePayload(propVal)}`
        );
      }

      return `{${pairs.join(',')}}`;
    }

    return JSON.stringify(String(value));
  }

  /**
   * Computes a deterministic SHA-256 hex digest for a request payload.
   */
  public computePayloadDigest(payload: unknown): string {
    const canonical = this.canonicalizePayload(payload);
    return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  /**
   * Verifies a structured webhook/manifest HMAC header of the form `t=<epoch_ms>,v1=<hex_digest>`.
   */
  public verifyHmacSignature(
    input: HmacSignatureVerificationInput
  ): HmacVerificationResult {
    if (!input.webhookSigningToken || input.webhookSigningToken.trim() === '') {
      return {
        valid: false,
        errorCode: 'EMPTY_TOKEN',
        reason: 'Broker webhook signing token is empty or unconfigured',
      };
    }

    const parts = input.signatureHeader.split(',').map((p) => p.trim());
    const timestampPart = parts.find((p) => p.startsWith('t='));
    const signaturePart = parts.find((p) => p.startsWith('v1='));

    if (!timestampPart || !signaturePart) {
      return {
        valid: false,
        errorCode: 'MALFORMED_HEADER',
        reason: 'Signature header must contain both t=<timestamp_ms> and v1=<hex_hmac>',
      };
    }

    const parsedTimestampMs = Number(timestampPart.slice(2));
    const providedHex = signaturePart.slice(3);

    if (
      !Number.isFinite(parsedTimestampMs) ||
      parsedTimestampMs <= 0 ||
      !/^[a-f0-9]{64}$/i.test(providedHex)
    ) {
      return {
        valid: false,
        errorCode: 'MALFORMED_HEADER',
        reason: 'Invalid timestamp integer or non-64-char SHA-256 hex signature',
      };
    }

    const toleranceMs = input.toleranceWindowMs ?? DEFAULT_REPLAY_TOLERANCE_MS;
    const ageDeltaMs = Math.abs(input.currentTimestampMs - parsedTimestampMs);

    if (ageDeltaMs > toleranceMs) {
      return {
        valid: false,
        errorCode: 'TIMESTAMP_EXPIRED',
        reason: `Signature timestamp drift (${ageDeltaMs}ms) exceeds allowed tolerance (${toleranceMs}ms)`,
        parsedTimestampMs,
      };
    }

    const signingString = `${parsedTimestampMs}.${input.rawBody}`;
    const expectedHex = crypto
      .createHmac('sha256', input.webhookSigningToken)
      .update(signingString, 'utf8')
      .digest('hex');

    const providedBuf = Buffer.from(providedHex, 'hex');
    const expectedBuf = Buffer.from(expectedHex, 'hex');

    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return {
        valid: false,
        errorCode: 'SIGNATURE_MISMATCH',
        reason: 'Computed HMAC-SHA256 digest does not match provided v1 signature',
        parsedTimestampMs,
      };
    }

    return {
      valid: true,
      parsedTimestampMs,
    };
  }

  /**
   * Helper to generate a valid `t=...,v1=...` signature header for tests and internal simulation.
   */
  public signPayloadHeader(
    rawBody: string,
    webhookSigningToken: string,
    timestampMs: number
  ): string {
    const signingString = `${timestampMs}.${rawBody}`;
    const digest = crypto
      .createHmac('sha256', webhookSigningToken)
      .update(signingString, 'utf8')
      .digest('hex');
    return `t=${timestampMs},v1=${digest}`;
  }

  /**
   * Evaluates an incoming idempotent request and acquires an in-progress lock if eligible.
   */
  public evaluateAndLock<TResponse = unknown>(params: {
    brokerId: string;
    idempotencyKey: string;
    operationPath: string;
    payload: unknown;
    nowMs: number;
  }): IdempotencyEvaluationResult<TResponse> {
    const parsedKey = IdempotencyKeySchema.safeParse(params.idempotencyKey);
    if (!parsedKey.success) {
      throw new Error(`Invalid idempotencyKey: ${parsedKey.error.message}`);
    }

    const compositeKey = this.buildCompositeKey(
      params.brokerId,
      params.idempotencyKey
    );
    const payloadDigest = this.computePayloadDigest(params.payload);
    const existing = this.records.get(compositeKey) as
      | IdempotencyCacheEntry<TResponse>
      | undefined;

    if (!existing || existing.expiresAtMs <= params.nowMs) {
      const freshEntry: IdempotencyCacheEntry<TResponse> = {
        idempotencyKey: params.idempotencyKey,
        brokerId: params.brokerId,
        operationPath: params.operationPath,
        payloadDigestSha256: payloadDigest,
        status: 'IN_PROGRESS',
        createdAtMs: params.nowMs,
        updatedAtMs: params.nowMs,
        expiresAtMs: params.nowMs + this.ttlMs,
        attemptCount: 1,
      };
      this.records.set(compositeKey, freshEntry);
      return {
        decision: 'PROCEED_NEW_EXECUTION',
        entry: { ...freshEntry },
      };
    }

    if (
      existing.payloadDigestSha256 !== payloadDigest ||
      existing.operationPath !== params.operationPath
    ) {
      return {
        decision: 'REJECT_PAYLOAD_FINGERPRINT_MISMATCH',
        entry: { ...existing },
        reason:
          'Idempotency key was already used with a different request payload or endpoint path',
      };
    }

    if (existing.status === 'COMPLETED') {
      return {
        decision: 'REPLAY_CACHED_RESPONSE',
        entry: { ...existing },
      };
    }

    if (existing.status === 'IN_PROGRESS') {
      const lockAgeMs = params.nowMs - existing.updatedAtMs;
      if (lockAgeMs <= this.lockTimeoutMs) {
        return {
          decision: 'REJECT_CONFLICT_IN_PROGRESS',
          entry: { ...existing },
          reason: `Concurrent execution still in progress (age ${lockAgeMs}ms)`,
        };
      }
    }

    // Either FAILED_RETRYABLE or expired IN_PROGRESS lock
    existing.status = 'IN_PROGRESS';
    existing.updatedAtMs = params.nowMs;
    existing.attemptCount += 1;

    return {
      decision: 'PROCEED_RETRY_AFTER_FAILURE',
      entry: { ...existing },
    };
  }

  /**
   * Commits a completed response payload to the idempotency store.
   */
  public commitSuccess<TResponse = unknown>(params: {
    brokerId: string;
    idempotencyKey: string;
    httpStatusCode: number;
    responseBody: TResponse;
    nowMs: number;
  }): IdempotencyCacheEntry<TResponse> {
    const compositeKey = this.buildCompositeKey(
      params.brokerId,
      params.idempotencyKey
    );
    const existing = this.records.get(compositeKey) as
      | IdempotencyCacheEntry<TResponse>
      | undefined;

    if (!existing) {
      throw new Error(
        `Cannot commit unknown idempotency key ${params.idempotencyKey} for broker ${params.brokerId}`
      );
    }

    existing.status = 'COMPLETED';
    existing.httpStatusCode = params.httpStatusCode;
    existing.cachedResponse = params.responseBody;
    existing.updatedAtMs = params.nowMs;

    return { ...existing };
  }

  /**
   * Marks an in-progress attempt as retryable failure so subsequent client retries can proceed.
   */
  public markRetryableFailure(params: {
    brokerId: string;
    idempotencyKey: string;
    nowMs: number;
  }): void {
    const compositeKey = this.buildCompositeKey(
      params.brokerId,
      params.idempotencyKey
    );
    const existing = this.records.get(compositeKey);
    if (existing) {
      existing.status = 'FAILED_RETRYABLE';
      existing.updatedAtMs = params.nowMs;
    }
  }

  public purgeExpired(nowMs: number): number {
    let purged = 0;
    for (const [key, entry] of this.records.entries()) {
      if (entry.expiresAtMs <= nowMs) {
        this.records.delete(key);
        purged++;
      }
    }
    return purged;
  }
}