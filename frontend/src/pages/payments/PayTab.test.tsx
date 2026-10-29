import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import PayTab from "./PayTab";

vi.mock("@/features/auth", () => ({
  useDeviceId: () => ({ deviceId: "dev-1" }),
}));
vi.mock("@/features/checkout", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  PayPalCheckout: () => <p>paypal button</p>,
  SimulatePayment: () => <p>simulate button</p>,
  usePaymentLimits: () => ({
    data: { max_auto_capture_amount: 1000, daily_auto_capture_cap: 5000 },
  }),
}));

describe("PayTab", () => {
  it("tells the customer the amount above which a payment is held", () => {
    renderWithProviders(<PayTab />);
    expect(
      screen.getByText(/above \$1,000\.00 are held for a reviewer/),
    ).toBeInTheDocument();
  });
});
