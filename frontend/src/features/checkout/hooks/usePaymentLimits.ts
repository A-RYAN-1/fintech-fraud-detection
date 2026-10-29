import { useQuery } from "@tanstack/react-query";
import { checkoutApi } from "../api";

export function usePaymentLimits() {
  return useQuery({
    queryKey: ["payment-limits"],
    queryFn: checkoutApi.limits,
    staleTime: 60_000,
  });
}
