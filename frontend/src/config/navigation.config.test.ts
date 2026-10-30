import { describe, it, expect } from "vitest";
import {
  navigationFor,
  accountNavigationFor,
  homePathFor,
  pageTitleFor,
} from "./navigation.config";
import type { UserRole } from "@/types";

const ROLES: UserRole[] = ["customer", "analyst", "reviewer", "admin"];

const titles = (role: UserRole) =>
  navigationFor(role).flatMap((s) => s.items.map((i) => i.title));

describe("navigationFor", () => {
  it("gives a customer Home, Pay, History and My Spending", () => {
    expect(titles("customer")).toEqual([
      "Home",
      "Pay",
      "History",
      "My Spending",
    ]);
  });

  it("gives an analyst no Approvals, since an analyst cannot decide", () => {
    expect(titles("analyst")).toEqual([
      "Home",
      "Review Queue",
      "Feedback",
      "Rule Changes",
      "Insights",
    ]);
  });

  it("gives a reviewer Approvals and no admin pages", () => {
    expect(titles("reviewer")).toEqual([
      "Home",
      "Review Queue",
      "Approvals",
      "Feedback",
      "Rule Changes",
      "Insights",
    ]);
  });

  it("adds Users and Audit Log for an admin", () => {
    expect(titles("admin")).toEqual([
      "Home",
      "Review Queue",
      "Approvals",
      "Feedback",
      "Rule Changes",
      "Insights",
      "Users",
      "Audit Log",
    ]);
  });

  it("never lists Settings or Preferences", () => {
    for (const role of ROLES) {
      expect(titles(role)).not.toContain("Settings");
      expect(titles(role)).not.toContain("Preferences");
    }
  });

  it("returns nothing without a role", () => {
    expect(navigationFor(undefined)).toEqual([]);
    expect(accountNavigationFor(undefined)).toEqual([]);
  });
});

describe("accountNavigationFor", () => {
  it("puts Profile and Help in the shared bottom group for every role", () => {
    for (const role of ROLES) {
      expect(accountNavigationFor(role).map((i) => i.title)).toEqual([
        "Profile",
        "Help",
      ]);
    }
  });
});

describe("homePathFor", () => {
  it("lands every role on Home", () => {
    for (const role of ROLES) {
      expect(homePathFor(role)).toBe("/home");
    }
  });
});

describe("pageTitleFor", () => {
  it("names each role's analytics page", () => {
    expect(pageTitleFor("/spending", "customer")).toBe("My Spending");
    expect(pageTitleFor("/insights", "reviewer")).toBe("Insights");
  });

  it("falls back to the shared map for pages outside the sidebar", () => {
    expect(pageTitleFor("/admin", "admin")).toBe("Administration");
  });
});
