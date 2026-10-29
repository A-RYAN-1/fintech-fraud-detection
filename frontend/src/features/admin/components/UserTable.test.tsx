import { beforeAll, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderWithProviders, screen } from "@/test/test-utils";
import type { User } from "@/types";
import UserTable from "./UserTable";

beforeAll(() => {
  // Radix popper constructs a ResizeObserver; the shared mock is not constructible.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.scrollIntoView ??= () => {};
});

const reviewer = {
  id: "7",
  email: "rev@example.com",
  first_name: "Rita",
  last_name: "Reviewer",
  role: "reviewer",
  status: "active",
  decision_limit: 1000,
  created_at: "2026-10-01T00:00:00Z",
} as unknown as User;

function setup() {
  const handlers = {
    onUpdateRole: vi.fn(),
    onUpdateStatus: vi.fn(),
    onUpdateLimit: vi.fn(),
  };
  renderWithProviders(<UserTable users={[reviewer]} {...handlers} />);
  return handlers;
}

async function openMenu(item: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /actions/i }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
  return user;
}

describe("UserTable dialogs", () => {
  it("asks before changing a role, and does nothing on cancel", async () => {
    const h = setup();
    const user = await openMenu(/set as admin/i);

    expect(
      await screen.findByRole("heading", {
        name: /make rita reviewer an admin/i,
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(h.onUpdateRole).not.toHaveBeenCalled();

    await openMenu(/set as admin/i);
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(h.onUpdateRole).toHaveBeenCalledWith("7", "admin");
  });

  it("sets the decision limit in a dialog, not window.prompt", async () => {
    const prompt = vi.spyOn(window, "prompt");
    const h = setup();
    const user = await openMenu(/set decision limit/i);

    const input = await screen.findByLabelText(/decision limit in usd/i);
    await user.clear(input);
    await user.type(input, "2500");
    await user.click(screen.getByRole("button", { name: /save limit/i }));

    expect(h.onUpdateLimit).toHaveBeenCalledWith("7", "2500");
    expect(prompt).not.toHaveBeenCalled();
  });

  it("refuses a limit that is not a positive number", async () => {
    const h = setup();
    const user = await openMenu(/set decision limit/i);

    const input = await screen.findByLabelText(/decision limit in usd/i);
    await user.clear(input);
    await user.type(input, "abc");

    expect(screen.getByRole("button", { name: /save limit/i })).toBeDisabled();
    expect(h.onUpdateLimit).not.toHaveBeenCalled();
  });

  it("confirms a suspension", async () => {
    const h = setup();
    const user = await openMenu(/suspend user/i);
    await user.click(screen.getByRole("button", { name: /confirm/i }));
    expect(h.onUpdateStatus).toHaveBeenCalledWith("7", "suspended");
  });
});
