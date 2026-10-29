import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { Mail, Lock, LogIn } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { cn } from "@/utils";
import { demoAccounts } from "@/config";
import { loginSchema, type LoginFormData } from "../schemas";
import { useLogin } from "../hooks";

export default function LoginForm() {
  const emailInputRef = useRef<HTMLInputElement>(null);
  const { mutate: login, isPending } = useLogin();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Auto-focus email field on mount
  useEffect(() => {
    emailInputRef.current?.focus();
  }, []);

  const onSubmit = (data: LoginFormData) => {
    login(data);
  };

  const fillDemo = (email: string, password: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", password, { shouldValidate: true });
  };

  const { ref: emailRef, ...emailRegister } = register("email");

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" required>
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              error={!!errors.email}
              className="pl-10"
              {...emailRegister}
              ref={(e) => {
                emailRef(e);
                (
                  emailInputRef as React.MutableRefObject<HTMLInputElement | null>
                ).current = e;
              }}
            />
          </div>
          {errors.email && (
            <p className="text-sm text-danger-600 dark:text-danger-400">
              {errors.email.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" required>
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              error={!!errors.password}
              className="pl-10"
              {...register("password")}
            />
          </div>
          {errors.password && (
            <p className="text-sm text-danger-600 dark:text-danger-400">
              {errors.password.message}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" isLoading={isPending}>
          {!isPending && <LogIn className="h-4 w-4 mr-2" />}
          Sign In
        </Button>

        <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
          Don't have an account?{" "}
          <Link
            to="/register"
            className={cn(
              "font-medium text-primary-600 hover:text-primary-700",
              "dark:text-primary-400 dark:hover:text-primary-300",
            )}
          >
            Create one
          </Link>
        </p>
      </form>

      <section
        aria-labelledby="demo-logins"
        className="mt-6 border-t border-neutral-200 pt-5 dark:border-neutral-800"
      >
        <h2
          id="demo-logins"
          className="text-sm font-medium text-neutral-900 dark:text-neutral-100"
        >
          Sandbox demo logins
        </h2>
        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          For judges and visitors. Fills the form; nothing is sent until you
          sign in.
        </p>
        <ul className="mt-3 space-y-2">
          {demoAccounts.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                onClick={() => fillDemo(account.email, account.password)}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-left transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:border-neutral-700 dark:hover:bg-neutral-800 dark:focus-visible:ring-offset-neutral-900"
              >
                <span className="block text-sm font-medium">
                  {account.label}
                </span>
                <span className="block text-xs text-neutral-600 dark:text-neutral-400">
                  {account.description}
                </span>
                <span className="mt-1 block font-mono text-xs text-neutral-500 dark:text-neutral-400">
                  {account.email} / {account.password}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
