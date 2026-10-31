import { useState } from "react";
import { Button } from "@/components/ui";
import { useAnalystAnswer } from "../hooks";
import type { AnalystQuestion } from "../api";

interface AskAnalystPanelProps {
  paymentId: string;
}

const QUESTIONS: { key: AnalystQuestion; label: string }[] = [
  { key: "why", label: "Why this verdict?" },
  { key: "change", label: "What would change it?" },
];

// One turn with the analyst about this case. Nothing is requested until a question is clicked, and the answer
// never changes the decision, so the panel only reads.
export function AskAnalystPanel({ paymentId }: AskAnalystPanelProps) {
  const [question, setQuestion] = useState<AnalystQuestion | null>(null);

  return (
    <div className="min-w-0 flex-1 text-sm">
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Ask the analyst"
      >
        {QUESTIONS.map((q) => (
          <Button
            key={q.key}
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={question === q.key}
            onClick={() => setQuestion(question === q.key ? null : q.key)}
          >
            {q.label}
          </Button>
        ))}
      </div>

      {question && <Answer paymentId={paymentId} question={question} />}
    </div>
  );
}

// Mounted only after a click, so a list of cases makes no request and needs no query client.
function Answer({
  paymentId,
  question,
}: {
  paymentId: string;
  question: AnalystQuestion;
}) {
  const { data, isLoading, isError } = useAnalystAnswer(paymentId, question);

  return (
    <div className="mt-2" aria-live="polite">
      {isLoading && (
        <p className="text-neutral-500 dark:text-neutral-400">
          Asking the analyst...
        </p>
      )}
      {isError && (
        <p className="text-red-700 dark:text-red-400">
          Could not get an answer. Try again in a minute.
        </p>
      )}
      {data && (
        <>
          <p className="text-neutral-700 dark:text-neutral-300">
            {data.answer}
          </p>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
            {data.source === "ai"
              ? "AI analyst, from the same facts as the verdict. Advice only: it does not change the decision."
              : "Rules-only answer: the AI analyst was not available."}
          </p>
        </>
      )}
    </div>
  );
}
