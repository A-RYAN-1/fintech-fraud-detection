// One Idempotency-Key per user intent. The same key is sent again on a retry of the same request (a dropped
// connection, a double click), so the server returns the first answer instead of paying twice. A new intent
// (another amount, another payment) gets a new key.
export const IDEMPOTENCY_HEADER = "Idempotency-Key";

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function idempotencyHeaders(key: string): Record<string, string> {
  return { [IDEMPOTENCY_HEADER]: key };
}

// Holds the key of the attempt in flight, per intent label. `release` after the attempt succeeds.
export function createKeyStore() {
  const keys = new Map<string, string>();
  return {
    keyFor(intent: string): string {
      let key = keys.get(intent);
      if (!key) {
        key = newIdempotencyKey();
        keys.set(intent, key);
      }
      return key;
    },
    release(intent: string): void {
      keys.delete(intent);
    },
  };
}
