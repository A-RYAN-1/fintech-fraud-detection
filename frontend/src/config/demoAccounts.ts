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
 * deployment (PayPal sandbox, no real money) and are created and reset by
 * `rake demo:judges`. The API keeps them read-only, and the sandbox admin
 * cannot change admins, these accounts, or make anyone an admin.
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
  {
    role: "admin",
    label: "Admin",
    email: "judge.admin@sentrix.demo",
    password: "password123",
    description:
      "Settle requests above a reviewer's limit and refunds, manage users. Sandbox admin: cannot change other admins.",
  },
];
