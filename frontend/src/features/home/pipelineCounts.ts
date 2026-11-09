import type { PipelineStep } from "@/config";
import type { HomePipeline } from "./home.api";

/** The counts shown under each pipeline step, on Home and on the public tour. */
export function countsFor(
  key: PipelineStep["key"],
  p: HomePipeline,
): [string, number][] {
  switch (key) {
    case "paypal":
      return [["authorized", p.authorized]];
    case "rules":
      return [
        ["blocked", p.rules_blocked],
        ["held", p.rules_flagged],
      ];
    case "model":
      return [["held", p.model_flagged]];
    case "ai":
      return [
        ["read", p.ai_read],
        ["escalated", p.ai_escalated],
      ];
    case "human":
      return [
        ["decided", p.human_decided],
        ["waiting", p.held],
      ];
    case "result":
      return [
        ["captured", p.captured],
        ["voided", p.voided],
        ["refunded", p.refunded],
      ];
  }
}
