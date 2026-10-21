import type { MlReason } from "@/types";

interface MlScoreSectionProps {
  score?: number | null;
  reasons?: MlReason[];
}

// The model's second opinion. It can raise a flag but never blocks, and says why in plain words.
export default function MlScoreSection({
  score,
  reasons = [],
}: MlScoreSectionProps) {
  if (score == null) return null;

  const strongest = Math.max(...reasons.map((r) => r.contribution), 0);

  return (
    <section
      className="space-y-2"
      aria-labelledby="ml-score-heading"
      data-testid="ml-score-section"
    >
      <div className="flex items-center justify-between">
        <h3
          id="ml-score-heading"
          className="text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          Model risk estimate
        </h3>
        <span className="font-bold text-neutral-900 dark:text-neutral-100">
          {(score * 100).toFixed(1)}%
        </span>
      </div>

      {reasons.length > 0 && (
        <ul className="space-y-1.5">
          {reasons.map((reason) => (
            <li key={reason.feature} className="text-xs">
              <div className="flex justify-between gap-2 text-neutral-700 dark:text-neutral-300">
                <span>{reason.label}</span>
                <span className="font-mono">
                  +{reason.contribution.toFixed(2)}
                </span>
              </div>
              <div className="mt-0.5 h-1 rounded-full bg-neutral-200 dark:bg-neutral-700">
                <div
                  className="h-full rounded-full bg-warning-500"
                  style={{
                    width: `${(reason.contribution / strongest) * 100}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        A statistical second opinion trained on synthetic data. It can raise a
        flag, never block a payment.
      </p>
    </section>
  );
}
