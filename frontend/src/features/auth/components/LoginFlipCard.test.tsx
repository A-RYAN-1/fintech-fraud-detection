import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/components/ui";
import { renderWithProviders } from "@/test/test-utils";
import LoginFlipCard from "./LoginFlipCard";

const emailFace = () => screen.getByLabelText(/email/i).closest("section");

describe("LoginFlipCard", () => {
  it("shows the product first and the sign-in form after the flip", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TooltipProvider>
        <LoginFlipCard />
      </TooltipProvider>,
    );

    expect(
      screen.getByRole("heading", { name: /judged by AI/i }),
    ).toBeInTheDocument();
    expect(emailFace()).toHaveAttribute("inert");

    await user.click(
      screen.getByRole("button", { name: /continue to sign in/i }),
    );
    expect(emailFace()).not.toHaveAttribute("inert");
    expect(screen.getByLabelText(/email/i)).toHaveFocus();

    await user.click(screen.getByRole("button", { name: /about sentrix/i }));
    expect(emailFace()).toHaveAttribute("inert");
    expect(
      screen.getByRole("button", { name: /continue to sign in/i }),
    ).toBeInTheDocument();
  });
});
