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
  HomePage,
  DashboardPage,
  PayPage,
  HistoryPage,
  RiskAnalysisPage,
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
        path: "home",
        element: <HomePage />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
      },
      {
        path: "pay",
        element: (
          <RoleGuard allowedRoles={["customer"]}>
            <PayPage />
          </RoleGuard>
        ),
      },
      {
        path: "history",
        element: (
          <RoleGuard allowedRoles={["customer"]}>
            <HistoryPage />
          </RoleGuard>
        ),
      },
      // Old addresses keep working.
      ...[
        ["payments", "/pay"],
        ["payments/pay", "/pay"],
        ["payments/history", "/history"],
        ["transactions", "/history"],
        ["transactions/new", "/pay"],
        ["checkout", "/pay"],
        ["settings", "/home"],
      ].map(([path, to]) => ({
        path,
        element: <Navigate to={to} replace />,
      })),
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
          <RoleGuard allowedRoles={["admin", "reviewer"]}>
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
