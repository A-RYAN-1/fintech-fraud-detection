/**
 * The path every PayPal payment takes, one true sentence per step (read from
 * paypal_checkout.rb, risk_rules_processor.rb, ml_risk_scorer.rb,
 * ai_analyst.rb, agent_action_policy.rb and review_queue_controller.rb).
 * Shared by the sign-in page and every role's Home.
 */
export interface PipelineStep {
  key: "paypal" | "rules" | "model" | "ai" | "human" | "result";
  title: string;
  line: string;
}

export const pipelineSteps: PipelineStep[] = [
  {
    key: "paypal",
    title: "PayPal checkout",
    line: "The buyer approves in PayPal's own window. PayPal authorizes the money but does not move it yet.",
  },
  {
    key: "rules",
    title: "Risk rules",
    line: "Amount against the buyer's usual spend, payment speed and a new or missing device add up a score. 70 or more blocks, 30 or more holds.",
  },
  {
    key: "model",
    title: "Model score",
    line: "A model trained on labelled payments gives a second score with its top reasons. It can ask for a hold, never a block.",
  },
  {
    key: "ai",
    title: "AI analyst",
    line: "Gemini reads the facts, never personal data, and explains its verdict in words. It can confirm or escalate, never void or release.",
  },
  {
    key: "human",
    title: "Human gate",
    line: "A reviewer decides a held payment within a decision limit; above it, or for a refund, an admin settles.",
  },
  {
    key: "result",
    title: "Capture or void",
    line: "Sentrix makes the PayPal call: capture charges the buyer, void releases the hold. Every step is in the audit log.",
  },
];
