import type { Grounding } from "../api";

const KIND_LABEL: Record<Grounding["issues"][number]["kind"], string> = {
  unknown_number: "number",
  unknown_rule: "rule name",
  identifier: "identifier",
};

// One line under AI text: either it was checked against the case facts and cited nothing outside them, or the AI
// text was replaced because it did. No line when no AI text was involved.
export function GroundingNote({ grounding }: { grounding?: Grounding }) {
  if (!grounding || grounding.status === "not_applicable") return null;

  if (grounding.status === "passed") {
    return (
      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
        Checked against the case facts: every number and rule name in this text
        is in them.
      </p>
    );
  }

  const cited = grounding.issues
    .map((issue) =>
      issue.kind === "identifier"
        ? "an identifier"
        : `${KIND_LABEL[issue.kind]} ${issue.detail}`,
    )
    .join(", ");

  return (
    <p className="mt-1 text-xs text-amber-800 dark:text-amber-400">
      The AI draft was replaced because it cited something that is not in the
      case facts ({cited}).
    </p>
  );
}
