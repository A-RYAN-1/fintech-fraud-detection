import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import type { FeedbackResponse } from "@/features/feedback";
import { feedbackApi } from "@/features/feedback";
import FeedbackPage from "./FeedbackPage";

const response: FeedbackResponse = {
  labelled: 4,
  human_approve: 2,
  human_block: 2,
  signals: {
    rules: { answered: 4, agree: 3, agreement_rate: 0.75, false_alarms: 1, misses: 0 },
    ml: { answered: 4, agree: 2, agreement_rate: 0.5, false_alarms: 1, misses: 1 },
    ai: { answered: 0, agree: 0, agreement_rate: null, false_alarms: 0, misses: 0 },
  },
  daily: [{ date: "2026-10-28", labelled: 4, rules: 0.75, ml: 0.5, ai: null }],
  disagreements: [
    {
      transaction_id: "t1",
      amount: 120,
      human_label: "approve",
      label_source: "decision",
      labeled_by: "reviewer@example.com",
      labeled_at: "2026-10-28T10:00:00Z",
      rules_status: "FLAGGED",
      rules_triggered: [],
      ml_score: 0.12,
      ai_action: "review",
      ai_confidence: 0.8,
      ai_explanation: "New device.",
      disagreeing: ["rules", "ai"],
    },
  ],
  meta: { current_page: 1, total_pages: 1, total_count: 1 } as FeedbackResponse["meta"],
};

describe("FeedbackPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows agreement per signal, n/a for a silent one, and the disagreement", async () => {
    vi.spyOn(feedbackApi, "get").mockResolvedValue(response);
    renderWithProviders(<FeedbackPage />);

    expect((await screen.findAllByText("75%")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("50%").length).toBeGreaterThan(0);
    expect(screen.getAllByText("n/a").length).toBeGreaterThan(0);
    expect(screen.getByText("New device.")).toBeInTheDocument();
    expect(screen.getByText("Rules and model disagreed")).toBeInTheDocument();
  });

  it("asks the API for one signal when a filter is picked", async () => {
    const get = vi.spyOn(feedbackApi, "get").mockResolvedValue(response);
    renderWithProviders(<FeedbackPage />);
    await screen.findAllByText("75%");

    await userEvent.click(screen.getByRole("button", { name: "AI analyst" }));

    expect(get).toHaveBeenLastCalledWith("ai", 1);
  });

  it("says so when nobody has decided anything yet", async () => {
    vi.spyOn(feedbackApi, "get").mockResolvedValue({
      ...response,
      labelled: 0,
      daily: [],
      disagreements: [],
    });
    renderWithProviders(<FeedbackPage />);

    expect(await screen.findByText(/No decisions yet/)).toBeInTheDocument();
    expect(screen.getByText("No disagreements")).toBeInTheDocument();
  });
});
