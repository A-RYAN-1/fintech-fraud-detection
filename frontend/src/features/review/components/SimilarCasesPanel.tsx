import { useState } from "react";
import { Button } from "@/components/ui";
import { useSimilarCases } from "../hooks";

interface SimilarCasesPanelProps {
  paymentId: string;
}

// Loaded on click: a request embeds the case and searches the decided ones, so a list of cases makes none.
// Evidence for the reviewer only; it never changes the payment.
export function SimilarCasesPanel({ paymentId }: SimilarCasesPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-w-0 basis-full text-sm">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {open ? "Hide similar past cases" : "Similar past cases"}
      </Button>
      {open && <SimilarCasesList paymentId={paymentId} />}
    </div>
  );
}

export function SimilarCasesList({ paymentId }: SimilarCasesPanelProps) {
  const { data, isLoading, isError } = useSimilarCases(paymentId);

  return (
    <div className="mt-2" aria-live="polite">
      {isLoading && (
        <p className="text-neutral-500 dark:text-neutral-400">
          Looking for similar cases...
        </p>
      )}
      {isError && (
        <p className="text-red-700 dark:text-red-400">
          Could not load similar cases. Try again in a minute.
        </p>
      )}
      {data && data.matches.length === 0 && (
        <p className="text-neutral-600 dark:text-neutral-400">
          No decided case is similar yet. Cases appear here once a person has
          approved or voided them.
        </p>
      )}
      {data && data.matches.length > 0 && (
        <div>
          <p className="mb-2 text-neutral-700 dark:text-neutral-300">
            {data.source === "embedding"
              ? "Nearest decided cases by the meaning of the case facts, with what a person decided."
              : "Rules-based match: decided cases that fired the same rules in the same amount band. The embedding search was not available."}
          </p>
          <ul className="space-y-1" aria-label="Similar past cases">
            {data.matches.map((match) => (
              <li
                key={match.payment_id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-l-2 border-neutral-300 pl-3 dark:border-neutral-700"
              >
                <span>
                  <span className="font-medium">
                    {match.human_outcome === "block" ? "Voided" : "Approved"}
                  </span>
                  <span className="text-neutral-700 dark:text-neutral-300">
                    , {match.amount_band_usd} USD
                    {match.rules_triggered.length > 0
                      ? `, ${match.rules_triggered.join(", ")}`
                      : ", no rule fired"}
                  </span>
                </span>
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  {match.distance === null
                    ? "same rules and band"
                    : `distance ${match.distance.toFixed(3)}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
