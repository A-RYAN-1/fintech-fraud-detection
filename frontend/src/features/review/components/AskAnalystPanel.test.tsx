import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AskAnalystPanel } from "./AskAnalystPanel";
import { reviewApi } from "../api";

function renderPanel() {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <AskAnalystPanel paymentId="abc" />
    </QueryClientProvider>,
  );
}

describe("AskAnalystPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("asks nothing until a question is clicked", () => {
    const spy = vi.spyOn(reviewApi, "ask");
    renderPanel();

    expect(spy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Why this verdict?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "What would change it?" }),
    ).toBeInTheDocument();
  });

  it("shows the analyst answer and says it is advice", async () => {
    const spy = vi.spyOn(reviewApi, "ask").mockResolvedValue({
      question: "why",
      answer: "The untrusted device drove it.",
      source: "ai",
      model: "m",
    });
    renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "Why this verdict?" }),
    );

    expect(
      await screen.findByText("The untrusted device drove it."),
    ).toBeInTheDocument();
    expect(spy).toHaveBeenCalledWith("abc", "why");
    expect(
      screen.getByText(/does not change the decision/),
    ).toBeInTheDocument();
  });

  it("labels a rules-only answer", async () => {
    vi.spyOn(reviewApi, "ask").mockResolvedValue({
      question: "change",
      answer: "Facts that would lower the risk: a trusted device.",
      source: "rules",
      model: null,
    });
    renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "What would change it?" }),
    );

    expect(await screen.findByText(/Rules-only answer/)).toBeInTheDocument();
  });

  it("says plainly when the request fails", async () => {
    vi.spyOn(reviewApi, "ask").mockRejectedValue(new Error("x"));
    renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "Why this verdict?" }),
    );

    expect(
      await screen.findByText(/Could not get an answer/),
    ).toBeInTheDocument();
  });
});
