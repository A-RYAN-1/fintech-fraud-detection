import { useState, type FormEvent } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from "@/components/ui";
import { useSendAppeal } from "../hooks";
import type { Transaction } from "@/types";

const MAX = 250;
const MIN = 5;

interface AppealDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// One short note to the person reviewing a held payment. It changes nothing about the payment: a person still decides.
export default function AppealDialog({
  transaction,
  open,
  onOpenChange,
}: AppealDialogProps) {
  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send a note to the reviewer</DialogTitle>
          <DialogDescription>
            Your payment is waiting for a person to review it. Tell them
            anything that helps, for example that you are travelling or changed
            device. You can send one note. It does not approve the payment by
            itself.
          </DialogDescription>
        </DialogHeader>
        {/* The form mounts each time the dialog opens, so the note starts empty. */}
        <AppealForm
          transactionId={transaction.id}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AppealForm({
  transactionId,
  onDone,
}: {
  transactionId: string;
  onDone: () => void;
}) {
  const { mutate: send, isPending } = useSendAppeal();
  const [note, setNote] = useState("");

  const trimmed = note.trim();
  const valid = trimmed.length >= MIN;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    send({ transactionId, note: trimmed }, { onSuccess: onDone });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="appeal-note">Your note</Label>
        <Textarea
          id="appeal-note"
          rows={4}
          maxLength={MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
          {trimmed.length} of {MAX} characters. Do not include card numbers or
          passwords.
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid || isPending}>
          Send note
        </Button>
      </DialogFooter>
    </form>
  );
}
