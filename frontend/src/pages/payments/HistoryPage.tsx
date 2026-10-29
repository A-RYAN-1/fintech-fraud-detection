import { PageHeader } from "@/components/common";
import HistoryTab from "./HistoryTab";

export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="History"
        description="Every payment you made, its PayPal status and the decision Sentrix reached."
      />
      <HistoryTab />
    </div>
  );
}
