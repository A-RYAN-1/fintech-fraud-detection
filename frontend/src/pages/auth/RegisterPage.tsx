import { Navigate } from "react-router-dom";
import { homePathFor } from "@/config";
import { Shield } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { RegisterForm } from "@/features/auth/components";
import { useAuth } from "@/features/auth/hooks";

export default function RegisterPage() {
  const { user, isAuthenticated, isInitialized } = useAuth();

  // Redirect if already authenticated
  if (isInitialized && isAuthenticated) {
    return <Navigate to={homePathFor(user?.role)} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-950 dark:to-neutral-900">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 mb-4">
            <Shield className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Fintech Risk Engine
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            Create your secure account
          </p>
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Get started</CardTitle>
            <CardDescription>
              Create an account to start monitoring transactions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RegisterForm />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-neutral-500 dark:text-neutral-400 mt-6">
          By creating an account, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
