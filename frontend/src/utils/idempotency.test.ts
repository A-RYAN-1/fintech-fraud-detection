import { describe, expect, it } from "vitest";
import { createKeyStore, idempotencyHeaders } from "./idempotency";

describe("createKeyStore", () => {
  it("returns the same key for a retry of the same intent", () => {
    const store = createKeyStore();
    expect(store.keyFor("pay:10")).toBe(store.keyFor("pay:10"));
  });

  it("returns different keys for different intents", () => {
    const store = createKeyStore();
    expect(store.keyFor("pay:10")).not.toBe(store.keyFor("pay:20"));
  });

  it("returns a new key after release", () => {
    const store = createKeyStore();
    const first = store.keyFor("pay:10");
    store.release("pay:10");
    expect(store.keyFor("pay:10")).not.toBe(first);
  });
});

describe("idempotencyHeaders", () => {
  it("names the header", () => {
    expect(idempotencyHeaders("k")).toEqual({ "Idempotency-Key": "k" });
  });
});
