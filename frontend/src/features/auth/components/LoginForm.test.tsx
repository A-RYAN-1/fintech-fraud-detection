import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import { demoAccounts } from "@/config";
import LoginForm from "./LoginForm";

describe("LoginForm demo logins", () => {
  it("lists the customer, reviewer and sandbox admin logins", () => {
    renderWithProviders(<LoginForm />);

    expect(
      screen.getByRole("heading", { name: /sandbox demo logins/i }),
    ).toBeInTheDocument();
    expect(demoAccounts.map((a) => a.role)).toEqual([
      "customer",
      "reviewer",
      "admin",
    ]);
    expect(
      screen.getByRole("button", { name: /judge\.admin@sentrix\.demo/ }),
    ).toBeInTheDocument();
  });

  it("fills the form when a demo login is chosen", async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm />);

    await user.click(screen.getByRole("button", { name: /^Reviewer/ }));

    expect(screen.getByLabelText(/email/i)).toHaveValue(demoAccounts[1].email);
    expect(screen.getByLabelText(/password/i)).toHaveValue(
      demoAccounts[1].password,
    );
  });
});
