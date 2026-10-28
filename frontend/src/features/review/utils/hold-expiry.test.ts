import { describe, expect, it } from "vitest";
import { holdExpiry } from "./hold-expiry";

const now = new Date("2026-10-28T12:00:00Z");
const inHours = (h: number) =>
  new Date(now.getTime() + h * 3_600_000).toISOString();

describe("holdExpiry", () => {
  it("returns null without an expiry", () => {
    expect(holdExpiry(null, now)).toBeNull();
    expect(holdExpiry(undefined, now)).toBeNull();
  });

  it("counts days when far away and is not urgent", () => {
    expect(holdExpiry(inHours(24 * 20 + 3), now)).toEqual({
      label: "Hold expires in 20 days",
      urgent: false,
    });
  });

  it("counts hours under two days and is urgent under three", () => {
    expect(holdExpiry(inHours(30), now)).toEqual({
      label: "Hold expires in 30 hours",
      urgent: true,
    });
    expect(holdExpiry(inHours(60), now)).toEqual({
      label: "Hold expires in 2 days",
      urgent: true,
    });
  });

  it("handles the last hour and the past", () => {
    expect(holdExpiry(inHours(0.5), now)?.label).toBe(
      "Hold expires in under 1 hour",
    );
    expect(holdExpiry(inHours(-1), now)).toEqual({
      label: "Hold expired",
      urgent: true,
    });
  });
});
