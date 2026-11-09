import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const similar = vi.fn(() => ({
  data: undefined,
  isLoading: true,
  isError: false,
}));
const ring = vi.fn(() => ({
  data: undefined,
  isLoading: true,
  isError: false,
}));
vi.mock("../hooks", () => ({
  useSimilarCases: (...a: unknown[]) => similar(...(a as [])),
  useAccountRing: (...a: unknown[]) => ring(...(a as [])),
  useAnalystAnswer: vi.fn(),
  useCaseNarrative: vi.fn(),
}));

import { InvestigatePanel } from "./InvestigatePanel";

describe("InvestigatePanel", () => {
  it("opens on the analyst questions and loads nothing until a tab asks for it", () => {
    render(<InvestigatePanel paymentId="p1" />);
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(
      screen.getByRole("button", { name: "Why this verdict?" }),
    ).toBeInTheDocument();
    expect(similar).not.toHaveBeenCalled();
    expect(ring).not.toHaveBeenCalled();
  });

  it("loads similar cases and linked accounts only when their tab is opened", async () => {
    render(<InvestigatePanel paymentId="p1" />);
    await userEvent.click(screen.getByRole("tab", { name: /Similar cases/ }));
    expect(similar).toHaveBeenCalledWith("p1");
    expect(
      screen.getByText("Looking for similar cases..."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /Linked accounts/ }));
    expect(ring).toHaveBeenCalled();
  });

  it("drafts a narrative only on its own button, since a draft is saved", async () => {
    render(<InvestigatePanel paymentId="p1" />);
    await userEvent.click(screen.getByRole("tab", { name: /Case narrative/ }));
    expect(
      screen.getByRole("button", { name: "Draft case narrative" }),
    ).toBeInTheDocument();
  });
});
