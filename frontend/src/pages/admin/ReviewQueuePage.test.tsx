import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import { reviewApi, type HeldPayment } from "@/features/review";
import ReviewQueuePage from "./ReviewQueuePage";

function held(id: string, email: string): HeldPayment {
  return {
    id,
    user_email: email,
    amount: 120,
    created_at: "2026-10-30T10:00:00Z",
    status: "FLAGGED",
    risk_score: 30,
    paypal_status: "HELD",
    capture_mode: null,
    authorization_expires_at: null,
    refunded_amount: 0,
    action_reason: null,
    rules_triggered: ["UNTRUSTED_DEVICE"],
    ml_score: 0.7,
    ml_explanation: [],
    ai_verdict: null,
    notes: [],
    pending_request: null,
  };
}

const meta = { total_count: 2, per_page: 1 };

describe("ReviewQueuePage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the first held payment and loads the older one on request", async () => {
    const listHeld = vi
      .spyOn(reviewApi, "listHeld")
      .mockResolvedValueOnce({
        held: [held("a", "newer@example.com")],
        meta: { ...meta, next_cursor: "CURSOR-1", has_more: true },
        limit: null,
        role: "admin",
      })
      .mockResolvedValueOnce({
        held: [held("b", "older@example.com")],
        meta: { ...meta, next_cursor: null, has_more: false },
        limit: null,
        role: "admin",
      });
    renderWithProviders(<ReviewQueuePage />, {
      preloadedState: { auth: { user: { id: "1", role: "admin" } } } as never,
    });

    expect(await screen.findByText(/newer@example.com/)).toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 2 held")).toBeInTheDocument();
    expect(screen.queryByText(/older@example.com/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Show older" }));

    expect(await screen.findByText(/older@example.com/)).toBeInTheDocument();
    expect(listHeld).toHaveBeenLastCalledWith("CURSOR-1");
    expect(screen.getByText("Showing 2 of 2 held")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show older" }),
    ).not.toBeInTheDocument();
  });

  it("has no Show older button on the last page", async () => {
    vi.spyOn(reviewApi, "listHeld").mockResolvedValue({
      held: [held("a", "only@example.com")],
      meta: {
        total_count: 1,
        per_page: 10,
        next_cursor: null,
        has_more: false,
      },
      limit: null,
      role: "admin",
    });
    renderWithProviders(<ReviewQueuePage />);

    await screen.findByText(/only@example.com/);
    expect(
      screen.queryByRole("button", { name: "Show older" }),
    ).not.toBeInTheDocument();
  });
});
