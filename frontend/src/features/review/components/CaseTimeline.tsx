import type { TimelineEntry, TimelineImpact } from "@/features/checkout";

const SIGNAL_LABELS: Record<string, string> = {
  amount: "Amount",
  device: "Device",
  velocity: "Velocity",
  time_of_day: "Time of day",
  history: "History",
  rule_hit: "Rule hit",
  model_reason: "Model reason",
};

const IMPACT_LABELS: Record<TimelineImpact, string> = {
  raises_risk: "Raises risk",
  lowers_risk: "Lowers risk",
  neutral: "Neutral",
};

const IMPACT_STYLES: Record<TimelineImpact, string> = {
  raises_risk: "border-red-500 text-red-700 dark:text-red-400",
  lowers_risk: "border-green-600 text-green-700 dark:text-green-400",
  neutral: "border-neutral-400 text-neutral-600 dark:text-neutral-400",
};

interface CaseTimelineProps {
  entries: TimelineEntry[] | undefined;
}

export function CaseTimeline({ entries }: CaseTimelineProps) {
  if (!entries || entries.length === 0) return null;

  return (
    <div>
      <div className="mb-2 text-sm font-medium">Evidence, strongest first</div>
      <ol className="space-y-2" aria-label="Evidence timeline">
        {entries.map((entry, index) => (
          <li
            key={`${entry.signal}-${index}`}
            className={`border-l-2 pl-3 text-sm ${IMPACT_STYLES[entry.impact]}`}
          >
            <div className="font-medium">
              {SIGNAL_LABELS[entry.signal] ?? entry.signal}
              <span className="ml-2 text-xs font-normal">
                {IMPACT_LABELS[entry.impact]}
              </span>
            </div>
            <p className="text-neutral-700 dark:text-neutral-300">
              {entry.detail}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
