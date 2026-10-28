import {
  createBrowserRouter,
  Navigate,
  type RouteObject,
} from "react-router-dom";
import HomeRedirect from "@/components/common/HomeRedirect";
import { AuthGuard, GuestGuard, RoleGuard } from "@/components/common";
import { MainLayout } from "@/layouts";
import {
  LoginPage,
  RegisterPage,
  DashboardPage,
  PaymentsLayout,
  PayTab,
  HistoryTab,
  RiskAnalysisPage,
  SettingsPage,
  HelpSupportPage,
  NotFoundPage,
  UsersPage,
  AuditLogsPage,
  ReviewQueuePage,
  ApprovalsPage,
  FeedbackPage,
} from "@/pages";

export const routes: RouteObject[] = [
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
        element: <HomeRedirect />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
      {
        path: "payments",
        element: (
          <RoleGuard allowedRoles={["customer"]}>
            <PaymentsLayout />
          </RoleGuard>
        ),
        children: [
          { index: true, element: <Navigate to="pay" replace /> },
          { path: "pay", element: <PayTab /> },
          { path: "history", element: <HistoryTab /> },
        ],
      },
      // Old addresses keep working.
      {
        path: "transactions",
        element: <Navigate to="/payments/history" replace />,
      },
      {
        path: "transactions/new",
        element: <Navigate to="/payments/pay" replace />,
      },
      {
        path: "checkout",
        element: <Navigate to="/payments/pay" replace />,
      },
      {
        path: "admin/review",
        element: (
          <RoleGuard allowedRoles={["admin", "reviewer", "analyst"]}>
            <ReviewQueuePage />
          </RoleGuard>
        ),
      },
      {
        path: "admin/approvals",
        element: (
          <RoleGuard allowedRoles={["admin", "reviewer", "analyst"]}>
            <ApprovalsPage />
          </RoleGuard>
        ),
      },
      {
        path: "admin/feedback",
        element: (
          <RoleGuard allowedRoles={["admin", "reviewer", "analyst"]}>
            <FeedbackPage />
          </RoleGuard>
        ),
      },
      {
        path: "risk-analysis",
        element: (
          <RoleGuard allowedRoles={["admin", "reviewer", "analyst"]}>
            <RiskAnalysisPage />
          </RoleGuard>
        ),
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
          <RoleGuard allowedRoles={["admin"]}>
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
];

export const router = createBrowserRouter(routes);
