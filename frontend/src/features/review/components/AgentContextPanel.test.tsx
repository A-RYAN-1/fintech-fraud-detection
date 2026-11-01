import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/test-utils";
import { agentsApi } from "@/features/agents";
import { AgentContextPanel } from "./AgentContextPanel";
import type { AgentContext } from "../api";

const agent: AgentContext = {
  mandate_id: 3,
  label: "Groceries agent",
  merchant: "Sentrix Demo Store",
  status: "active",
  per_payment_cap: 50,
  total_cap: 200,
  spent_amount: 80,
  remaining: 120,
  expires_at: "2026-11-20T10:00:00Z",
};

describe("AgentContextPanel", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("shows the permission the payment was made under", () => {
    renderWithProviders(<AgentContextPanel agent={agent} />);
    expect(
      screen.getByText(/Paid by an agent: Groceries agent/),
    ).toBeInTheDocument();
    expect(screen.getByText("Mandate active")).toBeInTheDocument();
    expect(
      screen.getByText(/\$80\.00 used, \$120\.00 left/),
    ).toBeInTheDocument();
    expect(screen.getByText(/still checked by the rules/)).toBeInTheDocument();
  });

  it("revokes the mandate from the case", async () => {
    const revoke = vi.spyOn(agentsApi, "revoke").mockResolvedValue({} as never);
    renderWithProviders(<AgentContextPanel agent={agent} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Revoke this mandate" }),
    );
    expect(revoke).toHaveBeenCalledWith(3);
  });

  it("offers no revoke once the mandate is revoked", () => {
    renderWithProviders(
      <AgentContextPanel agent={{ ...agent, status: "revoked" }} />,
    );
    expect(screen.getByText("Mandate revoked")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Revoke this mandate" }),
    ).not.toBeInTheDocument();
  });
});
