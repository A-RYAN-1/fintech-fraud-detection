import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PaymentOutcome } from "./PaymentOutcome";
import type { SettledPayment } from "../api";

const base: SettledPayment = {
  transaction_id: "t1",
  decision: "captured",
  status: "SUCCESS",
  risk_score: 10,
  paypal_status: "CAPTURED",
  action_reason: null,
  rules_triggered: "",
  ml_explanation: [],
  ai_verdict: null,
};

describe("PaymentOutcome", () => {
  it("says the funds were taken for a capture", () => {
    render(<PaymentOutcome payment={base} />);
    expect(screen.getByText("Payment captured")).toBeInTheDocument();
  });

  it("says nothing was charged for a void", () => {
    render(
      <PaymentOutcome
        payment={{ ...base, decision: "voided", paypal_status: "VOIDED" }}
      />,
    );
    expect(screen.getByText("Payment blocked")).toBeInTheDocument();
    expect(screen.getByText(/Nothing was charged/)).toBeInTheDocument();
  });

  it("shows the triggered rules and the AI explanation for a hold", () => {
    render(
      <PaymentOutcome
        payment={{
          ...base,
          decision: "held",
          paypal_status: "HELD",
          action_reason: "Over the auto-capture limit",
          rules_triggered: "HIGH_AMOUNT,NEW_DEVICE",
          ai_verdict: {
            action: "review",
            confidence: 0.82,
            explanation: "Large amount from a new device",
          },
        }}
      />,
    );
    expect(screen.getByText("HIGH_AMOUNT")).toBeInTheDocument();
    expect(screen.getByText("NEW_DEVICE")).toBeInTheDocument();
    expect(screen.getByText("Over the auto-capture limit")).toBeInTheDocument();
    expect(screen.getByText(/82% confident/)).toBeInTheDocument();
    expect(
      screen.getByText("Large amount from a new device"),
    ).toBeInTheDocument();
  });

  it("labels a simulated payment and shows the evidence timeline", () => {
    render(
      <PaymentOutcome
        payment={{
          ...base,
          simulated: true,
          ai_verdict: {
            action: "review",
            confidence: 0.8,
            explanation: "New device",
            timeline: [
              {
                signal: "device",
                impact: "raises_risk",
                detail: "Untrusted device",
              },
            ],
          },
        }}
      />,
    );
    expect(
      screen.getByText(/Simulated payment, no money moved/),
    ).toBeInTheDocument();
    expect(screen.getByText("Untrusted device")).toBeInTheDocument();
  });
});
