import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountRingPanel } from "./AccountRingPanel";
import { reviewApi, type AccountRing } from "../api";

function renderPanel() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <AccountRingPanel paymentId="abc" />
    </QueryClientProvider>,
  );
}

const ring: AccountRing = {
  size: 3,
  depth: 2,
  devices_shared: 1,
  window_days: 30,
  members: [
    {
      user_id: 2,
      email: "b@example.com",
      hops: 1,
      payments: 3,
      captured: 1,
      voided: 1,
    },
    {
      user_id: 3,
      email: "c@example.com",
      hops: 2,
      payments: 1,
      captured: 0,
      voided: 0,
    },
  ],
};

describe("AccountRingPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("does not load anything until asked", () => {
    const spy = vi.spyOn(reviewApi, "ring");
    renderPanel();

    expect(spy).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Linked accounts" }),
    ).toBeInTheDocument();
  });

  it("lists the linked accounts and what a person did with their payments", async () => {
    vi.spyOn(reviewApi, "ring").mockResolvedValue(ring);
    renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "Linked accounts" }),
    );

    expect(await screen.findByText("b@example.com")).toBeInTheDocument();
    expect(screen.getByText(/2 other accounts linked/)).toBeInTheDocument();
    expect(screen.getByText("1 voided by a person")).toBeInTheDocument();
    expect(screen.getByText(/^2 hops,/)).toBeInTheDocument();
  });

  it("says plainly when there is no ring", async () => {
    vi.spyOn(reviewApi, "ring").mockResolvedValue({
      ...ring,
      size: 1,
      depth: 0,
      members: [],
    });
    renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: "Linked accounts" }),
    );

    expect(
      await screen.findByText(/No other account paid from this customer/),
    ).toBeInTheDocument();
  });
});
