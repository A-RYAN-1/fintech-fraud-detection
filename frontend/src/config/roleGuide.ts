import type { UserRole } from "@/types";

export interface RoleTask {
  title: string;
  href: string;
  /** What the page lets this role do, naming the PayPal call or the AI part it touches. */
  body: string;
}

export interface RoleGuide {
  label: string;
  summary: string;
  tasks: RoleTask[];
}

/** One true sentence per page a role can open; read from the controllers and services, not invented. */
export const roleGuides: Record<UserRole, RoleGuide> = {
  customer: {
    label: "Customer",
    summary:
      "You pay with PayPal in the sandbox. PayPal authorizes the money, then Sentrix checks the payment with its rules, a model score and an AI analyst before anything is captured.",
    tasks: [
      {
        title: "Pay",
        href: "/pay",
        body: "Pay with the PayPal buttons. A safe payment is captured at once, a risky one is held for a reviewer and a blocked one is voided, so nothing is charged.",
      },
      {
        title: "History",
        href: "/history",
        body: "Every payment you made, its PayPal status and the decision Sentrix reached.",
      },
      {
        title: "My Spending",
        href: "/spending",
        body: "What you were charged, what waits for a reviewer, what was voided, and which checks stopped your payments.",
      },
    ],
  },
  analyst: {
    label: "Analyst",
    summary:
      "You read the evidence on held payments and advise. A reviewer or an admin makes the PayPal call.",
    tasks: [
      {
        title: "Review Queue",
        href: "/admin/review",
        body: "Read the rules score, the model score and the AI analyst's verdict on each held payment, add a note or propose capture, void or refund.",
      },
      {
        title: "Feedback",
        href: "/admin/feedback",
        body: "See how often the rules, the model and the AI analyst agreed with the people who decided.",
      },
      {
        title: "Rule Changes",
        href: "/admin/rules",
        body: "Read the changes the agent drafted after a person overrode the rules, with the test on stored payments. An admin accepts or rejects.",
      },
      {
        title: "Incidents",
        href: "/admin/incidents",
        body: "Read the failures grouped by what went wrong, with a drafted GitHub issue for each. An admin approves a report; nothing is filed for you.",
      },
      {
        title: "Insights",
        href: "/insights",
        body: "Every payment of the period as counts: outcomes, rules score ranges, the rules that fired, the model's flag rate, the AI analyst's verdicts and time to a decision.",
      },
    ],
  },
  reviewer: {
    label: "Reviewer",
    summary:
      "You decide held payments. Your decision runs the PayPal capture or void and becomes a label that scores the rules, the model and the AI analyst.",
    tasks: [
      {
        title: "Review Queue",
        href: "/admin/review",
        body: "Capture or void a held payment at PayPal within your decision limit; above it, the action becomes a request for an admin. Ask for a refund of a captured payment.",
      },
      {
        title: "Approvals",
        href: "/admin/approvals",
        body: "See every request waiting for an admin, yours included, and how each one was decided.",
      },
      {
        title: "Feedback",
        href: "/admin/feedback",
        body: "See how often the rules, the model and the AI analyst agreed with human decisions.",
      },
      {
        title: "Rule Changes",
        href: "/admin/rules",
        body: "Read the changes the agent drafted after a person overrode the rules, with the test on stored payments. An admin accepts or rejects.",
      },
      {
        title: "Incidents",
        href: "/admin/incidents",
        body: "Read the failures grouped by what went wrong, with a drafted GitHub issue for each. An admin approves a report; nothing is filed for you.",
      },
      {
        title: "Insights",
        href: "/insights",
        body: "Every payment of the period as counts: outcomes, rules score ranges, the rules that fired, the model's flag rate, the AI analyst's verdicts and time to a decision.",
      },
    ],
  },
  admin: {
    label: "Admin",
    summary:
      "You decide held payments, settle requests above a reviewer's limit and refunds, and manage who can do what.",
    tasks: [
      {
        title: "Review Queue",
        href: "/admin/review",
        body: "Capture or void a held payment at PayPal within your decision limit, or ask for a refund of a captured one.",
      },
      {
        title: "Approvals",
        href: "/admin/approvals",
        body: "Approve or reject requests from reviewers and refunds raised by another person. Approving runs the PayPal call.",
      },
      {
        title: "Feedback",
        href: "/admin/feedback",
        body: "See how often the rules, the model and the AI analyst agreed with human decisions.",
      },
      {
        title: "Rule Changes",
        href: "/admin/rules",
        body: "Accept or reject the rule changes the agent drafted after an override. Each shows its test on stored payments; nothing changes until you accept.",
      },
      {
        title: "Incidents",
        href: "/admin/incidents",
        body: "Approve or dismiss the incident reports the agent drafted from failed PayPal calls, failed jobs and AI analyst failures. You file the GitHub issue yourself; the agent never does.",
      },
      {
        title: "Insights",
        href: "/insights",
        body: "Every payment of the period as counts: outcomes, rules score ranges, the rules that fired, the model's flag rate, the AI analyst's verdicts and time to a decision.",
      },
      {
        title: "Users",
        href: "/admin/users",
        body: "Change a person's role, status and decision limit.",
      },
      {
        title: "Audit Log",
        href: "/admin/audit-logs",
        body: "Every human and agent action on a payment, with who did it and when.",
      },
    ],
  },
};
