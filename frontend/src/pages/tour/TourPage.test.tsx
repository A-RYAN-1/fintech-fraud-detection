import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import TourPage from "./TourPage";

const mutate = vi.fn();
vi.mock("@/features/auth/hooks", () => ({
  useAuth: vi.fn(),
  useLogin: () => ({ mutate, isPending: false, variables: undefined }),
}));
vi.mock("@/features/tour", () => ({ usePublicPipeline: vi.fn() }));
vi.mock("@/components/common/ThemeToggle", () => ({ default: () => null }));

import { useAuth } from "@/features/auth/hooks";
import { usePublicPipeline } from "@/features/tour";

const pipeline = {
  authorized: 157,
  rules_blocked: 12,
  rules_flagged: 35,
  model_flagged: 0,
  ai_read: 9,
  ai_escalated: 6,
  human_decided: 6,
  captured: 117,
  held: 21,
  voided: 16,
  refunded: 2,
};

function setup(authenticated = false) {
  vi.mocked(useAuth).mockReturnValue({
    isAuthenticated: authenticated,
    user: authenticated ? { role: "reviewer" } : null,
  } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(usePublicPipeline).mockReturnValue({
    data: { window_days: 7, pipeline },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof usePublicPipeline>);
  renderWithProviders(<TourPage />, { route: "/tour" });
}

describe("TourPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("says what Sentrix is and shows the live counts", () => {
    setup();
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /checked before the money moves/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Live from the demo, last 7 days"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("157").length).toBeGreaterThan(0);
    expect(screen.getAllByText("117").length).toBeGreaterThan(0);
  });

  it("walks through the six steps, the AI limits and every judging criterion", () => {
    setup();
    for (const step of [
      "PayPal checkout",
      "Risk rules",
      "Model score",
      "AI analyst",
      "Human gate",
      "Capture or void",
    ]) {
      expect(
        screen.getByRole("heading", { level: 3, name: step }),
      ).toBeInTheDocument();
    }
    expect(screen.getByText("The analyst never")).toBeInTheDocument();
    for (const c of [
      "Technological implementation",
      "Design",
      "Potential impact",
      "Creativity",
    ]) {
      expect(screen.getByRole("heading", { name: c })).toBeInTheDocument();
    }
  });

  it("signs a guest in as a sandbox role with one click", async () => {
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: /sign in as admin/i }),
    );
    expect(mutate).toHaveBeenCalledWith({
      email: "judge.admin@sentrix.demo",
      password: "password123",
    });
  });

  it("sends a signed-in person to the app instead of signing in again", () => {
    setup(true);
    expect(
      screen.queryByRole("button", { name: /sign in as/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /open the app/i }).length,
    ).toBeGreaterThan(0);
  });
});
