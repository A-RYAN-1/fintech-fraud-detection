import { createBrowserRouter, Navigate } from "react-router-dom";
import { AuthGuard, GuestGuard, RoleGuard } from "@/components/common";
import { MainLayout } from "@/layouts";
import {
  LoginPage,
  RegisterPage,
  DashboardPage,
  TransactionsPage,
  RiskAnalysisPage,
  SettingsPage,
  HelpSupportPage,
  NotFoundPage,
  UsersPage,
  AuditLogsPage,
  CheckoutPage,
  ReviewQueuePage,
} from "@/pages";

export const router = createBrowserRouter([
  // Public routes (guest only)
  {
    path: "/login",
    element: (
      <GuestGuard>
        <LoginPage />
      </GuestGuard>
    ),
  },
  {
    path: "/register",
    element: (
      <GuestGuard>
        <RegisterPage />
      </GuestGuard>
    ),
  },

  // Protected routes with layout
  {
    path: "/",
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
      {
        path: "transactions",
        element: <TransactionsPage />,
      },
      {
        path: "transactions/new",
        element: <TransactionsPage />,
      },
      {
        path: "checkout",
        element: <CheckoutPage />,
      },
      {
        path: "admin/review",
        element: (
          <RoleGuard allowedRoles={["admin", "manager"]}>
            <ReviewQueuePage />
          </RoleGuard>
        ),
      },
      {
        path: "risk-analysis",
        element: <RiskAnalysisPage />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
      {
        path: "help",
        element: <HelpSupportPage />,
      },
      // Admin routes
      {
        path: "admin/users",
        element: (
          <RoleGuard allowedRoles={["admin", "manager"]}>
            <UsersPage />
          </RoleGuard>
        ),
      },
      {
        path: "admin/audit-logs",
        element: (
          <RoleGuard allowedRoles={["admin"]}>
            <AuditLogsPage />
          </RoleGuard>
        ),
      },
    ],
  },

  // 404
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
