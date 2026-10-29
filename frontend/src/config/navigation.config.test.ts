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
      "Dashboard",
      "Risk Analysis",
    ]);
  });

  it("gives a reviewer Approvals and no admin pages", () => {
    expect(titles("reviewer")).toEqual([
      "Home",
      "Review Queue",
      "Approvals",
      "Feedback",
      "Dashboard",
      "Risk Analysis",
    ]);
  });

  it("adds Users and Audit Log for an admin", () => {
    expect(titles("admin")).toEqual([
      "Home",
      "Review Queue",
      "Approvals",
      "Feedback",
      "Dashboard",
      "Risk Analysis",
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
  it("puts Help in the shared bottom group for every role", () => {
    for (const role of ROLES) {
      expect(accountNavigationFor(role).map((i) => i.title)).toEqual(["Help"]);
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
  it("names the shared /dashboard by role", () => {
    expect(pageTitleFor("/dashboard", "customer")).toBe("My Spending");
    expect(pageTitleFor("/dashboard", "reviewer")).toBe("Dashboard");
  });

  it("falls back to the shared map for pages outside the sidebar", () => {
    expect(pageTitleFor("/admin", "admin")).toBe("Administration");
  });
});
