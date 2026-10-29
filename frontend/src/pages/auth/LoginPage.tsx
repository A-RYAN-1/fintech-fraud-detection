import { Navigate } from "react-router-dom";
import { homePathFor } from "@/config";
import { LoginFlipCard } from "@/features/auth/components";
import { useAuth } from "@/features/auth/hooks";

export default function LoginPage() {
  const { user, isAuthenticated, isInitialized } = useAuth();

  // Redirect if already authenticated
  if (isInitialized && isAuthenticated) {
    return <Navigate to={homePathFor(user?.role)} replace />;
  }

  return <LoginFlipCard />;
}
