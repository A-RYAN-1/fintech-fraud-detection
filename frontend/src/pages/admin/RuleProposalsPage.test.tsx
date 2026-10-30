import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import { rulesApi, type RuleProposal } from "@/features/rules";
import RuleProposalsPage from "./RuleProposalsPage";

const metrics = { success: 90, flagged: 8, blocked: 2 };

const proposal: RuleProposal = {
  id: 7,
  key: "flag_threshold",
  description: "Risk score at or above which a transaction is flagged",
  current_value: 30,
  proposed_value: 51,
  live_value: 30,
  trigger_kind: "false_alarm",
  transaction_id: "t1",
  rationale: "reviewer@example.com approved a payment the rules held.",
  status: "pending",
  decided_by: null,
  decided_at: null,
  decision_note: null,
  created_at: "2026-10-30T10:00:00Z",
  backtest: {
    replayed: 100,
    labelled: 6,
    fidelity: { matches: 97, total: 100, rate: 0.97 },
    baseline: { ...metrics, false_alarms: 3, misses: 1 },
    candidate: {
      success: 93,
      flagged: 5,
      blocked: 2,
      false_alarms: 1,
      misses: 1,
    },
    delta: { success: 3, flagged: -3, blocked: 0, false_alarms: -2, misses: 0 },
    flips: [
      {
        transaction_id: "t1",
        amount: 250,
        from: "FLAGGED",
        to: "SUCCESS",
        human_label: "approve",
      },
    ],
    focus: { transaction_id: "t1", from: "FLAGGED", to: "SUCCESS" },
    notes: "Stats follow what happened.",
  },
};

function mockList(rows: RuleProposal[]) {
  return vi.spyOn(rulesApi, "list").mockResolvedValue({
    rule_proposals: rows,
    meta: {
      current_page: 1,
      total_pages: 1,
      total_count: rows.length,
    } as never,
  });
}

describe("RuleProposalsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the draft, its backtest and the before and after counts", async () => {
    mockList([proposal]);
    renderWithProviders(<RuleProposalsPage />);

    expect(
      await screen.findByText(/Risk score at or above which/),
    ).toBeInTheDocument();
    expect(screen.getByText("Over 100 stored payments")).toBeInTheDocument();
    expect(screen.getByText("-2")).toBeInTheDocument();
    expect(screen.getByText(/reproduces 97%/)).toBeInTheDocument();
  });

  it("gives a non-admin no accept button", async () => {
    mockList([proposal]);
    renderWithProviders(<RuleProposalsPage />, {
      preloadedState: { auth: { user: { id: "2", role: "analyst" } } } as never,
    });

    await screen.findByText(/Risk score at or above which/);
    expect(
      screen.queryByRole("button", { name: /Accept and change/ }),
    ).not.toBeInTheDocument();
  });

  it("lets an admin accept with a note", async () => {
    mockList([proposal]);
    const settle = vi.spyOn(rulesApi, "settle").mockResolvedValue(proposal);
    renderWithProviders(<RuleProposalsPage />, {
      preloadedState: { auth: { user: { id: "1", role: "admin" } } } as never,
    });

    await userEvent.type(await screen.findByLabelText(/Note/), "checked");
    await userEvent.click(
      screen.getByRole("button", { name: /Accept and change the rule/ }),
    );

    expect(settle).toHaveBeenCalledWith(
      7,
      "accept",
      "checked",
      expect.any(String),
    );
  });

  it("says so when no draft is waiting", async () => {
    mockList([]);
    renderWithProviders(<RuleProposalsPage />);

    expect(await screen.findByText("No drafts waiting")).toBeInTheDocument();
  });
});
