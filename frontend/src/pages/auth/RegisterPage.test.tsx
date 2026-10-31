import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui";
import { renderWithProviders } from "@/test/test-utils";
import RegisterPage from "./RegisterPage";

describe("RegisterPage", () => {
  it("is one compact card with the form, the sandbox note and a way back to sign in", () => {
    renderWithProviders(
      <TooltipProvider>
        <RegisterPage />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Create an account" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByText(/no real money moves/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create account/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.queryByText(/how a payment is decided/i)).toBeNull();
  });
});
