import { useState } from "react";
import { Button } from "@/components/ui";
import { useCaseNarrative } from "../hooks";
import { GroundingNote } from "./GroundingNote";

interface CaseNarrativePanelProps {
  paymentId: string;
}

// The case narrative is drafted on click and saved as an audit row, so nothing is requested until the button is
// pressed. It is a write-up to attach to a decision; it never changes the payment.
export function CaseNarrativePanel({ paymentId }: CaseNarrativePanelProps) {
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
        {open ? "Hide case narrative" : "Draft case narrative"}
      </Button>
      {open && <Draft paymentId={paymentId} />}
    </div>
  );
}

// Mounted only after a click, so a list of cases makes no request and needs no query client.
function Draft({ paymentId }: { paymentId: string }) {
  const { data, isLoading, isError } = useCaseNarrative(paymentId);

  return (
    <div className="mt-2" aria-live="polite">
      {isLoading && (
        <p className="text-neutral-500 dark:text-neutral-400">
          Drafting the narrative...
        </p>
      )}
      {isError && (
        <p className="text-red-700 dark:text-red-400">
          Could not draft the narrative. Try again in a minute.
        </p>
      )}
      {data && (
        <div className="space-y-2 rounded-md border border-neutral-200 p-3 dark:border-neutral-700">
          <p className="text-neutral-800 dark:text-neutral-200">
            {data.summary}
          </p>
          <NarrativeList title="Risk indicators" items={data.indicators} />
          <NarrativeList
            title="Before deciding, check"
            items={data.reviewer_checks}
          />
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            {data.source === "ai"
              ? "Drafted by the AI analyst from the same facts as the verdict and saved to the audit trail. It does not change the decision."
              : data.grounding?.status === "rejected"
                ? "Rules-only narrative, saved to the audit trail."
                : "Rules-only narrative: the AI analyst was not available. Saved to the audit trail."}
          </p>
          <GroundingNote grounding={data.grounding} />
        </div>
      )}
    </div>
  );
}

function NarrativeList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="font-medium">{title}</div>
      <ul className="list-disc pl-5 text-neutral-700 dark:text-neutral-300">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
