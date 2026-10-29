import { Button } from "@/components/ui";
import { cn } from "@/utils";
import type { ComparisonPeriod } from "../types";

interface PeriodSelectorProps {
  value: ComparisonPeriod;
  onChange: (period: ComparisonPeriod) => void;
}

const periods: { value: ComparisonPeriod; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
];

export default function PeriodSelector({
  value,
  onChange,
}: PeriodSelectorProps) {
  return (
    <div className="inline-flex rounded-lg border border-neutral-200 dark:border-neutral-800 p-1 bg-neutral-100 dark:bg-neutral-900">
      {periods.map((period) => (
        <Button
          key={period.value}
          variant="ghost"
          size="sm"
          onClick={() => onChange(period.value)}
          className={cn(
            "h-8 px-3 text-xs font-medium transition-all",
            value === period.value
              ? "bg-white dark:bg-neutral-800 shadow-sm text-neutral-900 dark:text-neutral-100"
              : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100",
          )}
        >
          {period.label}
        </Button>
      ))}
    </div>
  );
}
