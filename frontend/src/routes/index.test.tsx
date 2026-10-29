import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, Outlet } from "react-router-dom";
import type { UserRole } from "@/types";

vi.mock("@/features/auth/hooks", () => ({ useAuth: vi.fn() }));

vi.mock("@/components/common", async () => {
  const guard = await vi.importActual<
    typeof import("@/components/common/RoleGuard")
  >("@/components/common/RoleGuard");
  return {
    RoleGuard: guard.default,
    AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    GuestGuard: ({ children }: { children: React.ReactNode }) => (
      <>{children}</>
    ),
  };
});

vi.mock("@/layouts", () => ({ MainLayout: () => <Outlet /> }));

vi.mock("@/pages", () => {
  const page = (name: string) => () => <div>{`page:${name}`}</div>;
  return {
    LoginPage: page("login"),
    RegisterPage: page("register"),
    HomePage: page("home"),
    DashboardPage: page("dashboard"),
    PayPage: page("pay"),
    HistoryPage: page("history"),
    RiskAnalysisPage: page("risk"),
    HelpSupportPage: page("help"),
    ProfilePage: page("profile"),
    NotFoundPage: page("notfound"),
    UsersPage: page("users"),
    AuditLogsPage: page("audit"),
    ReviewQueuePage: page("review"),
    ApprovalsPage: page("approvals"),
    FeedbackPage: page("feedback"),
  };
});

import { useAuth } from "@/features/auth/hooks";
import { routes } from "./index";

function visit(role: UserRole, path: string) {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: "1", role, status: "active" },
  } as ReturnType<typeof useAuth>);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe("route access per role", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["customer", "analyst", "reviewer", "admin"] as UserRole[])(
    "lands %s on Home",
    (role) => {
      const router = visit(role, "/");
      expect(router.state.location.pathname).toBe("/home");
      expect(screen.getByText("page:home")).toBeInTheDocument();
    },
  );

  it.each([
    "/admin/review",
    "/admin/approvals",
    "/admin/feedback",
    "/risk-analysis",
    "/admin/users",
    "/admin/audit-logs",
  ])("redirects a customer from %s to Home", (path) => {
    expect(visit("customer", path).state.location.pathname).toBe("/home");
  });

  it.each(["analyst", "reviewer"] as UserRole[])(
    "redirects %s away from admin-only pages, Pay and History",
    (role) => {
      for (const path of [
        "/admin/users",
        "/admin/audit-logs",
        "/pay",
        "/history",
      ]) {
        expect(visit(role, path).state.location.pathname).toBe("/home");
      }
    },
  );

  it("keeps an analyst out of Approvals, since an analyst cannot decide", () => {
    expect(visit("analyst", "/admin/approvals").state.location.pathname).toBe(
      "/home",
    );
  });

  it("lets staff open the pages in their sidebar", () => {
    for (const path of [
      "/admin/review",
      "/admin/feedback",
      "/risk-analysis",
      "/dashboard",
    ]) {
      expect(visit("analyst", path).state.location.pathname).toBe(path);
    }
    expect(visit("reviewer", "/admin/approvals").state.location.pathname).toBe(
      "/admin/approvals",
    );
  });

  it("lets an admin open Users and Audit Log", () => {
    expect(visit("admin", "/admin/users").state.location.pathname).toBe(
      "/admin/users",
    );
    expect(visit("admin", "/admin/audit-logs").state.location.pathname).toBe(
      "/admin/audit-logs",
    );
  });

  it("lets a customer open Home, Pay, History and My Spending", () => {
    for (const path of ["/home", "/pay", "/history", "/dashboard"]) {
      expect(visit("customer", path).state.location.pathname).toBe(path);
    }
  });

  it.each([
    ["/payments", "/pay"],
    ["/payments/pay", "/pay"],
    ["/payments/history", "/history"],
    ["/transactions", "/history"],
    ["/checkout", "/pay"],
  ])("sends the old address %s to %s", (from, to) => {
    expect(visit("customer", from).state.location.pathname).toBe(to);
  });

  it.each(["customer", "analyst", "reviewer", "admin"] as UserRole[])(
    "lets %s open Profile and Help",
    (role) => {
      expect(visit(role, "/profile").state.location.pathname).toBe("/profile");
      expect(visit(role, "/help").state.location.pathname).toBe("/help");
    },
  );

  it("sends the removed Settings page to Home", () => {
    expect(visit("reviewer", "/settings").state.location.pathname).toBe(
      "/home",
    );
  });
});
