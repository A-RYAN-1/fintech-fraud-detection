import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import GuestGuard from "./GuestGuard";

// Mock useAuth
vi.mock("@/features/auth/hooks", () => ({
  useAuth: vi.fn(),
}));

// Mock Navigate
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => (
      <div data-testid="navigate" data-to={to} />
    ),
    useLocation: () => ({ pathname: "/login", state: null }),
  };
});

import { useAuth } from "@/features/auth/hooks";

const mockUseAuth = vi.mocked(useAuth);

describe("GuestGuard", () => {
  const mockCheckSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading screen when not initialized", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      isInitialized: false,
      checkSession: mockCheckSession,
      logout: vi.fn(),
    });

    renderWithProviders(
      <GuestGuard>
        <div>Login Form</div>
      </GuestGuard>,
    );

    expect(screen.queryByText("Login Form")).not.toBeInTheDocument();
  });

  it("redirects to the role landing page when authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "1",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        role: "customer",
        status: "active",
      },
      isAuthenticated: true,
      isLoading: false,
      isInitialized: true,
      checkSession: mockCheckSession,
      logout: vi.fn(),
    });

    renderWithProviders(
      <GuestGuard>
        <div>Login Form</div>
      </GuestGuard>,
    );

    expect(screen.getByTestId("navigate")).toHaveAttribute(
      "data-to",
      "/payments",
    );
  });

  it("renders children when not authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: true,
      checkSession: mockCheckSession,
      logout: vi.fn(),
    });

    renderWithProviders(
      <GuestGuard>
        <div>Login Form</div>
      </GuestGuard>,
    );

    expect(screen.getByText("Login Form")).toBeInTheDocument();
  });

  it("calls checkSession when not initialized", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: false,
      checkSession: mockCheckSession,
      logout: vi.fn(),
    });

    renderWithProviders(
      <GuestGuard>
        <div>Login Form</div>
      </GuestGuard>,
    );

    expect(mockCheckSession).toHaveBeenCalled();
  });
});
