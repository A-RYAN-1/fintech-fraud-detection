import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/hooks";
import { Skeleton } from "@/components/ui";
import { homePathFor } from "@/config";

interface GuestGuardProps {
  children: ReactNode;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto">
          <Skeleton className="w-full h-full" variant="circular" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-3 w-24 mx-auto" />
        </div>
      </div>
    </div>
  );
}

export default function GuestGuard({ children }: GuestGuardProps) {
  const { user, isAuthenticated, isInitialized, isLoading, checkSession } =
    useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!isInitialized) {
      checkSession();
    }
  }, [isInitialized, checkSession]);

  // Show loading while checking session
  if (!isInitialized || isLoading) {
    return <LoadingScreen />;
  }

  // Redirect to dashboard if already authenticated
  if (isAuthenticated) {
    const from =
      (location.state as { from?: Location })?.from?.pathname ||
      homePathFor(user?.role);
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
}
