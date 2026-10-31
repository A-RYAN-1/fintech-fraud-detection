import { useState } from "react";
import { Button } from "@/components/ui";
import { useAccountRing } from "../hooks";

interface AccountRingPanelProps {
  paymentId: string;
}

// Loaded on request: the ring is a graph query, so the list of cases does not run it for every row.
export function AccountRingPanel({ paymentId }: AccountRingPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="text-sm">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide linked accounts" : "Linked accounts"}
      </Button>

      {open && <RingList paymentId={paymentId} />}
    </div>
  );
}

// Mounted only when opened, so a closed panel (and every list of cases) makes no request.
function RingList({ paymentId }: AccountRingPanelProps) {
  const { data, isLoading, isError } = useAccountRing(paymentId, true);

  return (
    <>
      {isLoading && (
        <p className="mt-2 text-neutral-500">Following shared devices...</p>
      )}
      {isError && (
        <p className="mt-2 text-red-700 dark:text-red-400">
          Could not load the linked accounts.
        </p>
      )}
      {data && data.members.length === 0 && (
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">
          No other account paid from this customer&apos;s devices in the last{" "}
          {data.window_days} days.
        </p>
      )}
      {data && data.members.length > 0 && (
        <div className="mt-2">
          <p className="mb-2 text-neutral-700 dark:text-neutral-300">
            {data.members.length} other{" "}
            {data.members.length === 1 ? "account" : "accounts"} linked through
            shared devices, up to {data.depth}{" "}
            {data.depth === 1 ? "hop" : "hops"} away (last {data.window_days}{" "}
            days). A link alone is weak: households share devices. Accounts a
            person already voided are the strong signal.
          </p>
          <ul className="space-y-1" aria-label="Linked accounts">
            {data.members.map((member) => (
              <li
                key={member.user_id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-l-2 border-neutral-300 pl-3 dark:border-neutral-700"
              >
                <span className="font-medium">{member.email}</span>
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  {member.hops === 1 ? "same device" : `${member.hops} hops`},{" "}
                  {member.payments} payments, {member.captured} captured,{" "}
                  <span
                    className={
                      member.voided > 0
                        ? "font-medium text-red-700 dark:text-red-400"
                        : ""
                    }
                  >
                    {member.voided} voided by a person
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
