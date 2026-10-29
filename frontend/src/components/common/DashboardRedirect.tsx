import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks";

/** /dashboard was one page for everyone; customers now have My Spending and staff Insights. */
export default function DashboardRedirect() {
  const { user } = useAuth();
  return (
    <Navigate to={user?.role === "customer" ? "/spending" : "/insights"} replace />
  );
}
