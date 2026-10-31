import { Navigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { homePathFor } from "@/config";
import ThemeToggle from "@/components/common/ThemeToggle";
import { RegisterForm } from "@/features/auth/components";
import { useAuth } from "@/features/auth/hooks";

/**
 * Register page: one compact centred card, the same chrome as the sign-in
 * card (brand, theme toggle, one panel), so the two pages feel like one flow.
 */
export default function RegisterPage() {
  const { user, isAuthenticated, isInitialized } = useAuth();

  // Redirect if already authenticated
  if (isInitialized && isAuthenticated) {
    return <Navigate to={homePathFor(user?.role)} replace />;
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-6 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <section
        aria-labelledby="register-heading"
        className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-soft dark:border-neutral-800 dark:bg-neutral-900 sm:p-6"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-600 text-white">
            <Shield className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-xl font-semibold tracking-tight">Sentrix</span>
        </div>
        <h1
          id="register-heading"
          className="mt-4 text-xl font-semibold leading-tight"
        >
          Create an account
        </h1>
        <p className="mb-4 mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          New accounts are customers. Staff accounts are set up by an admin.
          Demo deployment on the PayPal sandbox: no real money moves.
        </p>
        <RegisterForm />
      </section>
    </main>
  );
}
