import { describe, expect, it } from "vitest";
import { actionTaken, formatMlScore } from "./payment-labels";

describe("actionTaken", () => {
  it("names who captured a payment", () => {
    expect(
      actionTaken({
        paypal_status: "CAPTURED",
        capture_mode: "auto",
        status: "success",
      }),
    ).toBe("Captured by agent");
    expect(
      actionTaken({
        paypal_status: "CAPTURED",
        capture_mode: "human",
        status: "flagged",
      }),
    ).toBe("Captured by reviewer");
  });

  it("maps the held, voided and refunded states", () => {
    expect(actionTaken({ paypal_status: "HELD", status: "flagged" })).toBe(
      "Held for review",
    );
    expect(actionTaken({ paypal_status: "VOIDED", status: "blocked" })).toBe(
      "Voided",
    );
    expect(actionTaken({ paypal_status: "REFUNDED", status: "success" })).toBe(
      "Refunded",
    );
  });

  it("falls back to the rules decision for a row that never used PayPal", () => {
    expect(actionTaken({ paypal_status: null, status: "success" })).toBe(
      "Approved",
    );
    expect(actionTaken({ status: "FLAGGED" })).toBe("Flagged");
    expect(actionTaken({ status: "blocked" })).toBe("Blocked");
    expect(actionTaken({ status: "pending" })).toBe("Pending");
  });
});

describe("formatMlScore", () => {
  it("shows a percentage or a dash", () => {
    expect(formatMlScore(0.734)).toBe("73%");
    expect(formatMlScore(null)).toBe("-");
    expect(formatMlScore(undefined)).toBe("-");
  });
});
