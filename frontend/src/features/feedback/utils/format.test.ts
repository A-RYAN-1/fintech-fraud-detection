import { describe, expect, it } from "vitest";
import { formatRate } from "./format";

describe("formatRate", () => {
  it("rounds to a whole percent", () => {
    expect(formatRate(0.833)).toBe("83%");
    expect(formatRate(1)).toBe("100%");
    expect(formatRate(0)).toBe("0%");
  });

  it("shows n/a when the signal never answered", () => {
    expect(formatRate(null)).toBe("n/a");
  });
});
