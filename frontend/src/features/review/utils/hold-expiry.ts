export interface HoldExpiry {
  label: string;
  urgent: boolean;
}

const HOUR = 3_600_000;
const URGENT_WITHIN_HOURS = 72;

// How long a held payment (a PayPal authorization) has before it lapses. Under three days is urgent; the server
// alerts the reviewers then and voids the hold 12 hours before the end.
export function holdExpiry(
  expiresAt: string | null | undefined,
  now: Date = new Date(),
): HoldExpiry | null {
  if (!expiresAt) return null;
  const hoursLeft = (new Date(expiresAt).getTime() - now.getTime()) / HOUR;
  if (Number.isNaN(hoursLeft)) return null;
  if (hoursLeft <= 0) return { label: "Hold expired", urgent: true };
  const urgent = hoursLeft <= URGENT_WITHIN_HOURS;
  if (hoursLeft < 1) return { label: "Hold expires in under 1 hour", urgent };
  if (hoursLeft < 48) {
    return { label: `Hold expires in ${Math.floor(hoursLeft)} hours`, urgent };
  }
  return {
    label: `Hold expires in ${Math.floor(hoursLeft / 24)} days`,
    urgent,
  };
}
