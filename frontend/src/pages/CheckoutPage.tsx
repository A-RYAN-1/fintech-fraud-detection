import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui";
import { PageTransition } from "@/components/common";
import { useDeviceId } from "@/features/auth";
import {
  PayPalCheckout,
  PaymentOutcome,
  type SettledPayment,
} from "@/features/checkout";

const MIN_AMOUNT = 0.01;
const MAX_AMOUNT = 10000;

export default function CheckoutPage() {
  const { deviceId } = useDeviceId();
  const [amountText, setAmountText] = useState("49.00");
  const [payment, setPayment] = useState<SettledPayment | null>(null);

  const amount = Number(amountText);
  const valid =
    Number.isFinite(amount) && amount >= MIN_AMOUNT && amount <= MAX_AMOUNT;

  return (
    <PageTransition>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Checkout
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Pay with the PayPal sandbox. Every payment is authorized, scored,
            then captured, held or voided by the agent.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pay</CardTitle>
              <CardDescription>
                Sandbox money only. Use the sandbox buyer account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <Input
                  id="amount"
                  inputMode="decimal"
                  value={amountText}
                  onChange={(e) => {
                    setAmountText(e.target.value);
                    setPayment(null);
                  }}
                  aria-invalid={!valid}
                  aria-describedby="amount-help"
                />
                <p
                  id="amount-help"
                  className={
                    valid
                      ? "text-xs text-neutral-500"
                      : "text-xs text-red-600 dark:text-red-400"
                  }
                >
                  Between {MIN_AMOUNT} and {MAX_AMOUNT.toLocaleString()}. Larger
                  amounts are held for review.
                </p>
              </div>
              {valid && deviceId ? (
                <PayPalCheckout
                  amount={amount}
                  deviceId={deviceId}
                  onSettled={setPayment}
                />
              ) : (
                <p className="text-sm text-neutral-500">
                  Enter a valid amount to see the PayPal buttons.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Result</CardTitle>
              <CardDescription>What the agent decided and why.</CardDescription>
            </CardHeader>
            <CardContent>
              {payment ? (
                <PaymentOutcome payment={payment} />
              ) : (
                <p className="text-sm text-neutral-500">
                  Complete a payment to see the decision here.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}
