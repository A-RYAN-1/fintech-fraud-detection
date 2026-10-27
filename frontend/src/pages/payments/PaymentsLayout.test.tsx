import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders, screen } from "@/test/test-utils";
import PaymentsLayout from "./PaymentsLayout";

function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="payments" element={<PaymentsLayout />}>
        <Route path="pay" element={<p>pay content</p>} />
        <Route path="history" element={<p>history content</p>} />
      </Route>
    </Routes>,
    { route },
  );
}

describe("PaymentsLayout", () => {
  it("shows the Pay and History tabs and marks the open one", () => {
    renderAt("/payments/history");

    expect(screen.getByRole("link", { name: "Pay" })).toHaveAttribute(
      "href",
      "/payments/pay",
    );
    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("history content")).toBeInTheDocument();
  });

  it("renders the Pay tab content under the same header", () => {
    renderAt("/payments/pay");

    expect(
      screen.getByRole("heading", { name: "Payments" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pay" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("pay content")).toBeInTheDocument();
  });
});
