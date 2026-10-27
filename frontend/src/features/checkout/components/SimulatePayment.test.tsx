import { describe, expect, it, vi } from "vitest";
import {
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
} from "@/test/test-utils";
import { SimulatePayment } from "./SimulatePayment";
import { checkoutApi, type SettledPayment } from "../api";

const settled: SettledPayment = {
  transaction_id: "t1",
  decision: "held",
  status: "FLAGGED",
  risk_score: 40,
  paypal_status: "HELD",
  action_reason: "Over the limit",
  rules_triggered: "",
  ml_explanation: [],
  ai_verdict: null,
  simulated: true,
};

describe("SimulatePayment", () => {
  it("says no money moves", () => {
    renderWithProviders(
      <SimulatePayment amount={20} deviceId="d" onSettled={vi.fn()} />,
    );
    expect(screen.getByText(/no money moves/i)).toBeInTheDocument();
  });

  it("sends the amount and device and hands the verdict back", async () => {
    const simulate = vi
      .spyOn(checkoutApi, "simulate")
      .mockResolvedValue(settled);
    const onSettled = vi.fn();
    renderWithProviders(
      <SimulatePayment amount={20} deviceId="dev-1" onSettled={onSettled} />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Simulate payment" }),
    );

    await waitFor(() => expect(onSettled).toHaveBeenCalledWith(settled));
    expect(simulate).toHaveBeenCalledWith(20, "dev-1");
  });
});
