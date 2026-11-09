import * as Tabs from "@radix-ui/react-tabs";
import { FileText, MessageSquareText, Network, Users } from "lucide-react";
import { cn } from "@/utils";
import { AskAnalystPanel } from "./AskAnalystPanel";
import { CaseNarrativePanel } from "./CaseNarrativePanel";
import { LinkedAccountsList } from "./AccountRingPanel";
import { SimilarCasesList } from "./SimilarCasesPanel";

const TABS = [
  {
    value: "ask",
    label: "Ask the analyst",
    icon: MessageSquareText,
    lead: "Ask about this case. The answer is advice only and never changes the decision.",
  },
  {
    value: "similar",
    label: "Similar cases",
    icon: Users,
    lead: "Decided cases closest to this one, and what a person did with them.",
  },
  {
    value: "narrative",
    label: "Case narrative",
    icon: FileText,
    lead: "A write-up to attach to your decision: summary, risk indicators and checks. Saved to the audit trail.",
  },
  {
    value: "ring",
    label: "Linked accounts",
    icon: Network,
    lead: "Other accounts that paid from this customer's devices.",
  },
] as const;

/**
 * The tools a reviewer uses to look deeper at one case, as tabs. Radix mounts only the open tab, so a list of
 * cases makes no request until a tab is opened; the narrative still drafts only on its own button.
 */
export function InvestigatePanel({ paymentId }: { paymentId: string }) {
  return (
    <Tabs.Root defaultValue="ask" className="text-sm">
      <Tabs.List
        aria-label="Investigate this case"
        className="-mx-1 flex gap-1 overflow-x-auto border-b border-neutral-200 px-1 dark:border-white/[0.06]"
      >
        {TABS.map(({ value, label, icon: Icon }) => (
          <Tabs.Trigger
            key={value}
            value={value}
            className={cn(
              "relative inline-flex shrink-0 items-center gap-1.5 rounded-t-md px-3 py-2 text-[13px] font-medium text-neutral-500 transition-colors",
              "hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-neutral-400 dark:hover:text-neutral-100",
              "data-[state=active]:text-neutral-900 dark:data-[state=active]:text-neutral-50",
              "after:absolute after:inset-x-2 after:-bottom-px after:h-0.5 after:rounded-full after:bg-transparent data-[state=active]:after:bg-brand-gradient",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {TABS.map(({ value, lead }) => (
        <Tabs.Content
          key={value}
          value={value}
          className="pt-3 focus-visible:outline-none"
        >
          <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
            {lead}
          </p>
          {value === "ask" && <AskAnalystPanel paymentId={paymentId} />}
          {value === "similar" && <SimilarCasesList paymentId={paymentId} />}
          {value === "narrative" && (
            <CaseNarrativePanel paymentId={paymentId} />
          )}
          {value === "ring" && <LinkedAccountsList paymentId={paymentId} />}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
