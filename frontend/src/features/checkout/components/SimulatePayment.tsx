import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { TRANSACTIONS_QUERY_KEY } from "@/features/transactions";
import { getErrorMessage } from "@/types";
import { checkoutApi, type SettledPayment } from "../api";

interface SimulatePaymentProps {
  amount: number;
  deviceId: string;
  onSettled: (payment: SettledPayment) => void;
}

// A test payment that runs the same pipeline as a PayPal payment. It is labelled so nobody mistakes it for money.
export function SimulatePayment({
  amount,
  deviceId,
  onSettled,
}: SimulatePaymentProps) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => checkoutApi.simulate(amount, deviceId),
    onSuccess: (payment) => {
      void queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] });
      onSettled(payment);
    },
    onError: (error) =>
      toast.error("Simulated payment failed", {
        description: getErrorMessage(error),
      }),
  });

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        <FlaskConical className="mr-2 h-4 w-4" aria-hidden="true" />
        {mutation.isPending ? "Judging the payment..." : "Simulate payment"}
      </Button>
      <p className="text-xs text-neutral-500">
        Test payment: no money moves. It goes through the same rules, risk
        model, AI analyst and admin limits as a PayPal payment.
      </p>
    </div>
  );
}
