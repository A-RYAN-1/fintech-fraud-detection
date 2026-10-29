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
    description:
      "Pay with PayPal's buttons, then see the rules, model and AI analyst verdict on your payment.",
  },
  {
    role: "reviewer",
    label: "Reviewer",
    email: "judge.reviewer@sentrix.demo",
    password: "password123",
    description:
      "Read the model score and AI verdict on held payments, then capture or void at PayPal up to $5,000.",
  },
  {
    role: "admin",
    label: "Admin",
    email: "judge.admin@sentrix.demo",
    password: "password123",
    description:
      "Settle requests above a reviewer's limit and PayPal refunds, see how the AI and model scored, manage users. Cannot change other admins.",
  },
];
