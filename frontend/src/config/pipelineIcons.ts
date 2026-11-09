import {
  CircleCheck,
  Cpu,
  ListChecks,
  Sparkles,
  UserCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { PipelineStep } from "./pipeline";

/** One icon per pipeline step, shared by sign-in, Home and the tour. */
export const pipelineIcons: Record<PipelineStep["key"], LucideIcon> = {
  paypal: Wallet,
  rules: ListChecks,
  model: Cpu,
  ai: Sparkles,
  human: UserCheck,
  result: CircleCheck,
};
