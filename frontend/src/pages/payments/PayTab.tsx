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
  SimulatePayment,
  type SettledPayment,
} from "@/features/checkout";

const MIN_AMOUNT = 0.01;
const MAX_AMOUNT = 10000;

export default function PayTab() {
  const { deviceId } = useDeviceId();
  const [amountText, setAmountText] = useState("49.00");
  const [payment, setPayment] = useState<SettledPayment | null>(null);

  const amount = Number(amountText);
  const valid =
    Number.isFinite(amount) && amount >= MIN_AMOUNT && amount <= MAX_AMOUNT;

  return (
    <PageTransition>
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Pay</CardTitle>
              <CardDescription>
                Every payment is judged by the rules, the risk model and the AI
                analyst into one verdict, inside the limits the admin set.
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
                <div className="space-y-5">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Pay with PayPal</p>
                    <p className="text-xs text-neutral-500">
                      Sandbox money only. Use the sandbox buyer account.
                    </p>
                    <PayPalCheckout
                      amount={amount}
                      deviceId={deviceId}
                      onSettled={setPayment}
                    />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-neutral-500">
                    <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                    or
                    <span className="h-px flex-1 bg-neutral-200 dark:bg-neutral-800" />
                  </div>
                  <SimulatePayment
                    amount={amount}
                    deviceId={deviceId}
                    onSettled={setPayment}
                  />
                </div>
              ) : (
                <p className="text-sm text-neutral-500">
                  Enter a valid amount to pay.
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
