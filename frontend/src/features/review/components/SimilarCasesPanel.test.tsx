import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SimilarCasesPanel } from "./SimilarCasesPanel";
import { reviewApi } from "../api";

function renderPanel() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <SimilarCasesPanel paymentId="abc" />
    </QueryClientProvider>,
  );
}

const match = {
  payment_id: "p1",
  amount_band_usd: "250 to 1,000",
  rules_triggered: ["UNTRUSTED_DEVICE"],
  human_outcome: "block" as const,
  decided_at: "2026-11-01T10:00:00Z",
  distance: 0.1234,
};

async function open() {
  await userEvent.click(
    screen.getByRole("button", { name: "Similar past cases" }),
  );
}

describe("SimilarCasesPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests nothing until the button is clicked", () => {
    const spy = vi.spyOn(reviewApi, "similar");
    renderPanel();

    expect(spy).not.toHaveBeenCalled();
  });

  it("lists the nearest cases with the human outcome and the distance", async () => {
    const spy = vi.spyOn(reviewApi, "similar").mockResolvedValue({
      source: "embedding",
      matches: [
        match,
        { ...match, payment_id: "p2", human_outcome: "approve" },
      ],
    });
    renderPanel();
    await open();

    expect(await screen.findByText("Voided")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getAllByText(/UNTRUSTED_DEVICE/)).toHaveLength(2);
    expect(screen.getAllByText("distance 0.123")).toHaveLength(2);
    expect(spy).toHaveBeenCalledWith("abc");
  });

  it("labels a rules-based match as such", async () => {
    vi.spyOn(reviewApi, "similar").mockResolvedValue({
      source: "rules",
      matches: [{ ...match, distance: null }],
    });
    renderPanel();
    await open();

    expect(await screen.findByText(/Rules-based match/)).toBeInTheDocument();
    expect(screen.getByText("same rules and band")).toBeInTheDocument();
  });

  it("says so when no decided case is similar", async () => {
    vi.spyOn(reviewApi, "similar").mockResolvedValue({
      source: "rules",
      matches: [],
    });
    renderPanel();
    await open();

    expect(
      await screen.findByText(/No decided case is similar yet/),
    ).toBeInTheDocument();
  });

  it("shows an error when the request fails", async () => {
    vi.spyOn(reviewApi, "similar").mockRejectedValue(new Error("down"));
    renderPanel();
    await open();

    expect(
      await screen.findByText(/Could not load similar cases/),
    ).toBeInTheDocument();
  });
});
