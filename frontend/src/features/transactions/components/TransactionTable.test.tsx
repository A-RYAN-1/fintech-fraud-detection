import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import TransactionTable from "./TransactionTable";
import type { Transaction } from "@/types";

const held = {
  id: "t-1",
  amount: "300.0",
  payment_method: "wallet",
  device_id: "d1",
  status: "flagged",
  risk_score: 40,
  ip_address: "",
  created_at: "2026-11-01T10:00:00Z",
  rules_triggered: "",
  paypal_status: "HELD",
  feedback_submitted: true,
  customer_message:
    "A person is reviewing this payment. Nothing is charged until they decide.",
  can_appeal: true,
  appeal: null,
} as unknown as Transaction;

describe("TransactionTable", () => {
  // The shared test setup mocks ResizeObserver with a function; the dropdown positioner needs a constructor.
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });

  it("points a customer with no payments to the Pay page", () => {
    renderWithProviders(
      <TransactionTable
        transactions={[]}
        onViewDetails={vi.fn()}
        onSubmitFeedback={vi.fn()}
      />,
    );
    expect(screen.getByText("No payments yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pay page" })).toHaveAttribute(
      "href",
      "/pay",
    );
  });

  it("tells the customer what a held payment means and offers a note", async () => {
    const onSendNote = vi.fn();
    renderWithProviders(
      <TransactionTable
        transactions={[held]}
        onViewDetails={vi.fn()}
        onSubmitFeedback={vi.fn()}
        onSendNote={onSendNote}
      />,
    );
    expect(
      screen.getByText(/A person is reviewing this payment/),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await userEvent.click(
      await screen.findByText("Send a note to the reviewer"),
    );
    expect(onSendNote).toHaveBeenCalledWith(held);
  });

  it("offers no note once one was sent, and says so", async () => {
    const sent = {
      ...held,
      can_appeal: false,
      appeal: { note: "Travelling", submitted_at: "2026-11-01T11:00:00Z" },
    } as Transaction;
    renderWithProviders(
      <TransactionTable
        transactions={[sent]}
        onViewDetails={vi.fn()}
        onSubmitFeedback={vi.fn()}
        onSendNote={vi.fn()}
      />,
    );
    expect(screen.getByText(/Your note was sent/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Actions" }));
    await screen.findByText("View Details");
    expect(
      screen.queryByText("Send a note to the reviewer"),
    ).not.toBeInTheDocument();
  });
});
