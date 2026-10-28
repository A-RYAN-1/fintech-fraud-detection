import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import RoleGuard from "./RoleGuard";

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
  };
});

import { useAuth } from "@/features/auth/hooks";

const mockUseAuth = vi.mocked(useAuth);

describe("RoleGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders children when user has allowed role", () => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "1",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        role: "admin",
        status: "active",
      },
      isAuthenticated: true,
      isLoading: false,
      isInitialized: true,
      checkSession: vi.fn(),
      logout: vi.fn(),
    });

    renderWithProviders(
      <RoleGuard allowedRoles={["admin", "reviewer"]}>
        <div>Protected Content</div>
      </RoleGuard>,
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("redirects when user role is not allowed", () => {
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
      checkSession: vi.fn(),
      logout: vi.fn(),
    });

    renderWithProviders(
      <RoleGuard allowedRoles={["admin"]}>
        <div>Protected Content</div>
      </RoleGuard>,
    );

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(screen.getByTestId("navigate")).toHaveAttribute(
      "data-to",
      "/payments",
    );
  });

  it.each([
    ["analyst", "/admin/review"],
    ["reviewer", "/admin/review"],
    ["admin", "/admin/review"],
  ] as const)("sends a refused %s to %s", (role, path) => {
    mockUseAuth.mockReturnValue({
      user: {
        id: "1",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        role,
        status: "active",
      },
      isAuthenticated: true,
      isLoading: false,
      isInitialized: true,
      checkSession: vi.fn(),
      logout: vi.fn(),
    });

    renderWithProviders(
      <RoleGuard allowedRoles={["customer"]}>
        <div>Protected Content</div>
      </RoleGuard>,
    );

    expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", path);
  });

  it("redirects to custom path when specified", () => {
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
      checkSession: vi.fn(),
      logout: vi.fn(),
    });

    renderWithProviders(
      <RoleGuard allowedRoles={["admin"]} fallbackPath="/unauthorized">
        <div>Protected Content</div>
      </RoleGuard>,
    );

    expect(screen.getByTestId("navigate")).toHaveAttribute(
      "data-to",
      "/unauthorized",
    );
  });

  it("redirects when user is null", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: true,
      checkSession: vi.fn(),
      logout: vi.fn(),
    });

    renderWithProviders(
      <RoleGuard allowedRoles={["admin"]}>
        <div>Protected Content</div>
      </RoleGuard>,
    );

    expect(screen.getByTestId("navigate")).toBeInTheDocument();
  });
});
