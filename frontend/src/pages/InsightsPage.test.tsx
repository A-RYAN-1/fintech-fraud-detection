import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";

vi.mock("@/features/insights", () => ({ useInsights: vi.fn() }));
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

import { useInsights, type Insights } from "@/features/insights";
import { formatMinutes } from "@/utils/formatMinutes";
import InsightsPage from "./InsightsPage";

const data: Insights = {
  period_days: 30,
  totals: {
    payments: 40,
    volume: 5000,
    captured_amount: 3000,
    refunded_amount: 0,
    captured: 25,
    held: 5,
    voided: 6,
    blocked_by_rules: 4,
    auto_captured: 20,
  },
  daily: [
    { date: "2026-10-28", payments: 4, volume: 500, flagged: 1, blocked: 0 },
  ],
  risk_ranges: [{ range: "0-29", min: 0, max: 29, count: 30 }],
  top_rules: [{ rule: "high_amount", count: 7 }],
  model: { scored: 40, flagged: 4, flag_rate: 0.1 },
  ai: { read: 12, approve: 6, review: 4, block: 2 },
  decision_time: { decided: 8, median_minutes: 12, p90_minutes: 45 },
};

describe("formatMinutes", () => {
  it("reads in words", () => {
    expect(formatMinutes(null)).toBe("none yet");
    expect(formatMinutes(0.4)).toBe("under a minute");
    expect(formatMinutes(12)).toBe("12 min");
    expect(formatMinutes(180)).toBe("3.0 h");
  });
});

describe("InsightsPage", () => {
  it("shows model flag rate and decision time for staff", () => {
    vi.mocked(useInsights).mockReturnValue({
      data,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useInsights>);
    renderWithProviders(<InsightsPage />);

    expect(screen.getByText("10.0%")).toBeInTheDocument();
    expect(screen.getByText(/Median of 8 human decisions/)).toBeInTheDocument();
  });
});
