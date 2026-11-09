import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import AuthGuard from "./AuthGuard";

// Mock useAuth
vi.mock("@/features/auth/hooks", () => ({
  useAuth: vi.fn(),
}));

let mockPath = "/protected";

// Mock Navigate
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => (
      <div data-testid="navigate" data-to={to} />
    ),
    useLocation: () => ({ pathname: mockPath, state: null }),
  };
});

import { useAuth } from "@/features/auth/hooks";

const mockUseAuth = vi.mocked(useAuth);

describe("AuthGuard", () => {
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
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("redirects to login when not authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: true,
      checkSession: mockCheckSession,
      logout: vi.fn(),
    });

    renderWithProviders(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/login");
  });

  it("sends a guest at the site root to the public tour", () => {
    mockPath = "/";
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: true,
      checkSession: mockCheckSession,
      logout: vi.fn(),
    });

    renderWithProviders(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/tour");
    mockPath = "/protected";
  });

  it("renders children when authenticated", () => {
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
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
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
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(mockCheckSession).toHaveBeenCalled();
  });
});
