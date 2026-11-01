import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import { transactionsApi } from "../api";
import AppealDialog from "./AppealDialog";
import type { Transaction } from "@/types";

const held = {
  id: "t-1",
  amount: "300.0",
  paypal_status: "HELD",
  can_appeal: true,
} as unknown as Transaction;

describe("AppealDialog", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("keeps the send button off until the note is long enough", async () => {
    renderWithProviders(
      <AppealDialog transaction={held} open onOpenChange={() => undefined} />,
    );
    const send = screen.getByRole("button", { name: "Send note" });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Your note"), "ab");
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Your note"), "cdef");
    expect(send).toBeEnabled();
  });

  it("sends the trimmed note for the payment and closes", async () => {
    const send = vi
      .spyOn(transactionsApi, "sendAppeal")
      .mockResolvedValue({ submitted_at: "2026-11-02T10:00:00Z", note: "x" });
    const onOpenChange = vi.fn();
    renderWithProviders(
      <AppealDialog transaction={held} open onOpenChange={onOpenChange} />,
    );
    await userEvent.type(
      screen.getByLabelText("Your note"),
      "  I am travelling this week  ",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send note" }));

    expect(send).toHaveBeenCalledWith("t-1", "I am travelling this week");
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("says it does not approve the payment by itself", () => {
    renderWithProviders(
      <AppealDialog transaction={held} open onOpenChange={() => undefined} />,
    );
    expect(
      screen.getByText(/does not approve the payment/),
    ).toBeInTheDocument();
  });
});
