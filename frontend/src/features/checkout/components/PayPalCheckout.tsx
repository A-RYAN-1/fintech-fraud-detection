import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { getErrorMessage } from "@/types";
import { checkoutApi, type SettledPayment } from "../api";
import { usePayPalSdk } from "../hooks";

interface PayPalCheckoutProps {
  amount: number;
  deviceId: string;
  onSettled: (payment: SettledPayment) => void;
}

// The amount lives in a ref so the buttons are rendered once and still read the latest value when clicked.
export function PayPalCheckout({
  amount,
  deviceId,
  onSettled,
}: PayPalCheckoutProps) {
  const { status, configured } = usePayPalSdk();
  const container = useRef<HTMLDivElement>(null);
  const amountRef = useRef(amount);
  const callback = useRef(onSettled);

  useEffect(() => {
    amountRef.current = amount;
    callback.current = onSettled;
  });

  useEffect(() => {
    const target = container.current;
    if (status !== "ready" || !window.paypal || !target) return;

    const buttons = window.paypal.Buttons({
      style: { layout: "vertical", shape: "rect", label: "pay" },
      createOrder: async () => {
        const order = await checkoutApi.createOrder(
          amountRef.current,
          deviceId,
        );
        return order.order_id;
      },
      onApprove: async ({ orderID }) => {
        const payment = await checkoutApi.authorizeOrder(orderID);
        callback.current(payment);
      },
      onError: (error) => {
        toast.error("Payment could not be completed", {
          description: getErrorMessage(error),
        });
      },
      onCancel: () => toast.info("Payment cancelled, nothing was charged"),
    });
    void buttons.render(target);
    return () => {
      void buttons.close();
    };
  }, [status, deviceId]);

  if (!configured) {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        PayPal checkout is not configured for this deployment.
      </p>
    );
  }
  if (status === "error") {
    return (
      <p className="text-sm text-red-600 dark:text-red-400">
        PayPal could not be loaded. Check your connection and reload.
      </p>
    );
  }
  return <div ref={container} aria-label="PayPal payment buttons" />;
}
