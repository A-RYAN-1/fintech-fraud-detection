import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReviewCard } from "./ReviewCard";
import type { HeldPayment } from "../api";

const payment: HeldPayment = {
  id: "abc",
  user_email: "buyer@example.com",
  amount: 2500,
  created_at: "2026-10-26T10:00:00Z",
  status: "FLAGGED",
  risk_score: 45,
  paypal_status: "HELD",
  capture_mode: null,
  action_reason: "Over max_auto_capture_amount",
  rules_triggered: ["HIGH_AMOUNT"],
  ml_score: 0.4,
  ml_explanation: [],
  ai_verdict: {
    action: "review",
    confidence: 0.7,
    explanation: "Unusual size",
  },
};

describe("ReviewCard", () => {
  it("passes the note with the approve action", async () => {
    const onAct = vi.fn();
    render(<ReviewCard payment={payment} busy={false} canAct onAct={onAct} />);

    await userEvent.type(screen.getByLabelText(/Note for the audit log/), "ok");
    await userEvent.click(
      screen.getByRole("button", { name: "Approve and capture" }),
    );

    expect(onAct).toHaveBeenCalledWith("abc", "approve", "ok");
  });

  it("hides the actions from a non-admin", () => {
    render(
      <ReviewCard
        payment={payment}
        busy={false}
        canAct={false}
        onAct={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Void" })).toBeNull();
    expect(screen.getByText(/Only an admin/)).toBeInTheDocument();
  });

  it("shows why it was held and the AI explanation", () => {
    render(
      <ReviewCard payment={payment} busy={false} canAct onAct={vi.fn()} />,
    );
    expect(
      screen.getByText("Over max_auto_capture_amount"),
    ).toBeInTheDocument();
    expect(screen.getByText("Unusual size")).toBeInTheDocument();
  });

  it("renders the evidence timeline in order", () => {
    const withTimeline: HeldPayment = {
      ...payment,
      ai_verdict: {
        action: "review",
        confidence: 0.7,
        explanation: "Unusual size",
        timeline: [
          { signal: "device", impact: "raises_risk", detail: "New device" },
          { signal: "amount", impact: "neutral", detail: "About the average" },
        ],
      },
    };
    render(
      <ReviewCard payment={withTimeline} busy={false} canAct onAct={vi.fn()} />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Device");
    expect(items[0]).toHaveTextContent("New device");
    expect(items[1]).toHaveTextContent("Amount");
  });

  it("shows no timeline for an older verdict without one", () => {
    render(<ReviewCard payment={payment} busy={false} canAct onAct={vi.fn()} />);
    expect(screen.queryByLabelText("Evidence timeline")).toBeNull();
  });
});
