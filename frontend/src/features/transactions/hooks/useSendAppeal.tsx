import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { transactionsApi } from "../api";
import { TRANSACTIONS_QUERY_KEY } from "./useTransactions";
import { getErrorMessage } from "@/types";

export function useSendAppeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      transactionId,
      note,
    }: {
      transactionId: string;
      note: string;
    }) => transactionsApi.sendAppeal(transactionId, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] });
      toast.success("Note sent", {
        description: "The reviewer will see it with your payment.",
      });
    },
    onError: (error) => {
      toast.error("Could not send the note", {
        description: getErrorMessage(error),
      });
    },
  });
}
