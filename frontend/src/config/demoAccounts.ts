import type { UserRole } from "@/types";

export interface DemoAccount {
  role: UserRole;
  label: string;
  email: string;
  password: string;
  description: string;
}

/**
 * Sandbox accounts shown on the sign-in page. They exist only on the demo
 * deployment (PayPal sandbox, no real money) and are created by
 * `rake demo:judges`; the admin account is never listed.
 */
export const demoAccounts: DemoAccount[] = [
  {
    role: "customer",
    label: "Customer",
    email: "john@example.com",
    password: "password123",
    description: "Pay, see the verdict, watch your own spend.",
  },
  {
    role: "reviewer",
    label: "Reviewer",
    email: "judge.reviewer@sentrix.demo",
    password: "password123",
    description: "Approve or void held payments up to a $5,000 limit.",
  },
];
