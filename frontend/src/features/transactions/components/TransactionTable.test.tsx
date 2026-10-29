import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import TransactionTable from "./TransactionTable";

describe("TransactionTable", () => {
  it("points a customer with no payments to the Pay tab", () => {
    renderWithProviders(
      <TransactionTable
        transactions={[]}
        onViewDetails={vi.fn()}
        onSubmitFeedback={vi.fn()}
      />,
    );
    expect(screen.getByText("No payments yet")).toBeInTheDocument();
    expect(screen.getByText(/Pay tab/)).toBeInTheDocument();
  });
});
