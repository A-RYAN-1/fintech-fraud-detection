import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@/components/ui";
import type { User } from "@/types";

export type PendingUserAction =
  | { kind: "role"; user: User; role: string }
  | { kind: "status"; user: User; status: string }
  | { kind: "limit"; user: User };

interface Props {
  action: PendingUserAction | null;
  onCancel: () => void;
  onRole: (userId: string, role: string) => void;
  onStatus: (userId: string, status: string) => void;
  onLimit: (userId: string, limit: string) => void;
}

const ROLE_NOTE: Record<string, string> = {
  customer: "They will only see their own payments.",
  analyst:
    "They can read payments, add notes and propose decisions, not decide.",
  reviewer:
    "They can capture or void held payments up to their decision limit.",
  admin:
    "They can decide any amount, settle approval requests and manage users.",
};

function LimitForm({
  user,
  onCancel,
  onLimit,
}: {
  user: User;
  onCancel: () => void;
  onLimit: (userId: string, limit: string) => void;
}) {
  const [value, setValue] = useState(String(user.decision_limit ?? ""));
  const invalid = value.trim() !== "" && !(Number(value) > 0);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!invalid) onLimit(user.id, value.trim());
      }}
    >
      <div className="space-y-2 py-2">
        <Label htmlFor="decision-limit">Decision limit in USD</Label>
        <Input
          id="decision-limit"
          inputMode="decimal"
          value={value}
          error={invalid}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Blank for the default"
        />
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Above this amount a decision becomes a request an admin settles. Leave
          blank to use the default.
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={invalid}>
          Save limit
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Role changes, suspensions and decision limits are confirmed here, not with window.prompt. */
export default function UserActionDialog({
  action,
  onCancel,
  onRole,
  onStatus,
  onLimit,
}: Props) {
  const name = action
    ? `${action.user.first_name} ${action.user.last_name}`
    : "";

  let title = "";
  let body = "";
  if (action?.kind === "role") {
    title = `Make ${name} ${action.role === "admin" ? "an" : "a"} ${action.role}?`;
    body = ROLE_NOTE[action.role] ?? "";
  } else if (action?.kind === "status") {
    title =
      action.status === "suspended" ? `Suspend ${name}?` : `Activate ${name}?`;
    body =
      action.status === "suspended"
        ? "They will not be able to sign in until an admin activates the account."
        : "They will be able to sign in again.";
  } else if (action?.kind === "limit") {
    title = `Decision limit for ${name}`;
    body = action.user.email;
  }

  return (
    <Dialog open={action !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>
        {action?.kind === "limit" ? (
          <LimitForm user={action.user} onCancel={onCancel} onLimit={onLimit} />
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant={
                action?.kind === "status" && action.status === "suspended"
                  ? "destructive"
                  : "default"
              }
              onClick={() => {
                if (action?.kind === "role")
                  onRole(action.user.id, action.role);
                if (action?.kind === "status")
                  onStatus(action.user.id, action.status);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
