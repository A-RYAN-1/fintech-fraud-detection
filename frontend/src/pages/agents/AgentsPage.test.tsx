import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import { agentsApi, type AgentMandate } from "@/features/agents";
import AgentsPage from "./AgentsPage";

const mandate: AgentMandate = {
  id: 3,
  label: "Groceries agent",
  merchant: "Sentrix Demo Store",
  per_payment_cap: "50.0",
  total_cap: "200.0",
  spent_amount: "80.0",
  remaining: "120.0",
  status: "active",
  expires_at: "2026-11-20T10:00:00Z",
  revoked_at: null,
  last_used_at: null,
  token_hint: "ab12",
  owner_email: null,
};

function mockList(rows: AgentMandate[], scope: "mine" | "all" = "mine") {
  return vi
    .spyOn(agentsApi, "list")
    .mockResolvedValue({ mandates: rows, scope });
}

describe("AgentsPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an empty state when there are no mandates", async () => {
    mockList([]);
    renderWithProviders(<AgentsPage />);
    expect(await screen.findByText("No mandates yet")).toBeInTheDocument();
  });

  it("shows spent and remaining for a mandate", async () => {
    mockList([mandate]);
    renderWithProviders(<AgentsPage />);
    expect(await screen.findByText("Groceries agent")).toBeInTheDocument();
    expect(screen.getByText(/\$80\.00 of \$200\.00 used/)).toBeInTheDocument();
    expect(screen.getByText(/\$120\.00 left/)).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText(/token ending ab12/)).toBeInTheDocument();
  });

  it("shows the owner when staff see every mandate", async () => {
    mockList([{ ...mandate, owner_email: "test@example.com" }], "all");
    renderWithProviders(<AgentsPage />);
    expect(
      await screen.findByText(/given by test@example\.com/),
    ).toBeInTheDocument();
    expect(screen.getByText("All mandates")).toBeInTheDocument();
  });

  it("creates a mandate and shows the token once", async () => {
    mockList([]);
    const create = vi
      .spyOn(agentsApi, "create")
      .mockResolvedValue({ ...mandate, token: "smt_secret_value" });
    const user = userEvent.setup();
    renderWithProviders(<AgentsPage />);

    await user.type(await screen.findByLabelText("Agent name"), "Trip agent");
    await user.click(screen.getByRole("button", { name: "Create mandate" }));

    expect(await screen.findByTestId("mandate-token")).toHaveTextContent(
      "smt_secret_value",
    );
    expect(create).toHaveBeenCalledWith({
      label: "Trip agent",
      merchant: "Sentrix Demo Store",
      per_payment_cap: "50",
      total_cap: "200",
      expires_in_days: 7,
    });

    await user.click(screen.getByRole("button", { name: "I have saved it" }));
    expect(screen.queryByTestId("mandate-token")).not.toBeInTheDocument();
  });

  it("revokes an active mandate", async () => {
    mockList([mandate]);
    const revoke = vi
      .spyOn(agentsApi, "revoke")
      .mockResolvedValue({ ...mandate, status: "revoked" });
    const user = userEvent.setup();
    renderWithProviders(<AgentsPage />);

    await user.click(await screen.findByRole("button", { name: "Revoke" }));
    expect(revoke).toHaveBeenCalledWith(3);
  });

  it("offers no revoke button on a revoked mandate", async () => {
    mockList([{ ...mandate, status: "revoked", revoked_at: "2026-11-02T10:00:00Z" }]);
    renderWithProviders(<AgentsPage />);
    expect(await screen.findByText("revoked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();
  });
});
