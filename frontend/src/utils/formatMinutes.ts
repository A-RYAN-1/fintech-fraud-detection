export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "none yet";
  if (minutes < 1) return "under a minute";
  if (minutes < 90) return `${Math.round(minutes)} min`;
  return `${(minutes / 60).toFixed(1)} h`;
}
