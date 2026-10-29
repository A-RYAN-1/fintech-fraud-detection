import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";

vi.mock("@/features/spending", () => ({ useSpending: vi.fn() }));
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

import { useSpending, type Spending } from "@/features/spending";
import MySpendingPage from "./MySpendingPage";

function mockSpending(data: Spending | undefined, extra = {}) {
  vi.mocked(useSpending).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...extra,
  } as unknown as ReturnType<typeof useSpending>);
}

const base: Spending = {
  period_days: 30,
  spent: 1234.5,
  captured_count: 3,
  held: { count: 1, amount: 200 },
  voided: { count: 2, amount: 90 },
  refunded_amount: 0,
  daily: [{ date: "2026-10-28", spent: 100, held: 0, voided: 0 }],
  reasons: [{ rule: "high_amount", count: 2 }],
};

describe("MySpendingPage", () => {
  it("shows spent, held and voided in USD", () => {
    mockSpending(base);
    renderWithProviders(<MySpendingPage />);

    expect(screen.getByText("$1,234.50")).toBeInTheDocument();
    expect(screen.getByText("$200.00")).toBeInTheDocument();
    expect(screen.getByText("$90.00")).toBeInTheDocument();
    expect(screen.getByText(/3 captured payments/)).toBeInTheDocument();
  });

  it("points a customer with no payments to Pay", () => {
    mockSpending({
      ...base,
      spent: 0,
      captured_count: 0,
      held: { count: 0, amount: 0 },
      voided: { count: 0, amount: 0 },
    });
    renderWithProviders(<MySpendingPage />);

    expect(
      screen.getByRole("link", { name: /make a sandbox payment/i }),
    ).toHaveAttribute("href", "/pay");
  });

  it("offers a retry when loading fails", () => {
    mockSpending(undefined, { isError: true });
    renderWithProviders(<MySpendingPage />);

    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument();
  });
});
