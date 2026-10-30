import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import type { User, UserRole } from "@/types";

vi.mock("@/features/auth/hooks", () => ({ useAuth: vi.fn() }));
vi.mock("@/features/home", () => ({ useHomeSummary: vi.fn() }));

import { useAuth } from "@/features/auth/hooks";
import { useHomeSummary, type HomeSummary } from "@/features/home";
import HomePage from "./HomePage";

const PIPELINE = {
  authorized: 12,
  rules_blocked: 2,
  rules_flagged: 3,
  model_flagged: 1,
  ai_read: 9,
  ai_escalated: 1,
  human_decided: 4,
  captured: 7,
  held: 2,
  voided: 3,
  refunded: 0,
};

function summary(
  next_step: HomeSummary["next_step"],
  scope: "own" | "all" = "all",
) {
  vi.mocked(useHomeSummary).mockReturnValue({
    data: {
      scope,
      window_days: scope === "all" ? 7 : null,
      pipeline: PIPELINE,
      next_step,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useHomeSummary>);
}

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
  screen
    .getAllByRole("link")
    .filter((a) => !a.textContent?.match(/^(Go to|Open)/))
    .map((a) => a.getAttribute("href"));

describe("HomePage", () => {
  it("shows a customer the Pay, History and My Spending cards", () => {
    summary({ kind: "pay", count: 0 }, "own");
    renderAs("customer");
    expect(screen.getByText("Welcome, Ada")).toBeInTheDocument();
    expect(screen.getByText(/then Sentrix checks the payment/)).toBeInTheDocument();
    expect(cardLinks()).toEqual(["/pay", "/history", "/spending"]);
  });

  it("keeps an analyst away from Approvals", () => {
    summary({ kind: "queue_empty", count: 0 });
    renderAs("analyst");
    expect(cardLinks()).toEqual([
      "/admin/review",
      "/admin/feedback",
      "/admin/rules",
      "/insights",
    ]);
  });

  it("gives an admin the admin pages", () => {
    summary({
      kind: "approvals",
      count: 2,
      oldest: { action: "refund", created_at: "2026-10-29T10:00:00Z" },
    });
    renderAs("admin");
    expect(cardLinks()).toEqual([
      "/admin/review",
      "/admin/approvals",
      "/admin/feedback",
      "/admin/rules",
      "/insights",
      "/admin/users",
      "/admin/audit-logs",
    ]);
  });

  it("sends a customer with a held payment to History", () => {
    summary(
      {
        kind: "wait",
        count: 1,
        latest: {
          amount: 1100,
          paypal_status: "HELD",
          created_at: "2026-10-29T10:00:00Z",
        },
      },
      "own",
    );
    renderAs("customer");
    expect(
      screen.getByText(/Your payment of \$1,100.00 is held/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open History/ })).toHaveAttribute(
      "href",
      "/history",
    );
    expect(
      screen.getByText("Counts over your own payments."),
    ).toBeInTheDocument();
  });

  it("points a reviewer at the oldest held payment and shows the pipeline counts", () => {
    summary({
      kind: "review",
      count: 2,
      oldest: {
        amount: 250,
        risk_score: 45,
        created_at: "2026-10-29T10:00:00Z",
      },
    });
    renderAs("reviewer");
    expect(
      screen.getByText("Decide the oldest held payment"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open the Review Queue/ }),
    ).toHaveAttribute("href", "/admin/review");
    expect(screen.getByText("PayPal checkout")).toBeInTheDocument();
    expect(screen.getByText("AI analyst")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(
      screen.getByText("Counts over every payment of the last 7 days."),
    ).toBeInTheDocument();
  });

  it("offers a retry when the numbers cannot load", () => {
    vi.mocked(useHomeSummary).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useHomeSummary>);
    renderAs("customer");
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});
