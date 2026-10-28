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
    DashboardPage: page("dashboard"),
    PaymentsLayout: () => (
      <div>
        page:payments
        <Outlet />
      </div>
    ),
    PayTab: page("pay"),
    HistoryTab: page("history"),
    RiskAnalysisPage: page("risk"),
    SettingsPage: page("settings"),
    HelpSupportPage: page("help"),
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

  it("sends the root to each role's landing page", () => {
    expect(visit("customer", "/").state.location.pathname).toBe(
      "/payments/pay",
    );
  });

  it.each(["analyst", "reviewer", "admin"] as UserRole[])(
    "lands %s on the Review Queue",
    (role) => {
      const router = visit(role, "/");
      expect(router.state.location.pathname).toBe("/admin/review");
      expect(screen.getByText("page:review")).toBeInTheDocument();
    },
  );

  it.each([
    "/admin/review",
    "/admin/approvals",
    "/admin/feedback",
    "/risk-analysis",
    "/admin/users",
    "/admin/audit-logs",
  ])("redirects a customer from %s to Payments", (path) => {
    const router = visit("customer", path);
    expect(router.state.location.pathname).toBe("/payments/pay");
  });

  it.each(["analyst", "reviewer"] as UserRole[])(
    "redirects %s away from admin-only pages and Payments",
    (role) => {
      for (const path of [
        "/admin/users",
        "/admin/audit-logs",
        "/payments/pay",
      ]) {
        const router = visit(role, path);
        expect(router.state.location.pathname).toBe("/admin/review");
      }
    },
  );

  it("lets staff open the pages in their sidebar", () => {
    for (const path of [
      "/admin/approvals",
      "/admin/feedback",
      "/risk-analysis",
      "/dashboard",
    ]) {
      expect(visit("analyst", path).state.location.pathname).toBe(path);
    }
  });

  it("lets an admin open Users and Audit Logs", () => {
    expect(visit("admin", "/admin/users").state.location.pathname).toBe(
      "/admin/users",
    );
    expect(visit("admin", "/admin/audit-logs").state.location.pathname).toBe(
      "/admin/audit-logs",
    );
  });

  it("lets a customer open Dashboard, Pay and History", () => {
    for (const path of ["/dashboard", "/payments/pay", "/payments/history"]) {
      expect(visit("customer", path).state.location.pathname).toBe(path);
    }
  });
});
