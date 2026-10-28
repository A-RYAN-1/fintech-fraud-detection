import { describe, it, expect } from "vitest";
import { navigationFor, homePathFor } from "./navigation.config";
import type { UserRole } from "@/types";

const titles = (role: UserRole) =>
  navigationFor(role).flatMap((s) => s.items.map((i) => i.title));

describe("navigationFor", () => {
  it("gives a customer Dashboard and Payments only", () => {
    expect(titles("customer")).toEqual(["Dashboard", "Payments"]);
  });

  it.each(["analyst", "reviewer"] as UserRole[])(
    "gives %s the staff list without admin pages",
    (role) => {
      expect(titles(role)).toEqual([
        "Review Queue",
        "Approvals",
        "Feedback",
        "Dashboard",
        "Risk Analysis",
      ]);
    },
  );

  it("adds Users and Audit Logs for an admin", () => {
    expect(titles("admin")).toEqual([
      "Review Queue",
      "Approvals",
      "Feedback",
      "Dashboard",
      "Risk Analysis",
      "Users",
      "Audit Logs",
    ]);
  });

  it("never lists Preferences or Help in the sidebar", () => {
    for (const role of ["customer", "analyst", "reviewer", "admin"] as const) {
      expect(titles(role)).not.toContain("Preferences");
      expect(titles(role).join()).not.toMatch(/Help/);
    }
  });

  it("returns nothing without a role", () => {
    expect(navigationFor(undefined)).toEqual([]);
  });
});

describe("homePathFor", () => {
  it("lands customers on Payments and staff on the Review Queue", () => {
    expect(homePathFor("customer")).toBe("/payments");
    expect(homePathFor("analyst")).toBe("/admin/review");
    expect(homePathFor("reviewer")).toBe("/admin/review");
    expect(homePathFor("admin")).toBe("/admin/review");
  });
});
