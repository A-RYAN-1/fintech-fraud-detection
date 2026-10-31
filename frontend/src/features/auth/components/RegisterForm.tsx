import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { Mail, Lock, User, Eye, EyeOff, UserPlus } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { cn } from "@/utils";
import { registerSchema, type RegisterFormData } from "../schemas";
import { useRegister } from "../hooks";

export default function RegisterForm() {
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { mutate: registerUser, isPending } = useRegister();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      password_confirmation: "",
    },
  });

  const password = watch("password");

  // Auto-focus first name field on mount
  useEffect(() => {
    firstNameInputRef.current?.focus();
  }, []);

  const onSubmit = (data: RegisterFormData) => {
    registerUser(data);
  };

  const { ref: firstNameRef, ...firstNameRegister } = register("first_name");

  // Password strength indicator
  const getPasswordStrength = (
    pwd: string,
  ): { strength: number; label: string; color: string } => {
    if (!pwd) return { strength: 0, label: "", color: "" };

    let strength = 0;
    if (pwd.length >= 8) strength += 25;
    if (/[a-z]/.test(pwd)) strength += 25;
    if (/[A-Z]/.test(pwd)) strength += 25;
    if (/\d/.test(pwd)) strength += 15;
    if (/[^a-zA-Z\d]/.test(pwd)) strength += 10;

    if (strength < 50)
      return { strength, label: "Weak", color: "bg-danger-500" };
    if (strength < 75)
      return { strength, label: "Fair", color: "bg-warning-500" };
    if (strength < 100)
      return { strength, label: "Good", color: "bg-primary-500" };
    return { strength: 100, label: "Strong", color: "bg-success-500" };
  };

  const passwordStrength = getPasswordStrength(password);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="first_name" required>
            First Name
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              id="first_name"
              type="text"
              placeholder="John"
              autoComplete="given-name"
              error={!!errors.first_name}
              className="pl-10"
              {...firstNameRegister}
              ref={(e) => {
                firstNameRef(e);
                (
                  firstNameInputRef as React.MutableRefObject<HTMLInputElement | null>
                ).current = e;
              }}
            />
          </div>
          {errors.first_name && (
            <p className="text-xs text-danger-600 dark:text-danger-400">
              {errors.first_name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="last_name" required>
            Last Name
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <Input
              id="last_name"
              type="text"
              placeholder="Doe"
              autoComplete="family-name"
              error={!!errors.last_name}
              className="pl-10"
              {...register("last_name")}
            />
          </div>
          {errors.last_name && (
            <p className="text-xs text-danger-600 dark:text-danger-400">
              {errors.last_name.message}
            </p>
          )}
        </div>
      </div>

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
            {...register("email")}
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
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
            error={!!errors.password}
            className="pl-10 pr-10"
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {password && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-300",
                    passwordStrength.color,
                  )}
                  style={{ width: `${passwordStrength.strength}%` }}
                />
              </div>
              <span className="text-xs text-neutral-500 dark:text-neutral-400 w-12">
                {passwordStrength.label}
              </span>
            </div>
          </div>
        )}
        {errors.password && (
          <p className="text-sm text-danger-600 dark:text-danger-400">
            {errors.password.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password_confirmation" required>
          Confirm Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            id="password_confirmation"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
            error={!!errors.password_confirmation}
            className="pl-10 pr-10"
            {...register("password_confirmation")}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
        {errors.password_confirmation && (
          <p className="text-sm text-danger-600 dark:text-danger-400">
            {errors.password_confirmation.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" isLoading={isPending}>
        {!isPending && <UserPlus className="h-4 w-4 mr-2" />}
        Create Account
      </Button>

      <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
        Already have an account?{" "}
        <Link
          to="/login"
          className={cn(
            "font-medium text-primary-700 hover:text-primary-800",
            "dark:text-primary-400 dark:hover:text-primary-300",
          )}
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
