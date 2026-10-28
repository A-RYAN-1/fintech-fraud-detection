import { describe, it, expect } from "vitest";
import { formatMoney } from "./money";

describe("formatMoney", () => {
  it("formats numbers and numeric strings as USD with cents", () => {
    expect(formatMoney(1100)).toBe("$1,100.00");
    expect(formatMoney("49.5")).toBe("$49.50");
  });

  it("drops cents when whole is set", () => {
    expect(formatMoney(12345.67, { whole: true })).toBe("$12,346");
  });

  it("falls back to zero for non-numbers", () => {
    expect(formatMoney("abc")).toBe("$0.00");
  });

  it("never uses a rupee sign or INR", () => {
    const out = formatMoney(10000000);
    expect(out).not.toMatch(/₹|INR/);
    expect(out).toBe("$10,000,000.00");
  });
});
