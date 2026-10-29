import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import type { User, UserRole } from "@/types";

vi.mock("@/features/auth/hooks", () => ({ useAuth: vi.fn() }));

import { useAuth } from "@/features/auth/hooks";
import HomePage from "./HomePage";

function renderAs(role: UserRole) {
  const user = {
    id: "1",
    email: "x@example.com",
    first_name: "Ada",
    last_name: "Lovelace",
    role,
    status: "active",
  } as User;
  vi.mocked(useAuth).mockReturnValue({ user } as ReturnType<typeof useAuth>);
  return renderWithProviders(<HomePage />);
}

const cardLinks = () =>
  screen.getAllByRole("link").map((a) => a.getAttribute("href"));

describe("HomePage", () => {
  it("shows a customer the Pay, History and My Spending cards", () => {
    renderAs("customer");
    expect(screen.getByText("Welcome, Ada")).toBeInTheDocument();
    expect(screen.getByText(/PayPal authorizes the money/)).toBeInTheDocument();
    expect(cardLinks()).toEqual(["/pay", "/history", "/dashboard"]);
  });

  it("keeps an analyst away from Approvals", () => {
    renderAs("analyst");
    expect(cardLinks()).toEqual(["/admin/review", "/admin/feedback"]);
  });

  it("gives an admin the admin pages", () => {
    renderAs("admin");
    expect(cardLinks()).toEqual([
      "/admin/review",
      "/admin/approvals",
      "/admin/feedback",
      "/admin/users",
      "/admin/audit-logs",
    ]);
  });
});
