import type { UserRole } from "@/types";

export interface FaqEntry {
  question: string;
  answer: string;
  /** Roles that see the entry; everyone when left out. */
  roles?: UserRole[];
}

const STAFF: UserRole[] = ["analyst", "reviewer", "admin"];
const DECIDERS: UserRole[] = ["reviewer", "admin"];

/**
 * Answers written from the code (risk_rule_config.rb, agent_action_policy.rb,
 * ai_analyst.rb, review_queue_controller.rb, application_controller.rb).
 * The amounts are the shipped defaults; an admin can change the rules.
 */
const FAQ: FaqEntry[] = [
  {
    question: "Is this real money?",
    answer:
      "No. Payments run in the PayPal sandbox, so PayPal's test buyers and the simulated payments move no real money.",
  },
  {
    question: "How is a payment decided?",
    answer:
      "PayPal first authorizes the money. Sentrix then scores the payment with its risk rules (amount against your usual spend, how fast payments arrive, a new or missing device), adds a second score from a trained model and, when it is switched on, asks an AI analyst for a verdict. A blocked payment is voided at PayPal, a flagged one is held for a person, and a safe one inside the auto-capture limits is captured.",
  },
  {
    question: "Why was my payment held?",
    answer:
      "The rules score reached the flag level (30 by default), the model flagged it, the AI analyst asked for a review, or the amount was above what the agent may capture alone ($1,000 per payment and $5,000 a day by default). A reviewer or an admin then captures or voids it.",
  },
  {
    question: "Why was my payment blocked?",
    answer:
      "Its rules score reached the block level (70 by default). Sentrix voids the PayPal authorization, so nothing is charged. The model and the AI analyst can only ask for a hold; they never block on their own.",
  },
  {
    question: "What does the AI analyst see, and what can it do?",
    answer:
      "Only listed facts: amount and risk bands, rule names and model reasons, never names, emails, IP addresses or device ids. Its answer must fit a fixed format or it is thrown away. It can confirm a decision or ask for a human, but it never voids a payment or lifts a hold. If it is slow or fails, the rules decision stands alone.",
  },
  {
    question: "Why was I signed out?",
    answer:
      "A session ends after 10 minutes without activity. Sign in again; nothing you finished is lost.",
  },
  {
    question: "How do I change my name or password?",
    answer:
      "Open Profile. The shared demo accounts on the sign-in page are read-only, so register your own account to try it.",
  },
  {
    question: "What is my decision limit?",
    answer:
      "The largest payment a reviewer may capture or void alone: $1,000 unless an admin set another amount. Above it, the action becomes a request that an admin settles on the Approvals page. Admins have no limit; analysts advise and do not decide.",
    roles: STAFF,
  },
  {
    question: "Why does a refund need a second person?",
    answer:
      "Asking for a refund raises a request that a different admin settles. Refunds on one payment add up and can never pass the captured amount.",
    roles: DECIDERS,
  },
  {
    question: "Where do the Feedback numbers come from?",
    answer:
      "When a person captures or voids a held payment, that decision becomes the label (approve or block). A later full refund turns an approve into a block. Each signal (rules, model, AI analyst) is scored against those labels. Actions the agent took alone are not labels.",
    roles: STAFF,
  },
  {
    question: "What can the sandbox admin not do?",
    answer:
      "The shared admin login can settle requests and manage ordinary users, but it cannot change another admin, change the shared demo accounts, or make anyone an admin.",
    roles: ["admin"],
  },
];

export function faqFor(role: UserRole | undefined): FaqEntry[] {
  return FAQ.filter(
    (entry) => !entry.roles || (role && entry.roles.includes(role)),
  );
}
