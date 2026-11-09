import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GuideStrip from "./GuideStrip";

vi.mock("@/features/auth/hooks", () => ({ useAuth: vi.fn() }));
import { useAuth } from "@/features/auth/hooks";

function show(role: string, path: string) {
  vi.mocked(useAuth).mockReturnValue({
    user: { role },
  } as unknown as ReturnType<typeof useAuth>);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GuideStrip />
    </MemoryRouter>,
  );
}

describe("GuideStrip", () => {
  beforeEach(() => vi.clearAllMocks());

  it("says where a reviewer is on the path and links to the next page", () => {
    show("reviewer", "/admin/review");
    expect(screen.getByText("Step 2 of 4: Review Queue")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Next: Feedback/ }),
    ).toHaveAttribute("href", "/admin/feedback");
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute(
      "href",
      "/home",
    );
  });

  it("ends an admin's path with a link back to the tour", () => {
    show("admin", "/admin/audit-logs");
    expect(
      screen.getByRole("link", { name: "Back to the tour" }),
    ).toHaveAttribute("href", "/tour");
  });

  it("stays out of the way on a page that is not on the path", () => {
    const { container } = show("customer", "/profile");
    expect(container).toBeEmptyDOMElement();
  });

  it("can be hidden and brought back, and remembers the choice", async () => {
    show("customer", "/pay");
    await userEvent.click(
      screen.getByRole("button", { name: "Hide the guide" }),
    );
    expect(screen.queryByLabelText("Guided tour")).toBeNull();
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      "sentrix-guide-hidden",
      "1",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Show the guide \(2 of 4\)/ }),
    );
    expect(screen.getByLabelText("Guided tour")).toBeInTheDocument();
  });
});
