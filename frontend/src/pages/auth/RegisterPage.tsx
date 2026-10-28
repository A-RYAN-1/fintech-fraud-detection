import { Navigate } from "react-router-dom";
import { homePathFor } from "@/config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { AuthLayout, RegisterForm } from "@/features/auth/components";
import { useAuth } from "@/features/auth/hooks";

export default function RegisterPage() {
  const { user, isAuthenticated, isInitialized } = useAuth();

  // Redirect if already authenticated
  if (isInitialized && isAuthenticated) {
    return <Navigate to={homePathFor(user?.role)} replace />;
  }

  return (
    <AuthLayout>
      <Card>
        <CardHeader>
          <CardTitle>Create an account</CardTitle>
          <CardDescription>
            New accounts are customers. Staff accounts are set up by an admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
