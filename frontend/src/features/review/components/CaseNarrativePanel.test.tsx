import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CaseNarrativePanel } from "./CaseNarrativePanel";
import { reviewApi } from "../api";

function renderPanel() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <CaseNarrativePanel paymentId="abc" />
    </QueryClientProvider>,
  );
}

const draft = {
  summary: "A payment was held after an untrusted device.",
  indicators: ["Untrusted device"],
  reviewer_checks: ["Confirm the device with the customer"],
  source: "ai" as const,
  model: "m",
  created_at: "2026-11-01T10:00:00Z",
};

describe("CaseNarrativePanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("drafts nothing until the button is clicked", () => {
    const spy = vi.spyOn(reviewApi, "narrative");
    renderPanel();

    expect(spy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Draft case narrative" }),
    ).toBeInTheDocument();
  });

  it("shows the draft with its lists and says it is saved and advisory", async () => {
    const spy = vi.spyOn(reviewApi, "narrative").mockResolvedValue(draft);
    renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "Draft case narrative" }),
    );

    expect(await screen.findByText(draft.summary)).toBeInTheDocument();
    expect(screen.getByText("Untrusted device")).toBeInTheDocument();
    expect(
      screen.getByText("Confirm the device with the customer"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not change the decision/),
    ).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith("abc");
  });

  it("labels a rules-only narrative and requests it only once", async () => {
    const spy = vi
      .spyOn(reviewApi, "narrative")
      .mockResolvedValue({ ...draft, source: "rules", model: null });
    renderPanel();
    const button = screen.getByRole("button", { name: "Draft case narrative" });
    await userEvent.click(button);
    expect(await screen.findByText(/Rules-only narrative/)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Hide case narrative" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Draft case narrative" }),
    );
    expect(await screen.findByText(/Rules-only narrative/)).toBeInTheDocument();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("shows an error when the draft fails", async () => {
    vi.spyOn(reviewApi, "narrative").mockRejectedValue(new Error("down"));
    renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "Draft case narrative" }),
    );

    expect(
      await screen.findByText(/Could not draft the narrative/),
    ).toBeInTheDocument();
  });

  it("tells the reviewer when the AI draft was replaced for citing something outside the facts", async () => {
    vi.spyOn(reviewApi, "narrative").mockResolvedValue({
      ...draft,
      source: "rules",
      model: null,
      grounding: {
        status: "rejected",
        issues: [{ kind: "unknown_rule", detail: "CHARGEBACK_HISTORY" }],
      },
    });
    renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "Draft case narrative" }),
    );

    expect(
      await screen.findByText(/The AI draft was replaced/),
    ).toHaveTextContent("CHARGEBACK_HISTORY");
    expect(screen.queryByText(/was not available/)).not.toBeInTheDocument();
  });
});
