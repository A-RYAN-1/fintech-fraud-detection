import { PageHeader } from "@/components/common";
import PayTab from "./PayTab";

export default function PayPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Pay"
        description="Pay with PayPal in the sandbox. Sentrix checks the payment with its rules, a model score and an AI analyst before PayPal captures the money."
      />
      <PayTab />
    </div>
  );
}
