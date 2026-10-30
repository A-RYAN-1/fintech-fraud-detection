import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import { transactionsApi } from "@/features/transactions";
import type { Transaction } from "@/types";
import HistoryTab from "./HistoryTab";

function payment(id: string, amount: number): Transaction {
  return {
    id,
    amount,
    payment_method: "card",
    device_id: "d",
    status: "SUCCESS",
    risk_score: 10,
    ip_address: "127.0.0.1",
    created_at: "2026-10-30T10:00:00Z",
    rules_triggered: null,
    feedback_submitted: false,
  } as Transaction;
}

describe("HistoryTab", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("asks for the first page by cursor and appends the older page", async () => {
    const get = vi
      .spyOn(transactionsApi, "getTransactions")
      .mockResolvedValueOnce({
        transactions: [payment("t1", 111)],
        pagination: {
          total_count: 2,
          per_page: 1,
          next_cursor: "CURSOR-1",
          has_more: true,
        },
        user_stats: null,
      })
      .mockResolvedValueOnce({
        transactions: [payment("t2", 222)],
        pagination: {
          total_count: 2,
          per_page: 1,
          next_cursor: null,
          has_more: false,
        },
        user_stats: null,
      });
    renderWithProviders(<HistoryTab />);

    expect(await screen.findByText("Showing 1 of 2")).toBeInTheDocument();
    expect(get.mock.calls[0][0]).toMatchObject({ cursor: "" });
    expect(get.mock.calls[0][0]).not.toHaveProperty("page");

    await userEvent.click(screen.getByRole("button", { name: "Show older" }));

    expect(await screen.findByText("Showing 2 of 2")).toBeInTheDocument();
    expect(get.mock.calls[1][0]).toMatchObject({ cursor: "CURSOR-1" });
  });
});
