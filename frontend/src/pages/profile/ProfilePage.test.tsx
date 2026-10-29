import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithProviders, screen } from "@/test/test-utils";
import type { User } from "@/types";

vi.mock("@/features/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/features/auth")>("@/features/auth");
  return {
    ...actual,
    useAuth: vi.fn(),
    authApi: { ...actual.authApi, getActivity: vi.fn() },
  };
});

import { authApi, useAuth } from "@/features/auth";
import ProfilePage from "./ProfilePage";

function renderAs(user: Partial<User>) {
  vi.mocked(useAuth).mockReturnValue({
    user: {
      id: "1",
      email: "max@example.com",
      first_name: "Max",
      last_name: "Reviewer",
      role: "reviewer",
      status: "active",
      decision_limit: 1000,
      created_at: "2026-10-01T10:00:00Z",
      demo_account: false,
      ...user,
    },
  } as ReturnType<typeof useAuth>);
  return renderWithProviders(<ProfilePage />);
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.mocked(authApi.getActivity).mockResolvedValue([
      {
        id: 7,
        event_type: "REVIEW_NOTE",
        description: "max@example.com added a note",
        created_at: "2026-10-29T08:00:00Z",
      },
    ]);
  });

  it("shows the account, the decision limit in USD and recent activity", async () => {
    renderAs({});
    expect(screen.getByText("max@example.com")).toBeInTheDocument();
    expect(screen.getByText("$1,000.00")).toBeInTheDocument();
    expect(
      await screen.findByText("max@example.com added a note"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toBeEnabled();
    expect(screen.queryByText("Shared demo account")).not.toBeInTheDocument();
  });

  it("locks the forms of a shared demo account and says why", () => {
    renderAs({ demo_account: true, role: "admin", decision_limit: null });
    expect(screen.getByText("Shared demo account")).toBeInTheDocument();
    expect(screen.getByText("No limit")).toBeInTheDocument();
    expect(screen.getByLabelText("First name")).toBeDisabled();
    expect(screen.getByLabelText("Current password")).toBeDisabled();
  });

  it("says when there is no activity yet", async () => {
    vi.mocked(authApi.getActivity).mockResolvedValue([]);
    renderAs({ role: "customer", decision_limit: 0 });
    expect(await screen.findByText(/Nothing yet/)).toBeInTheDocument();
    expect(
      screen.getByText("Customers do not decide payments"),
    ).toBeInTheDocument();
  });
});
