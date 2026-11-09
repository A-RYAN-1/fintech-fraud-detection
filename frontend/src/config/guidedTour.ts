import type { UserRole } from "@/types";

export interface GuideStep {
  href: string;
  title: string;
  /** What to do on this page, in one sentence. */
  line: string;
}

/**
 * The guided path per role, in the order of the demo video: a customer pays, a reviewer reads the case and decides,
 * an admin settles requests and looks at agents, rule changes and the audit trail. Each line says what the page
 * does, read from the pages themselves.
 */
export const guidedTour: Record<UserRole, GuideStep[]> = {
  customer: [
    {
      href: "/home",
      title: "Home",
      line: "The six checks every payment goes through, with the counts for your own payments.",
    },
    {
      href: "/pay",
      title: "Pay",
      line: "Pay with PayPal's sandbox buttons. An unusual amount or a new device can get the payment held for a reviewer.",
    },
    {
      href: "/history",
      title: "History",
      line: "Open a payment to see its rules, model and AI verdict, and what is happening to your money.",
    },
    {
      href: "/agents",
      title: "Agents",
      line: "Give an AI agent a mandate: one merchant, caps and an expiry. Anything outside it is refused.",
    },
  ],
  reviewer: [
    {
      href: "/home",
      title: "Home",
      line: "How many payments wait for a person, and how the checks split recent payments.",
    },
    {
      href: "/admin/review",
      title: "Review Queue",
      line: "Read why a payment was held, ask the analyst, then capture or void it at PayPal.",
    },
    {
      href: "/admin/feedback",
      title: "Feedback",
      line: "Your decisions score the rules, the model and the analyst, and show each rule's false alarms.",
    },
    {
      href: "/admin/rules",
      title: "Rule Changes",
      line: "After an override, an agent drafts one rule change and replays it over stored payments.",
    },
  ],
  analyst: [
    {
      href: "/home",
      title: "Home",
      line: "How many payments wait for a person, and how the checks split recent payments.",
    },
    {
      href: "/admin/review",
      title: "Review Queue",
      line: "Read the evidence on a held payment and propose a decision with a note.",
    },
    {
      href: "/admin/feedback",
      title: "Feedback",
      line: "How the rules, the model and the analyst agreed with the people who decided.",
    },
  ],
  admin: [
    {
      href: "/home",
      title: "Home",
      line: "What waits for you first, and how the checks split recent payments.",
    },
    {
      href: "/admin/review",
      title: "Review Queue",
      line: "Capture or void a held payment at PayPal, with no decision limit.",
    },
    {
      href: "/agents",
      title: "Agents",
      line: "Every agent mandate, its caps and what the agent has spent; revoke one at any time.",
    },
    {
      href: "/admin/rules",
      title: "Rule Changes",
      line: "Accept or reject an agent-drafted rule change after reading its replay.",
    },
    {
      href: "/admin/audit-logs",
      title: "Audit Log",
      line: "Every human and agent action on a payment, with who did it and when, including refusals.",
    },
  ],
};
